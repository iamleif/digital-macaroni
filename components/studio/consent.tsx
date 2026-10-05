"use client";

import { useEffect, useState } from "react";
import c from "./consent.module.css";

/**
 * Analytics only with consent. Google Analytics and Grain load after a visitor
 * says yes; until then nothing is set or sent. The choice lives in this browser.
 */
const KEY = "dm-cookie-consent";
const GA_ID = "G-VPGKY80HW8";
const GRAIN_SRC = "https://tag.grainql.com/v4/digitalmacaroni-tsr779.js";
const OPEN_EVENT = "dm:cookie-settings";

type Choice = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    GrainTag?: { track: (name: string, props?: Record<string, unknown>) => void };
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
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("_grain_")) localStorage.removeItem(k);
  } catch {}
}

/** Sends an event to Google Analytics and Grain, only if the visitor said yes. Never pass personal details. */
export function track(name: string, params: Record<string, string | number> = {}) {
  if (readChoice() !== "granted") return;
  window.gtag?.("event", name, params);
  window.GrainTag?.track(name, params);
}

/** The yes-or-no card. Shows on a first visit, and again from any "Cookie settings" link. */
export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
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
