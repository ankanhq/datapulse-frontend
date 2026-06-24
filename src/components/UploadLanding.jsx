import { useRef, useState } from "react";
import { uploadDataset, loadSampleDataset, API_BASE } from "../api";
import Spinner from "./Spinner";

// Client-side guard mirroring the backend's limit, so oversized files fail
// instantly with a friendly message instead of a wasted upload.
const MAX_MB = 25;

function Feature({ title, body }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}

export default function UploadLanding({ onLoaded }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(null); // "upload" | "sample" | null
  const [error, setError] = useState("");

  async function handleFile(file) {
    setError("");
    if (!file) return;
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) {
      setError("Please choose a .csv file.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_MB} MB.`
      );
      return;
    }
    setBusy("upload");
    try {
      const ds = await onLoad(() => uploadDataset(file));
      if (ds) onLoaded(ds);
    } finally {
      setBusy(null);
    }
  }

  async function handleSample() {
    setError("");
    setBusy("sample");
    try {
      const ds = await onLoad(loadSampleDataset);
      if (ds) onLoaded(ds);
    } finally {
      setBusy(null);
    }
  }

  // Shared error handling for both upload paths.
  async function onLoad(fn) {
    try {
      return await fn();
    } catch (e) {
      setError(
        `${e.message} (API: ${API_BASE}). The backend may be waking from sleep — try again in a moment.`
      );
      return null;
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="animate-fade-in mx-auto max-w-3xl">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
          Explore any CSV, instantly
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
          Upload a spreadsheet and DataPulse detects your columns, then gives you live
          summary stats, a sortable/filterable table, adaptive charts, and CSV export —
          no setup, no account.
        </p>
      </div>

      {/* Drop zone */}
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
          accept=".csv,.tsv,.txt,text/csv"
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
              Drag &amp; drop a CSV here, or <span className="text-pulse-400">browse</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">Up to {MAX_MB} MB · .csv files</p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
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
          {busy === "sample" ? (
            <Spinner label="Loading sample…" />
          ) : (
            "Try with sample data"
          )}
        </button>
      </div>

      {/* What it does */}
      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Feature
          title="Auto-detected schema"
          body="Numbers, dates, and text are inferred from your file — every feature adapts to your columns."
        />
        <Feature
          title="Charts that fit your data"
          body="Counts for categories, trends over date columns, distributions for numbers — you pick the column."
        />
        <Feature
          title="Private by design"
          body="Your file is processed in memory and never stored permanently. Old datasets are evicted automatically."
        />
      </div>
    </div>
  );
}
