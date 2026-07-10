import { useRef, useState } from "react";
import { supabase, AUTH_REDIRECT_TO } from "../supabase";
import Spinner from "./Spinner";
import EvidencePreview from "./EvidencePreview";

// Split-screen sign-in: the auth card on one side, a living Evidence Mode
// preview on the other. Four ways in, none of them a password:
//   • Google / GitHub — Supabase OAuth (PKCE), unchanged
//   • Email           — a magic link via signInWithOtp
//   • Guest           — a real anonymous session via signInAnonymously
// On return the AuthGate resolves the session and drops the user into the app.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Supabase emails a 6-digit token by default; allow the range GoTrue can issue.
const CODE_RE = /^\d{4,8}$/;

/** Turn a Supabase auth error into something a person can act on. */
function friendlyAuthError(err, fallback) {
  const msg = err?.message || "";
  const status = err?.status;
  if (status === 429 || /rate limit|too many/i.test(msg)) {
    return "Too many attempts. Wait a minute, then try again.";
  }
  if (/anonymous.*(disabled|not enabled)/i.test(msg)) {
    return "Guest access isn't switched on for this project yet. Try Google, GitHub, or email.";
  }
  if (/invalid.*email|email.*invalid/i.test(msg)) {
    return "That email address doesn't look right.";
  }
  if (/signups? not allowed|email.*not authorized/i.test(msg)) {
    return "That email isn't allowed to sign in to this project.";
  }
  return msg || fallback;
}

function LogoMark() {
  return (
    <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pulse-500 to-pulse-600 text-white animate-logo-pulse">
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

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The drifting colour fields behind everything. Decorative only. */
function Aurora() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="animate-aurora absolute -left-[15%] -top-[25%] h-[70vmax] w-[70vmax] rounded-full bg-[radial-gradient(circle,rgba(26,133,255,0.20),transparent_62%)] blur-3xl" />
      <div className="animate-aurora-slow absolute -right-[20%] top-[10%] h-[62vmax] w-[62vmax] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.13),transparent_62%)] blur-3xl" />
      <div className="animate-aurora absolute bottom-[-30%] left-[20%] h-[55vmax] w-[55vmax] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.14),transparent_62%)] blur-3xl" />
    </div>
  );
}

export default function Login() {
  // "options" → the four ways in · "email" → address entry · "sent" → check inbox
  const [view, setView] = useState("options");
  const [busy, setBusy] = useState(null); // "google" | "github" | "email" | "guest" | "resend"
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const emailRef = useRef(null);
  const codeRef = useRef(null);

  async function signInWith(provider) {
    setError("");
    setBusy(provider);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: AUTH_REDIRECT_TO },
      });
      if (err) throw err;
      // Browser redirects to the provider; no further UI needed here.
    } catch (err) {
      const label = provider === "google" ? "Google" : "GitHub";
      setError(friendlyAuthError(err, `Could not start ${label} sign-in. Please try again.`));
      setBusy(null);
    }
  }

  /** Email magic link. Same return URL as the OAuth flows. */
  async function sendMagicLink(mode) {
    const address = email.trim();
    if (!EMAIL_RE.test(address)) {
      setError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    setError("");
    setNotice("");
    setBusy(mode);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: AUTH_REDIRECT_TO },
      });
      if (err) throw err;
      setView("sent");
      if (mode === "resend") setNotice("Sent again — check your inbox.");
    } catch (err) {
      setError(friendlyAuthError(err, "Could not send the sign-in link. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  /** Verify the emailed code. The magic link in the same email still works. */
  async function verifyCode(e) {
    e.preventDefault();
    const token = code.trim();
    if (!CODE_RE.test(token)) {
      setError("Enter the code from the email.");
      codeRef.current?.focus();
      return;
    }
    setError("");
    setNotice("");
    setBusy("verify");
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: "email",
      });
      if (err) throw err;
      // onAuthStateChange in the AuthGate swaps this screen for the app.
    } catch (err) {
      setError(friendlyAuthError(err, "That code didn't work. Check it and try again."));
      setBusy(null);
    }
  }

  /** Real anonymous session, so a visitor can use the whole app before deciding. */
  async function exploreAsGuest() {
    setError("");
    setBusy("guest");
    try {
      const { error: err } = await supabase.auth.signInAnonymously();
      if (err) throw err;
      // onAuthStateChange in the AuthGate swaps this screen for the app.
    } catch (err) {
      setError(friendlyAuthError(err, "Could not start a guest session. Please try again."));
      setBusy(null);
    }
  }

  function backToOptions() {
    setView("options");
    setError("");
    setNotice("");
    setCode("");
    setBusy(null);
  }

  const btn =
    "w-full inline-flex items-center justify-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-medium " +
    "transition duration-150 active:scale-[0.985] focus:outline-none focus:ring-2 focus:ring-pulse-500/60 " +
    "focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <Aurora />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-10 px-4 py-10 lg:flex-row lg:gap-16 lg:px-8">
        {/* Auth card — first in the DOM so it leads on mobile and for screen readers. */}
        <div className="animate-rise-in w-full max-w-sm rounded-2xl border border-slate-700/60 bg-slate-900/60 p-7 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
          <div className="flex justify-center">
            <LogoMark />
          </div>

          <h1 className="mt-5 text-center text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
            Welcome to DataPulse
          </h1>

          {view === "sent" ? (
            <div className="mt-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <MailIcon />
              </div>
              <h2 className="mt-4 text-center text-base font-semibold text-slate-100">
                Enter the code we emailed you
              </h2>
              <p className="mt-1.5 text-center text-sm text-slate-400">
                We sent a code to <span className="font-medium text-slate-200">{email.trim()}</span>.
                You can type it below, or open the link in the same email.
              </p>
              <p className="mt-2 text-center text-xs text-slate-500">
                Don't see it? Check your spam or promotions folder.
              </p>

              {notice && <p className="mt-3 text-center text-sm text-emerald-300">{notice}</p>}
              {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}

              <form className="mt-5" onSubmit={verifyCode} noValidate>
                <label htmlFor="login-code" className="sr-only">
                  Sign-in code
                </label>
                <input
                  id="login-code"
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    if (error) setError("");
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-center text-lg tracking-widest text-slate-100 placeholder:text-slate-600 placeholder:tracking-widest focus:border-pulse-500 focus:outline-none focus:ring-1 focus:ring-pulse-500"
                />
                <button
                  type="submit"
                  disabled={!!busy}
                  className={`${btn} mt-3 bg-pulse-500 text-white shadow-lg shadow-pulse-500/20 hover:bg-pulse-600`}
                >
                  {busy === "verify" ? <Spinner label="Verifying…" /> : "Verify & sign in"}
                </button>
              </form>

              <div className="mt-3 space-y-3">
                <button
                  type="button"
                  onClick={() => sendMagicLink("resend")}
                  disabled={!!busy}
                  className={`${btn} border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700`}
                >
                  {busy === "resend" ? <Spinner label="Sending…" /> : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={backToOptions}
                  className="w-full text-center text-sm text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
                >
                  Use a different method
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-1.5 text-center text-sm text-slate-400">
                Sign in to explore your data — private to your account.
              </p>

              {view === "options" ? (
                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => signInWith("google")}
                    disabled={!!busy}
                    className={`${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100`}
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
                    className={`${btn} border border-slate-700 bg-[#1f2328] text-white hover:bg-[#2a3037]`}
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

                  <button
                    type="button"
                    onClick={() => {
                      setView("email");
                      setError("");
                      // focus lands after the input has actually mounted
                      requestAnimationFrame(() => emailRef.current?.focus());
                    }}
                    disabled={!!busy}
                    className={`${btn} border border-slate-700 bg-slate-800/80 text-slate-100 hover:bg-slate-700`}
                  >
                    <MailIcon />
                    Continue with email
                  </button>

                  <div className="flex items-center gap-3 pt-1">
                    <span className="h-px flex-1 bg-slate-800" />
                    <span className="text-[11px] uppercase tracking-wide text-slate-600">or</span>
                    <span className="h-px flex-1 bg-slate-800" />
                  </div>

                  <button
                    type="button"
                    onClick={exploreAsGuest}
                    disabled={!!busy}
                    className={`${btn} border border-dashed border-slate-700 bg-transparent text-slate-300 hover:border-pulse-500/50 hover:bg-slate-800/60 hover:text-slate-100`}
                  >
                    {busy === "guest" ? <Spinner label="Starting…" /> : "Explore without an account"}
                  </button>
                </div>
              ) : (
                <form
                  className="mt-6 space-y-3"
                  // Native validation would block submit on a malformed address
                  // and show a browser bubble, so our inline message never ran.
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMagicLink("email");
                  }}
                >
                  <div>
                    <label htmlFor="login-email" className="block text-xs font-medium text-slate-400">
                      Email address
                    </label>
                    <input
                      id="login-email"
                      ref={emailRef}
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-pulse-500 focus:outline-none focus:ring-1 focus:ring-pulse-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!!busy}
                    className={`${btn} bg-pulse-500 text-white shadow-lg shadow-pulse-500/20 hover:bg-pulse-600`}
                  >
                    {busy === "email" ? <Spinner label="Sending…" /> : "Send sign-in link"}
                  </button>

                  {error && <p className="text-center text-sm text-red-400">{error}</p>}

                  <button
                    type="button"
                    onClick={backToOptions}
                    className="w-full text-center text-sm text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
                  >
                    Use a different method
                  </button>
                </form>
              )}
            </>
          )}

          {view === "options" && error && (
            <p className="mt-4 text-center text-sm text-red-400">{error}</p>
          )}

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

        {/* Live proof-of-product. Hidden on the smallest screens, where the card
            alone should own the fold; condensed from sm upward. */}
        <div className="hidden w-full justify-center sm:flex lg:flex-1">
          <EvidencePreview />
        </div>
      </div>
    </div>
  );
}
