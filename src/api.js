// Centralised access to the DataPulse FastAPI backend.

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

async function getJSON(path, params) {
  const res = await fetch(`${API_BASE}${path}${toQuery(params)}`);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* response was not JSON */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json();
}

export const fetchSummary = () => getJSON("/data/summary");
export const fetchQuery = (params) => getJSON("/data/query", params);
export const fetchChart = (params) => getJSON("/data/chart", params);

// Full URL for the streaming CSV export. Returned as a string (not fetched)
// so the browser downloads it directly to disk — pulling it through fetch()
// would defeat the point of streaming a multi-hundred-MB file.
export const exportUrl = (params) => `${API_BASE}/data/export${toQuery(params)}`;
