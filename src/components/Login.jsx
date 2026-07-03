import { useState } from "react";
import { supabase } from "../supabase";
import Spinner from "./Spinner";

// Premium, centered sign-in card on the app's dark background.
// Auth is OAuth-only (no passwords, no email codes): "Continue with Google" and
// "Continue with GitHub", both via Supabase PKCE. On return the AuthGate resolves
// the session and drops the user straight into the app.

const REDIRECT_TO = "https://datapulse-frontend.vercel.app";

function LogoMark() {
  return (
    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pulse-500 to-pulse-600 text-white animate-logo-pulse">
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M3 12h4l2 6 4-12 2 6h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.46h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.73z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.28 6.62l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.05.78 2.12v3.14c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

export default function Login() {
  const [busy, setBusy] = useState(null); // "google" | "github" | null
  const [error, setError] = useState("");

  async function signInWith(provider) {
    setError("");
    setBusy(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: REDIRECT_TO },
      });
      if (error) throw error;
      // Browser redirects to the provider; no further UI needed here.
    } catch (err) {
      const label = provider === "google" ? "Google" : "GitHub";
      setError(err?.message || `Could not start ${label} sign-in. Please try again.`);
      setBusy(null);
    }
  }

  const oauthBtn =
    "w-full inline-flex items-center justify-center gap-2.5 rounded-lg px-4 py-2.5 text-sm " +
    "font-medium transition disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      {/* subtle top glow — understated, single accent colour */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_0%,rgba(26,133,255,0.12),transparent_70%)]"
      />

      <div className="animate-rise-in relative w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/70 p-7 shadow-xl shadow-black/40 backdrop-blur sm:p-8">
        <LogoMark />

        <h1 className="mt-5 text-center text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
          Welcome to DataPulse
        </h1>
        <p className="mt-1.5 text-center text-sm text-slate-400">
          Sign in to explore your data — private to your account.
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => signInWith("google")}
            disabled={!!busy}
            className={`${oauthBtn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100`}
          >
            {busy === "google" ? (
              <Spinner label="Redirecting…" />
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => signInWith("github")}
            disabled={!!busy}
            className={`${oauthBtn} border border-slate-700 bg-[#1f2328] text-white hover:bg-[#2a3037]`}
          >
            {busy === "github" ? (
              <Spinner label="Redirecting…" />
            ) : (
              <>
                <GitHubIcon />
                Continue with GitHub
              </>
            )}
          </button>
        </div>

        {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

        <div className="mt-6 border-t border-slate-800 pt-4 text-center">
          <p className="text-xs text-slate-500">
            No passwords — sign in with an account you already have.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            <a href="/terms" className="hover:text-slate-400">Terms</a>
            <span className="mx-1.5">·</span>
            <a href="/privacy" className="hover:text-slate-400">Privacy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
