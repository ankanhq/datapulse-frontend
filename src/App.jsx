import { useQuery } from "@tanstack/react-query";
import { API_BASE, fetchSummary } from "./api";
import Layout from "./components/Layout";
import Spinner from "./components/Spinner";
import DataTable from "./components/DataTable";
import ValueOverTimeChart from "./components/ValueOverTimeChart";
import CategoryDistributionChart from "./components/CategoryDistributionChart";

function StatCard({ label, value }) {
  return (
    <div className="animate-fade-in rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-50 sm:text-3xl">{value}</p>
    </div>
  );
}

export default function App() {
  const { data: summary, isLoading, isError, error } = useQuery({
    queryKey: ["summary"],
    queryFn: fetchSummary,
  });

  const categories = summary?.unique_categories ?? [];

  return (
    <Layout>
      {isError && (
        <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          Could not reach the DataPulse API at <code>{API_BASE}</code>: {error.message}. Is the
          backend running and is this origin allowed by its CORS configuration?
        </div>
      )}

      {isLoading ? (
        <Spinner label="Loading summary…" className="mb-6" />
      ) : (
        summary && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total rows" value={summary.total_rows.toLocaleString()} />
            <StatCard label="Average value" value={summary.avg_value?.toFixed(2)} />
            <StatCard label="Categories" value={categories.length} />
          </div>
        )
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ValueOverTimeChart
            categories={categories}
            minTimestamp={summary?.min_timestamp}
            maxTimestamp={summary?.max_timestamp}
          />
        </div>
        <div className="lg:col-span-1">
          <CategoryDistributionChart />
        </div>
      </div>

      <div className="mt-4">
        <DataTable categories={categories} />
      </div>
    </Layout>
  );
}
