import { useEffect, useRef, useState } from "react";
import { deleteAccount } from "../api";
import { supabase } from "../supabase";

// Header account control: shows the signed-in email with a dropdown that offers
// "Sign out" and the GDPR "Delete my account and data" action. Deletion asks for
// an explicit "Are you sure? This can't be undone" confirmation, calls the
// backend to purge the user's datasets/reports/account, then signs out.
export default function AccountMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);

  // Close the menu on outside click / Escape.
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) close();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function close() {
    if (busy) return; // don't yank the menu out mid-deletion
    setOpen(false);
    setConfirming(false);
    setError("");
  }

  async function handleSignOut() {
    close();
    if (onSignOut) onSignOut();
  }

  async function handleDelete() {
    setBusy(true);
    setError("");
    try {
      await deleteAccount();
      // Data + account are gone; sign out locally so AuthGate returns to Login.
      await supabase.auth.signOut();
      if (onSignOut) onSignOut();
    } catch (err) {
      setError(err?.message || "Could not delete your account. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="relative ml-auto" ref={ref}>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pulse-500/20 text-xs font-semibold uppercase text-pulse-300">
          {(user?.email || "?").charAt(0)}
        </span>
        <span className="hidden max-w-[32vw] truncate sm:inline" title={user?.email}>
          {user?.email}
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl shadow-black/50"
        >
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500">Signed in as</p>
            <p className="truncate text-sm text-slate-200" title={user?.email}>{user?.email}</p>
          </div>

          {!confirming ? (
            <div className="p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 17l5-5-5-5M21 12H9M12 19H6a2 2 0 01-2-2V7a2 2 0 012-2h6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Sign out
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setConfirming(true); setError(""); }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-400 transition hover:bg-red-500/10"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Delete my account and data
              </button>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-sm font-medium text-slate-100">Are you sure? This can't be undone.</p>
              <p className="mt-1 text-xs text-slate-400">
                This permanently deletes your datasets, saved reports, and account.
              </p>
              {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Deleting…" : "Yes, delete everything"}
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirming(false); setError(""); }}
                  disabled={busy}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
