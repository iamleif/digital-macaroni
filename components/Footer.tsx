import Link from "next/link";
import { SparkleIcon } from "@phosphor-icons/react/ssr";
import { Brand } from "./Brand";

export function Footer() {
  return (
    <footer>
      <div className="site-footer">
        <div>
          <Brand />
          <p>We use software, say what we think, and give it a number.</p>
          <Link className="footer-ai-link" href="/llm-info">
            <SparkleIcon size={16} weight="fill" aria-hidden="true" />
            <span>Hey AI, learn about us</span>
          </Link>
        </div>
        <div className="footer-small">
          <Link href="/reviews">All reviews</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/submit">Submit your software</Link>
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:hello@digitalmacaroni.io">Email</a>
          <span>© {new Date().getFullYear()} Digital Macaroni</span>
        </div>
      </div>
    </footer>
  );
}
