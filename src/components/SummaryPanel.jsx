import { useQuery } from "@tanstack/react-query";
import { fetchSummary, API_BASE } from "../api";
import Spinner from "./Spinner";

const TYPE_BADGE = {
  number: "bg-emerald-500/15 text-emerald-300",
  date: "bg-amber-500/15 text-amber-300",
  text: "bg-sky-500/15 text-sky-300",
};

function StatCard({ label, value }) {
  return (
    <div className="animate-fade-in rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-50 sm:text-3xl">{value}</p>
    </div>
  );
}

function fmt(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}

/** One-line stat describing a column, based on its type. */
function colStat(col) {
  if (col.type === "number") {
    return `min ${fmt(col.min)} · max ${fmt(col.max)} · avg ${fmt(col.avg)}`;
  }
  if (col.type === "date") {
    return `${fmt(col.min)} → ${fmt(col.max)}`;
  }
  return `${fmt(col.distinct)} distinct values`;
}

export default function SummaryPanel({ datasetId }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["summary", datasetId],
    queryFn: () => fetchSummary(datasetId),
  });

  if (isError) {
    return (
      <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
        Could not load summary from <code>{API_BASE}</code>: {error.message}
      </div>
    );
  }

  if (isLoading) {
    return <Spinner label="Loading summary…" className="mb-6" />;
  }

  return (
    <div className="mb-6">
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total rows" value={data.total_rows.toLocaleString()} />
        <StatCard label="Columns" value={data.total_columns.toLocaleString()} />
        <StatCard label="Numeric columns" value={data.columns.filter((c) => c.type === "number").length} />
      </div>

      <div className="animate-fade-in rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold sm:text-lg">Columns</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {data.columns.map((col) => (
            <div
              key={col.name}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                    TYPE_BADGE[col.type] || TYPE_BADGE.text
                  }`}
                >
                  {col.type}
                </span>
                <span className="truncate text-sm text-slate-200" title={col.name}>
                  {col.name}
                </span>
              </div>
              <span className="shrink-0 text-xs text-slate-500">{colStat(col)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
