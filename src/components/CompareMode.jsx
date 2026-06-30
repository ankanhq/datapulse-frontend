import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { fetchComparison, fetchSummary, uploadDataset } from "../api";
import Spinner from "./Spinner";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

const inputClass =
  "rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 " +
  "focus:border-pulse-500 focus:outline-none focus:ring-1 focus:ring-pulse-500";
const btnClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 " +
  "text-sm font-medium text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40";
const primaryBtnClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-pulse-500 px-3 py-1.5 text-sm font-medium text-white " +
  "transition hover:bg-pulse-600 disabled:cursor-not-allowed disabled:opacity-40";

const AGG_LABEL = { count: "Count", sum: "Total", avg: "Average" };

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: { legend: { labels: { color: "#cbd5e1" } } },
  scales: {
    x: { ticks: { color: "#94a3b8", maxTicksLimit: 10 }, grid: { color: "rgba(148,163,184,0.1)" } },
    y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.1)" } },
  },
};

function prettyName(name) {
  return String(name || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function fmt(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtSigned(value, agg) {
  const n = Number(value) || 0;
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${fmt(Math.abs(n), agg === "count" ? 0 : 2)}`;
}

function pct(delta, baseline) {
  const base = Number(baseline) || 0;
  if (!base) return "New baseline";
  return `${delta >= 0 ? "+" : ""}${((delta / Math.abs(base)) * 100).toFixed(1)}%`;
}

function dateOnly(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function compactDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" }).format(d);
}

function filtersParam(filters) {
  return filters.length ? JSON.stringify(filters) : undefined;
}

function dateRangeFilters(column, start, end) {
  const filters = [];
  if (column && start) filters.push({ col: column, op: "gte", value: start });
  if (column && end) filters.push({ col: column, op: "lte", value: end });
  return filters;
}

function splitDateRange(summary, dateColumn) {
  const col = summary?.columns?.find((c) => c.name === dateColumn);
  const start = new Date(col?.min);
  const end = new Date(col?.max);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return { baselineStart: "", baselineEnd: "", currentStart: "", currentEnd: "" };
  }
  const mid = new Date((start.getTime() + end.getTime()) / 2);
  const currentStart = new Date(mid.getTime() + 86_400_000);
  return {
    baselineStart: dateOnly(start),
    baselineEnd: dateOnly(mid),
    currentStart: dateOnly(currentStart > end ? mid : currentStart),
    currentEnd: dateOnly(end),
  };
}

function buildComparison(baseline, current, dimension, agg) {
  const baseTotal = Number(baseline?.total) || 0;
  const currentTotal = Number(current?.total) || 0;
  const delta = currentTotal - baseTotal;
  const driverMap = new Map();
  for (const d of baseline?.drivers || []) {
    driverMap.set(d.label, { label: d.label, baseline: Number(d.value) || 0, current: 0 });
  }
  for (const d of current?.drivers || []) {
    const row = driverMap.get(d.label) || { label: d.label, baseline: 0, current: 0 };
    row.current = Number(d.value) || 0;
    driverMap.set(d.label, row);
  }
  const drivers = Array.from(driverMap.values())
    .map((d) => ({ ...d, delta: d.current - d.baseline }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const top = drivers[0];
  const direction = delta > 0 ? "increased" : delta < 0 ? "decreased" : "was unchanged";
  const metricLabel = agg === "count" ? "Rows" : AGG_LABEL[agg];
  const driverText = top
    ? `${prettyName(dimension)} "${top.label}" was the largest driver, moving ${fmtSigned(top.delta, agg)}.`
    : "No single category driver stood out in the selected comparison.";

  return {
    baseTotal,
    currentTotal,
    delta,
    drivers,
    positives: drivers.filter((d) => d.delta > 0).slice(0, 4),
    negatives: drivers.filter((d) => d.delta < 0).slice(0, 4),
    narrative: `${metricLabel} ${direction} by ${fmtSigned(delta, agg)} (${pct(delta, baseTotal)}). ${driverText}`,
  };
}

function seriesChartData(baseline, current) {
  const labels = Array.from(
    new Set([...(baseline?.series || []).map((p) => p.label), ...(current?.series || []).map((p) => p.label)])
  ).sort((a, b) => new Date(a) - new Date(b));
  if (labels.length < 2) return null;
  const baseMap = new Map((baseline?.series || []).map((p) => [p.label, Number(p.value) || 0]));
  const currentMap = new Map((current?.series || []).map((p) => [p.label, Number(p.value) || 0]));
  return {
    labels: labels.map(compactDate),
    datasets: [
      {
        label: "Baseline",
        data: labels.map((label) => baseMap.get(label) ?? null),
        borderColor: "#94a3b8",
        backgroundColor: "rgba(148,163,184,0.12)",
        tension: 0.3,
        fill: false,
      },
      {
        label: "Current",
        data: labels.map((label) => currentMap.get(label) ?? null),
        borderColor: "#1a85ff",
        backgroundColor: "rgba(26,133,255,0.16)",
        tension: 0.3,
        fill: true,
      },
    ],
  };
}

function driverChartData(drivers) {
  const rows = drivers.slice(0, 8).reverse();
  if (!rows.length) return null;
  return {
    labels: rows.map((d) => d.label),
    datasets: [
      {
        label: "Delta",
        data: rows.map((d) => d.delta),
        backgroundColor: rows.map((d) => (d.delta >= 0 ? "#1a85ff" : "#f97316")),
      },
    ],
  };
}

function StatCard({ label, value, tone = "default" }) {
  const toneClass = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-orange-300" : "text-slate-50";
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

export default function CompareMode({ dataset, columns }) {
  const dateColumns = useMemo(() => columns.filter((c) => c.type === "date"), [columns]);
  const numericColumns = useMemo(() => columns.filter((c) => c.type === "number"), [columns]);
  const textColumns = useMemo(() => columns.filter((c) => c.type === "text"), [columns]);
  const dimensionColumns = useMemo(
    () => (textColumns.length ? textColumns : columns.filter((c) => c.type !== "date" && c.name !== "id")),
    [columns, textColumns]
  );
  const segmentColumns = useMemo(
    () => (textColumns.length ? textColumns : columns.filter((c) => c.type === "number")),
    [columns, textColumns]
  );

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(dateColumns.length ? "time" : "filter");
  const [agg, setAgg] = useState("count");
  const [metricColumn, setMetricColumn] = useState(numericColumns[0]?.name || "");
  const [dateColumn, setDateColumn] = useState(dateColumns[0]?.name || "");
  const [dimensionColumn, setDimensionColumn] = useState(dimensionColumns[0]?.name || "");
  const [compareColumn, setCompareColumn] = useState(segmentColumns[0]?.name || "");
  const [baselineValue, setBaselineValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [baselineStart, setBaselineStart] = useState("");
  const [baselineEnd, setBaselineEnd] = useState("");
  const [currentStart, setCurrentStart] = useState("");
  const [currentEnd, setCurrentEnd] = useState("");
  const [peerDataset, setPeerDataset] = useState(null);
  const [peerBusy, setPeerBusy] = useState(false);
  const [peerError, setPeerError] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["summary", dataset.dataset_id],
    queryFn: () => fetchSummary(dataset.dataset_id),
    enabled: open,
  });

  const defaults = useMemo(
    () => splitDateRange(summaryQuery.data, dateColumn),
    [summaryQuery.data, dateColumn]
  );

  const effectiveRanges = {
    baselineStart: baselineStart || defaults.baselineStart,
    baselineEnd: baselineEnd || defaults.baselineEnd,
    currentStart: currentStart || defaults.currentStart,
    currentEnd: currentEnd || defaults.currentEnd,
  };

  const valuesQuery = useQuery({
    queryKey: ["compare-values", dataset.dataset_id, compareColumn],
    queryFn: () => fetchComparison(dataset.dataset_id, { agg: "count", dimension_column: compareColumn }),
    enabled: open && mode === "filter" && !!compareColumn,
  });

  const segmentValues = valuesQuery.data?.drivers?.map((d) => d.label) || [];
  const effectiveBaselineValue = baselineValue || segmentValues[1] || segmentValues[0] || "";
  const effectiveCurrentValue = currentValue || segmentValues[0] || "";

  useEffect(() => {
    setBaselineValue("");
    setCurrentValue("");
  }, [compareColumn]);

  const metricParams = {
    agg,
    metric_column: agg === "count" ? undefined : metricColumn,
    date_column: dateColumn || undefined,
    dimension_column: dimensionColumn || undefined,
  };

  const baselineFilters =
    mode === "time"
      ? dateRangeFilters(dateColumn, effectiveRanges.baselineStart, effectiveRanges.baselineEnd)
      : mode === "filter" && compareColumn && effectiveBaselineValue
        ? [{ col: compareColumn, op: "eq", value: effectiveBaselineValue }]
        : [];
  const currentFilters =
    mode === "time"
      ? dateRangeFilters(dateColumn, effectiveRanges.currentStart, effectiveRanges.currentEnd)
      : mode === "filter" && compareColumn && effectiveCurrentValue
        ? [{ col: compareColumn, op: "eq", value: effectiveCurrentValue }]
        : [];

  const canCompare =
    open &&
    !!dimensionColumn &&
    (agg === "count" || !!metricColumn) &&
    (mode !== "time" || (!!dateColumn && effectiveRanges.baselineStart && effectiveRanges.currentStart)) &&
    (mode !== "filter" || (!!compareColumn && !!effectiveBaselineValue && !!effectiveCurrentValue)) &&
    (mode !== "dataset" || !!peerDataset);

  const baselineQuery = useQuery({
    queryKey: ["compare", "baseline", dataset.dataset_id, mode, metricParams, baselineFilters],
    queryFn: () => fetchComparison(dataset.dataset_id, { ...metricParams, filters: filtersParam(baselineFilters) }),
    enabled: canCompare,
    placeholderData: keepPreviousData,
  });

  const currentDatasetId = mode === "dataset" ? peerDataset?.dataset_id : dataset.dataset_id;
  const currentQuery = useQuery({
    queryKey: ["compare", "current", currentDatasetId, mode, metricParams, currentFilters],
    queryFn: () => fetchComparison(currentDatasetId, { ...metricParams, filters: filtersParam(currentFilters) }),
    enabled: canCompare && !!currentDatasetId,
    placeholderData: keepPreviousData,
  });

  const comparison = useMemo(
    () => buildComparison(baselineQuery.data, currentQuery.data, dimensionColumn, agg),
    [baselineQuery.data, currentQuery.data, dimensionColumn, agg]
  );
  const seriesData = useMemo(() => seriesChartData(baselineQuery.data, currentQuery.data), [baselineQuery.data, currentQuery.data]);
  const deltaData = useMemo(() => driverChartData(comparison.drivers), [comparison.drivers]);

  async function handlePeerUpload(file) {
    if (!file) return;
    setPeerBusy(true);
    setPeerError("");
    try {
      setPeerDataset(await uploadDataset(file));
    } catch (e) {
      setPeerError(e?.message || "Could not load comparison dataset.");
    } finally {
      setPeerBusy(false);
    }
  }

  const isLoading = baselineQuery.isLoading || currentQuery.isLoading || baselineQuery.isFetching || currentQuery.isFetching;
  const error = baselineQuery.error || currentQuery.error;
  const deltaTone = comparison.delta > 0 ? "good" : comparison.delta < 0 ? "bad" : "default";
  const metricTitle = agg === "count" ? "Row Count" : `${AGG_LABEL[agg]} ${prettyName(metricColumn)}`;

  return (
    <section className="animate-fade-in rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-pulse-300">Flagship insight</p>
          <h2 className="mt-1 text-base font-semibold sm:text-lg">Compare Mode</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Compare two slices and see the delta, top movers, and the likely reason the metric changed.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className={open ? btnClass : primaryBtnClass}>
          {open ? "Hide Compare" : "Open Compare Mode"}
        </button>
      </div>

      {open && (
        <div className="mt-5 space-y-5 border-t border-slate-800 pt-5">
          <div className="flex flex-wrap gap-2" aria-label="Compare mode type">
            <ModeButton active={mode === "time"} disabled={!dateColumns.length} onClick={() => setMode("time")}>
              Time ranges
            </ModeButton>
            <ModeButton active={mode === "filter"} disabled={!segmentColumns.length} onClick={() => setMode("filter")}>
              Filter sets
            </ModeButton>
            <ModeButton active={mode === "dataset"} onClick={() => setMode("dataset")}>
              Dataset A/B
            </ModeButton>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Metric">
                  <select className={inputClass} value={agg} onChange={(e) => setAgg(e.target.value)}>
                    <option value="count">Count rows</option>
                    <option value="sum" disabled={!numericColumns.length}>Total</option>
                    <option value="avg" disabled={!numericColumns.length}>Average</option>
                  </select>
                </Field>
                {agg !== "count" && (
                  <Field label="Numeric column">
                    <select className={inputClass} value={metricColumn} onChange={(e) => setMetricColumn(e.target.value)}>
                      {numericColumns.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Date column">
                  <select className={inputClass} value={dateColumn} onChange={(e) => setDateColumn(e.target.value)} disabled={!dateColumns.length}>
                    {dateColumns.length ? dateColumns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>) : <option>No date column</option>}
                  </select>
                </Field>
                <Field label="Driver dimension">
                  <select className={inputClass} value={dimensionColumn} onChange={(e) => setDimensionColumn(e.target.value)} disabled={!dimensionColumns.length}>
                    {dimensionColumns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </Field>
              </div>

              {mode === "time" && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <RangeFields title="Baseline range" start={effectiveRanges.baselineStart} end={effectiveRanges.baselineEnd} onStart={setBaselineStart} onEnd={setBaselineEnd} />
                  <RangeFields title="Current range" start={effectiveRanges.currentStart} end={effectiveRanges.currentEnd} onStart={setCurrentStart} onEnd={setCurrentEnd} />
                </div>
              )}

              {mode === "filter" && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Field label="Compare column">
                    <select className={inputClass} value={compareColumn} onChange={(e) => setCompareColumn(e.target.value)}>
                      {segmentColumns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Baseline filter">
                    <select className={inputClass} value={effectiveBaselineValue} onChange={(e) => setBaselineValue(e.target.value)} disabled={valuesQuery.isLoading || !segmentValues.length}>
                      {segmentValues.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Current filter">
                    <select className={inputClass} value={effectiveCurrentValue} onChange={(e) => setCurrentValue(e.target.value)} disabled={valuesQuery.isLoading || !segmentValues.length}>
                      {segmentValues.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              {mode === "dataset" && (
                <div className="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-950/30 p-3">
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="compare-file">
                    Current dataset
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <input
                      id="compare-file"
                      type="file"
                      accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={(e) => handlePeerUpload(e.target.files?.[0])}
                      className="block text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-pulse-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-pulse-600"
                    />
                    {peerBusy && <Spinner label="Loading dataset…" />}
                    {peerDataset && <span className="text-sm text-emerald-300">{peerDataset.name} loaded</span>}
                  </div>
                  {peerError && <p className="mt-2 text-sm text-red-400">{peerError}</p>}
                  <p className="mt-2 text-xs text-slate-500">Use a dataset with matching column names for the cleanest comparison.</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Comparison context</p>
              <h3 className="mt-1 font-semibold text-slate-100">{metricTitle}</h3>
              <p className="mt-2 text-sm text-slate-400">
                {mode === "time" && `Baseline ${effectiveRanges.baselineStart || "start"} to ${effectiveRanges.baselineEnd || "end"}; current ${effectiveRanges.currentStart || "start"} to ${effectiveRanges.currentEnd || "end"}.`}
                {mode === "filter" && `${prettyName(compareColumn)}: ${effectiveBaselineValue || "baseline"} vs ${effectiveCurrentValue || "current"}.`}
                {mode === "dataset" && `${dataset.name} vs ${peerDataset?.name || "comparison dataset"}.`}
              </p>
            </div>
          </div>

          {!canCompare && (
            <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-400">
              Choose a valid baseline and current slice to generate the comparison.
            </p>
          )}
          {error && <p className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error.message}</p>}

          {canCompare && !error && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Baseline" value={fmt(comparison.baseTotal, agg === "count" ? 0 : 2)} />
                <StatCard label="Current" value={fmt(comparison.currentTotal, agg === "count" ? 0 : 2)} />
                <StatCard label="Delta" value={fmtSigned(comparison.delta, agg)} tone={deltaTone} />
                <StatCard label="Change" value={pct(comparison.delta, comparison.baseTotal)} tone={deltaTone} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-100">Delta view</h3>
                    {isLoading && <Spinner label="Comparing…" />}
                  </div>
                  <div className="h-64">
                    {seriesData ? <Line data={seriesData} options={chartOptions} /> : deltaData ? <Bar data={deltaData} options={chartOptions} /> : <p className="text-sm text-slate-500">No chartable comparison data yet.</p>}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                    <h3 className="font-semibold text-slate-100">Why it changed</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{comparison.narrative}</p>
                  </div>
                  <DriverList title="Top positive changes" rows={comparison.positives} agg={agg} empty="No positive movers." />
                  <DriverList title="Top negative changes" rows={comparison.negatives} agg={agg} empty="No negative movers." />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
      {label}
      {children}
    </label>
  );
}

function RangeFields({ title, start, end, onStart, onEnd }) {
  return (
    <fieldset className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Field label="Start">
          <input className={inputClass} type="date" value={start} onChange={(e) => onStart(e.target.value)} />
        </Field>
        <Field label="End">
          <input className={inputClass} type="date" value={end} onChange={(e) => onEnd(e.target.value)} />
        </Field>
      </div>
    </fieldset>
  );
}

function ModeButton({ active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`${active ? "border-pulse-500 bg-pulse-500/15 text-pulse-200" : "border-slate-700 bg-slate-800 text-slate-200"} inline-flex rounded-md border px-3 py-1.5 text-sm font-medium transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function DriverList({ title, rows, agg, empty }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
      <h3 className="font-semibold text-slate-100">{title}</h3>
      {rows.length ? (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-300" title={row.label}>{row.label}</span>
              <span className={row.delta >= 0 ? "font-medium text-emerald-300" : "font-medium text-orange-300"}>{fmtSigned(row.delta, agg)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      )}
    </div>
  );
}
