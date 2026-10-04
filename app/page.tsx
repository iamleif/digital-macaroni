import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <main id="content" className="home-page">
      <Link className="corner-link" href="/contact">
        Contact
      </Link>

      <section className="studio-intro" aria-labelledby="studio-name">
        <Image
          className="studio-mark"
          src="/brand/macaroni-yellow-logo.png"
          alt=""
          width={1200}
          height={1200}
          priority
        />
        <h1 id="studio-name">Digital Macaroni</h1>
        <p>
          We’re a digital studio creating software, brands, websites, and other
          useful things.
        </p>
        <Link className="text-link" href="/contact">
          Start a conversation <span aria-hidden="true">↗</span>
        </Link>
      </section>

    </main>
  );
}
