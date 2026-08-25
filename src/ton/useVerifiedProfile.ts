import { useEffect, useState } from "react";
import { useTonConnectAccount } from "./useTonConnectAccount";
import { useTonProof } from "./useTonProof";
import type { TonProofVerifyResponse } from "../api/client";

export type VerifiedProfileState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "success"; data: TonProofVerifyResponse }
  | { status: "error" }
  // The backend couldn't be reached to even issue a ton_proof challenge (wrong API base URL,
  // server down) — distinct from "error" (a completed-but-rejected verification), since here
  // the wallet connected with no proof attached at all and retry must re-fetch the payload
  // before the *next* connect, not just re-run verify() against the same (proof-less) wallet.
  | { status: "backend-unreachable" }
  // The wallet connected before `refreshPayload()`'s async chain (telegramAuth + payload fetch)
  // finished attaching `tonProof` to `setConnectRequestParameters` — TonConnect only attaches
  // `connectItems.tonProof` at connect time, never retroactively, so this connection can never
  // produce a proof; the only fix is disconnecting and reconnecting once a fresh payload is
  // ready. Previously this silently left `state` stuck at "idle" forever with no feedback.
  | { status: "no-proof" };

/**
 * Shared `ton_proof` verification gate — Connect uses it to decide when the "Generate" action
 * unlocks, Profile uses it to render the result. Wraps `useTonProof` (never touch that hook's
 * logic) so both screens share one verify-on-connect flow instead of diverging over time.
 */
export function useVerifiedProfile() {
  const { isConnected, tonConnectUI } = useTonConnectAccount();
  const { verify, hasProof, payloadError, refreshPayload } = useTonProof();
  const [state, setState] = useState<VerifiedProfileState>({ status: "idle" });

  useEffect(() => {
    if (!isConnected || state.status !== "idle") return;

    if (payloadError) {
      setState({ status: "backend-unreachable" });
      return;
    }
    if (!hasProof) {
      setState({ status: "no-proof" });
      return;
    }

    setState({ status: "verifying" });
    verify()
      .then((data) => setState({ status: "success", data }))
      .catch(() => setState({ status: "error" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, hasProof, payloadError]);

  return {
    isConnected,
    hasProof,
    state,
    retry: () => {
      void refreshPayload();
      setState({ status: "idle" });
    },
    reconnect: async () => {
      await tonConnectUI.disconnect();
      await refreshPayload();
      setState({ status: "idle" });
      void tonConnectUI.openModal();
    },
  };
}
