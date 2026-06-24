import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchQuery, exportUrl } from "../api";
import Spinner from "./Spinner";

const PAGE_SIZE = 50;

// Operators offered per column type, with friendly labels. Values are sent to
// the backend, which validates them against the same per-type allow-list.
const OPS = {
  number: [
    { op: "eq", label: "=" },
    { op: "neq", label: "≠" },
    { op: "gte", label: "≥" },
    { op: "lte", label: "≤" },
  ],
  date: [
    { op: "gte", label: "on/after" },
    { op: "lte", label: "on/before" },
  ],
  text: [
    { op: "contains", label: "contains" },
    { op: "eq", label: "equals" },
    { op: "neq", label: "≠" },
  ],
};
const OP_LABEL = Object.fromEntries(
  Object.values(OPS).flat().map((o) => [o.op, o.label])
);

const inputClass =
  "rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 " +
  "placeholder:text-slate-500 focus:border-pulse-500 focus:outline-none focus:ring-1 focus:ring-pulse-500";

function inputTypeFor(type) {
  if (type === "number") return "number";
  if (type === "date") return "date";
  return "text";
}

export default function DataTable({ datasetId, columns }) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filters, setFilters] = useState([]); // applied: [{col, op, value}]

  // Draft filter being composed.
  const [draftCol, setDraftCol] = useState(columns[0]?.name ?? "");
  const draftColType = columns.find((c) => c.name === draftCol)?.type ?? "text";
  const [draftOp, setDraftOp] = useState(OPS[draftColType][0].op);
  const [draftVal, setDraftVal] = useState("");

  const params = {
    page,
    page_size: PAGE_SIZE,
    sort_by: sortBy,
    sort_order: sortOrder,
    filters: filters.length ? JSON.stringify(filters) : undefined,
  };

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["query", datasetId, params],
    queryFn: () => fetchQuery(datasetId, params),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function toggleSort(col) {
    if (sortBy === col) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortOrder("asc");
    }
    setPage(1);
  }

  function pickDraftCol(name) {
    setDraftCol(name);
    const t = columns.find((c) => c.name === name)?.type ?? "text";
    setDraftOp(OPS[t][0].op); // reset operator to a valid one for the new type
    setDraftVal("");
  }

  function addFilter(e) {
    e.preventDefault();
    if (draftVal === "") return;
    setFilters((f) => [...f, { col: draftCol, op: draftOp, value: draftVal }]);
    setDraftVal("");
    setPage(1);
  }

  function removeFilter(i) {
    setFilters((f) => f.filter((_, idx) => idx !== i));
    setPage(1);
  }

  function handleExport() {
    const url = exportUrl(datasetId, {
      sort_by: sortBy,
      sort_order: sortOrder,
      filters: filters.length ? JSON.stringify(filters) : undefined,
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = "datapulse_export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function sortIndicator(col) {
    if (sortBy !== col) return " ↕";
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
          title="Download the current filtered & sorted view as CSV"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Filter builder */}
      <form onSubmit={addFilter} className="mb-3 flex flex-wrap items-center gap-2">
        <select className={inputClass} value={draftCol} onChange={(e) => pickDraftCol(e.target.value)}>
          {columns.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={inputClass} value={draftOp} onChange={(e) => setDraftOp(e.target.value)}>
          {OPS[draftColType].map((o) => (
            <option key={o.op} value={o.op}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          className={inputClass}
          type={inputTypeFor(draftColType)}
          step={draftColType === "number" ? "any" : undefined}
          placeholder="value"
          value={draftVal}
          onChange={(e) => setDraftVal(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-md bg-pulse-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-pulse-600"
        >
          Add filter
        </button>
      </form>

      {/* Active filters */}
      {filters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {filters.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200"
            >
              <span className="font-medium">{f.col}</span>
              <span className="text-slate-400">{OP_LABEL[f.op] || f.op}</span>
              <span>{String(f.value)}</span>
              <button
                type="button"
                onClick={() => removeFilter(i)}
                className="ml-0.5 text-slate-500 hover:text-red-400"
                aria-label="Remove filter"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              setFilters([]);
              setPage(1);
            }}
            className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

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
                    key={col.name}
                    onClick={() => toggleSort(col.name)}
                    className="cursor-pointer select-none px-4 py-2.5 font-medium hover:text-slate-200"
                    title="Click to sort"
                  >
                    {col.name}
                    <span className="text-pulse-400">{sortIndicator(col.name)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-slate-800 odd:bg-slate-900/40 hover:bg-slate-800/60"
                >
                  {columns.map((col) => {
                    const v = row[col.name];
                    return (
                      <td key={col.name} className="whitespace-nowrap px-4 py-2 text-slate-200">
                        {v === null || v === undefined ? (
                          <span className="text-slate-600">—</span>
                        ) : typeof v === "number" ? (
                          v.toLocaleString()
                        ) : (
                          String(v)
                        )}
                      </td>
                    );
                  })}
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
