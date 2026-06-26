import { useState } from "react";
import Layout from "./components/Layout";
import UploadLanding from "./components/UploadLanding";
import SummaryPanel from "./components/SummaryPanel";
import DataTable from "./components/DataTable";
import AdaptiveChart from "./components/AdaptiveChart";

export default function App() {
  // The active dataset: { dataset_id, name, source, row_count, columns } | null.
  const [dataset, setDataset] = useState(null);

  if (!dataset) {
    return (
      <Layout>
        <UploadLanding onLoaded={setDataset} />
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Active dataset bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-100" title={dataset.name}>
            {dataset.name}
            {dataset.source === "sample" && (
              <span className="ml-2 rounded bg-pulse-500/15 px-1.5 py-0.5 text-[10px] uppercase text-pulse-400">
                sample
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400">
            {dataset.row_count.toLocaleString()} rows · {dataset.columns.length} columns
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDataset(null)}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          New upload
        </button>
      </div>

      {/* Everything below is keyed by dataset id so state resets cleanly between
          uploads (page/sort/filter/selected column don't leak across datasets). */}
      <SummaryPanel key={`sum-${dataset.dataset_id}`} datasetId={dataset.dataset_id} />

      <div className="mb-6">
        <AdaptiveChart
          key={`chart-${dataset.dataset_id}`}
          datasetId={dataset.dataset_id}
          datasetName={dataset.name}
          columns={dataset.columns}
        />
      </div>

      <DataTable
        key={`table-${dataset.dataset_id}`}
        datasetId={dataset.dataset_id}
        columns={dataset.columns}
      />
    </Layout>
  );
}
