import { useCallback, useEffect, useRef } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import type { TonProofItemReplySuccess } from "@tonconnect/ui-react";
import { api } from "../api/client";
import { getTelegramInitData } from "../app/telegram";

/**
 * Implements the TonConnect `ton_proof` request/response dance described in
 * TMAGUIDE.md §3:
 *   1. Ask the backend for a one-time challenge payload.
 *   2. Attach it to TonConnect's connect request via `setConnectRequestParameters`
 *      *before* the user opens the wallet picker, so the wallet signs it as part
 *      of connecting.
 *   3. Once connected, `wallet.connectItems.tonProof` carries the wallet's
 *      signature — hand it to the backend to verify (challenge + domain +
 *      stateInit-derived pubkey for undeployed wallets).
 *
 * Call `refreshPayload()` once near the app root (see src/App.tsx) so the
 * payload is ready before the TonConnect button is clicked.
 */
export function useTonProof() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const payloadRef = useRef<string | null>(null);

  const refreshPayload = useCallback(async () => {
    try {
      tonConnectUI.setConnectRequestParameters({ state: "loading" });
      const { payload } = await api.getTonProofPayload(getTelegramInitData());
      payloadRef.current = payload;
      tonConnectUI.setConnectRequestParameters({ state: "ready", value: { tonProof: payload } });
    } catch {
      // Backend unreachable (e.g. local dev without server running) — clear the loading
      // state so the wallet can still connect without a proof, and let the caller retry.
      tonConnectUI.setConnectRequestParameters(null);
    }
  }, [tonConnectUI]);

  useEffect(() => {
    void refreshPayload();
  }, [refreshPayload]);

  const tonProofResult = wallet?.connectItems?.tonProof as TonProofItemReplySuccess | undefined;

  const verify = useCallback(async () => {
    if (!wallet || !tonProofResult || !("proof" in tonProofResult)) {
      throw new Error("No ton_proof available on the current wallet connection");
    }

    return api.verifyTonProof(
      {
        address: wallet.account.address,
        network: wallet.account.chain,
        publicKey: wallet.account.publicKey,
        walletStateInit: wallet.account.walletStateInit,
        proof: {
          timestamp: tonProofResult.proof.timestamp,
          domain: tonProofResult.proof.domain,
          signature: tonProofResult.proof.signature,
          payload: tonProofResult.proof.payload,
        },
      },
      getTelegramInitData(),
    );
  }, [wallet, tonProofResult]);

  return { refreshPayload, verify, hasProof: Boolean(tonProofResult && "proof" in tonProofResult) };
}
