# DataPulse — Frontend

React + Vite + Tailwind CSS + Chart.js dashboard for the DataPulse backend.
Fetches via TanStack Query (react-query).

## Setup

```bash
cd datapulse-frontend
npm install
npm run dev      # http://localhost:5173
```

The backend is expected at `http://localhost:8000`. Override with an env var:

```bash
VITE_API_BASE=http://localhost:9000 npm run dev
```

## What's here

| File | Purpose |
|------|---------|
| `src/api.js` | Typed-ish fetch helpers for `/data/summary`, `/data/query`, `/data/chart` |
| `src/components/Layout.jsx` | App shell (header / main / footer) |
| `src/App.jsx` | Summary stat cards + dashboard grid |
| `src/components/DataTable.jsx` | Paginated, sortable, filterable table |
| `src/components/ValueOverTimeChart.jsx` | Line chart with interval + category controls |
| `src/components/CategoryDistributionChart.jsx` | Doughnut chart with date-range filter |
| `src/components/Spinner.jsx` | Loading indicator |

## Notes

- Tailwind **v3** (directive-based config) to match the project guide.
- Sorting is restricted to `id`, `timestamp`, `value` (the columns the backend
  allows). Clicking those headers toggles asc/desc.
- Filters are applied on submit (not on every keystroke) to avoid hammering the
  backend; react-query keeps previous data on screen during refetch.
