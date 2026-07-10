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
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [savingName, setSavingName] = useState(false);
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
    if (busy || savingName) return; // don't yank the menu out mid-write
    setOpen(false);
    setConfirming(false);
    setEditing(false);
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

  /** Persist the chosen name onto the Supabase user's metadata. */
  async function saveUsername() {
    const name = username.trim();
    if (!name) {
      setError("Enter a username.");
      return;
    }
    setSavingName(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.updateUser({ data: { username: name } });
      if (err) throw err;
      setEditing(false); // AuthGate's onAuthStateChange (USER_UPDATED) refreshes the header
    } catch (err) {
      // A 5xx surfaces as a retryable fetch error whose message is the literal
      // "{}", which is truthy and would be shown to the user as-is.
      const msg = err?.message;
      setError(!msg || msg === "{}" ? "Could not save your username." : msg);
    } finally {
      setSavingName(false);
    }
  }

  // Anonymous sessions have no email — name them plainly rather than rendering
  // an empty label where an address would be. For everyone else prefer a chosen
  // username, then whatever name the OAuth provider supplied, then the local
  // part of the email; the raw address is the last resort.
  const guest = !!user?.is_anonymous;
  const meta = user?.user_metadata || {};
  const emailName = user?.email ? user.email.split("@")[0] : "";
  const displayName = meta.username || meta.full_name || meta.name || meta.user_name || emailName || "";
  const label = guest ? "Guest" : displayName || user?.email;

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
          {(label || "?").charAt(0)}
        </span>
        <span className="hidden max-w-[32vw] truncate sm:inline" title={label}>
          {label}
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
            <p className="text-xs text-slate-500">{guest ? "Exploring as" : "Signed in as"}</p>
            <p className="truncate text-sm text-slate-200" title={label}>{label}</p>
            {!guest && displayName && user?.email && displayName !== user.email && (
              <p className="truncate text-xs text-slate-500" title={user.email}>{user.email}</p>
            )}
            {guest && (
              <p className="mt-1 text-xs text-amber-300/90">
                Sign in to save your data — use the banner at the top of the page.
              </p>
            )}
          </div>

          {!confirming ? (
            <div className="p-1.5">
              {/* Guests have no account to name — the banner asks them to sign in. */}
              {!guest &&
                (editing ? (
                  <form
                    className="px-1.5 py-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveUsername();
                    }}
                  >
                    <label htmlFor="account-username" className="sr-only">
                      Username
                    </label>
                    <input
                      id="account-username"
                      type="text"
                      maxLength={32}
                      placeholder="Your name"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (error) setError("");
                      }}
                      className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-pulse-500 focus:outline-none focus:ring-1 focus:ring-pulse-500"
                    />
                    {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
                    <div className="mt-2 flex gap-2">
                      <button
                        type="submit"
                        disabled={savingName}
                        className="inline-flex flex-1 items-center justify-center rounded-md bg-pulse-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-pulse-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingName ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        disabled={savingName}
                        onClick={() => {
                          setEditing(false);
                          setError("");
                        }}
                        className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setEditing(true);
                      setUsername(meta.username || "");
                      setError("");
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Edit username
                  </button>
                ))}
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
