import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type ScanStatusResponse } from "../../api/client";

export const SCAN_STEP_COUNT = 9;

const POLL_MS = 2000;
// Fixed-duration cosmetic transitions — see the STEP/COSMETIC_SEQUENCE comment below for which
// steps these are and why they only ever play after the real backend job is DONE.
const COSMETIC_STEP_MS = 1300;
const PREPARING_STEP_MS = 900;

/**
 * Indices into the 9 `scanning.steps.*` i18n strings, named so the mapping logic below reads
 * naturally instead of as bare numbers.
 */
const STEP = {
  LOADING_TX: 0,
  ANALYZING_TRACES: 1,
  JETTONS: 2,
  DEFI: 3,
  NFTS_TG: 4,
  STAKING: 5,
  RARE_RELICS: 6,
  SCORE: 7,
  PREPARING: 8,
} as const;

/**
 * Steps 2-6 (Jettons/DeFi/NFTs & Telegram assets/Staking/Rare Relics) have NO backend signal
 * behind them today — `runScan` (server/src/ingestion/scanRunner.ts) only fetches transactions,
 * canonicalizes them, and computes rawStats; it does not run per-category DeFi/NFT/staking/relic
 * analysis. Faking progress through those stages while real work happens would misrepresent what
 * the backend is doing, so instead they play as a short, clearly-cosmetic sequence AFTER the real
 * job reports DONE and BEFORE navigating to the profile — preserving the "feels thorough" UX the
 * product wants without claiming any of them are live.
 */
const COSMETIC_SEQUENCE = [STEP.JETTONS, STEP.DEFI, STEP.NFTS_TG, STEP.STAKING, STEP.RARE_RELICS];

export type ScanProgress = {
  stepIndex: number;
  progressPct: number;
  done: boolean;
  failed: boolean;
};

/**
 * Best-effort mapping from the server's real `phase` string to one of our step indices.
 * Matched by keyword rather than exact enum value because `phase` is being added concurrently
 * server-side — this survives minor naming differences (e.g. "FETCHING_TRANSACTIONS" vs
 * "fetch_transactions") without needing to coordinate the exact string in advance.
 */
function phaseToStepIndex(phase: string | undefined): number | null {
  const p = (phase ?? "").toLowerCase();
  if (!p) return null;
  if (p.includes("fetch") || p.includes("transaction")) return STEP.LOADING_TX;
  if (p.includes("canon") || p.includes("trace")) return STEP.ANALYZING_TRACES;
  if (p.includes("metric") || p.includes("scor")) return STEP.SCORE;
  return null;
}

/** 0..100 progress within the "loading transactions" step, from real txFetched/txTotal counts. */
function txFetchPct(job: ScanStatusResponse): number {
  if (job.txTotal && job.txTotal > 0) {
    return Math.min(100, (job.txFetched / job.txTotal) * 100);
  }
  return job.txFetched > 0 ? 50 : 5;
}

/**
 * Overall 0..88 progress bar position while the real backend job is still PENDING/RUNNING. The
 * remaining 88..100 range is reserved for the cosmetic sequence below so the bar always visibly
 * advances once DONE, even though those steps aren't backend-driven.
 */
function overallRealProgressPct(job: ScanStatusResponse, stepIndex: number): number {
  if (stepIndex === STEP.LOADING_TX) return 5 + txFetchPct(job) * 0.4; // 5..45
  if (stepIndex === STEP.ANALYZING_TRACES) return 60;
  if (stepIndex === STEP.SCORE) return 80;
  return 30;
}

/**
 * Falls back to a txFetched/txTotal-driven guess when the server hasn't sent `phase` yet
 * (rollout gap, or an older ScanJob row) — never gets stuck on step 0 forever.
 */
function fallbackStepIndex(job: ScanStatusResponse): number {
  if (job.txTotal && job.txTotal > 0 && job.txFetched >= job.txTotal) return STEP.ANALYZING_TRACES;
  return STEP.LOADING_TX;
}

/**
 * Drives the Scanning screen's progress UI with REAL backend polling:
 *   1. POST /wallets/:address/scan to kick off (or join) a scan job.
 *   2. Poll GET /wallets/:address/scan-status every ~2s, mapping the real `status`/`phase`/
 *      `txFetched`/`txTotal` fields onto step 0 (Loading transactions), step 1 (Analyzing
 *      traces), and step 7 (Calculating Wallet Score) — see phaseToStepIndex above.
 *   3. Once the job reports DONE, play the fixed-duration COSMETIC_SEQUENCE (steps 2-6) plus a
 *      short "Preparing Wallet Passport" step (8), then report done=true.
 *   4. On FAILED, report failed=true with the server's error message; `retry()` re-runs step 1.
 */
export function useScanProgress(address: string | undefined, active: boolean) {
  const [progress, setProgress] = useState<ScanProgress>({
    stepIndex: 0,
    progressPct: 0,
    done: false,
    failed: false,
  });
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const skippedRef = useRef(false);
  const cosmeticStartedRef = useRef(false);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  const clearTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  const runCosmeticSequence = useCallback(() => {
    if (cosmeticStartedRef.current) return;
    cosmeticStartedRef.current = true;

    let elapsed = 0;
    COSMETIC_SEQUENCE.forEach((stepIndex, i) => {
      const timeout = setTimeout(() => {
        if (skippedRef.current) return;
        setProgress({
          stepIndex,
          progressPct: 88 + ((i + 1) / (COSMETIC_SEQUENCE.length + 1)) * 10,
          done: false,
          failed: false,
        });
      }, elapsed);
      timeoutsRef.current.push(timeout);
      elapsed += COSMETIC_STEP_MS;
    });

    const preparingTimeout = setTimeout(() => {
      if (skippedRef.current) return;
      setProgress({ stepIndex: STEP.PREPARING, progressPct: 99, done: false, failed: false });
    }, elapsed);
    timeoutsRef.current.push(preparingTimeout);
    elapsed += PREPARING_STEP_MS;

    const doneTimeout = setTimeout(() => {
      if (skippedRef.current) return;
      setProgress({ stepIndex: STEP.PREPARING, progressPct: 100, done: true, failed: false });
    }, elapsed);
    timeoutsRef.current.push(doneTimeout);
  }, []);

  const start = useCallback(async () => {
    if (!address) return;

    setErrorMessage(undefined);
    skippedRef.current = false;
    cosmeticStartedRef.current = false;
    clearPoll();
    clearTimeouts();
    setProgress({ stepIndex: STEP.LOADING_TX, progressPct: 0, done: false, failed: false });

    try {
      await api.startWalletScan(address);
    } catch (err) {
      // A 4xx here (e.g. a scan already in flight) still leaves a real job to poll for — only a
      // total failure to reach the backend at all is fatal before polling even starts.
      if (!(err instanceof ApiError)) {
        setProgress({ stepIndex: STEP.LOADING_TX, progressPct: 0, done: false, failed: true });
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
          runCosmeticSequence();
          return;
        }

        const stepIndex = phaseToStepIndex(job.phase) ?? fallbackStepIndex(job);
        setProgress({
          stepIndex,
          progressPct: overallRealProgressPct(job, stepIndex),
          done: false,
          failed: false,
        });
      } catch {
        // Transient network hiccup on one poll tick — the next tick tries again rather than
        // failing the whole scan over a single dropped request.
      }
    }, POLL_MS);
  }, [address, runCosmeticSequence]);

  useEffect(() => {
    if (!active || !address) return;
    void start();
    return () => {
      clearPoll();
      clearTimeouts();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, address]);

  const skip = () => {
    skippedRef.current = true;
    clearPoll();
    clearTimeouts();
    setProgress({ stepIndex: STEP.PREPARING, progressPct: 100, done: true, failed: false });
  };

  const retry = () => {
    void start();
  };

  return { ...progress, errorMessage, skip, retry };
}
