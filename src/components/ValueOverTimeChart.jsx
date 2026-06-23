import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { fetchChart } from "../api";
import Spinner from "./Spinner";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const INTERVALS = ["hour", "day", "month", "year"];
// Mirror of the backend cap (main.py): only offer intervals that produce a
// readable number of buckets for the dataset's span. Keeps "hourly over 5
// years" out of the dropdown entirely rather than relying on downsampling.
const INTERVAL_SECONDS = {
  hour: 3_600,
  day: 86_400,
  month: 2_592_000,
  year: 31_536_000,
};
const MAX_BUCKETS = 2_000;
const inputClass =
  "rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-sm text-slate-100 focus:border-pulse-500 focus:outline-none";

export default function ValueOverTimeChart({ categories = [], minTimestamp, maxTimestamp }) {
  const [interval, setInterval] = useState("month");
  const [category, setCategory] = useState("");

  // Span of the dataset; until the summary loads we don't cap (the backend
  // still guards). Intervals that would exceed MAX_BUCKETS are hidden.
  const spanSeconds =
    minTimestamp && maxTimestamp
      ? (new Date(maxTimestamp) - new Date(minTimestamp)) / 1000
      : null;
  const fits = (iv) =>
    spanSeconds === null || spanSeconds / INTERVAL_SECONDS[iv] <= MAX_BUCKETS;
  const allowedIntervals = INTERVALS.filter(fits);
  const intervalOptions = allowedIntervals.length
    ? allowedIntervals
    : [INTERVALS[INTERVALS.length - 1]];

  // If the current selection becomes invalid (e.g. range narrows/widens),
  // fall back to the finest interval that still fits.
  useEffect(() => {
    if (!intervalOptions.includes(interval)) {
      setInterval(intervalOptions[0]);
    }
  }, [intervalOptions.join(","), interval]);

  const params = { chart_type: "value_over_time", interval, category };
  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["chart", params],
    queryFn: () => fetchChart(params),
    placeholderData: keepPreviousData,
  });

  const rawPoints = data?.data ?? [];
  // The `hour` interval over 5 years returns ~44k buckets. The API serves that
  // fast, but Chart.js renders sluggishly past a few thousand points, so we
  // downsample evenly for display (the curve shape is preserved). All other
  // intervals (day ≈ 1.8k, month, year) fall under the cap and pass through.
  const MAX_POINTS = 2000;
  const points =
    rawPoints.length <= MAX_POINTS
      ? rawPoints
      : (() => {
          const step = rawPoints.length / MAX_POINTS;
          const out = [];
          for (let i = 0; i < MAX_POINTS; i++) out.push(rawPoints[Math.floor(i * step)]);
          const last = rawPoints[rawPoints.length - 1];
          if (out[out.length - 1] !== last) out.push(last);
          return out;
        })();
  const downsampled = points.length < rawPoints.length;

  const chartData = {
    labels: points.map((p) => p.time),
    datasets: [
      {
        label: "Avg value",
        data: points.map((p) => p.avg_value),
        borderColor: "#1a85ff",
        backgroundColor: "rgba(26,133,255,0.15)",
        fill: true,
        tension: 0.3,
        pointRadius: points.length > 60 ? 0 : 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: "#cbd5e1" } } },
    scales: {
      x: { ticks: { color: "#94a3b8", maxTicksLimit: 12 }, grid: { color: "rgba(148,163,184,0.1)" } },
      y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.1)" } },
    },
  };

  return (
    <div className="animate-fade-in rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold sm:text-lg">Value Over Time</h2>
        <div className="flex items-center gap-2">
          <select
            className={inputClass}
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            title={
              intervalOptions.length < INTERVALS.length
                ? "Finer intervals are hidden for this date range (too many buckets)"
                : undefined
            }
          >
            {intervalOptions.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative h-72">
        {isError ? (
          <p className="text-sm text-red-400">Error: {error.message}</p>
        ) : isLoading ? (
          <Spinner label="Loading chart…" />
        ) : (
          <>
            {isFetching && (
              <span className="absolute right-0 top-0">
                <Spinner label="" />
              </span>
            )}
            <Line data={chartData} options={options} />
            {downsampled && (
              <p className="absolute bottom-0 left-0 text-[10px] text-slate-500">
                showing {points.length.toLocaleString()} of{" "}
                {rawPoints.length.toLocaleString()} points (downsampled)
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
