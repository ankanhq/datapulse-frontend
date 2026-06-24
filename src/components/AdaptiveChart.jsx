import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
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
import { fetchChart } from "../api";
import Spinner from "./Spinner";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler
);

const PALETTE = ["#1a85ff", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#14b8a6", "#eab308", "#ec4899"];
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

// The chart kind is decided by the selected column's type.
function chartTypeFor(colType) {
  if (colType === "date") return "time_series";
  if (colType === "number") return "numeric_histogram";
  return "category_counts";
}

export default function AdaptiveChart({ datasetId, columns }) {
  const numericColumns = useMemo(
    () => columns.filter((c) => c.type === "number"),
    [columns]
  );
  // Default to the first date column if present (most interesting), else first column.
  const defaultCol =
    columns.find((c) => c.type === "date")?.name ?? columns[0]?.name ?? "";

  const [column, setColumn] = useState(defaultCol);
  const [agg, setAgg] = useState("count");
  const [yColumn, setYColumn] = useState(numericColumns[0]?.name ?? "");

  const colType = columns.find((c) => c.name === column)?.type ?? "text";
  const chartType = chartTypeFor(colType);

  const params = {
    chart_type: chartType,
    column,
    ...(chartType === "time_series"
      ? { agg, y_column: agg === "count" ? undefined : yColumn }
      : {}),
  };

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["chart", datasetId, params],
    queryFn: () => fetchChart(datasetId, params),
    placeholderData: keepPreviousData,
    enabled: !!column,
  });

  const points = data?.data ?? [];

  let chartEl = null;
  if (chartType === "time_series") {
    const chartData = {
      labels: points.map((p) => p.time),
      datasets: [
        {
          label: agg === "count" ? "Count" : `${agg}(${yColumn})`,
          data: points.map((p) => p.value),
          borderColor: "#1a85ff",
          backgroundColor: "rgba(26,133,255,0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: points.length > 60 ? 0 : 2,
        },
      ],
    };
    chartEl = <Line data={chartData} options={AXIS} />;
  } else if (chartType === "numeric_histogram") {
    const chartData = {
      labels: points.map((p) => p.label),
      datasets: [
        {
          label: `${column} (count)`,
          data: points.map((p) => p.count),
          backgroundColor: "#1a85ff",
        },
      ],
    };
    chartEl = <Bar data={chartData} options={AXIS} />;
  } else {
    // category_counts — doughnut when few categories, bar when many.
    const labels = points.map((p) => p.label);
    const counts = points.map((p) => p.count);
    if (labels.length <= 8) {
      const chartData = {
        labels,
        datasets: [
          {
            data: counts,
            backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
            borderColor: "#0f172a",
            borderWidth: 2,
          },
        ],
      };
      chartEl = (
        <Doughnut
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom", labels: { color: "#cbd5e1" } } },
          }}
        />
      );
    } else {
      const chartData = {
        labels,
        datasets: [{ label: `${column} (count)`, data: counts, backgroundColor: "#1a85ff" }],
      };
      chartEl = <Bar data={chartData} options={AXIS} />;
    }
  }

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
            </>
          )}
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        {chartType === "time_series" && "Trend over time — choose an aggregation."}
        {chartType === "numeric_histogram" && "Distribution of values across bins."}
        {chartType === "category_counts" && "Row counts per distinct value (top 50)."}
      </p>

      <div className="relative h-80">
        {isError ? (
          <p className="text-sm text-red-400">Error: {error.message}</p>
        ) : isLoading ? (
          <Spinner label="Loading chart…" />
        ) : points.length === 0 ? (
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
    </div>
  );
}
