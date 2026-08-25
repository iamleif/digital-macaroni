#!/usr/bin/env python3
"""Fetch official product pages and store their icons and source records in Supabase."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser


USER_AGENT = os.getenv(
    "DIGITAL_MACARONI_USER_AGENT",
    "DigitalMacaroniResearchBot/0.1 (+https://digitalmacaroni.io/llm-info; mailto:hello@digitalmacaroni.io)",
)
MAX_HTML_BYTES = 2_000_000
MAX_ICON_BYTES = 2_097_152
TIMEOUT_SECONDS = 20


def load_local_environment() -> None:
    """Load only the two crawler credentials from .env.local when needed."""
    if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SECRET_KEY"):
        return
    env_path = os.path.join(os.getcwd(), ".env.local")
    try:
        with open(env_path, encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                if key not in {"SUPABASE_URL", "SUPABASE_SECRET_KEY"}:
                    continue
                os.environ.setdefault(key, value.strip().strip('"').strip("'"))
    except FileNotFoundError:
        return


@dataclass(frozen=True)
class Product:
    id: int
    slug: str
    name: str
    website_url: str


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.description = ""
        self.icons: list[tuple[int, str]] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): (value or "") for key, value in attrs}
        if tag.lower() == "title":
            self._in_title = True
        if tag.lower() == "meta":
            name = (values.get("name") or values.get("property") or "").lower()
            if name in {"description", "og:description"} and not self.description:
                self.description = values.get("content", "").strip()
        if tag.lower() == "link":
            rel = values.get("rel", "").lower()
            href = values.get("href", "").strip()
            if not href or "icon" not in rel or href.startswith("data:"):
                return
            sizes = values.get("sizes", "")
            numeric_sizes = [int(piece.split("x", 1)[0]) for piece in sizes.split() if piece.split("x", 1)[0].isdigit()]
            score = max(numeric_sizes, default=0)
            if "apple-touch-icon" in rel:
                score += 1_000
            self.icons.append((score, href))

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


class SupabaseApi:
    def __init__(self, url: str, secret_key: str) -> None:
        self.url = url.rstrip("/")
        self.secret_key = secret_key

    def _request(
        self,
        method: str,
        path: str,
        body: bytes | None = None,
        content_type: str = "application/json",
        prefer: str | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> tuple[bytes, dict[str, str]]:
        headers = {
            "apikey": self.secret_key,
            "Authorization": f"Bearer {self.secret_key}",
            "User-Agent": USER_AGENT,
        }
        if body is not None:
            headers["Content-Type"] = content_type
        if prefer:
            headers["Prefer"] = prefer
        if extra_headers:
            headers.update(extra_headers)
        request = Request(f"{self.url}{path}", data=body, headers=headers, method=method)
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return response.read(), dict(response.headers.items())

    def products(
        self,
        slug: str | None,
        slugs: list[str] | None,
        limit: int,
        missing_icons_only: bool,
    ) -> list[Product]:
        query = {
            "select": "id,slug,name,website_url",
            "order": "target_publish_date.asc,id.asc",
            "limit": str(limit),
        }
        if slug:
            query["slug"] = f"eq.{slug}"
        elif slugs:
            safe_slugs = [item for item in slugs if item.replace("-", "").isalnum()]
            query["slug"] = f"in.({','.join(safe_slugs)})"
        elif missing_icons_only:
            query["logo_storage_path"] = "is.null"
        payload, _ = self._request("GET", f"/rest/v1/products?{urlencode(query)}")
        return [Product(**item) for item in json.loads(payload)]

    def begin_run(self, product: Product) -> int:
        body = json.dumps({
            "product_id": product.id,
            "connector": "official-site",
            "status": "running",
        }).encode()
        payload, _ = self._request(
            "POST",
            "/rest/v1/crawl_runs?select=id",
            body,
            prefer="return=representation",
        )
        return int(json.loads(payload)[0]["id"])

    def finish_run(self, run_id: int, status: str, error: str | None = None) -> None:
        body = json.dumps({
            "status": status,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "pages_fetched": 1 if status == "succeeded" else 0,
            "records_found": 1 if status == "succeeded" else 0,
            "error_message": error,
        }).encode()
        self._request("PATCH", f"/rest/v1/crawl_runs?id=eq.{run_id}", body)

    def save_official_source(
        self,
        product: Product,
        run_id: int,
        title: str,
        description: str,
    ) -> None:
        body = json.dumps({
            "product_id": product.id,
            "crawl_run_id": run_id,
            "platform": product.name,
            "source_type": "official",
            "url": product.website_url,
            "title": title or product.name,
            "summary": description[:1_500] or None,
            "accessed_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {"collector": "official-site-v1"},
        }).encode()
        self._request(
            "POST",
            "/rest/v1/research_sources?on_conflict=product_id,url",
            body,
            prefer="resolution=merge-duplicates,return=minimal",
        )

    def upload_icon(self, product: Product, icon_url: str, content: bytes, content_type: str) -> str:
        storage_path = f"{product.slug}/icon"
        headers_body, _ = self._request(
            "PUT",
            f"/storage/v1/object/product-icons/{quote(storage_path, safe='/')}",
            content,
            content_type=content_type,
            prefer=None,
            extra_headers={"x-upsert": "true"},
        )
        del headers_body
        body = json.dumps({
            "logo_source_url": icon_url,
            "logo_storage_path": storage_path,
            "logo_fetched_at": datetime.now(timezone.utc).isoformat(),
        }).encode()
        self._request("PATCH", f"/rest/v1/products?id=eq.{product.id}", body)
        return storage_path


def fetch(
    url: str,
    max_bytes: int,
    accept: str = "*/*",
    reject_oversize: bool = True,
) -> tuple[bytes, str, str]:
    last_error: Exception | None = None
    for attempt in range(3):
        request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
        try:
            with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                content = response.read(max_bytes + 1)
                if len(content) > max_bytes and reject_oversize:
                    raise ValueError(f"response exceeds {max_bytes} bytes")
                return content[:max_bytes], response.headers.get_content_type(), response.geturl()
        except HTTPError as error:
            last_error = error
            if error.code not in {429, 500, 502, 503, 504} or attempt == 2:
                raise
            retry_after = error.headers.get("Retry-After", "")
            delay = int(retry_after) if retry_after.isdigit() else (attempt + 1) * 2
            time.sleep(min(delay, 10))
        except (TimeoutError, URLError) as error:
            last_error = error
            if attempt == 2:
                raise
            time.sleep((attempt + 1) * 2)
    raise RuntimeError(str(last_error))


def allowed_by_robots(url: str) -> bool:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser = RobotFileParser()
    parser.set_url(robots_url)
    try:
        body, _, _ = fetch(robots_url, 500_000, "text/plain")
        parser.parse(body.decode("utf-8", errors="replace").splitlines())
        return parser.can_fetch(USER_AGENT, url)
    except (HTTPError, URLError, TimeoutError, ValueError):
        return True


def select_icon(base_url: str, parser: PageParser) -> list[str]:
    ranked = sorted(parser.icons, key=lambda item: item[0], reverse=True)
    icons = [urljoin(base_url, href) for _, href in ranked]
    fallback = urljoin(base_url, "/favicon.ico")
    if fallback not in icons:
        icons.append(fallback)
    return icons


def crawl_product(api: SupabaseApi, product: Product) -> tuple[str, str]:
    run_id = api.begin_run(product)
    try:
        parser = PageParser()
        final_url = product.website_url
        page_error: Exception | None = None
        try:
            if not allowed_by_robots(product.website_url):
                raise PermissionError("robots.txt blocks the official page")
            html, content_type, final_url = fetch(
                product.website_url,
                MAX_HTML_BYTES,
                "text/html,application/xhtml+xml",
                reject_oversize=False,
            )
            if content_type not in {"text/html", "application/xhtml+xml"}:
                raise ValueError(f"official page returned {content_type}")
            parser.feed(html.decode("utf-8", errors="replace"))
            api.save_official_source(product, run_id, parser.title.strip(), parser.description.strip())
        except (HTTPError, URLError, TimeoutError, ValueError, PermissionError) as error:
            page_error = error

        icon_error = "no usable icon found"
        for icon_url in select_icon(final_url, parser):
            try:
                if not allowed_by_robots(icon_url):
                    continue
                icon, icon_type, _ = fetch(icon_url, MAX_ICON_BYTES, "image/*")
                if not icon_type.startswith("image/"):
                    guessed = mimetypes.guess_type(urlparse(icon_url).path)[0]
                    icon_type = guessed or icon_type
                if not icon_type.startswith("image/"):
                    continue
                api.upload_icon(product, icon_url, icon, icon_type)
                if page_error:
                    api.finish_run(run_id, "partial", str(page_error)[:1_000])
                    return product.slug, f"icon synced; official page skipped ({page_error})"
                api.finish_run(run_id, "succeeded")
                return product.slug, "synced"
            except (HTTPError, URLError, TimeoutError, ValueError) as error:
                icon_error = str(error)

        combined_error = f"page: {page_error}; icon: {icon_error}" if page_error else icon_error
        api.finish_run(run_id, "blocked" if isinstance(page_error, PermissionError) else "partial", combined_error[:1_000])
        return product.slug, f"source/icon incomplete ({combined_error})"
    except (HTTPError, URLError, TimeoutError, ValueError, PermissionError) as error:
        message = str(error)[:1_000]
        api.finish_run(run_id, "blocked" if isinstance(error, PermissionError) else "failed", message)
        return product.slug, f"failed ({message})"


def main() -> int:
    load_local_environment()
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument("--slug")
    argument_parser.add_argument("--batch-file", help="JSON batch file containing a products array with slugs")
    argument_parser.add_argument("--limit", type=int, default=50)
    argument_parser.add_argument("--workers", type=int, default=6)
    argument_parser.add_argument("--refresh", action="store_true", help="Re-fetch products that already have an icon")
    args = argument_parser.parse_args()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_secret_key = os.getenv("SUPABASE_SECRET_KEY")
    if not supabase_url or not supabase_secret_key:
        print("Missing SUPABASE_URL or SUPABASE_SECRET_KEY.", file=sys.stderr)
        return 1

    batch_slugs = None
    if args.batch_file:
        with open(args.batch_file, encoding="utf-8") as handle:
            batch_slugs = [item["slug"] for item in json.load(handle).get("products", [])]

    api = SupabaseApi(supabase_url, supabase_secret_key)
    products = api.products(args.slug, batch_slugs, args.limit, missing_icons_only=not args.refresh)
    if not products:
        print("No products found.")
        return 0

    failures = 0
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as executor:
        futures = {executor.submit(crawl_product, api, product): product for product in products}
        for future in as_completed(futures):
            slug, result = future.result()
            print(f"{slug}: {result}")
            if result.startswith("failed"):
                failures += 1

    print(f"Processed {len(products)} products with {failures} hard failures.")
    return 0 if failures == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
