// Centralised access to the DataPulse FastAPI backend.
//
// The API base URL comes from VITE_API_BASE at build time (set on Vercel to the
// deployed backend); locally it falls back to the dev server. Every endpoint is
// scoped to a dataset id returned by the upload/sample calls, so each visitor
// only ever touches their own data.

export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8000";

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
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* response was not JSON */
    }
    throw new Error(detail);
  }
  return res.json();
}

/** Upload a CSV file. Returns { dataset_id, name, source, row_count, columns }. */
export async function uploadDataset(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/datasets`, { method: "POST", body: form });
  return handle(res);
}

/** Analyze pasted CSV / tab-separated text. Same shape as uploadDataset. */
export async function pasteDataset(text, name) {
  const res = await fetch(`${API_BASE}/datasets/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, name }),
  });
  return handle(res);
}

/** Load the bundled demo dataset. Same shape as uploadDataset. */
export async function loadSampleDataset() {
  const res = await fetch(`${API_BASE}/datasets/sample`, { method: "POST" });
  return handle(res);
}

export const fetchSummary = (id) =>
  fetch(`${API_BASE}/datasets/${id}/summary`).then(handle);

export const fetchQuery = (id, params) =>
  fetch(`${API_BASE}/datasets/${id}/query${toQuery(params)}`).then(handle);

export const fetchChart = (id, params) =>
  fetch(`${API_BASE}/datasets/${id}/chart${toQuery(params)}`).then(handle);

// Full URL for the streaming CSV export. Returned as a string (not fetched) so
// the browser downloads it directly to disk.
export const exportUrl = (id, params) =>
  `${API_BASE}/datasets/${id}/export${toQuery(params)}`;
