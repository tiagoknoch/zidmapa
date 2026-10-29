import { useEffect, useRef } from "react";

const INTERVAL_MS = 60_000;

// Calls `refresh` every minute while the page is visible, and right away when
// the user comes back to it (e.g. after taking a photo or switching apps).
export function useAutoRefresh(refresh: () => void, enabled = true) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });

  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    const timer = setInterval(run, INTERVAL_MS);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [enabled]);
}
