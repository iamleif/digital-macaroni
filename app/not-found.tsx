import Link from "next/link";

export default function NotFound() {
  return (
    <main id="content" className="not-found">
      <h1>Nothing here.</h1>
      <p>This page doesn’t exist.</p>
      <Link className="text-link" href="/">
        Back home <span aria-hidden="true">↗</span>
      </Link>
    </main>
  );
}
