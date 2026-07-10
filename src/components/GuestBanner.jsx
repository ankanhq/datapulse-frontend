import { useRef, useState } from "react";
import { supabase, AUTH_REDIRECT_TO } from "../supabase";

// Shown for the whole session while the user is signed in anonymously. Upgrading
// keeps the guest's data because it attaches a real identity to the SAME user:
//   • OAuth — linkIdentity({ provider }). Needs "manual linking" enabled; if the
//     project has it off we fall back to a normal sign-in, which starts a fresh
//     user (data doesn't carry) — so we say so plainly before redirecting.
//   • Email — updateUser({ email }) mails a confirmation link and converts the
//     anonymous user in place. signInWithOtp would authenticate a *different*
//     user and strand the guest's datasets, so it isn't used here.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function linkingUnavailable(err) {
  const msg = err?.message || "";
  return (
    err?.status === 404 ||
    err?.status === 422 ||
    /manual linking.*disabled|not enabled|unsupported|identity.*not|already.*linked/i.test(msg)
  );
}

function friendlyError(err, fallback) {
  const msg = err?.message || "";
  if (err?.status === 429 || /rate limit|too many/i.test(msg)) {
    return "Too many attempts. Wait a minute, then try again.";
  }
  if (/already.*registered|already.*use/i.test(msg)) {
    return "That email already has an account. Sign out and sign in with it instead.";
  }
  if (/invalid.*email/i.test(msg)) return "That email address doesn't look right.";
  return msg || fallback;
}

export default function GuestBanner() {
  const [mode, setMode] = useState("idle"); // "idle" | "email" | "sent"
  const [busy, setBusy] = useState(null); // "google" | "github" | "email"
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const inputRef = useRef(null);

  async function upgradeWithOAuth(provider) {
    setError("");
    setBusy(provider);
    try {
      const { error: err } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo: AUTH_REDIRECT_TO },
      });
      if (err) throw err;
      // Redirects to the provider and returns onto the same user.
    } catch (err) {
      if (linkingUnavailable(err)) {
        // Can't link — sign in normally rather than leaving the user stuck.
        const { error: signInErr } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: AUTH_REDIRECT_TO },
        });
        if (!signInErr) return; // navigating away
        setError(friendlyError(signInErr, "Could not start sign-in. Please try again."));
      } else {
        setError(friendlyError(err, "Could not link your account. Please try again."));
      }
      setBusy(null);
    }
  }

  async function upgradeWithEmail(e) {
    e.preventDefault();
    const address = email.trim();
    if (!EMAIL_RE.test(address)) {
      setError("Enter a valid email address.");
      inputRef.current?.focus();
      return;
    }
    setError("");
    setBusy("email");
    try {
      const { error: err } = await supabase.auth.updateUser({ email: address });
      if (err) throw err;
      setMode("sent");
    } catch (err) {
      setError(friendlyError(err, "Could not send the confirmation link. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  const pill =
    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium " +
    "transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

  if (mode === "sent") {
    return (
      <div className="border-b border-emerald-500/25 bg-emerald-500/10">
        <div className="mx-auto max-w-7xl px-4 py-2.5 text-sm text-emerald-200 sm:px-6">
          Check <span className="font-medium">{email.trim()}</span> for a confirmation link. Opening
          it saves everything you've done in this session.
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-amber-500/25 bg-amber-500/10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        <p className="text-sm text-amber-100">
          <span className="mr-2 rounded bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            Guest
          </span>
          You're exploring as a guest — sign in to save your data.
        </p>

        {mode === "idle" ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => upgradeWithOAuth("google")}
              className={`${pill} border-slate-300 bg-white text-slate-800 hover:bg-slate-100`}
            >
              {busy === "google" ? "Redirecting…" : "Save with Google"}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => upgradeWithOAuth("github")}
              className={`${pill} border-slate-700 bg-[#1f2328] text-white hover:bg-[#2a3037]`}
            >
              {busy === "github" ? "Redirecting…" : "GitHub"}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => {
                setMode("email");
                setError("");
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              className={`${pill} border-amber-500/40 bg-transparent text-amber-100 hover:bg-amber-500/15`}
            >
              Email
            </button>
          </div>
        ) : (
          <form onSubmit={upgradeWithEmail} noValidate className="ml-auto flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(ev) => {
                setEmail(ev.target.value);
                if (error) setError("");
              }}
              className="rounded-md border border-amber-500/30 bg-slate-900/70 px-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-pulse-500 focus:outline-none focus:ring-1 focus:ring-pulse-500"
            />
            <button
              type="submit"
              disabled={!!busy}
              className={`${pill} border-transparent bg-pulse-500 text-white hover:bg-pulse-600`}
            >
              {busy === "email" ? "Sending…" : "Send link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("idle");
                setError("");
              }}
              className="text-xs text-amber-200/80 underline-offset-2 hover:text-amber-100 hover:underline"
            >
              Cancel
            </button>
          </form>
        )}

        {error && <p className="w-full text-xs text-red-300">{error}</p>}
      </div>
    </div>
  );
}
