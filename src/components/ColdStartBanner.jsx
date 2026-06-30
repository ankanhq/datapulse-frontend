import { useEffect, useState } from "react";
import { subscribeColdStart } from "../api";

// Fixed toast that appears whenever a request has been in flight for more than
// ~4s — almost always the free backend waking from sleep. It carries the same
// pulse spinner used elsewhere and disappears the instant data arrives.
export default function ColdStartBanner() {
  const [waking, setWaking] = useState(false);

  useEffect(() => subscribeColdStart(setWaking), []);

  if (!waking) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="animate-fade-in pointer-events-auto flex items-center gap-3 rounded-xl border border-pulse-500/40 bg-slate-900/95 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur"
      >
        <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-600 border-t-pulse-500" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100">Waking up the server…</p>
          <p className="text-xs text-slate-400">This can take up to a minute on the free tier.</p>
        </div>
      </div>
    </div>
  );
}
