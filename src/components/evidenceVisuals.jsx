import { useEffect, useState } from "react";

// Shared visual primitives for Evidence Mode. Used by both the login preview
// (EvidencePreview) and the real insight cards (EvidenceMode) so the animated
// sparkline, count-up numbers and trust meter read as one visual language.
// CSS-only motion via the classes in index.css (animate-draw-line/area-in/
// dot-in), all of which stand down under prefers-reduced-motion.

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** Count from 0 to `target` once per `runKey`, on rAF. Returns the live value. */
export function useCountUp(target, runKey, duration = 1100) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return undefined;
    }
    let raf = 0;
    let start = 0;
    const tick = (now) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic — quick to move, soft to land.
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, runKey, duration]);
  return value;
}

/** Sparkline whose stroke draws itself, with a soft area fill beneath. */
export function Sparkline({ points, runKey }) {
  const w = 260;
  const h = 72;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points.map((p, i) => [
    (i / (points.length - 1)) * w,
    h - ((p - min) / span) * (h - 10) - 5,
  ]);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const [lx, ly] = coords[coords.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-[72px] w-full" aria-hidden="true">
      <defs>
        <linearGradient id="dp-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(59,158,255)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="rgb(59,158,255)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path key={`a-${runKey}`} d={area} fill="url(#dp-spark)" className="animate-area-in" />
      <path
        key={`l-${runKey}`}
        d={line}
        fill="none"
        stroke="rgb(59,158,255)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        className="animate-draw-line"
      />
      <circle key={`d-${runKey}`} cx={lx} cy={ly} r="3.5" fill="rgb(59,158,255)" className="animate-dot-in" />
    </svg>
  );
}
