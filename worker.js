const RECIPIENT = "hello@digitalmacaroni.io";
const SENDER = "website@digitalmacaroni.io";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPICS = new Map([
  ["ready-made", "Ready-made voice agent"],
  ["custom-agent", "Custom voice agent"],
  ["software", "Business software or dashboard"],
  ["app", "An app"],
  ["question", "General question"],
  ["other", "Something else"],
  // Older form values, kept so a cached page still sends.
  ["new-project", "New project"],
  ["existing-project", "Existing project"],
  ["collaboration", "Collaboration"],
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    const source = SHORT_LINKS[path];
    if (source) {
      return Response.redirect(`${url.origin}/try/?utm_source=${source}&utm_medium=social`, 302);
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
