"use client";

import { useEffect, useState } from "react";
import c from "./consent.module.css";

/**
 * Analytics only with consent. Google Analytics, Grain and PostHog load after a
 * visitor says yes; until then nothing is set or sent. The choice lives in this browser.
 */
const KEY = "dm-cookie-consent";
const GA_ID = "G-VPGKY80HW8";
const GRAIN_SRC = "https://tag.grainql.com/v4/digitalmacaroni-tsr779.js";
// PostHog's project key is public by design: it can only send events, never read them.
const POSTHOG_KEY = "phc_rV2dJi3D8xE37Kirg54ksXt4STc4KYiXCEHCuwWAh4t6";
const POSTHOG_HOST = "https://us.i.posthog.com";
const OPEN_EVENT = "dm:cookie-settings";

type Choice = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    GrainTag?: { track: (name: string, props?: Record<string, unknown>) => void };
    posthog?: { capture: (name: string, props?: Record<string, unknown>) => void; init: (key: string, options: Record<string, unknown>) => void; __SV?: number };
  }
}

function readChoice(): Choice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function addScript(src: string) {
  const s = document.createElement("script");
  s.src = src;
  s.async = true;
  document.head.appendChild(s);
}

let loaded = false;
function loadAnalytics() {
  if (loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag reads the arguments object itself, not an array copy.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
  addScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
  addScript(GRAIN_SRC);
  loadPostHog();
}

/**
 * PostHog: page views, the demo funnel and session recordings (form fields are never recorded).
 * The same queue-then-load stub as PostHog's own snippet: calls made before the library arrives are
 * kept and replayed by it.
 */
function loadPostHog() {
  type Stub = unknown[] & { _i: unknown[]; __SV: number } & Record<string, unknown>;
  const stub = [] as unknown as Stub;
  stub._i = [];
  stub.__SV = 1;
  for (const m of ["capture", "identify", "register", "reset", "opt_out_capturing"]) {
    stub[m] = (...args: unknown[]) => { stub.push([m, ...args]); };
  }
  stub.init = (key: string, options: Record<string, unknown>) => { stub._i.push([key, options]); };
  window.posthog = stub as unknown as Window["posthog"];
  window.posthog!.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: "history_change",
    session_recording: { maskAllInputs: true, maskTextSelector: ".ph-mask" },
  });
  const script = document.createElement("script");
  script.src = `${POSTHOG_HOST.replace(".i.posthog.com", "-assets.i.posthog.com")}/static/array.js`;
  script.async = true;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}

/** Removes what the analytics tools stored, for when a visitor changes their answer to no. */
function clearAnalytics() {
  const host = location.hostname;
  for (const name of document.cookie.split("; ").map((part) => part.split("=")[0])) {
    if (!name.startsWith("_ga")) continue;
    for (const domain of ["", host, `.${host.replace(/^www\./, "")}`]) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
  for (const name of document.cookie.split("; ").map((part) => part.split("=")[0])) {
    if (name.startsWith("ph_")) document.cookie = `${name}=; Max-Age=0; path=/`;
  }
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("_grain_") || k.startsWith("ph_")) localStorage.removeItem(k);
  } catch {}
}

/** Sends an event to Google Analytics, Grain and PostHog, only if the visitor said yes. Never pass personal details. */
export function track(name: string, params: Record<string, string | number> = {}) {
  if (readChoice() !== "granted") return;
  const withSource = { ...params, ...firstTouch() };
  window.gtag?.("event", name, withSource);
  window.GrainTag?.track(name, withSource);
  window.posthog?.capture(name, withSource);
}

const SOURCE_KEY = "dm-source";
/**
 * Where this visit came from (a ?utm_source=, or another site), remembered for the rest of the visit in
 * this tab only, so an event three pages later still knows it started on TikTok. Nothing personal.
 */
export function firstTouch(): Record<string, string> {
  try {
    const saved = sessionStorage.getItem(SOURCE_KEY);
    if (saved) return JSON.parse(saved);
    const url = new URL(location.href);
    const ref = document.referrer ? new URL(document.referrer).hostname : "";
    const touch: Record<string, string> = {};
    const source = url.searchParams.get("utm_source") || (ref && ref !== location.hostname ? ref : "");
    if (source) touch.first_source = source.slice(0, 60);
    const medium = url.searchParams.get("utm_medium");
    if (medium) touch.first_medium = medium.slice(0, 40);
    const campaign = url.searchParams.get("utm_campaign");
    if (campaign) touch.first_campaign = campaign.slice(0, 60);
    touch.first_page = url.pathname.slice(0, 80);
    sessionStorage.setItem(SOURCE_KEY, JSON.stringify(touch));
    return touch;
  } catch {
    return {};
  }
}

/** The yes-or-no card. Shows on a first visit, and again from any "Cookie settings" link. */
export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Remember where this visit started before anything else, so later events can say.
    firstTouch();
    const choice = readChoice();
    if (choice === "granted") loadAnalytics();
    else {
      // Without a yes, nothing from the tools should remain, including what they wrote while unloading.
      clearAnalytics();
      if (choice === null) setOpen(true);
    }
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  function choose(choice: Choice) {
    const before = readChoice();
    try {
      localStorage.setItem(KEY, choice);
    } catch {}
    setOpen(false);
    if (choice === "granted") loadAnalytics();
    // The tools are already running on this page; reload so they stop. The next load clears what they stored.
    else if (before === "granted") location.reload();
  }

  if (!open) return null;
  return <div className={c.card} role="dialog" aria-labelledby="cookie-text">
    <p id="cookie-text">Can we use analytics cookies to see how people use this site? <a href="/cookies/">Cookie policy</a></p>
    <div className={c.actions}>
      <button type="button" className={c.no} onClick={() => choose("denied")}>No thanks</button>
      <button type="button" className={c.yes} onClick={() => choose("granted")}>Accept</button>
    </div>
  </div>;
}

/** Footer link that reopens the card so a visitor can change their answer. */
export function CookieSettings() {
  return <button type="button" className={c.link} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>Cookie settings</button>;
}
