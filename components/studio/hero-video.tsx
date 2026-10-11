"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "./consent";
import h from "./home.module.css";

/**
 * The homepage explainer, hosted on Cloudflare Stream. Nothing from Stream loads until
 * the visitor presses play; then the player loads with sound and we report plays,
 * 25/50/75% progress and completions through the consented analytics in consent.tsx.
 */
const STREAM = "https://customer-2krkuj6lgwd7527e.cloudflarestream.com";
const VIDEO_ID = "9b528cb0adb965a562ba000b362cabda";
const POSTER = "/studio/video/explainer-poster.jpg";
const LENGTH = "1:24";
const SECONDS = 84.4; // fallback when the player has not reported its duration yet

type StreamPlayer = {
  addEventListener: (name: string, fn: () => void) => void;
  currentTime: number;
  duration: number;
};

declare global {
  interface Window {
    Stream?: (iframe: HTMLIFrameElement) => StreamPlayer;
  }
}

function loadSdk(): Promise<void> {
  if (window.Stream) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

export function HeroVideo() {
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!playing || !frame.current) return;
    const iframe = frame.current;
    let done = false;
    loadSdk().then(() => {
      if (done || !window.Stream) return;
      const player = window.Stream(iframe);
      const sent = new Set<number>();
      player.addEventListener("timeupdate", () => {
        const pct = (player.currentTime / (player.duration || SECONDS)) * 100;
        for (const mark of [25, 50, 75]) {
          if (pct >= mark && !sent.has(mark)) {
            sent.add(mark);
            track("hero_video_progress", { percent: mark });
          }
        }
        if (pct >= 97) complete();
      });
      // "ended" doesn't always reach a player attached after load, so 97% also counts.
      player.addEventListener("ended", complete);
      function complete() {
        if (sent.has(100)) return;
        sent.add(100);
        track("hero_video_complete");
      }
    }).catch(() => {});
    return () => { done = true; };
  }, [playing]);

  function play() {
    setPlaying(true);
    track("hero_video_play");
  }

  return <div className={h.heroStage}>
    <div className={h.videoShell}>
      {playing
        ? <iframe
            ref={frame}
            className={h.videoFrame}
            src={`${STREAM}/${VIDEO_ID}/iframe?autoplay=true&preload=auto&poster=${encodeURIComponent(`https://digitalmacaroni.io${POSTER}`)}&primaryColor=%23f6cf4a&letterboxColor=transparent`}
            title="Digital Macaroni: voice agents that answer every call and do the work"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        : <button type="button" className={h.videoPoster} onClick={play} aria-label={`Play the Digital Macaroni video, ${LENGTH}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={POSTER} alt="" width={1920} height={1080} fetchPriority="high" />
            <span className={h.videoCta}>
              <span className={h.videoPlay} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
              </span>
              <span className={h.videoCtaText}>Watch how it works</span> <em>{LENGTH}</em>
            </span>
          </button>}
    </div>
  </div>;
}
