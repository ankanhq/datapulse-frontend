import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchInsights, fetchRows, createReport } from "../api";
import Spinner from "./Spinner";
import useColdStart from "../useColdStart";
import { useCountUp, Sparkline } from "./evidenceVisuals";

// Evidence Mode — a trustworthy, evidence-backed data story. Every card here is
// rendered straight from numbers the backend computed (insights.py); nothing is
// generated. The "Show evidence" drawer proves each claim with the exact rows
// and the calculation behind it.

const MODES = [
  { id: "student", label: "Student" },
  { id: "analyst", label: "Analyst" },
  { id: "founder", label: "Founder" },
  { id: "manager", label: "Manager" },
  { id: "researcher", label: "Researcher" },
];

// Order + friendly headings for the category sections.
const SECTIONS = [
  { key: "top_insights", title: "Top insights", blurb: "The most notable computed findings, ranked." },
  { key: "hidden_patterns", title: "Hidden patterns", blurb: "Concentration and trends the raw table hides." },
  { key: "what_changed_most", title: "What changed most", blurb: "Biggest movers between the earlier and later half." },
  { key: "anomalies", title: "Anomalies", blurb: "Outliers flagged by the 1.5×IQR fence." },
  { key: "correlations", title: "Correlations", blurb: "Pairwise Pearson relationships between numbers." },
  { key: "missing_data", title: "Data completeness", blurb: "Where values are missing and how much." },
];

function fmt(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

function confidenceTone(c) {
  if (c >= 0.66) return { label: "High confidence", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
  if (c >= 0.33) return { label: "Medium confidence", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  return { label: "Low confidence", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" };
}

function trustTone(t) {
  if (t >= 70) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (t >= 40) return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-rose-500/15 text-rose-300 border-rose-500/30";
}

function Badge({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  );
}

// `displayPct` lets a caller animate the number while the tone/label stay fixed
// to the true value (so the badge colour doesn't flicker across tiers mid-count).
function ConfidenceBadge({ value, displayPct }) {
  const t = confidenceTone(value);
  const pct = displayPct ?? Math.round(value * 100);
  return (
    <Badge className={t.cls} aria-label={`${t.label}, ${Math.round(value * 100)} percent`}>
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t.label} · {pct}%
    </Badge>
  );
}

function TrustBadge({ value }) {
  return (
    <Badge className={trustTone(value)} aria-label={`Trust score ${value} out of 100`}>
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Trust {value}/100
    </Badge>
  );
}

// Small info popover explaining what Confidence and Trust mean, in plain words.
function ScoreInfo() {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="How to read the confidence and trust scores"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-[11px] font-medium text-slate-300 transition hover:bg-slate-700"
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 7.5h.01" strokeLinecap="round" />
        </svg>
        How scores work
      </button>
      {open && (
        <>
          {/* click-away layer */}
          <span className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <span
            role="dialog"
            className="absolute left-0 z-30 mt-2 block w-72 rounded-xl border border-slate-700 bg-slate-900 p-3 text-left shadow-xl shadow-black/40"
          >
            <span className="block text-xs font-semibold text-emerald-300">Confidence (0–100%)</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
              How strong the pattern is — its effect size scaled by how many rows back it.
              Higher means the signal stands out from noise.
            </span>
            <span className="mt-2 block text-xs font-semibold text-emerald-300">Trust score (0–100)</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
              How much to rely on the number overall. It blends sample size, how complete
              the columns are, and how consistent the values are.
            </span>
            <span className="mt-2 block text-[11px] leading-relaxed text-slate-500">
              Green = high · amber = medium · grey/red = low — treat low scores as directional,
              not conclusive.
            </span>
          </span>
        </>
      )}
    </span>
  );
}

// Render one supporting metric value — scalars nicely, nested structures compactly.
function MetricValue({ value }) {
  if (value !== null && typeof value === "object") {
    return (
      <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-950/60 p-2 text-[11px] leading-relaxed text-slate-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span className="text-slate-100">{fmt(value)}</span>;
}

// Pick a numeric series to draw: an explicit `spark`, else the first array of
// >=3 finite numbers among the supporting metrics. Null means "no chart".
function sparkPoints(insight) {
  const ok = (a) =>
    Array.isArray(a) && a.length >= 3 && a.every((n) => typeof n === "number" && Number.isFinite(n));
  if (ok(insight.spark)) return insight.spark;
  for (const v of Object.values(insight.supporting_metrics || {})) {
    if (ok(v)) return v;
  }
  return null;
}

function InsightCard({ insight, index = 0, onShowEvidence }) {
  const limitation = insight.is_limitation;
  // Hooks run every render regardless of card type; the values are only shown
  // for real (non-limitation) cards. useCountUp settles to the final number
  // instantly under prefers-reduced-motion.
  const trustAnim = useCountUp(insight.trust_score ?? 0, insight.id, 1400);
  const confPct = Math.round(useCountUp((insight.confidence ?? 0) * 100, insight.id));
  const points = limitation ? null : sparkPoints(insight);
  return (
    <article
      style={{ animationDelay: `${index * 60}ms` }}
      className={`group animate-card-in rounded-2xl border p-4 backdrop-blur transition duration-200 hover:-translate-y-0.5 sm:p-5 ${
        limitation
          ? "border-slate-800 bg-slate-900/40"
          : "border-slate-700/70 bg-slate-900/60 shadow-lg shadow-black/20 hover:border-pulse-500/40"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-base font-semibold text-slate-50">{insight.title}</h4>
        <div className="flex flex-wrap items-center gap-1.5">
          {limitation ? (
            <Badge className="border-slate-600/40 bg-slate-700/30 text-slate-300">Limitation</Badge>
          ) : (
            <>
              <ConfidenceBadge value={insight.confidence} displayPct={confPct} />
              <TrustBadge value={insight.trust_score} />
            </>
          )}
        </div>
      </div>

      <p className="text-sm leading-6 text-slate-300">{insight.explanation}</p>

      {/* The preview's visual language, on the real numbers: an animated curve
          when a series exists, then a trust meter that fills as it counts up. */}
      {points && <Sparkline points={points} runKey={insight.id} />}

      {!limitation && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="uppercase tracking-wide text-slate-500">Trust score</span>
            <span className="font-semibold tabular-nums text-slate-300">
              {Math.round(trustAnim)}/100
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full border ${trustTone(insight.trust_score)}`}
              style={{ width: `${trustAnim}%` }}
            />
          </div>
        </div>
      )}

      {insight.why_it_matters && (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-300">Why this matters</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">{insight.why_it_matters}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {insight.what_to_check_next && (
            <>
              <span className="font-medium text-slate-400">Next:</span> {insight.what_to_check_next}
            </>
          )}
        </p>
        {!limitation && (insight.evidence_rows?.length > 0 || Object.keys(insight.supporting_metrics || {}).length > 0) && (
          <button
            type="button"
            onClick={() => onShowEvidence(insight)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:border-pulse-500/50 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-pulse-500"
            aria-label={`Show the evidence behind: ${insight.title}`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Show evidence
          </button>
        )}
      </div>
    </article>
  );
}

function EvidenceDrawer({ datasetId, filtersParam, insight, onClose, onHighlightInTable }) {
  const rowIds = insight?.evidence_rows ?? [];
  const panelRef = useRef(null);
  const rowsQuery = useQuery({
    queryKey: ["evidence-rows", datasetId, rowIds, filtersParam],
    queryFn: () => fetchRows(datasetId, rowIds, filtersParam),
    enabled: !!insight && rowIds.length > 0,
    placeholderData: keepPreviousData,
  });

  // Close on Escape, lock background scroll while open, and move focus into the
  // drawer so keyboard users land inside the dialog.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!insight) return null;
  const rows = rowsQuery.data?.data ?? [];
  const cols = rowsQuery.data?.columns ?? [];
  const metrics = insight.supporting_metrics || {};

  // Portal into <body> so the fixed inset-0 overlay pins to the VIEWPORT. The
  // Evidence section carries a lingering `transform` from its fade-in animation,
  // and a transformed ancestor becomes the containing block for fixed-position
  // descendants — which would otherwise anchor this drawer to the section (off
  // screen for lower cards) instead of the viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Evidence for ${insight.title}`}
        className="animate-slide-in relative flex h-full w-full max-w-2xl flex-col border-l border-slate-800 bg-slate-950/95 shadow-2xl focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-300">Proof</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-50">{insight.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ConfidenceBadge value={insight.confidence} />
              <TrustBadge value={insight.trust_score} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-pulse-500"
            aria-label="Close evidence"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* The calculation / numbers behind the claim */}
          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-200">The calculation</h4>
            <dl className="grid gap-2 sm:grid-cols-2">
              {Object.entries(metrics).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">{k.replace(/_/g, " ")}</dt>
                  <dd className="mt-0.5 break-words text-sm"><MetricValue value={v} /></dd>
                </div>
              ))}
            </dl>
            {insight.evidence_columns?.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Columns involved: {insight.evidence_columns.join(", ")}
              </p>
            )}
          </section>

          {/* The exact supporting rows */}
          <section>
            {/* Sticks to the top of the scroll area so "Highlight in data table"
                stays tappable while reading a long list of rows. The negative
                inset/offset cancel the scroll container's p-4 so the opaque
                backing spans the full width and pins flush against the drawer
                header — otherwise rows scroll through the padding gap above it. */}
            <div className="sticky -top-4 z-10 -mx-4 mb-2 flex items-center justify-between gap-2 bg-slate-950/95 px-4 py-2 backdrop-blur">
              <h4 className="text-sm font-semibold text-slate-200">
                Supporting rows{rowIds.length ? ` (${rowIds.length})` : ""}
              </h4>
              {rowIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onHighlightInTable(rowIds, insight.title)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-pulse-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-pulse-600 focus:outline-none focus:ring-2 focus:ring-pulse-500"
                >
                  Highlight in data table
                </button>
              )}
            </div>
            {rowIds.length === 0 ? (
              <p className="text-sm text-slate-500">
                This insight is computed over the whole slice rather than specific rows.
              </p>
            ) : rowsQuery.isLoading ? (
              <Spinner label="Loading the proof rows…" />
            ) : rowsQuery.isError ? (
              <div className="rounded-lg border border-red-900 bg-red-950/40 p-3">
                <p className="text-sm text-red-200">Couldn’t load the proof rows.</p>
                <p className="mt-1 text-xs text-red-300">{rowsQuery.error.message}</p>
                <button
                  type="button"
                  onClick={() => rowsQuery.refetch()}
                  className="mt-2 inline-flex items-center rounded-md border border-red-700/70 bg-red-900/40 px-3 py-1 text-xs font-medium text-red-100 transition hover:bg-red-900/70"
                >
                  Retry
                </button>
              </div>
            ) : (
              /* Bounded height makes this wrapper the rows' own scrollport, which
                 is what the sticky column headers pin against — without it they'd
                 have nothing to stick to and would scroll away with the drawer.
                 Sticky sits on the th cells (not thead) for Safari, and the
                 background must be opaque or rows show through it. */
              <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="uppercase tracking-wide text-slate-400">
                    <tr>
                      {cols.map((c) => (
                        <th key={c.name} className="sticky top-0 z-10 bg-slate-800 px-2.5 py-2 font-medium">{c.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.__rowid} className="border-t border-slate-800 odd:bg-slate-900/40">
                        {cols.map((c) => (
                          <td key={c.name} className="whitespace-nowrap px-2.5 py-1.5 text-slate-200">
                            {fmt(row[c.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function EvidenceMode({ dataset, columns, filters = [], filtersParam, onHighlightInTable }) {
  const [mode, setMode] = useState("analyst");
  const [drawerInsight, setDrawerInsight] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareError, setShareError] = useState("");
  const [copied, setCopied] = useState(false);
  const waking = useColdStart();

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["insights", dataset.dataset_id, mode, filtersParam ?? null],
    queryFn: () => fetchInsights(dataset.dataset_id, { mode, filters: filtersParam }),
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const byCategory = useMemo(() => {
    const map = {};
    for (const ins of data?.insights ?? []) {
      (map[ins.category] ||= []).push(ins);
    }
    return map;
  }, [data]);

  const execCard = (byCategory.executive_summary || [])[0];

  // "Meaningful" = a real computed finding, not the exec summary and not a
  // limitation. If there are none, we show a friendly explainer rather than a
  // page of only limitation cards (or a blank screen).
  const meaningfulCount = useMemo(
    () =>
      (data?.insights ?? []).filter(
        (i) => !i.is_limitation && i.category !== "executive_summary"
      ).length,
    [data]
  );

  function handleHighlight(rowIds, label) {
    setDrawerInsight(null);
    onHighlightInTable?.(rowIds, label);
  }

  // Reset any existing share link whenever the underlying report changes.
  useEffect(() => {
    setShareUrl("");
    setShareError("");
  }, [dataset.dataset_id, mode, filtersParam]);

  async function handleGenerateReport() {
    if (!data || shareBusy) return;
    setShareBusy(true);
    setShareError("");
    try {
      const res = await createReport(data, dataset.name);
      setShareUrl(`${window.location.origin}${res.url}`);
    } catch (e) {
      setShareError(e?.message || "Could not generate a shareable report.");
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is still visible to copy manually */
    }
  }

  return (
    <section className="animate-fade-in space-y-6">
      {/* Header + audience selector */}
      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4 backdrop-blur sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-pulse-300">Evidence Mode</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-50 sm:text-xl">
              The story behind your data — with the proof attached
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Every insight below is computed from your rows. Open “Show evidence” on any card to
              see the exact numbers and rows that back it.
              {isFetching && <span className="ml-2 text-slate-500">Refreshing…</span>}
            </p>
            <div className="mt-2">
              <ScoreInfo />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div>
              <label htmlFor="audience-mode" className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Explain for
              </label>
              <select
                id="audience-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="mt-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-pulse-500 focus:outline-none focus:ring-1 focus:ring-pulse-500"
              >
                {MODES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={shareBusy || !data}
              className="inline-flex items-center gap-1.5 rounded-md bg-pulse-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-pulse-600 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-pulse-500"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {shareBusy ? "Generating…" : "Generate report"}
            </button>
          </div>
        </div>

        {(shareUrl || shareError) && (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            {shareError ? (
              <p className="text-sm text-red-400">{shareError}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-slate-500">Shareable link</span>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-pulse-300 hover:underline"
                >
                  {shareUrl}
                </a>
                <button
                  type="button"
                  onClick={copyShare}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-100 transition hover:bg-slate-700"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                <p className="w-full text-[11px] text-slate-500">
                  Read-only snapshot of this story. Links are best-effort on the free tier and may expire on server restart.
                </p>
              </div>
            )}
          </div>
        )}

        {filters.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <span className="uppercase tracking-wide text-slate-500">Filtered:</span>
            {filters.map((f, i) => (
              <span key={i} className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5">
                {f.col} {f.op} {String(f.value)}
              </span>
            ))}
          </div>
        )}
      </div>

      {isError ? (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4">
          <p className="text-sm font-medium text-red-200">Couldn’t compute insights</p>
          <p className="mt-1 text-sm text-red-300">{error.message}</p>
          <p className="mt-1 text-xs text-red-300/70">
            The rest of DataPulse (table, charts, export) still works. If this was a cold start,
            the server may just need a moment.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-700/70 bg-red-900/40 px-3 py-1.5 text-xs font-medium text-red-100 transition hover:bg-red-900/70"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
          <Spinner
            label={
              waking
                ? "Waking up the server… (~30s on the free tier)"
                : "Computing evidence-backed insights…"
            }
          />
        </div>
      ) : data ? (
        <>
          {data.summary && <SummaryStrip summary={data.summary} quality={data.data_quality} />}

          {execCard && (
            <div className="rounded-2xl border border-pulse-500/30 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-4 backdrop-blur sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-300">Executive summary</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{execCard.explanation}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{execCard.why_it_matters}</p>
            </div>
          )}

          {meaningfulCount === 0 && (
            <div className="rounded-2xl border border-amber-700/40 bg-amber-950/30 p-4 sm:p-5">
              <p className="text-sm font-medium text-amber-100">
                No high-confidence insights for this slice
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-200/80">
                DataPulse analysed the data but every check either didn’t apply or didn’t clear the
                confidence bar — often because there are too few rows, no date/numeric columns, or a
                single dominant value. That’s reported honestly below rather than invented. Try a
                larger dataset, fewer filters, or a file with date and numeric columns.
              </p>
            </div>
          )}

          {SECTIONS.map((section) => {
            const items = byCategory[section.key];
            if (!items || items.length === 0) return null;
            return (
              <div key={section.key}>
                <div className="mb-3">
                  <h3 className="text-base font-semibold text-slate-100">{section.title}</h3>
                  <p className="text-xs text-slate-500">{section.blurb}</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {items.map((insight, index) => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      index={index}
                      onShowEvidence={setDrawerInsight}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {data.follow_up_questions?.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
              <h3 className="text-base font-semibold text-slate-100">Questions worth asking next</h3>
              <ul className="mt-3 space-y-2">
                {data.follow_up_questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="mt-0.5 text-pulse-400">→</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}

      {drawerInsight && (
        <EvidenceDrawer
          datasetId={dataset.dataset_id}
          filtersParam={filtersParam}
          insight={drawerInsight}
          onClose={() => setDrawerInsight(null)}
          onHighlightInTable={handleHighlight}
        />
      )}
    </section>
  );
}

function QualityChip({ label, value, tone = "default" }) {
  const cls =
    tone === "bad"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : tone === "good"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
        : "border-slate-700 bg-slate-800/60 text-slate-200";
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SummaryStrip({ summary, quality }) {
  const dr = summary.date_range;
  const worstMissing = Object.entries(quality?.missing_by_column || {})
    .map(([col, m]) => ({ col, pct: m.missing_pct }))
    .sort((a, b) => b.pct - a.pct)[0];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <QualityChip label="Rows" value={summary.rows.toLocaleString()} />
      <QualityChip label="Columns" value={summary.columns} />
      <QualityChip
        label="Date span"
        value={dr ? `${dr.span_days ?? "—"} days` : "No date column"}
      />
      <QualityChip
        label="Duplicate rows"
        value={quality?.duplicate_rows ?? 0}
        tone={quality?.duplicate_rows > 0 ? "bad" : "good"}
      />
      <QualityChip
        label="Most missing"
        value={worstMissing ? `${worstMissing.col} · ${worstMissing.pct}%` : "—"}
        tone={worstMissing && worstMissing.pct >= 20 ? "bad" : "default"}
      />
    </div>
  );
}
