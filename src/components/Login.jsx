import { useState } from "react";
import { supabase } from "../supabase";
import Spinner from "./Spinner";

// Premium, centered sign-in card on the app's dark background.
// Auth is passwordless: Supabase email OTP (email → 6-digit code → signed in),
// plus a "Continue with Google" OAuth option. No phone login.

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

const inputBase =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 py-2.5 text-sm text-slate-100 " +
  "placeholder:text-slate-600 focus:border-pulse-500 focus:outline-none focus:ring-1 focus:ring-pulse-500";
const primaryBtn =
  "w-full inline-flex items-center justify-center gap-2 rounded-lg bg-pulse-500 px-4 py-2.5 text-sm " +
  "font-medium text-white transition hover:bg-pulse-600 disabled:cursor-not-allowed disabled:opacity-60";

export default function Login() {
  const [step, setStep] = useState("email"); // "email" | "code"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(null); // "otp" | "verify" | "google" | null
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function sendCode(e) {
    e?.preventDefault();
    setError("");
    const addr = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy("otp");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: addr,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setStep("code");
      setNotice(`We sent a 6-digit code to ${addr}.`);
    } catch (err) {
      setError(err?.message || "Could not send the code. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function verify(e) {
    e?.preventDefault();
    setError("");
    const token = code.trim();
    if (!/^\d{6}$/.test(token)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy("verify");
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
      if (error) throw error;
      // On success the onAuthStateChange listener in AuthGate swaps in the app.
    } catch (err) {
      setError(err?.message || "That code didn't work. Request a new one and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function signInWithGoogle() {
    setError("");
    setBusy("google");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: "https://datapulse-frontend.vercel.app" },
      });
      if (error) throw error;
      // Browser redirects to Google; no further UI needed here.
    } catch (err) {
      setError(err?.message || "Could not start Google sign-in. Please try again.");
      setBusy(null);
    }
  }

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

        {step === "email" ? (
          <div className="mt-6 space-y-4">
            <form onSubmit={sendCode} className="space-y-3">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <input
                  type="email"
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`${inputBase} pl-10 pr-3`}
                  aria-label="Email address"
                />
              </div>
              <button type="submit" disabled={!!busy} className={primaryBtn}>
                {busy === "otp" ? <Spinner label="Sending…" /> : "Continue"}
              </button>
            </form>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-800" />
              <span className="text-xs uppercase tracking-wide text-slate-500">or</span>
              <span className="h-px flex-1 bg-slate-800" />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={!!busy}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
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
          </div>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-3">
            {notice && <p className="text-center text-xs text-emerald-400">{notice}</p>}
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 018 0v3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                aria-label="6-digit code"
                className={`${inputBase} pl-10 pr-3 tracking-[0.4em]`}
              />
            </div>
            <button type="submit" disabled={!!busy} className={primaryBtn}>
              {busy === "verify" ? <Spinner label="Verifying…" /> : "Verify & sign in"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); setError(""); setNotice(""); }}
              className="w-full text-center text-xs text-slate-400 transition hover:text-slate-200"
            >
              Use a different email
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

        <div className="mt-6 border-t border-slate-800 pt-4 text-center">
          <p className="text-xs text-slate-500">
            We'll email you a one-time code — no password to remember.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            <a href="#" className="hover:text-slate-400">Terms</a>
            <span className="mx-1.5">·</span>
            <a href="#" className="hover:text-slate-400">Privacy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
