import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchReport } from "../api";
import Spinner from "./Spinner";
import { KeyTakeaways, splitTakeaway } from "./keyTakeaways";

// Read-only render of a shared Evidence-Mode story (no editor: no tabs, no
// audience switch, no live table). The proof travels with the report as the
// stored supporting_metrics + evidence row ids, so it stays evidence-backed even
// after the original dataset has been evicted from the free-tier server.

const SECTIONS = [
  { key: "top_insights", title: "Top insights" },
  { key: "hidden_patterns", title: "Hidden patterns" },
  { key: "what_changed_most", title: "What changed most" },
  { key: "anomalies", title: "Anomalies" },
  { key: "correlations", title: "Correlations" },
  { key: "missing_data", title: "Data completeness" },
];

function fmt(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

function confTone(c) {
  if (c >= 0.66) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (c >= 0.33) return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-slate-500/15 text-slate-300 border-slate-500/30";
}
function trustTone(t) {
  if (t >= 70) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (t >= 40) return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-rose-500/15 text-rose-300 border-rose-500/30";
}
function Badge({ children, className }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  );
}

function Card({ insight }) {
  const metrics = insight.supporting_metrics || {};
  const { main, aside } = splitTakeaway(insight.explanation);
  // Shared reports read clean by default: the trailing "(slope … R²…)" clause is
  // tucked behind a "Show the math" toggle, mirroring the live dashboard.
  const [showMath, setShowMath] = useState(false);
  return (
    <article id={`insight-${insight.id}`} className="scroll-mt-24 rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4 backdrop-blur sm:p-5">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-base font-semibold text-slate-50">{insight.title}</h4>
        {!insight.is_limitation && (
          <div className="flex flex-wrap gap-1.5">
            {metrics.rare_but_real ? (
              <Badge className="bg-pulse-500/15 text-pulse-300 border-pulse-500/30">Rare but real</Badge>
            ) : metrics.all_clear ? (
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">All clear</Badge>
            ) : (
              <Badge className={confTone(insight.confidence)}>{Math.round(insight.confidence * 100)}% confidence</Badge>
            )}
            <Badge className={metrics.all_clear ? "bg-slate-500/15 text-slate-300 border-slate-500/30" : trustTone(insight.trust_score)}>Trust {insight.trust_score}/100</Badge>
          </div>
        )}
      </div>
      <p className="text-sm leading-6 text-slate-300">{main}</p>
      {aside && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setShowMath((v) => !v)}
            aria-expanded={showMath}
            className="text-xs text-slate-500 transition hover:text-pulse-300 focus:outline-none focus:text-pulse-300"
          >
            {showMath ? "Hide the math" : "Show the math"}
          </button>
          {showMath && <p className="mt-1 text-xs text-slate-500">{aside}</p>}
        </div>
      )}
      {insight.why_it_matters && (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-pulse-300">Why this matters</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">{insight.why_it_matters}</p>
        </div>
      )}
      {Object.keys(metrics).length > 0 && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-sm font-medium text-pulse-300 hover:text-pulse-200">
            Show the numbers behind this
          </summary>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {Object.entries(metrics).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">{k.replace(/_/g, " ")}</dt>
                <dd className="mt-0.5 break-words text-sm text-slate-100">
                  {v !== null && typeof v === "object" ? (
                    <pre className="max-h-40 overflow-auto rounded bg-slate-950/60 p-2 text-[11px] text-slate-300">
                      {JSON.stringify(v, null, 2)}
                    </pre>
                  ) : (
                    fmt(v)
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {insight.evidence_columns?.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">Columns involved: {insight.evidence_columns.join(", ")}</p>
          )}
          {insight.evidence_rows?.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">Backed by {insight.evidence_rows.length} specific row(s).</p>
          )}
        </details>
      )}
    </article>
  );
}

export default function ReportView({ token }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["report", token],
    queryFn: () => fetchReport(token),
    retry: false,
  });

  if (isLoading) {
    return <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8"><Spinner label="Loading shared report…" /></div>;
  }
  if (isError) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-900 bg-red-950/40 p-6 text-center">
        <p className="text-sm text-red-300">{error.message}</p>
        <a href="/" className="mt-4 inline-block rounded-md bg-pulse-500 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-600">
          Open DataPulse
        </a>
      </div>
    );
  }

  const report = data.report || {};
  const insights = report.insights || [];
  const byCategory = {};
  for (const ins of insights) (byCategory[ins.category] ||= []).push(ins);
  const exec = (byCategory.executive_summary || [])[0];
  const summary = report.summary || {};

  return (
    <div className="animate-fade-in space-y-6">
      <div className="rounded-2xl border border-pulse-500/30 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-wide text-pulse-300">Shared Evidence report · read-only</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-50">
          {data.dataset_name || "Data story"}
        </h2>
        {exec && <p className="mt-2 text-sm leading-6 text-slate-200">{exec.explanation}</p>}
        <a href="/" className="mt-3 inline-flex items-center gap-1.5 text-sm text-pulse-300 hover:underline">
          Explore your own data in DataPulse →
        </a>
      </div>

      {summary.rows !== undefined && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Chip label="Rows" value={Number(summary.rows).toLocaleString()} />
          <Chip label="Columns" value={summary.columns} />
          <Chip label="Date span" value={summary.date_range ? `${summary.date_range.span_days ?? "—"} days` : "No dates"} />
          <Chip label="Duplicate rows" value={report.data_quality?.duplicate_rows ?? 0} />
        </div>
      )}

      {/* Same digest as the live dashboard. Old saved reports predate the
          key_takeaways field, so KeyTakeaways falls back to the top_insights cards. */}
      <KeyTakeaways report={report} />

      {SECTIONS.map((s) => {
        const items = byCategory[s.key];
        if (!items || items.length === 0) return null;
        return (
          <div key={s.key}>
            <h3 className="mb-3 text-base font-semibold text-slate-100">{s.title}</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((ins) => <Card key={ins.id} insight={ins} />)}
            </div>
          </div>
        );
      })}

      {report.follow_up_questions?.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h3 className="text-base font-semibold text-slate-100">Questions worth asking next</h3>
          <ul className="mt-3 space-y-2">
            {report.follow_up_questions.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="mt-0.5 text-pulse-400">→</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Chip({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
