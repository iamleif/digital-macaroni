import { DISPOSABLE } from "./lib/disposable-domains.js";

const RECIPIENT = "hello@digitalmacaroni.io";
const SENDER = "website@digitalmacaroni.io";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPICS = new Map([
  ["core-agent", "Core voice agent"],
  ["custom-agent", "Custom voice agent"],
  ["consulting", "Consulting on a project"],
  ["software", "Business software or dashboard"],
  ["app", "An app"],
  ["question", "General question"],
  ["other", "Something else"],
  // Older form values, kept so a cached page still sends.
  ["new-project", "New project"],
  ["existing-project", "Existing project"],
  ["collaboration", "Collaboration"],
  ["ready-made", "Core voice agent"],
]);

// Optional details the form asks for depending on the topic. Only these are read, each capped.
const DETAILS = [
  ["company", "Business"],
  ["phone", "Phone"],
  ["contact_pref", "Prefers"],
  ["business_type", "Business type"],
  ["call_volume", "Calls per month"],
  ["texting", "Texting"],
  ["hosting", "Running it"],
  ["tools", "Tools to connect"],
  ["build", "What to build"],
  ["timeline", "Timeline"],
  ["budget", "Budget"],
  // Where the visitor came from: the bio link's utm_source, and the page the form was sent from.
  ["source", "Came from"],
  ["landing", "Sent from page"],
];

function json(message, status = 200) {
  return Response.json(
    { message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

// A throwaway inbox (from github.com/disposable-email-domains), or a subdomain of one.
function isDisposable(domain) {
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) if (DISPOSABLE.has(parts.slice(i).join("."))) return true;
  return false;
}

// Whether the domain can receive email (MX, or an address record), by DNS over HTTPS. Unknown counts as yes.
async function receivesMail(domain) {
  try {
    for (const type of ["MX", "A"]) {
      const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, { headers: { accept: "application/dns-json" } });
      const data = await r.json();
      if (data.Status === 3) return false;
      if (data.Answer && data.Answer.length) return true;
    }
    return false;
  } catch {
    return true;
  }
}

// Cloudflare Turnstile ("Verify you are human"), checked with the widget's secret.
async function isHuman(token, ip, env) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    const body = new FormData();
    body.set("secret", env.TURNSTILE_SECRET);
    body.set("response", token);
    if (ip) body.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    return Boolean((await r.json()).success);
  } catch {
    return false;
  }
}

function cleanHeader(value) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

// Short bio links: digitalmacaroni.io/yt etc. land on /try/ with the platform tagged for analytics.
const SHORT_LINKS = {
  "/yt": "youtube",
  "/tt": "tiktok",
  "/ig": "instagram",
  "/fb": "facebook",
  "/li": "linkedin",
};

// Demo-type links: digitalmacaroni.io/appointments etc. open the homepage scrolled to that demo type.
const DEMO_LINKS = {
  "/appointments": "appointments",
  "/stock": "stock-and-orders",
  "/clients": "new-clients",
  "/bookings": "longer-bookings",
};

// The demo voice service, reached as digitalmacaroni.io/voice/… so the browser only ever talks to this site.
const VOICE_ORIGIN = "https://studio-demo-voice-361680400699.us-central1.run.app";

function proxyVoice(request, env, url) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  // The service limits paid sessions per visitor; behind this proxy it needs the visitor's own address.
  headers.set("x-dm-client-ip", request.headers.get("cf-connecting-ip") || "");
  headers.set("x-dm-proxy-key", env.VOICE_PROXY_KEY || "");
  const target = VOICE_ORIGIN + url.pathname.slice("/voice".length) + url.search;
  // A WebSocket upgrade passes straight through: fetch returns the 101 and its socket.
  return fetch(target, { method: request.method, headers, body: request.body, redirect: "manual" });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/voice/")) return proxyVoice(request, env, url);

    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    const source = SHORT_LINKS[path];
    if (source) {
      return Response.redirect(`${url.origin}/try/?utm_source=${source}&utm_medium=social`, 302);
    }
    const demo = DEMO_LINKS[path];
    if (demo) {
      // ?s= is where the link was posted (linkedin, email, dm…); ?p= tags the person it was sent to.
      const tag = (v) => (v || "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 40);
      const q = new URLSearchParams({ utm_source: tag(url.searchParams.get("s")) || "direct", utm_medium: "demo", utm_campaign: demo });
      const person = tag(url.searchParams.get("p"));
      if (person) q.set("utm_content", person);
      return Response.redirect(`${url.origin}/?${q}#${demo}`, 302);
    }
    // Per-episode YouTube links: /yt1, /yt2… tag the long-form episode that sent the visitor.
    const episode = path.match(/^\/yt(\d{1,3})$/);
    if (episode) {
      const ep = "ep" + episode[1].padStart(2, "0");
      return Response.redirect(`${url.origin}/try/?utm_source=youtube&utm_medium=video&utm_campaign=${ep}`, 302);
    }
    // Per-short links: /yt1-4 (YouTube Short), /fb1-4 (Facebook Reel) tag episode 1, short #4.
    const short = path.match(/^\/(yt|fb)(\d{1,3})-(\d{1,3})$/);
    if (short) {
      const src = short[1] === "yt" ? "youtube" : "facebook";
      const ep = "ep" + short[2].padStart(2, "0");
      const s = "s" + short[3].padStart(2, "0");
      return Response.redirect(`${url.origin}/try/?utm_source=${src}&utm_medium=short&utm_campaign=${ep}&utm_content=${s}`, 302);
    }

    if (url.pathname !== "/api/contact") {
      return new Response("Not found", { status: 404 });
    }

    if (request.method !== "POST") {
      return json("Method not allowed.", 405);
    }

    const origin = request.headers.get("Origin");
    if (origin && new URL(origin).host !== url.host) {
      return json("Request rejected.", 403);
    }

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > 16_000) {
      return json("Your message is too long.", 413);
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return json("We couldn’t read your message.", 400);
    }

    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const topic = String(form.get("topic") || "").trim();
    const message = String(form.get("message") || "").trim();
    const website = String(form.get("website") || "").trim();

    // Bots commonly fill every field. Return success without sending anything.
    if (website) {
      return json("Thanks. Your message is on its way.");
    }

    // The page reports how long the form was open. Direct posts have no time at all;
    // anything under three seconds was filled by a script.
    const elapsed = Number(form.get("elapsed"));
    if (!Number.isFinite(elapsed) || elapsed <= 0) {
      return json("Please reload the page and try again.", 400);
    }
    if (elapsed < 3000) {
      return json("Thanks. Your message is on its way.");
    }

    if (!name || name.length > 100) {
      return json("Please enter your name.", 400);
    }

    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return json("Please enter a valid email address.", 400);
    }
    const domain = email.split("@").pop();
    if (isDisposable(domain)) {
      return json("Please use your real email address: we can’t reply to temporary inboxes.", 400);
    }
    if (!(await receivesMail(domain))) {
      return json("That email domain doesn’t seem to receive email. Please check the spelling.", 400);
    }

    if (!(await isHuman(String(form.get("cf-turnstile-response") || ""), request.headers.get("cf-connecting-ip"), env))) {
      return json("Please tick “Verify you are human” and try again.", 400);
    }

    const topicLabel = TOPICS.get(topic);
    if (!topicLabel) {
      return json("Please choose what this is about.", 400);
    }

    if (!message || message.length > 5000) {
      return json("Please enter a message under 5,000 characters.", 400);
    }

    const details = DETAILS
      .map(([field, label]) => [label, String(form.get(field) || "").trim().slice(0, 300)])
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}: ${value}\n`)
      .join("");

    try {
      await env.CONTACT_EMAIL.send({
        to: RECIPIENT,
        from: { email: SENDER, name: "Digital Macaroni website" },
        replyTo: { email, name: cleanHeader(name) },
        subject: `Website inquiry: ${topicLabel} — ${cleanHeader(name)}`,
        text: `Name: ${name}\nEmail: ${email}\nTopic: ${topicLabel}\n${details}\n${message}`,
      });
    } catch (error) {
      console.error("Contact email failed", error);
      return json("We couldn’t send your message. Please try again.", 500);
    }

    return json("Thanks. Your message is on its way.");
  },
};
