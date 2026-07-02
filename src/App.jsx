import { lazy, Suspense, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Layout from "./components/Layout";
import UploadLanding from "./components/UploadLanding";
import Spinner from "./components/Spinner";
import { refreshDataset } from "./api";

const loadSummaryPanel = () => import("./components/SummaryPanel");
const loadAdaptiveChart = () => import("./components/AdaptiveChart");
const loadCompareMode = () => import("./components/CompareMode");
const loadDataTable = () => import("./components/DataTable");
const loadEvidenceMode = () => import("./components/EvidenceMode");

const SummaryPanel = lazy(loadSummaryPanel);
const AdaptiveChart = lazy(loadAdaptiveChart);
const CompareMode = lazy(loadCompareMode);
const DataTable = lazy(loadDataTable);
const EvidenceMode = lazy(loadEvidenceMode);

function preloadDashboard() {
  loadSummaryPanel();
  loadAdaptiveChart();
  loadCompareMode();
  loadDataTable();
  loadEvidenceMode();
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-pulse-500 text-white shadow-sm shadow-pulse-500/30"
          : "text-slate-300 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function App({ user = null, onSignOut = null }) {
  // The active dataset: { dataset_id, name, source, row_count, columns } | null.
  const [dataset, setDataset] = useState(null);
  const [view, setView] = useState("dashboard"); // "dashboard" | "evidence"

  // Filters are lifted here so Evidence Mode reacts to the exact same slice the
  // Data Explorer is showing (its TanStack query is keyed on these).
  const [filters, setFilters] = useState([]);
  // Rows an insight asked us to spotlight in the Data Explorer.
  const [highlight, setHighlight] = useState(null); // { rowIds:number[], label } | null

  const tableRef = useRef(null);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  function loadDataset(ds) {
    setDataset(ds);
    setFilters([]);
    setHighlight(null);
    setView("dashboard");
  }

  async function handleRefresh() {
    if (refreshing || !dataset) return;
    setRefreshing(true);
    setRefreshError("");
    try {
      const ds = await refreshDataset(dataset.dataset_id);
      setDataset(ds); // updated row_count / columns
      setHighlight(null);
      // Data changed under the same id — drop cached summary/chart/table/insights.
      queryClient.invalidateQueries();
    } catch (e) {
      setRefreshError(e.message || "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  function showEvidenceInTable(rowIds, label) {
    setHighlight({ rowIds, label });
    setView("dashboard");
    // let the dashboard paint, then bring the table into view
    requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (!dataset) {
    return (
      <Layout user={user} onSignOut={onSignOut}>
        <UploadLanding onLoaded={loadDataset} onPrepareDashboard={preloadDashboard} />
      </Layout>
    );
  }

  const filtersParam = filters.length ? JSON.stringify(filters) : undefined;

  return (
    <Layout user={user} onSignOut={onSignOut}>
      {/* Active dataset bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-100" title={dataset.source_url || dataset.name}>
            {dataset.name}
            {dataset.source === "sample" && (
              <span className="ml-2 rounded bg-pulse-500/15 px-1.5 py-0.5 text-[10px] uppercase text-pulse-400">
                sample
              </span>
            )}
            {dataset.source === "url" && (
              <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] uppercase text-emerald-300">
                linked
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400">
            {dataset.row_count.toLocaleString()} rows · {dataset.columns.length} columns
            {refreshError && <span className="ml-2 text-red-400">· {refreshError}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dataset.source === "url" && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Re-pull the latest data from the linked source"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 11A8 8 0 006 5.3L4 7m0 0V3m0 4h4m-4 6a8 8 0 0014 4.7l2-1.7m0 0v4m0-4h-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {refreshing ? "Refreshing…" : "Refresh from source"}
            </button>
          )}
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
      </div>

      {/* View tabs */}
      <div role="tablist" aria-label="Dataset views" className="mb-6 inline-flex gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
        <TabButton active={view === "dashboard"} onClick={() => setView("dashboard")}>
          Dashboard
        </TabButton>
        <TabButton active={view === "evidence"} onClick={() => setView("evidence")}>
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Evidence
          </span>
        </TabButton>
      </div>

      {/* Everything below is keyed by dataset id so state resets cleanly between
          uploads (page/sort/filter/selected column don't leak across datasets). */}
      <Suspense fallback={<Spinner label="Loading…" className="mb-6" />}>
        {/* Dashboard is kept mounted (hidden when inactive) so the table's page,
            sort and any active evidence highlight survive tab switches. */}
        <div className={view === "dashboard" ? "" : "hidden"}>
          <SummaryPanel key={`sum-${dataset.dataset_id}`} datasetId={dataset.dataset_id} />

          <div className="mb-6">
            <AdaptiveChart
              key={`chart-${dataset.dataset_id}`}
              datasetId={dataset.dataset_id}
              datasetName={dataset.name}
              columns={dataset.columns}
            />
          </div>

          <div className="mb-6">
            <CompareMode
              key={`compare-${dataset.dataset_id}`}
              dataset={dataset}
              columns={dataset.columns}
            />
          </div>

          <div ref={tableRef}>
            <DataTable
              key={`table-${dataset.dataset_id}`}
              datasetId={dataset.dataset_id}
              columns={dataset.columns}
              filters={filters}
              onFiltersChange={setFilters}
              highlightRowIds={highlight?.rowIds}
              highlightLabel={highlight?.label}
              onClearHighlight={() => setHighlight(null)}
            />
          </div>
        </div>

        {view === "evidence" && (
          <EvidenceMode
            key={`evidence-${dataset.dataset_id}`}
            dataset={dataset}
            columns={dataset.columns}
            filters={filters}
            filtersParam={filtersParam}
            onHighlightInTable={showEvidenceInTable}
          />
        )}
      </Suspense>
    </Layout>
  );
}
