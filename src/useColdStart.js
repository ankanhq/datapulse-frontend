import { useEffect, useState } from "react";
import { subscribeColdStart } from "./api";

// React hook mirroring the api.js cold-start signal: true while at least one
// request has been in flight long enough to look like the free backend waking
// from sleep. Components use it to swap a bare spinner for a friendly message.
export default function useColdStart() {
  const [waking, setWaking] = useState(false);
  useEffect(() => subscribeColdStart(setWaking), []);
  return waking;
}
