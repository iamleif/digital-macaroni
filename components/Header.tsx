import Link from "next/link";
import { Brand } from "./Brand";

export function Header() {
  return (
    <header className="site-header">
      <Brand />
      <nav className="site-nav" aria-label="Main navigation">
        <Link href="/reviews">All reviews</Link>
        <Link href="/how-it-works">How it works</Link>
        <Link href="/submit">Submit your software</Link>
      </nav>
    </header>
  );
}
