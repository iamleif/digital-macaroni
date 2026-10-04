import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Digital Macaroni.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main id="content" className="contact-page">
      <header className="contact-header">
        <Link className="mini-brand" href="/" aria-label="Digital Macaroni, home">
          <Image
            src="/brand/macaroni-yellow-logo.png"
            alt=""
            width={120}
            height={120}
          />
          <span>Digital Macaroni</span>
        </Link>
        <Link className="back-link" href="/">
          Back home
        </Link>
      </header>

      <div className="contact-layout">
        <section className="contact-copy" aria-labelledby="contact-title">
          <h1 id="contact-title">Let’s make something.</h1>
          <p>
            Have a product in mind, a problem worth solving, or just want to say
            hello? Send a note here.
          </p>
        </section>

        <ContactForm />
      </div>
    </main>
  );
}
