import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import Layout from "./components/Layout";
import Spinner from "./components/Spinner";
import { ensureAuthReady } from "./supabase";
import "./index.css";

const ReportView = lazy(() => import("./components/ReportView"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep previous data on screen while refetching (smoother filtering).
      placeholderData: (prev) => prev,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function buildRoot() {
  // Tiny path-based router: /report/<32-hex-token> renders the read-only shared
  // story; everything else is the normal app. (A full router would be overkill
  // for a single extra route; the Vercel rewrite makes the deep link resolve.)
  // This is computed AFTER the OAuth callback is processed and stripped from the
  // URL, so the callback's query/hash is never consumed by any routing.
  const reportMatch = window.location.pathname.match(/^\/report\/([0-9a-f]{32})\/?$/);

  // The entire app — including the report route — is gated behind auth.
  return reportMatch ? (
    <AuthGate>
      {({ user, signOut }) => (
        <Layout user={user} onSignOut={signOut}>
          <Suspense fallback={<Spinner label="Loading shared report…" className="mt-8" />}>
            <ReportView token={reportMatch[1]} />
          </Suspense>
        </Layout>
      )}
    </AuthGate>
  ) : (
    <AuthGate>{({ user, signOut }) => <App user={user} onSignOut={signOut} />}</AuthGate>
  );
}

function render() {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>{buildRoot()}</QueryClientProvider>
    </React.StrictMode>
  );
}

// Process any OAuth return (exchange the PKCE code for a session and scrub the
// callback params) BEFORE the app renders. `.finally` guarantees we still render
// even if session resolution fails — AuthGate then shows the login screen.
ensureAuthReady().finally(render);
