import { useState } from "react";
import { supabase } from "../supabase";
import Layout from "./Layout";
import Spinner from "./Spinner";

// Passwordless sign-in with Supabase email OTP: the user enters their email,
// receives a 6-digit code, and verifies it. No passwords, no OAuth.
export default function Login() {
  const [step, setStep] = useState("email"); // "email" | "code"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: addr,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setStep("code");
      setNotice(`We sent a 6-digit code to ${addr}. Enter it below.`);
    } catch (err) {
      setError(err?.message || "Could not send the code. Please try again.");
    } finally {
      setBusy(false);
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
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: "email",
      });
      if (error) throw error;
      // On success the onAuthStateChange listener in AuthGate swaps in the app.
    } catch (err) {
      setError(err?.message || "That code didn't work. Request a new one and try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 " +
    "placeholder:text-slate-600 focus:border-pulse-500 focus:outline-none focus:ring-1 focus:ring-pulse-500";
  const btnClass =
    "w-full inline-flex items-center justify-center gap-2 rounded-md bg-pulse-500 px-4 py-2 text-sm " +
    "font-medium text-white transition hover:bg-pulse-600 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <Layout>
      <div className="animate-fade-in mx-auto mt-8 max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold text-slate-100">Sign in to DataPulse</h2>
        <p className="mt-1 text-sm text-slate-400">
          Your datasets and reports are private to your account. We'll email you a one-time code —
          no password to remember.
        </p>

        {step === "email" ? (
          <form onSubmit={sendCode} className="mt-5 space-y-3">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">Email</label>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
            <button type="submit" disabled={busy} className={btnClass}>
              {busy ? <Spinner label="Sending…" /> : "Email me a code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-5 space-y-3">
            {notice && <p className="text-xs text-emerald-400">{notice}</p>}
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className={`${inputClass} tracking-[0.4em]`}
            />
            <button type="submit" disabled={busy} className={btnClass}>
              {busy ? <Spinner label="Verifying…" /> : "Verify & sign in"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); setError(""); setNotice(""); }}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
            >
              Use a different email
            </button>
          </form>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </Layout>
  );
}
