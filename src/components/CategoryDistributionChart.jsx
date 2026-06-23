import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { fetchChart } from "../api";
import Spinner from "./Spinner";

ChartJS.register(ArcElement, Tooltip, Legend);

const PALETTE = ["#1a85ff", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#14b8a6"];
const inputClass =
  "rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-sm text-slate-100 focus:border-pulse-500 focus:outline-none";

export default function CategoryDistributionChart() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const params = {
    chart_type: "category_distribution",
    start_date: startDate,
    end_date: endDate,
  };
  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["chart", params],
    queryFn: () => fetchChart(params),
    placeholderData: keepPreviousData,
  });

  const slices = data?.data ?? [];
  const chartData = {
    labels: slices.map((s) => s.category),
    datasets: [
      {
        data: slices.map((s) => s.count),
        backgroundColor: slices.map((_, i) => PALETTE[i % PALETTE.length]),
        borderColor: "#0f172a",
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom", labels: { color: "#cbd5e1" } } },
  };

  return (
    <div className="animate-fade-in rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold sm:text-lg">Category Distribution</h2>
        <div className="flex items-center gap-2">
          <input
            className={inputClass}
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            className={inputClass}
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
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
            <Doughnut data={chartData} options={options} />
          </>
        )}
      </div>
    </div>
  );
}
