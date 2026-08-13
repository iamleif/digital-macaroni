import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/ssr";

export default function NotFound() {
  return (
    <section className="not-found section-pad">
      <span className="eyebrow">404 · Wrong turn</span>
      <h1>This page slipped through the colander.</h1>
      <p>The link may be old, or the story may have moved.</p>
      <Link className="arrow-link" href="/">
        Back to the front page <ArrowUpRight className="icon-inline" size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}
