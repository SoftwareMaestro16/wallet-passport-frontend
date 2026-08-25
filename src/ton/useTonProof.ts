import { useCallback, useEffect, useRef, useState } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import type { TonProofItemReplySuccess } from "@tonconnect/ui-react";
import { api, type TonProofVerifyResponse } from "../api/client";
import { getTelegramInitData, waitForTelegramInitData } from "../app/telegram";

/**
 * `useTonProof`/`useVerifiedProfile` are called independently from both `ConnectScreen` and
 * `ProfileScreen` (by design — see `useVerifiedProfile`'s doc comment), each with its own local
 * React state. The `ton_proof` payload is single-use server-side (consumed via Redis GETDEL) —
 * two independent hook instances both reacting to the same freshly-connected wallet raced to call
 * `verify()` with the same proof, and the loser got `payload_invalid_or_used` (confirmed in
 * production logs). Rather than restructure both screens to share one hook instance, de-duplicate
 * at the network-call level: cache the in-flight/settled promise by the proof's own payload
 * string (its nonce), so every caller for the same proof gets the exact same promise/result
 * instead of firing a second request.
 */
let verifyPromiseCache: { payload: string; promise: Promise<TonProofVerifyResponse> } | null = null;

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
  const [payloadError, setPayloadError] = useState(false);

  const refreshPayload = useCallback(async () => {
    try {
      setPayloadError(false);
      tonConnectUI.setConnectRequestParameters({ state: "loading" });
      // verifyTonProof requires an existing session cookie (server/src/http/routes/auth.ts) that
      // only this call issues — must happen before the wallet ever reaches verify(), so it's
      // bundled into the same mount-time effect that fetches the proof payload rather than a
      // separate step that could race with connecting. `waitForTelegramInitData` matters here:
      // on at least one real client `initData` reads empty for a beat right at mount (see its
      // doc comment) — this ran at mount before, so it hit that empty window every time.
      const initData = await waitForTelegramInitData();
      await api.telegramAuth(initData);
      const { payload } = await api.getTonProofPayload(initData);
      payloadRef.current = payload;
      tonConnectUI.setConnectRequestParameters({ state: "ready", value: { tonProof: payload } });
    } catch {
      // Backend unreachable (wrong VITE_API_BASE_URL, server down, etc.) — clear the loading
      // state so the wallet can still connect without a proof, but surface this loudly instead
      // of silently degrading: a wallet connected without a proof can never pass verification,
      // so the "Generate" button would otherwise just never appear with zero explanation.
      tonConnectUI.setConnectRequestParameters(null);
      setPayloadError(true);
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

    const payload = tonProofResult.proof.payload;
    if (verifyPromiseCache?.payload === payload) {
      return verifyPromiseCache.promise;
    }

    const promise = api.verifyTonProof(
      {
        address: wallet.account.address,
        network: wallet.account.chain,
        publicKey: wallet.account.publicKey,
        walletStateInit: wallet.account.walletStateInit,
        proof: {
          timestamp: tonProofResult.proof.timestamp,
          domain: tonProofResult.proof.domain,
          signature: tonProofResult.proof.signature,
          payload,
        },
      },
      getTelegramInitData(),
    );
    verifyPromiseCache = { payload, promise };
    // A failed verification must not permanently poison this payload — clear the cache so a
    // deliberate retry (which re-fetches a brand new payload anyway) isn't blocked by a stale
    // rejected promise if the same payload string were ever reused.
    promise.catch(() => {
      if (verifyPromiseCache?.payload === payload) verifyPromiseCache = null;
    });
    return promise;
  }, [wallet, tonProofResult]);

  return {
    refreshPayload,
    verify,
    hasProof: Boolean(tonProofResult && "proof" in tonProofResult),
    payloadError,
  };
}
