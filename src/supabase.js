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
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/** The current access token (JWT) for the signed-in user, or null. */
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}
