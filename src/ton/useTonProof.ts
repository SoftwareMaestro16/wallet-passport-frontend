import { useCallback, useEffect, useState } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import type { TonProofItemReplySuccess } from "@tonconnect/ui-react";
import { api, type TonProofVerifyResponse, ApiError } from "../api/client";
import { getTelegramInitData, waitForTelegramInitData } from "../app/telegram";
import { saveReferralCode } from "../shared/referral";
import { pushDebug } from "../shared/debug";

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
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const refreshPayload = useCallback(async () => {
    try {
      setPayloadError(null);
      tonConnectUI.setConnectRequestParameters({ state: "loading" });
      const initData = await waitForTelegramInitData();
      if (!initData) throw new Error("Telegram initData unavailable (waitForTelegramInitData timed out)");
      pushDebug(`initData length=${initData.length}`);
      const auth = await api.telegramAuth(initData);
      pushDebug(`telegramAuth OK user=${auth.user.id}`);
      const { payload } = await api.getTonProofPayload(initData);
      pushDebug(`ton_proof payload received (${payload.length} chars)`);
      tonConnectUI.setConnectRequestParameters({ state: "ready", value: { tonProof: payload } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      pushDebug(`refreshPayload FAILED: ${message}`);
      tonConnectUI.setConnectRequestParameters(null);
      setPayloadError(message);
    }
  }, [tonConnectUI]);

  useEffect(() => {
    void refreshPayload();
  }, [refreshPayload]);

  const tonProofResult = wallet?.connectItems?.tonProof as TonProofItemReplySuccess | undefined;

  const verify = useCallback(async () => {
    if (!wallet || !tonProofResult || !("proof" in tonProofResult)) {
      const msg = "No ton_proof on current wallet connection";
      setVerifyError(msg);
      pushDebug(`verify skipped: ${msg}`);
      throw new Error(msg);
    }

    const payload = tonProofResult.proof.payload;
    if (verifyPromiseCache?.payload === payload) {
      return verifyPromiseCache.promise;
    }

    pushDebug(`verify() sending: addr=${wallet.account.address.slice(0, 10)}... chain=${wallet.account.chain}`);
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
    promise
      .then((result) => {
        setVerifyError(null);
        pushDebug("verify OK");
        // Cached per-wallet code (see shared/referral.ts) is only a fallback for the brief
        // window before ProfileScreen's `GET /referrals/me` resolves — see useReferralMe.
        saveReferralCode(result.binding.referralCode);
      })
      .catch((err) => {
        const message = err instanceof ApiError
          ? `verify HTTP ${err.status}: ${JSON.stringify(err.body).slice(0, 200)}`
          : err instanceof Error
            ? `verify FAILED: ${err.message}`
            : `verify FAILED: ${String(err)}`;
        pushDebug(message);
        setVerifyError(message);
        if (verifyPromiseCache?.payload === payload) verifyPromiseCache = null;
      });
    return promise;
  }, [wallet, tonProofResult]);

  return {
    refreshPayload,
    verify,
    hasProof: Boolean(tonProofResult && "proof" in tonProofResult),
    payloadError,
    verifyError,
  };
}
