"use client";

import { useEffect, useRef } from "react";

/** Cloudflare Turnstile widget "digitalmacaroni.io instant call" (public site key; the secret lives on the voice service). */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "0x4AAAAAAFTy4ZbG8AjNRTWC";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** The "Verify you are human" box. Calls onToken with a fresh token, or "" when it expires or fails. */
export function Turnstile({ onToken, resetKey = 0 }: { onToken: (token: string) => void; resetKey?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const callback = useRef(onToken);
  callback.current = onToken;

  useEffect(() => {
    let gone = false;
    const render = () => {
      if (gone || !box.current || !window.turnstile || widget.current) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        // The normal widget is a fixed 300px; on narrow phones its compact form fits inside the card.
        size: window.innerWidth < 420 ? "compact" : "normal",
        // Always the light widget, whatever the visitor's system theme: the form card is white.
        theme: "light",
        callback: (t: string) => callback.current(t),
        "expired-callback": () => callback.current(""),
        "error-callback": () => callback.current(""),
      });
    };
    if (window.turnstile) render();
    else {
      let s = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      if (!s) {
        s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        s.dataset.turnstile = "1";
        document.head.appendChild(s);
      }
      s.addEventListener("load", render);
    }
    return () => {
      gone = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = undefined;
    };
  }, []);

  // A token works once: after each try, get a new one.
  useEffect(() => {
    if (resetKey && widget.current && window.turnstile) {
      window.turnstile.reset(widget.current);
      callback.current("");
    }
  }, [resetKey]);

  return <div ref={box} style={{ minHeight: 65 }} />;
}
