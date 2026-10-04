"use client";

import { useEffect, useRef } from "react";
import type { VoiceLevels } from "../live/voice-levels";

/**
 * Waveform bars that move with the agent's actual voice: low pitches in the middle, higher ones
 * towards the edges, mirrored. `shape` is the resting silhouette (and what renders before hydration,
 * animated by CSS). Without real levels (a sample replay) the bars speak in a plausible rhythm.
 */
export function VoiceBars({ voice, speaking, shape, className }: { voice: VoiceLevels; speaking: boolean; shape: number[]; className: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const talking = useRef(speaking);
  talking.current = speaking;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const bars = Array.from(root.children) as HTMLElement[];
    const n = bars.length;
    const centre = (n - 1) / 2 || 1;
    const tallest = Math.max(...shape);
    const rest = shape.map((h) => 0.12 + 0.36 * (h / tallest));
    const shown = new Float32Array(n).fill(0.2);
    let bands = new Float32Array(voice.bands);
    let peak = 0.6;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.dataset.live = "";

    let frame = 0;
    const draw = (t: number) => {
      if (bands.length !== voice.bands) bands = new Float32Array(voice.bands);
      const live = voice.sample(t, bands);
      if (live) {
        // Slow automatic gain: quieter voices still fill the bars, louder ones don't pin them.
        const loudest = Math.max(...bands);
        peak = loudest > peak ? peak + (loudest - peak) * 0.2 : Math.max(0.45, peak * 0.998);
      }
      const syllable = 0.5 + 0.5 * Math.sin(t * 0.0232) * Math.sin(t * 0.0071 + 1.3);
      for (let i = 0; i < n; i++) {
        const d = Math.abs(i - centre) / centre;
        let target: number;
        if (live) {
          const pos = d * (bands.length - 1);
          const lo = Math.floor(pos);
          const hi = Math.min(bands.length - 1, lo + 1);
          const v = bands[lo]! + (bands[hi]! - bands[lo]!) * (pos - lo);
          // A little of the neighbouring band keeps the shape organic rather than strictly stepped.
          const near = bands[Math.max(0, lo - 1)]! * 0.5 + bands[hi]! * 0.5;
          target = Math.max(rest[i]! * 0.6, Math.min(1, ((v * 0.75 + near * 0.25) / peak) * (1 - 0.3 * d) * (0.9 + 0.1 * Math.sin(i * 2.3))));
        } else if (talking.current && !voice.received) {
          target = 0.3 + 0.6 * syllable * (0.55 + 0.45 * Math.sin(t * 0.013 + i * 1.7)) * (1 - 0.3 * d);
        } else {
          target = still ? rest[i]! : rest[i]! * (1 + 0.25 * Math.sin(t * 0.0016 + i * 0.9));
        }
        shown[i]! += (target - shown[i]!) * (target > shown[i]! ? 0.5 : 0.16);
        bars[i]!.style.transform = `scaleY(${shown[i]!.toFixed(3)})`;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      delete root.dataset.live;
      bars.forEach((b) => (b.style.transform = ""));
    };
  }, [voice, shape]);

  return <span ref={ref} className={className} data-speaking={speaking || undefined} aria-hidden="true">
    {shape.map((h, i) => <i key={i} style={{ height: h, animationDelay: `${i * -0.11}s` }} />)}
  </span>;
}
