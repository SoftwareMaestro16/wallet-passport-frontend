import { useEffect, useState } from "react";
import { useTonConnectAccount } from "./useTonConnectAccount";
import { useTonProof } from "./useTonProof";
import type { TonProofVerifyResponse } from "../api/client";

export type VerifiedProfileState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "success"; data: TonProofVerifyResponse };

/**
 * Shared `ton_proof` verification gate. Any failure (backend unreachable, server rejected
 * the proof, or the wallet connected before a proof could be attached) simply disconnects
 * the wallet — the header's TonConnectButton then flips back to "Connect Wallet" and the
 * user retries with a fresh session. This replaces the earlier explicit error/backend-
 * unreachable/no-proof screens, which just told the user to reconnect anyway.
 */
export function useVerifiedProfile() {
  const { isConnected, tonConnectUI } = useTonConnectAccount();
  const { verify, hasProof, payloadError } = useTonProof();
  const [state, setState] = useState<VerifiedProfileState>({ status: "idle" });

  useEffect(() => {
    if (!isConnected) {
      // Wallet was disconnected (either by us on failure, or by the user) — reset state so a
      // fresh connect starts from a clean slate rather than being blocked by stale success/verify.
      setState({ status: "idle" });
      return;
    }
    if (state.status !== "idle") return;

    if (payloadError) {
      void tonConnectUI.disconnect();
      return;
    }
    if (!hasProof) {
      // Wallet connected before refreshPayload attached tonProof — this connection can never
      // produce one. Disconnect so the user gets a fresh Connect button; the next connect
      // (after payload is ready) will carry a valid proof.
      void tonConnectUI.disconnect();
      return;
    }

    setState({ status: "verifying" });
    verify()
      .then((data) => setState({ status: "success", data }))
      .catch(() => {
        void tonConnectUI.disconnect();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, hasProof, payloadError]);

  return { isConnected, hasProof, state };
}
