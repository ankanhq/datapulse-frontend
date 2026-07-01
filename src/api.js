// Centralised access to the DataPulse FastAPI backend.
//
// The API base URL comes from VITE_API_BASE at build time (set on Vercel to the
// deployed backend); locally it falls back to the dev server. Every endpoint is
// scoped to a dataset id returned by the upload/sample calls, so each visitor
// only ever touches their own data.

export const API_BASE = (
  import.meta.env.VITE_API_BASE || "http://localhost:8000"
).replace(/\/$/, "");

const envTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);
const DEFAULT_TIMEOUT_MS = Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : 30_000;
const LOAD_TIMEOUT_MS = Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : 75_000;

// --- Cold-start ("server waking up") signal -------------------------------
// The free backend tier sleeps when idle, so the first request after a nap can
// take 30–60s. Any request still in flight after SLOW_AFTER_MS is treated as a
// cold start: we bump a counter and notify subscribers so the UI can show a
// friendly "waking up" message, then clear it the moment the request settles.
const SLOW_AFTER_MS = 4000;
let slowCount = 0;
const slowListeners = new Set();

function emitSlow() {
  const active = slowCount > 0;
  for (const listener of slowListeners) listener(active);
}

/** Subscribe to cold-start state. Calls back with `true` while at least one
 *  request has been running longer than ~4s. Returns an unsubscribe fn. */
export function subscribeColdStart(listener) {
  slowListeners.add(listener);
  listener(slowCount > 0);
  return () => slowListeners.delete(listener);
}

/** Build a query string from an object, skipping empty/undefined values. */
function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, value);
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText || "";
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* response was not JSON (e.g. an empty-body 502/503 from the host) */
    }
    if (!detail) {
      detail =
        res.status >= 500
          ? "The server had a problem handling this request (it may be waking up or overloaded)"
          : "Request failed";
    }
    // Always surface the real HTTP status so failures aren't mistaken for a
    // network/"could not reach" error.
    throw new Error(`${detail} (HTTP ${res.status})`);
  }
  return res.json();
}

async function requestJson(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let countedSlow = false;
  const slowTimer = setTimeout(() => {
    countedSlow = true;
    slowCount += 1;
    emitSlow();
  }, SLOW_AFTER_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return handle(res);
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error(
        `Request timed out after ${Math.round(timeoutMs / 1000)} seconds. The backend may be waking up or busy; please retry.`
      );
    }
    if (e instanceof TypeError) {
      throw new Error(`Could not reach the DataPulse API at ${API_BASE}. Please retry in a moment.`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
    clearTimeout(slowTimer);
    if (countedSlow) {
      slowCount -= 1;
      emitSlow();
    }
  }
}

/** Upload a CSV file. Returns { dataset_id, name, source, row_count, columns }. */
export async function uploadDataset(file) {
  const form = new FormData();
  form.append("file", file);
  return requestJson(`${API_BASE}/datasets`, { method: "POST", body: form }, LOAD_TIMEOUT_MS);
}

/** Analyze pasted CSV / tab-separated text. Same shape as uploadDataset. */
export async function pasteDataset(text, name) {
  return requestJson(`${API_BASE}/datasets/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, name }),
  }, LOAD_TIMEOUT_MS);
}

/** Load the bundled demo dataset. Same shape as uploadDataset. */
export async function loadSampleDataset() {
  return requestJson(`${API_BASE}/datasets/sample`, { method: "POST" }, LOAD_TIMEOUT_MS);
}

export const fetchSummary = (id) =>
  requestJson(`${API_BASE}/datasets/${id}/summary`);

export const fetchQuery = (id, params) =>
  requestJson(`${API_BASE}/datasets/${id}/query${toQuery(params)}`);

export const fetchChart = (id, params) =>
  requestJson(`${API_BASE}/datasets/${id}/chart${toQuery(params)}`);

export const fetchComparison = (id, params) =>
  requestJson(`${API_BASE}/datasets/${id}/compare${toQuery(params)}`);

/** Evidence Mode: the full evidence-backed insight report. params: {mode, filters}. */
export const fetchInsights = (id, params) =>
  requestJson(`${API_BASE}/datasets/${id}/insights${toQuery(params)}`);

/** Fetch the exact rows (by DuckDB rowid) behind an insight, for the proof drawer. */
export const fetchRows = (id, rowids, filters) =>
  requestJson(
    `${API_BASE}/datasets/${id}/rows${toQuery({ rowids: (rowids || []).join(","), filters })}`
  );

/** Persist a computed report for sharing. Returns { token, url }. */
export const createReport = (report, datasetName) =>
  requestJson(`${API_BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report, dataset_name: datasetName }),
  });

/** Fetch a previously shared report by token (read-only view). */
export const fetchReport = (token) => requestJson(`${API_BASE}/reports/${token}`);

// Full URL for the streaming CSV export. Returned as a string (not fetched) so
// the browser downloads it directly to disk.
export const exportUrl = (id, params) =>
  `${API_BASE}/datasets/${id}/export${toQuery(params)}`;
