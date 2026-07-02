import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Login from "./components/Login";
import Layout from "./components/Layout";
import Spinner from "./components/Spinner";

// Gates the whole app behind Supabase auth. While the session is resolving we
// show a spinner; signed-out users see only the Login screen; signed-in users
// get the app, with their email + a sign-out control in the header.
export default function AuthGate({ children }) {
  const [status, setStatus] = useState("loading"); // "loading" | "in" | "out"
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setStatus(data.session ? "in" : "out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(session ? "in" : "out");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") {
    return (
      <Layout>
        <Spinner label="Loading…" className="mt-8" />
      </Layout>
    );
  }

  if (status === "out") {
    return <Login />;
  }

  return typeof children === "function"
    ? children({ user, signOut: () => supabase.auth.signOut() })
    : children;
}
