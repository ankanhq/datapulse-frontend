import { useMemo } from "react";
import { prefersReducedMotion } from "./evidenceVisuals";

// The "things that matter" digest, shared by the live dashboard (EvidenceMode)
// and shared reports (ReportView). Purely presentational: it reads the same
// numbers the backend already computed and never invents a finding.

// Split a plain-language takeaway from a single trailing technical parenthetical
// (the analyst/researcher "(slope … R²…)" clause) so the sentence reads clean and
// the stats render as a muted aside. Greedy main capture peels only the LAST
// "(...)" — and only one with no nested parens — at the very end; mid-sentence
// parentheticals like "(2,838 of 4,305)" stay in the takeaway. No trailing "(...)"
// -> the whole string is the takeaway.
export function splitTakeaway(text) {
  if (!text) return { main: "", aside: null };
  const m = text.match(/^(.*\S)\s*(\([^()]*\))\s*$/s);
  if (m) return { main: m[1], aside: m[2] };
  return { main: text, aside: null };
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six"];
function numberWord(n) {
  return NUMBER_WORDS[n] ?? String(n);
}

// First sentence only, so each takeaway reads as one line. Cuts at a terminator
// followed by whitespace/end (lookahead, no lookbehind — max compatibility), so
// decimals like 500000.0 (a '.' followed by a digit) are never split.
function firstSentence(text) {
  if (!text) return "";
  const s = String(text);
  const m = s.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : s).trim();
}

// Normalize a digest from a report-shaped object ({ key_takeaways?, insights? }).
// Prefer the backend's key_takeaways; fall back — for old saved reports that
// predate the field, or a response that omitted it — to the top_insights cards,
// using the plain part of each explanation truncated to its first sentence.
export function deriveTakeaways(report) {
  const backend = Array.isArray(report?.key_takeaways) ? report.key_takeaways : [];
  const clean = backend
    .filter((t) => t && typeof t.text === "string" && t.text.trim())
    .slice(0, 3)
    .map((t, i) => ({
      rank: typeof t.rank === "number" ? t.rank : i + 1,
      source_insight: t.source_insight ?? null,
      text: t.text.trim(),
    }));
  if (clean.length) return clean;

  const insights = Array.isArray(report?.insights) ? report.insights : [];
  return insights
    .filter((i) => i.category === "top_insights" && !i.is_limitation)
    .slice(0, 3)
    .map((ins, i) => {
      const m = /^top_insight_(\d+)$/.exec(ins.id || "");
      return {
        rank: m ? Number(m[1]) : i + 1,
        source_insight: ins.supporting_metrics?.source_insight ?? ins.id ?? null,
        text: firstSentence(splitTakeaway(ins.explanation).main),
      };
    })
    .filter((t) => t.text);
}

// The digest panel. Each takeaway smooth-scrolls to its card: the card whose id
// is `insight-top_insight_{rank}`, falling back to `insight-{source_insight}`.
// Renders nothing when there is no digest to show.
export function KeyTakeaways({ report }) {
  const takeaways = useMemo(() => deriveTakeaways(report), [report]);
  if (!takeaways.length) return null;
  const n = takeaways.length;

  function jumpTo(t) {
    const el =
      document.getElementById(`insight-top_insight_${t.rank}`) ||
      (t.source_insight && document.getElementById(`insight-${t.source_insight}`));
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className="rounded-2xl border border-pulse-500/30 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-4 backdrop-blur sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-300">
        The {numberWord(n)} {n === 1 ? "thing that matters" : "things that matter"} in your data
      </p>
      <ol className="mt-3 space-y-2.5">
        {takeaways.map((t) => (
          <li key={t.rank}>
            <button
              type="button"
              onClick={() => jumpTo(t)}
              className="group flex w-full items-baseline gap-3 rounded text-left focus:outline-none focus:ring-2 focus:ring-pulse-500/50"
              aria-label={`Jump to the card for: ${t.text}`}
            >
              <span className="shrink-0 text-[15px] font-semibold tabular-nums text-pulse-300">{t.rank}</span>
              <span className="text-[15px] font-medium leading-snug text-slate-50 underline-offset-2 group-hover:underline">
                {t.text}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
