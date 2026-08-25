import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type ScanStatusResponse } from "../../api/client";

export const SCAN_STEP_COUNT = 9;

const POLL_MS = 2000;

const STEP = {
  LOADING_TX: 0,
  ANALYZING_TRACES: 1,
  NFTS_TG: 4,
  SCORE: 7,
  PREPARING: 8,
} as const;

export type ScanProgress = {
  stepIndex: number;
  progressPct: number;
  done: boolean;
  failed: boolean;
  detailKey: string;
  detailValues?: Record<string, number>;
};

function phaseToStepIndex(phase: string | undefined): number | null {
  const p = (phase ?? "").toLowerCase();
  if (!p) return null;
  if (p.includes("fetch") || p.includes("transaction")) return STEP.LOADING_TX;
  if (p.includes("canon") || p.includes("trace")) return STEP.ANALYZING_TRACES;
  if (p.includes("aux")) return STEP.NFTS_TG;
  if (p.includes("metric") || p.includes("scor")) return STEP.SCORE;
  return null;
}

/**
 * The overall percentage itself is computed server-side (server/src/ingestion/scanProgress.ts)
 * from real per-phase counters — the client used to re-derive it here with several hardcoded
 * jumps (flat 78/90/97, an arbitrary `15 + fetched*2` formula) that didn't reflect real work
 * done. `progressPercent` can still be briefly `undefined` on rollout (older server build) or
 * for a job snapshot that predates the field; fall back to a small non-zero placeholder rather
 * than a fabricated mid-range number.
 */
function overallRealProgressPct(job: ScanStatusResponse): number {
  if (typeof job.progressPercent === "number") return job.progressPercent;
  return 2;
}

function progressDetail(job: ScanStatusResponse, stepIndex: number): Pick<ScanProgress, "detailKey" | "detailValues"> {
  if (stepIndex === STEP.LOADING_TX) {
    if (job.txTotal && job.txTotal > 0) {
      return {
        detailKey: "scanning.progress.loadedOfTotal",
        detailValues: { loaded: job.txFetched, total: job.txTotal },
      };
    }

    return {
      detailKey: "scanning.progress.loaded",
      detailValues: { loaded: job.txFetched },
    };
  }

  if (stepIndex === STEP.ANALYZING_TRACES) {
    if (job.txTotal && job.txTotal > 0) {
      return {
        detailKey: "scanning.progress.canonicalizingOfTotal",
        detailValues: { processed: job.txFetched, total: job.txTotal, new: job.newTxFetched },
      };
    }

    return {
      detailKey: "scanning.progress.canonicalizing",
      detailValues: { loaded: Math.max(job.txFetched, job.txTotal ?? 0), new: job.newTxFetched },
    };
  }

  if (stepIndex === STEP.NFTS_TG) {
    return {
      detailKey: "scanning.progress.auxiliary",
      detailValues: { loaded: Math.max(job.txFetched, job.txTotal ?? 0), new: job.newTxFetched },
    };
  }

  if (stepIndex === STEP.SCORE) {
    return {
      detailKey: "scanning.progress.metrics",
      detailValues: { loaded: Math.max(job.txFetched, job.txTotal ?? 0), new: job.newTxFetched },
    };
  }

  return { detailKey: "scanning.progress.starting" };
}

function fallbackStepIndex(job: ScanStatusResponse): number {
  if (job.txTotal && job.txTotal > 0 && job.txFetched >= job.txTotal) return STEP.ANALYZING_TRACES;
  return STEP.LOADING_TX;
}

export function useScanProgress(address: string | undefined, active: boolean) {
  const [progress, setProgress] = useState<ScanProgress>({
    stepIndex: STEP.LOADING_TX,
    progressPct: 0,
    done: false,
    failed: false,
    detailKey: "scanning.progress.starting",
  });
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const skippedRef = useRef(false);
  // The server derives progressPercent from live per-phase counters (see
  // scanRunner.ts/scanProgress.ts) that aren't strictly guaranteed monotonic across two polls
  // (e.g. a mainnet classification sub-phase can reset its own fetched/total pair mid-phase) —
  // clamp client-side so the displayed bar itself never visibly moves backwards.
  const maxPctRef = useRef(0);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const start = useCallback(async () => {
    if (!address) return;

    setErrorMessage(undefined);
    skippedRef.current = false;
    maxPctRef.current = 0;
    clearPoll();
    setProgress({
      stepIndex: STEP.LOADING_TX,
      progressPct: 0,
      done: false,
      failed: false,
      detailKey: "scanning.progress.starting",
    });

    try {
      await api.startWalletScan(address);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setProgress({
          stepIndex: STEP.LOADING_TX,
          progressPct: 0,
          done: false,
          failed: true,
          detailKey: "scanning.progress.starting",
        });
        return;
      }
    }

    pollRef.current = setInterval(async () => {
      if (skippedRef.current) return;

      try {
        const job = await api.getScanStatus(address);

        if (job.status === "FAILED") {
          clearPoll();
          setErrorMessage(job.error ?? undefined);
          setProgress((prev) => ({ ...prev, done: false, failed: true }));
          return;
        }

        if (job.status === "DONE") {
          clearPoll();
          maxPctRef.current = 100;
          setProgress({
            stepIndex: STEP.PREPARING,
            progressPct: 100,
            done: true,
            failed: false,
            detailKey: "scanning.progress.done",
            detailValues: { loaded: job.txTotal ?? job.txFetched, new: job.newTxFetched },
          });
          return;
        }

        const stepIndex = phaseToStepIndex(job.phase) ?? fallbackStepIndex(job);
        maxPctRef.current = Math.max(maxPctRef.current, overallRealProgressPct(job));
        setProgress({
          stepIndex,
          progressPct: maxPctRef.current,
          done: false,
          failed: false,
          ...progressDetail(job, stepIndex),
        });
      } catch {
        // Retry on the next polling tick.
      }
    }, POLL_MS);
  }, [address]);

  useEffect(() => {
    if (!active || !address) return;
    void start();

    return () => {
      clearPoll();
    };
  }, [active, address, start]);

  const skip = () => {
    skippedRef.current = true;
    clearPoll();
    setProgress({
      stepIndex: STEP.PREPARING,
      progressPct: 100,
      done: true,
      failed: false,
      detailKey: "scanning.progress.done",
    });
  };

  const retry = () => {
    void start();
  };

  return { ...progress, errorMessage, skip, retry };
}
