import type { Metadata } from "next";
import { ArrowUpRight } from "@phosphor-icons/react/ssr";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Digital Macaroni collects, which analytics tools it uses, and what choices visitors have.",
  alternates: {
    canonical: "/privacy",
    types: {
      "application/rss+xml": "/feed.xml",
      "application/feed+json": "/feed.json",
    },
  },
};

const trackers = [
  {
    name: "Grain Analytics",
    purpose: "Understand which pages people read and how they move through the site.",
    data: "Page views, navigation paths, referrer, browser and device details, approximate location, session duration, scroll depth, and click interactions. Grain may also process heatmap signals and DOM snapshots when those features are enabled.",
    storage: "We load Grain in its default cookieless mode. It does not set tracking cookies or persist visitor identifiers in browser storage across sessions. We do not send Grain names, email addresses, or customer IDs from this site.",
    href: "https://www.grainql.com/privacy-policy",
    link: "Grain privacy policy",
  },
  {
    name: "Google Analytics 4",
    purpose: "Measure readership, traffic sources, and basic site performance.",
    data: "Page views, sessions, referral source, approximate location, and browser, device, and operating-system information.",
    storage: "We configure Google Analytics with analytics storage denied. It sends cookieless measurement data but does not read or write Analytics cookies. Google signals and advertising-personalisation signals are also disabled.",
    href: "https://support.google.com/analytics/answer/11593727",
    link: "Google Analytics data collection",
  },
] as const;

const privacyAuthorities = [
  {
    name: "Norway · Datatilsynet",
    href: "https://www.datatilsynet.no/en/about-us/contact-us/",
  },
  {
    name: "Iceland · Persónuvernd",
    href: "https://www.personuvernd.is/",
  },
  {
    name: "EU and EEA · Find your supervisory authority",
    href: "https://www.edpb.europa.eu/about-edpb/about-edpb/members_en",
  },
  {
    name: "Switzerland · FDPIC",
    href: "https://www.edoeb.admin.ch/en/submitting-a-complaint",
  },
  {
    name: "California · CPPA",
    href: "https://www.cppa.ca.gov/webapplications/complaint",
  },
  {
    name: "United States · FTC",
    href: "https://reportfraud.ftc.gov/",
  },
  {
    name: "United States · Find your state attorney general",
    href: "https://www.naag.org/find-my-ag/",
  },
  {
    name: "Canada · Privacy Commissioner",
    href: "https://www.priv.gc.ca/en/report-a-concern/",
  },
  {
    name: "Australia · OAIC",
    href: "https://www.oaic.gov.au/privacy/privacy-complaints/lodge-a-privacy-complaint-with-us",
  },
  {
    name: "New Zealand · Privacy Commissioner",
    href: "https://www.privacy.org.nz/your-rights/making-a-complaint/",
  },
  {
    name: "United Kingdom · ICO",
    href: "https://ico.org.uk/for-the-public/how-to-make-a-data-protection-complaint/",
  },
] as const;

export default function PrivacyPage() {
  return (
    <article className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.label}>Privacy policy</span>
          <h1>Here&apos;s what follows you around.</h1>
        </div>
        <div className={styles.summary}>
          <p>
            Digital Macaroni uses analytics to understand whether people read
            the site and where the experience gets confusing. We do not sell
            personal information, run behavioural advertising, or build
            marketing profiles from your visits.
          </p>
          <span>Last updated · 3 August 2026</span>
        </div>
      </header>

      <section className={styles.tracking} aria-labelledby="tracking-title">
        <header>
          <span className={styles.label}>The tracking, in plain English</span>
          <h2 id="tracking-title">Two outside services receive data when you visit.</h2>
        </header>

        <div className={styles.trackerList}>
          {trackers.map((tracker, index) => (
            <article key={tracker.name}>
              <span className={styles.number}>0{index + 1}</span>
              <div className={styles.trackerName}>
                <h3>{tracker.name}</h3>
                <p>{tracker.purpose}</p>
              </div>
              <div className={styles.trackerDetails}>
                <h4>What it receives</h4>
                <p>{tracker.data}</p>
                <h4>Storage</h4>
                <p>{tracker.storage}</p>
                <a href={tracker.href} target="_blank" rel="noreferrer">
                  {tracker.link}
                  <ArrowUpRight size={15} weight="bold" aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.policyGrid}>
        <section aria-labelledby="contact-data-title">
          <span className={styles.label}>When you contact us</span>
          <h2 id="contact-data-title">Email is the only information you hand us directly.</h2>
          <p>
            If you email us, we receive your email address and anything you put
            in the message. We use it to reply, assess a software submission,
            maintain editorial records, or handle the request you made.
          </p>
          <p>
            The software-submission form does not send information to our
            website or database. It prepares a message in your own email app.
            Nothing is sent until you choose to send that email.
          </p>
        </section>

        <section aria-labelledby="basis-title">
          <span className={styles.label}>Why we process it</span>
          <h2 id="basis-title">Purpose and legal basis</h2>
          <p>
            We process correspondence because it is necessary to answer your
            request, and where appropriate because of our legitimate interest
            in running an editorial publication and keeping accurate records.
          </p>
          <p>
            Cookieless analytics is used to understand and improve the
            publication. Although these services do not store identifiers on
            your device, the information sent to them may still be personal
            information under applicable law.
          </p>
        </section>

        <section aria-labelledby="retention-title">
          <span className={styles.label}>How long it stays</span>
          <h2 id="retention-title">Retention</h2>
          <p>
            We keep emails and editorial correspondence only while they remain
            useful for the conversation, our records, or a legal obligation.
            Analytics information is retained according to our settings with
            Grain and Google and is deleted or aggregated when it is no longer
            needed.
          </p>
          <p>
            Neither analytics service stores a persistent visitor identifier
            on your device. Retention of the measurement data they receive is
            governed by our settings with each provider.
          </p>
        </section>

        <section aria-labelledby="sharing-title">
          <span className={styles.label}>Who gets it</span>
          <h2 id="sharing-title">Processors and transfers</h2>
          <p>
            We share data only with providers needed to run the site and the
            services described above. Grain says its primary analytics
            processing takes place in the EU. Google operates globally, so
            information may be processed outside Norway or the EEA under the
            safeguards described in Google&apos;s own privacy documentation.
          </p>
          <p>We do not sell or rent visitor information.</p>
        </section>
      </div>

      <section className={styles.rights} aria-labelledby="rights-title">
        <div>
          <span className={styles.label}>Your information</span>
          <h2 id="rights-title">You have a say.</h2>
        </div>
        <div>
          <p>
            Depending on where you live, you may have the right to access,
            correct, delete, restrict, or object to the processing of your
            personal information, and to withdraw consent where consent is the
            legal basis.
          </p>
          <p>
            This site does not set or use cookies. Grain runs in its default
            cookieless mode, and Google Analytics is configured not to read or
            write Analytics cookies. You can still block analytics requests in
            your browser without affecting your ability to read Digital
            Macaroni.
          </p>
          <p>
            To make a privacy request, email{
            " "
          }<a href="mailto:hello@digitalmacaroni.io">hello@digitalmacaroni.io</a>.
            Digital Macaroni is operated by Leif Johansen, who is responsible
            for the personal information described on this page.
          </p>
          <p>
            If you believe your information has been handled unlawfully, you
            may also complain to the privacy or consumer-protection authority
            that covers you. The appropriate authority depends on where you
            live and which law applies. In Canada, a provincial privacy
            commissioner may be the right authority; in the United States, a
            state attorney general or state privacy regulator may be more
            appropriate than the FTC.
          </p>
          <div className={styles.authorityLinks}>
            {privacyAuthorities.map((authority) => (
              <a
                key={authority.name}
                className={styles.authorityLink}
                href={authority.href}
                target="_blank"
                rel="noreferrer"
              >
                {authority.name}
                <ArrowUpRight size={16} weight="bold" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className={styles.policyFooter}>
        <span className={styles.label}>Changes</span>
        <p>
          We will update this page when the site, its tracking, or the law
          changes materially. The date at the top tells you when we last did.
        </p>
      </footer>
    </article>
  );
}
