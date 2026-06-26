import { useEffect, useRef, useState } from "react";
import { uploadDataset, pasteDataset, loadSampleDataset, API_BASE } from "../api";
import Spinner from "./Spinner";

// Client-side guard mirroring the backend's limit, so oversized input fails
// instantly with a friendly message instead of a wasted request.
const MAX_MB = 25;

const PASTE_PLACEHOLDER = `Paste CSV or spreadsheet data here, e.g.

product,region,units,revenue
Widget,North,12,240.50
Gadget,South,5,99.95

Tab-separated text copied from a spreadsheet works too.`;

/** Extract a real file from a paste event's clipboard, if one is present.
 *  Checks clipboardData.files first, then falls back to scanning items for a
 *  kind === "file" entry (some browsers only expose pasted files there). */
function fileFromClipboard(e) {
  const cd = e.clipboardData;
  if (!cd) return null;
  if (cd.files && cd.files.length > 0) return cd.files[0];
  if (cd.items) {
    for (const item of cd.items) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) return f;
      }
    }
  }
  return null;
}

function Feature({ title, body }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}

export default function UploadLanding({ onLoaded, onPrepareDashboard }) {
  const inputRef = useRef(null);
  const [mode, setMode] = useState("file"); // "file" | "paste"
  const [dragging, setDragging] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(null); // "upload" | "paste" | "sample" | null
  const [error, setError] = useState("");
  const [retryAction, setRetryAction] = useState(null);

  // Shared error handling for every load path.
  async function onLoad(fn, retry) {
    try {
      setRetryAction(null);
      return await fn();
    } catch (e) {
      setError(
        `${e.message} The backend may be waking from sleep — try again in a moment.`
      );
      setRetryAction(() => retry);
      return null;
    }
  }

  async function handleFile(file) {
    setError("");
    setRetryAction(null);
    if (!file) return;
    if (!/\.(csv|tsv|txt|xlsx|xls)$/i.test(file.name)) {
      setError("Please choose a CSV or Excel file (.csv, .xlsx, .xls).");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_MB} MB.`
      );
      return;
    }
    onPrepareDashboard?.();
    setBusy("upload");
    try {
      const ds = await onLoad(() => uploadDataset(file), () => handleFile(file));
      if (ds) onLoaded(ds);
    } finally {
      setBusy(null);
    }
  }

  async function handlePaste() {
    setError("");
    setRetryAction(null);
    if (!pasteText.trim()) {
      setError("Paste some CSV or tab-separated text first.");
      return;
    }
    if (new Blob([pasteText]).size > MAX_MB * 1024 * 1024) {
      setError(`That's more than ${MAX_MB} MB of text — try a smaller sample or upload a file.`);
      return;
    }
    onPrepareDashboard?.();
    setBusy("paste");
    try {
      const text = pasteText;
      const ds = await onLoad(() => pasteDataset(text, "Pasted data"), () => handlePaste());
      if (ds) onLoaded(ds);
    } finally {
      setBusy(null);
    }
  }

  async function handleSample() {
    setError("");
    setRetryAction(null);
    onPrepareDashboard?.();
    setBusy("sample");
    try {
      const ds = await onLoad(loadSampleDataset, handleSample);
      if (ds) onLoaded(ds);
    } finally {
      setBusy(null);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    handleFile(e.dataTransfer.files?.[0]);
  }

  // Anywhere on the upload page (including while the Paste-data textarea is
  // focused), if the clipboard holds a FILE — e.g. a spreadsheet copied in
  // Finder/Explorer — load the whole file through the upload pipeline rather
  // than pasting its name as text. Plain text falls through to the default
  // paste (so the textarea still receives pasted spreadsheet rows). When both
  // a file and its text representation are present, prefer the real file.
  useEffect(() => {
    function onPaste(e) {
      if (busy) return;
      const file = fileFromClipboard(e);
      if (!file) return; // plain text -> let the textarea handle it
      e.preventDefault();
      setMode("file"); // surface the "Uploading & analyzing…" state
      handleFile(file);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabClass = (active) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      active ? "bg-pulse-500 text-white" : "text-slate-300 hover:bg-slate-800"
    }`;

  return (
    <div className="animate-fade-in mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
          Explore any spreadsheet, instantly
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
          Upload or paste a CSV or Excel file and DataPulse detects your columns, then gives
          you live summary stats, a sortable/filterable table, adaptive charts, and CSV
          export — no setup, no account.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="mb-3 inline-flex gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
        <button type="button" className={tabClass(mode === "file")} onClick={() => { setMode("file"); setError(""); }}>
          Upload file
        </button>
        <button type="button" className={tabClass(mode === "paste")} onClick={() => { setMode("paste"); setError(""); }}>
          Paste data
        </button>
      </div>

      {mode === "file" ? (
        /* Drop zone */
        <div
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
            dragging
              ? "border-pulse-500 bg-pulse-500/10"
              : "border-slate-700 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/70"
          } ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {busy === "upload" ? (
            <Spinner label="Uploading & analyzing…" />
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="mb-3 h-10 w-10 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-sm font-medium text-slate-200">
                Drag &amp; drop a CSV or Excel file here, or <span className="text-pulse-400">browse</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Up to {MAX_MB} MB · CSV or Excel (.csv, .xlsx, .xls) · or paste a file with ⌘/Ctrl+V
              </p>
            </>
          )}
        </div>
      ) : (
        /* Paste box */
        <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-4">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            disabled={busy === "paste"}
            spellCheck={false}
            rows={9}
            placeholder={PASTE_PLACEHOLDER}
            className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950/60 p-3 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-pulse-500 focus:outline-none focus:ring-1 focus:ring-pulse-500"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              CSV or tab-separated · up to {MAX_MB} MB · or paste a copied file (⌘/Ctrl+V)
            </p>
            <button
              type="button"
              onClick={handlePaste}
              disabled={!!busy}
              className="inline-flex items-center gap-2 rounded-md bg-pulse-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-pulse-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "paste" ? <Spinner label="Analyzing…" /> : "Analyze pasted data"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          <p>{error}</p>
          <p className="mt-1 text-xs text-red-200/80">API endpoint: {API_BASE}</p>
          {retryAction && (
            <button
              type="button"
              onClick={retryAction}
              disabled={!!busy}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-700/70 bg-red-900/40 px-3 py-1.5 text-xs font-medium text-red-100 transition hover:bg-red-900/70 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Sample data */}
      <div className="mt-5 flex items-center justify-center gap-3">
        <span className="text-xs text-slate-500">First time here?</span>
        <button
          type="button"
          onClick={handleSample}
          disabled={!!busy}
          className="inline-flex items-center gap-2 rounded-md bg-pulse-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-pulse-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "sample" ? <Spinner label="Loading sample…" /> : "Try with sample data"}
        </button>
      </div>

      {/* What it does */}
      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Feature
          title="Auto-detected schema"
          body="Numbers, dates, and text are inferred from your data — every feature adapts to your columns."
        />
        <Feature
          title="Charts that fit your data"
          body="Counts for categories, trends over date columns, distributions for numbers — you pick the column."
        />
        <Feature
          title="Private by design"
          body="Your data is processed in memory and never stored permanently. Old datasets are evicted automatically."
        />
      </div>
    </div>
  );
}
