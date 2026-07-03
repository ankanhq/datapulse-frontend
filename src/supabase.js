import { createClient } from "@supabase/supabase-js";

// Supabase client, initialised from build-time env (set these on Vercel):
//   VITE_SUPABASE_URL       — your project URL
//   VITE_SUPABASE_ANON_KEY  — the public anon key
// No secrets are hardcoded. The anon key is safe to ship to the browser.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surfaced in the console rather than crashing the bundle, so a misconfigured
  // deploy shows a clear reason instead of a blank screen.
  console.error(
    "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(url || "http://localhost", anonKey || "public-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Process the OAuth return automatically: with PKCE, supabase-js exchanges
    // the `?code=` for a session on init; it also handles the legacy `#access_token`
    // hash flow. This is what turns the Google redirect into a real session.
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

/**
 * Resolve any OAuth callback before the app (and its router) render.
 *
 * `detectSessionInUrl: true` makes supabase-js exchange the PKCE `code` (or read
 * the legacy hash tokens) during initialization; awaiting `getSession()` waits
 * for that to finish. We then strip the auth params/hash from the URL so they
 * don't linger or get consumed by any path/hash routing. Returns the session.
 */
export async function ensureAuthReady() {
  const loc = window.location;
  const search = new URLSearchParams(loc.search);
  const hadCode = search.has("code");
  const hadHashToken = loc.hash.includes("access_token");
  const hadError = search.has("error");

  const { data } = await supabase.auth.getSession();

  if (hadCode || hadHashToken || hadError) {
    ["code", "state", "error", "error_description", "provider_token", "refresh_token"].forEach(
      (k) => search.delete(k)
    );
    const qs = search.toString();
    const cleanUrl = loc.pathname + (qs ? `?${qs}` : "") + (hadHashToken ? "" : loc.hash);
    window.history.replaceState({}, document.title, cleanUrl);
  }
  return data?.session ?? null;
}

/** The current access token (JWT) for the signed-in user, or null. */
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}
