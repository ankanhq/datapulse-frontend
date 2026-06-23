import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchQuery, exportUrl } from "../api";
import Spinner from "./Spinner";

const PAGE_SIZE = 50;
const SORTABLE = ["id", "timestamp", "value"];
// Above this, exporting is a heavy download, so confirm first.
const EXPORT_CONFIRM_THRESHOLD = 1_000_000;

const inputClass =
  "rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 " +
  "placeholder:text-slate-500 focus:border-pulse-500 focus:outline-none focus:ring-1 focus:ring-pulse-500";

export default function DataTable({ categories = [] }) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("asc");
  // Draft filters (form inputs) vs applied filters (sent to backend).
  const [draft, setDraft] = useState({
    category: "",
    min_value: "",
    max_value: "",
    start_date: "",
    end_date: "",
  });
  const [filters, setFilters] = useState(draft);

  const params = {
    page,
    page_size: PAGE_SIZE,
    sort_by: sortBy,
    sort_order: sortOrder,
    ...filters,
  };

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["query", params],
    queryFn: () => fetchQuery(params),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function toggleSort(column) {
    if (!SORTABLE.includes(column)) return;
    if (sortBy === column) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setPage(1);
  }

  function applyFilters(e) {
    e.preventDefault();
    setFilters(draft);
    setPage(1);
  }

  function resetFilters() {
    const cleared = {
      category: "",
      min_value: "",
      max_value: "",
      start_date: "",
      end_date: "",
    };
    setDraft(cleared);
    setFilters(cleared);
    setPage(1);
  }

  function handleExport() {
    // Export the whole filtered+sorted set (same filters as the table),
    // independent of the current page. Large sets confirm first.
    if (
      totalCount > EXPORT_CONFIRM_THRESHOLD &&
      !window.confirm(
        `This will export ${totalCount.toLocaleString()} rows as CSV, which may ` +
          `be a large download. Continue?`
      )
    ) {
      return;
    }
    const url = exportUrl({
      sort_by: sortBy,
      sort_order: sortOrder,
      ...filters,
    });
    // Direct browser navigation streams straight to disk (no JS buffering).
    const a = document.createElement("a");
    a.href = url;
    a.download = "datapulse_export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const columns = rows.length ? Object.keys(rows[0]) : ["id", "timestamp", "value", "category", "region"];

  function sortIndicator(col) {
    if (sortBy !== col) return SORTABLE.includes(col) ? " ↕" : "";
    return sortOrder === "asc" ? " ↑" : " ↓";
  }

  return (
    <section className="animate-fade-in rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold sm:text-lg">Data Explorer</h2>
          {isFetching && <Spinner label="Updating…" />}
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={totalCount === 0}
          title="Download the current filtered & sorted result set as CSV"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <form
        onSubmit={applyFilters}
        className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6"
      >
        <select
          className={inputClass}
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className={inputClass}
          type="number"
          step="0.01"
          placeholder="Min value"
          value={draft.min_value}
          onChange={(e) => setDraft({ ...draft, min_value: e.target.value })}
        />
        <input
          className={inputClass}
          type="number"
          step="0.01"
          placeholder="Max value"
          value={draft.max_value}
          onChange={(e) => setDraft({ ...draft, max_value: e.target.value })}
        />
        <input
          className={inputClass}
          type="datetime-local"
          value={draft.start_date}
          onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
        />
        <input
          className={inputClass}
          type="datetime-local"
          value={draft.end_date}
          onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-md bg-pulse-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-pulse-600"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="relative overflow-x-auto rounded-lg border border-slate-800">
        {isError ? (
          <p className="p-6 text-sm text-red-400">Error: {error.message}</p>
        ) : isLoading ? (
          <div className="p-6">
            <Spinner label="Loading rows…" />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    onClick={() => toggleSort(col)}
                    className={`px-4 py-2.5 font-medium ${
                      SORTABLE.includes(col) ? "cursor-pointer select-none hover:text-slate-200" : ""
                    }`}
                  >
                    {col}
                    <span className="text-pulse-400">{sortIndicator(col)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  className="border-t border-slate-800 odd:bg-slate-900/40 hover:bg-slate-800/60"
                >
                  {columns.map((col) => (
                    <td key={col} className="whitespace-nowrap px-4 py-2 text-slate-200">
                      {typeof row[col] === "number" ? row[col].toLocaleString() : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                    No rows match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs text-slate-400">
          {totalCount.toLocaleString()} rows · page {page} of {totalPages.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </section>
  );
}
