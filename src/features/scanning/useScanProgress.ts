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

function txFetchPct(job: ScanStatusResponse): number {
  if (job.txTotal && job.txTotal > 0) {
    return Math.min(100, (job.txFetched / job.txTotal) * 100);
  }

  if (job.txFetched > 0) {
    return 15 + Math.min(55, job.txFetched * 2);
  }

  return 2;
}

function overallRealProgressPct(job: ScanStatusResponse, stepIndex: number): number {
  if (stepIndex === STEP.LOADING_TX) return Math.max(2, Math.round(txFetchPct(job) * 0.72));
  if (stepIndex === STEP.ANALYZING_TRACES) return 78;
  if (stepIndex === STEP.NFTS_TG) return 90;
  if (stepIndex === STEP.SCORE) return 97;
  return 8;
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
        setProgress({
          stepIndex,
          progressPct: overallRealProgressPct(job, stepIndex),
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
