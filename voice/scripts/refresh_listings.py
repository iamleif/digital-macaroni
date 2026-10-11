"""
Juniper Row Realty's listings, pulled once from RentCast and kept as our own data.

    RENTCAST_API_KEY=… uv run python scripts/refresh_listings.py --raw-dir DIR

Pages through active Austin sale listings (and long-term rentals, for later) 500 at a time, writes every
raw response to DIR (the full record, kept in Google Cloud Storage: gs://digital-macaroni-demo-data/
realestate/), and writes the trimmed homes the agent uses to app/demos/realestate/data/listings.json.
The agent only ever reads that file (through store.py), so calls never touch RentCast.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

import httpx

DATA = Path(__file__).resolve().parents[1] / "app" / "demos" / "realestate" / "data"
TYPES = ("Single Family", "Condo", "Townhouse")
PAGE = 500


def pull(kind: str, pages: int, key: str, raw_dir: Path) -> list[dict]:
    out: list[dict] = []
    for page in range(pages):
        r = httpx.get(
            f"https://api.rentcast.io/v1/listings/{kind}",
            params={"city": "Austin", "state": "TX", "status": "Active", "propertyType": "|".join(TYPES), "limit": PAGE, "offset": page * PAGE},
            headers={"X-Api-Key": key, "Accept": "application/json"},
            timeout=90,
        )
        r.raise_for_status()
        rows = r.json()
        (raw_dir / f"{kind.replace('/', '-')}-{page:02d}.json").write_text(json.dumps(rows))
        out += rows
        print(f"{kind} page {page}: {len(rows)}")
        if len(rows) < PAGE:
            break
    return out


def main() -> None:
    a = argparse.ArgumentParser()
    a.add_argument("--raw-dir", required=True)
    a.add_argument("--sale-pages", type=int, default=10)
    a.add_argument("--rental-pages", type=int, default=2)
    args = a.parse_args()
    key = os.environ.get("RENTCAST_API_KEY") or sys.exit("Set RENTCAST_API_KEY.")
    raw = Path(args.raw_dir)
    raw.mkdir(parents=True, exist_ok=True)
    sale = pull("sale", args.sale_pages, key, raw)
    if args.rental_pages:
        pull("rental/long-term", args.rental_pages, key, raw)

    areas = json.loads((DATA / "areas.json").read_text())["areas"]
    area_of = {z: x["id"] for x in areas for z in x["zips"]}
    seen: set[str] = set()
    homes = []
    for x in sorted(sale, key=lambda x: (x.get("zipCode") or "", x.get("price") or 0)):
        if x["id"] in seen or x.get("zipCode") not in area_of or not (x.get("price") and x.get("bedrooms") and x.get("bathrooms") and x.get("squareFootage")) or x.get("propertyType") not in TYPES:
            continue
        seen.add(x["id"])
        homes.append({
            "id": f"JR-{len(homes) + 101}",
            "address": x["addressLine1"] + (f" {x['addressLine2']}" if x.get("addressLine2") else ""),
            "street": " ".join(w for w in x["addressLine1"].split() if not w.isdigit()),
            "city": x.get("city", "Austin"),
            "zip": x["zipCode"],
            "area": area_of[x["zipCode"]],
            "type": x["propertyType"],
            "price": int(x["price"]),
            "beds": x["bedrooms"],
            "baths": x["bathrooms"],
            "sqft": x["squareFootage"],
            "lotSqft": x.get("lotSize"),
            "yearBuilt": x.get("yearBuilt"),
            "hoaFee": (x.get("hoa") or {}).get("fee"),
            "newConstruction": x.get("listingType") == "New Construction",
            "listedDate": (x.get("listedDate") or "")[:10] or None,
            "daysOnMarket": x.get("daysOnMarket"),
            "latitude": x.get("latitude"),
            "longitude": x.get("longitude"),
        })
    out = {"source": "RentCast active sale listings, Austin TX", "snapshot": date.today().isoformat(), "listings": homes}
    (DATA / "listings.json").write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print(f"{len(homes)} homes kept of {len(sale)} pulled → {DATA / 'listings.json'}")


if __name__ == "__main__":
    main()
