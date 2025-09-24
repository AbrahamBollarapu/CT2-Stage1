import { useEffect, useRef } from "react";

/**
 * Simple, reliable auto-refresh hook.
 * - Keeps the latest callback via ref (no stale closures).
 * - Cleans up timers on unmount and when deps change.
 */
export default function useAutoRefresh(enabled: boolean, ms: number, fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled || !Number.isFinite(ms) || ms <= 0) return;
    const id = window.setInterval(() => fnRef.current(), ms);
    return () => window.clearInterval(id);
  }, [enabled, ms]);
}
