import { useMemo, useState } from "react";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { fetchChart, fetchSummary } from "../api";
import Spinner from "./Spinner";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler
);

const PALETTE = ["#1a85ff", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#14b8a6", "#eab308", "#ec4899"];
// Mirrors the backend cap on split-by series (main.py SPLIT_SERIES_TOP_N).
const SPLIT_SERIES_TOP_N = 8;
const inputClass =
  "rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-sm text-slate-100 focus:border-pulse-500 focus:outline-none";

const AXIS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: "#cbd5e1" } } },
  scales: {
    x: { ticks: { color: "#94a3b8", maxTicksLimit: 14 }, grid: { color: "rgba(148,163,184,0.1)" } },
    y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.1)" } },
  },
};

const AGG_LABEL = { avg: "Average", sum: "Total", count: "Count", min: "Minimum", max: "Maximum" };

function prettyName(name) {
  return String(name || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

// The chart kind is decided by the selected column's type.
function chartTypeFor(colType) {
  if (colType === "date") return "time_series";
  if (colType === "number") return "numeric_histogram";
  return "category_counts";
}

export default function AdaptiveChart({ datasetId, datasetName, columns }) {
  const queryClient = useQueryClient();
  const numericColumns = useMemo(
    () => columns.filter((c) => c.type === "number"),
    [columns]
  );
  const categoryColumns = useMemo(
    () => columns.filter((c) => c.type === "text"),
    [columns]
  );
  // Default to the first date column if present (most interesting), else first column.
  const defaultCol =
    columns.find((c) => c.type === "date")?.name ?? columns[0]?.name ?? "";

  const [column, setColumn] = useState(defaultCol);
  const [agg, setAgg] = useState("count");
  const [yColumn, setYColumn] = useState(numericColumns[0]?.name ?? "");
  const [splitBy, setSplitBy] = useState(""); // "" = single line

  // Export controls.
  const [title, setTitle] = useState("");
  const [exportState, setExportState] = useState(null); // { kind, msg } | null

  const colType = columns.find((c) => c.name === column)?.type ?? "text";
  const chartType = chartTypeFor(colType);

  const splitActive = chartType === "time_series" && !!splitBy;
  const params = {
    chart_type: chartType,
    column,
    ...(chartType === "time_series"
      ? {
          agg,
          y_column: agg === "count" ? undefined : yColumn,
          split_by: splitBy || undefined,
        }
      : {}),
  };

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["chart", datasetId, params],
    queryFn: () => fetchChart(datasetId, params),
    placeholderData: keepPreviousData,
    enabled: !!column,
  });

  const points = data?.data ?? [];

  // Build the Chart.js descriptor once so it drives both the live (dark) chart
  // and the white-background exports.
  const DOUGHNUT_OPTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom", labels: { color: "#cbd5e1" } } },
  };

  let chartJsType = null;
  let chartData = null;
  let chartOptions = AXIS;
  let defaultTitle = column;

  if (chartType === "time_series") {
    chartJsType = "line";
    const metric = agg === "count" ? "Count" : `${AGG_LABEL[agg]} ${prettyName(yColumn)}`;
    if (splitActive) {
      // One line per category value (from the backend's { labels, series } shape).
      const labels = data?.labels ?? [];
      const series = data?.series ?? [];
      defaultTitle = `${metric} by ${prettyName(column)}, per ${prettyName(splitBy)}`;
      chartData = {
        labels,
        datasets: series.map((s, i) => ({
          label: String(s.key),
          data: s.values,
          borderColor: PALETTE[i % PALETTE.length],
          backgroundColor: PALETTE[i % PALETTE.length],
          fill: false,
          tension: 0.3,
          spanGaps: true,
          pointRadius: labels.length > 60 ? 0 : 2,
        })),
      };
    } else {
      defaultTitle = `${metric} by ${prettyName(column)}`;
      chartData = {
        labels: points.map((p) => p.time),
        datasets: [
          {
            label: metric,
            data: points.map((p) => p.value),
            borderColor: "#1a85ff",
            backgroundColor: "rgba(26,133,255,0.15)",
            fill: true,
            tension: 0.3,
            pointRadius: points.length > 60 ? 0 : 2,
          },
        ],
      };
    }
  } else if (chartType === "numeric_histogram") {
    chartJsType = "bar";
    defaultTitle = `Distribution of ${prettyName(column)}`;
    chartData = {
      labels: points.map((p) => p.label),
      datasets: [
        {
          label: `${prettyName(column)} Count`,
          data: points.map((p) => p.count),
          backgroundColor: "#1a85ff",
        },
      ],
    };
  } else {
    // category_counts — doughnut when few categories, bar when many.
    const labels = points.map((p) => p.label);
    const counts = points.map((p) => p.count);
    defaultTitle = `Rows by ${prettyName(column)}`;
    if (labels.length <= 8) {
      chartJsType = "doughnut";
      chartOptions = DOUGHNUT_OPTS;
      chartData = {
        labels,
        datasets: [
          {
            label: "Rows",
            data: counts,
            backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
            borderColor: "#0f172a",
            borderWidth: 2,
          },
        ],
      };
    } else {
      chartJsType = "bar";
      chartData = {
        labels,
        datasets: [{ label: "Rows", data: counts, backgroundColor: "#1a85ff" }],
      };
    }
  }

  const COMPONENT = { line: Line, bar: Bar, doughnut: Doughnut }[chartJsType];
  const chartEl = chartData ? <COMPONENT data={chartData} options={chartOptions} /> : null;

  // Row/point presence across both shapes (single `data` vs split `series`).
  const chartLen = splitActive ? (data?.labels?.length ?? 0) : points.length;
  const hasChart = chartLen > 0 && !!chartData;
  const exportTitle = title.trim() || defaultTitle;
  const exportConfig = {
    type: chartJsType,
    data: chartData,
    title: exportTitle,
    labelFormat: chartType === "time_series" ? "date" : undefined,
    meta: { chartType, column, columnType: colType, agg, yColumn, points },
  };

  const [busy, setBusy] = useState(null); // "png" | "copy" | "pdf" | null

  function flash(msg, kind = "ok") {
    setExportState({ kind, msg });
    setTimeout(() => setExportState(null), 2500);
  }

  async function run(kind, fn, okMsg) {
    if (busy) return;
    setBusy(kind);
    try {
      const res = await fn();
      flash(typeof res === "string" && res !== "ok" ? res : okMsg);
    } catch (e) {
      flash(e?.message || "Export failed", "err");
    } finally {
      setBusy(null);
    }
  }

  const onExportPng = () =>
    run(
      "png",
      async () => {
        const { downloadChartPng } = await import("../lib/chartExport");
        return downloadChartPng(exportConfig);
      },
      "PNG downloaded"
    );

  const onCopy = () =>
    run(
      "copy",
      async () => {
        const { copyChartToClipboard } = await import("../lib/chartExport");
        const r = await copyChartToClipboard(exportConfig);
        return r === "copied" ? "Copied to clipboard" : "Clipboard blocked — downloaded instead";
      },
      "Copied to clipboard"
    );

  const onReport = () =>
    run(
      "pdf",
      async () => {
        const [{ downloadReport }, summary] = await Promise.all([
          import("../lib/reportExport"),
          queryClient.ensureQueryData({
            queryKey: ["summary", datasetId],
            queryFn: () => fetchSummary(datasetId),
          }),
        ]);
        return downloadReport({ datasetName, summary, chartConfig: exportConfig });
      },
      "Report downloaded"
    );

  return (
    <div className="animate-fade-in rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold sm:text-lg">Chart</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-400">Column</label>
          <select className={inputClass} value={column} onChange={(e) => setColumn(e.target.value)}>
            {columns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>

          {chartType === "time_series" && (
            <>
              <select className={inputClass} value={agg} onChange={(e) => setAgg(e.target.value)}>
                <option value="count">count</option>
                <option value="avg" disabled={!numericColumns.length}>avg</option>
                <option value="sum" disabled={!numericColumns.length}>sum</option>
              </select>
              {agg !== "count" && (
                <select className={inputClass} value={yColumn} onChange={(e) => setYColumn(e.target.value)}>
                  {numericColumns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {categoryColumns.length > 0 && (
                <>
                  <label className="text-xs text-slate-400">Split by</label>
                  <select className={inputClass} value={splitBy} onChange={(e) => setSplitBy(e.target.value)}>
                    <option value="">None</option>
                    {categoryColumns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        {chartType === "time_series" &&
          (splitActive
            ? `Trend over time — one line per ${prettyName(splitBy)} (top ${SPLIT_SERIES_TOP_N}).`
            : "Trend over time — choose an aggregation, and optionally split by a category.")}
        {chartType === "numeric_histogram" && "Distribution of values across bins."}
        {chartType === "category_counts" && "Row counts per distinct value (top 50)."}
      </p>

      <div className="relative h-80">
        {isError ? (
          <p className="text-sm text-red-400">Error: {error.message}</p>
        ) : isLoading ? (
          <Spinner label="Loading chart…" />
        ) : chartLen === 0 ? (
          <p className="text-sm text-slate-500">No data to chart for this column.</p>
        ) : (
          <>
            {isFetching && (
              <span className="absolute right-0 top-0 z-10">
                <Spinner label="" />
              </span>
            )}
            {chartEl}
          </>
        )}
      </div>

      {/* Export / share toolbar — turns the current chart into slide-ready output. */}
      <div className="mt-4 border-t border-slate-800 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={defaultTitle || "Chart title"}
            title="Optional title shown at the top of the exported image"
            aria-label="Export chart title"
            className={`${inputClass} min-w-0 flex-1 sm:max-w-xs`}
            disabled={!hasChart}
          />
          <button
            type="button"
            onClick={onExportPng}
            disabled={!hasChart || !!busy}
            title="Download the chart as a high-resolution PNG on a white background"
            aria-label="Export chart as PNG"
            className={btnClass}
          >
            <ImgIcon />
            {busy === "png" ? "Exporting…" : "Export chart"}
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={!hasChart || !!busy}
            title="Copy the chart image to the clipboard for pasting into slides/docs"
            aria-label="Copy chart image to clipboard"
            className={btnClass}
          >
            <CopyIcon />
            {busy === "copy" ? "Copying…" : "Copy to clipboard"}
          </button>
          <button
            type="button"
            onClick={onReport}
            disabled={!hasChart || !!busy}
            title="Download a one-page PDF report (stats + chart) on a white background"
            aria-label="Download one-page PDF report"
            className="inline-flex items-center gap-1.5 rounded-md bg-pulse-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-pulse-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <DocIcon />
            {busy === "pdf" ? "Building…" : "Download report"}
          </button>
        </div>
        {exportState && (
          <p
            className={`mt-2 text-xs ${
              exportState.kind === "err" ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {exportState.msg}
          </p>
        )}
      </div>
    </div>
  );
}

const btnClass =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 " +
  "text-sm font-medium text-slate-100 transition hover:bg-slate-700 " +
  "disabled:cursor-not-allowed disabled:opacity-40";

function ImgIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5-5L5 20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" strokeLinejoin="round" />
      <path d="M14 3v5h5M9 13h6M9 17h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
