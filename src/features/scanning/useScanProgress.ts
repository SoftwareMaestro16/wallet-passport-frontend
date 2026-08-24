import { useEffect, useRef, useState } from "react";

export const SCAN_STEP_COUNT = 7;

/** Product spec targets a real 60-120s deep scan; the simulation sits in that window. */
const SIMULATED_DURATION_MS = 75_000;
const TICK_MS = 300;

export type ScanProgress = {
  stepIndex: number;
  progressPct: number;
  done: boolean;
};

/**
 * Drives the Scanning screen's progress UI. Today this is a `setInterval` simulation because
 * there is no backend scan endpoint yet — everything that will change once one exists
 * (`GET /wallets/:address/scan-status` or similar) is contained in this hook. `ScanningScreen`
 * only ever reads `{ stepIndex, progressPct, done }` and calls `skip()`, so swapping the interval
 * below for a polling loop is a one-file change.
 */
export function useScanProgress(active: boolean): ScanProgress & { skip: () => void } {
  const [progress, setProgress] = useState<ScanProgress>({ stepIndex: 0, progressPct: 0, done: false });
  const startedAtRef = useRef<number | null>(null);
  // Tracks the live interval so `skip()` can cancel it — otherwise the next tick overwrites
  // the skipped-to-done state with its own (still in-progress) computed values.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;
    startedAtRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
      const progressPct = Math.min(100, (elapsed / SIMULATED_DURATION_MS) * 100);
      const stepIndex = Math.min(SCAN_STEP_COUNT - 1, Math.floor((elapsed / SIMULATED_DURATION_MS) * SCAN_STEP_COUNT));
      const done = elapsed >= SIMULATED_DURATION_MS;

      setProgress({ stepIndex, progressPct, done });
      if (done && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, TICK_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [active]);

  const skip = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress({ stepIndex: SCAN_STEP_COUNT - 1, progressPct: 100, done: true });
  };

  return { ...progress, skip };
}
