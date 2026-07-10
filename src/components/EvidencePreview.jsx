import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion, useCountUp, Sparkline } from "./evidenceVisuals";

// A living, front-end-only mock of an Evidence Mode card, shown beside the login
// form. It makes the "every claim comes with proof" promise concrete before the
// user has signed in. Nothing here touches the network: the numbers, the chart
// and the trust meter are all local, so the login screen can never be slowed or
// blocked by it.

const CYCLES = [
  {
    title: "Revenue climbed 24% in the second half",
    metric: 24.3,
    suffix: "%",
    prefix: "+",
    caption: "vs. the first half · 2,000 rows",
    trust: 100,
    columns: "timestamp, revenue",
    points: [18, 22, 20, 27, 25, 33, 38, 36, 44, 49, 47, 56],
  },
  {
    title: "'Database' changed most in category",
    metric: 22,
    suffix: "",
    prefix: "−",
    caption: "row delta · earlier vs. later half",
    trust: 86,
    columns: "timestamp, category",
    points: [52, 48, 50, 43, 45, 38, 34, 36, 29, 26, 24, 21],
  },
  {
    title: "3 outliers beyond the 1.5×IQR fence",
    metric: 3,
    suffix: "",
    prefix: "",
    caption: "flagged rows · value column",
    trust: 92,
    columns: "value",
    points: [30, 32, 31, 34, 62, 33, 30, 35, 12, 34, 33, 58],
  },
];

const CYCLE_MS = 5200;

export default function EvidencePreview({ className = "" }) {
  const [i, setI] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    timer.current = setInterval(() => setI((n) => (n + 1) % CYCLES.length), CYCLE_MS);
    return () => clearInterval(timer.current);
  }, []);

  const c = CYCLES[i];
  const metric = useCountUp(c.metric, i);
  const trust = useCountUp(c.trust, i, 1400);
  const decimals = c.metric % 1 === 0 ? 0 : 1;

  return (
    <div className={`w-full max-w-md ${className}`} aria-hidden="true">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pulse-300/80">
        Evidence Mode
      </p>
      <p className="mt-1.5 text-sm leading-6 text-slate-400">
        Every insight arrives with the numbers, the rows, and a trust score behind it.
      </p>

      <div
        key={i}
        className="animate-card-in mt-5 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 shadow-2xl shadow-black/40 backdrop-blur"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-semibold leading-snug text-slate-50">{c.title}</h3>
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            Computed
          </span>
        </div>

        <div className="mt-4 flex items-end gap-2">
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-slate-50">
            {c.prefix}
            {metric.toFixed(decimals)}
            {c.suffix}
          </span>
          <span className="pb-1.5 text-xs text-slate-500">{c.caption}</span>
        </div>

        <Sparkline points={c.points} runKey={i} />

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px]">
            <span className="uppercase tracking-wide text-slate-500">Trust score</span>
            <span className="font-semibold tabular-nums text-emerald-300">
              {Math.round(trust)}/100
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500/70 to-emerald-400 transition-[width] duration-100 ease-out"
              style={{ width: `${trust}%` }}
            />
          </div>
          <p className="mt-2.5 text-[11px] text-slate-500">Columns involved: {c.columns}</p>
        </div>
      </div>

      {/* Which card of the loop we're on — doubles as a calm progress cue. */}
      <div className="mt-4 flex items-center gap-1.5">
        {CYCLES.map((_, n) => (
          <span
            key={n}
            className={`h-1 rounded-full transition-all duration-500 ${
              n === i ? "w-6 bg-pulse-400" : "w-1.5 bg-slate-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
