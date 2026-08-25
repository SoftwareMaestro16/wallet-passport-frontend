import { useCallback, useEffect, useState } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import type { TonConnectUI } from "@tonconnect/ui-react";
import type { TonProofItemReplySuccess } from "@tonconnect/ui-react";
import { api, type TonProofVerifyResponse, ApiError } from "../api/client";
import { getTelegramInitData, waitForTelegramInitData } from "../app/telegram";
import { saveReferralCode } from "../shared/referral";

/**
 * `useTonProof`/`useVerifiedProfile` are called independently from `AppShell`, `ConnectScreen`,
 * `ProfileScreen`, and `MintScreen`, each with its own local React state. The `ton_proof` payload
 * is single-use server-side (consumed via Redis GETDEL) — two independent hook instances both
 * reacting to the same freshly-connected wallet raced to call `verify()` with the same proof, and
 * the loser got `payload_invalid_or_used` (confirmed in production logs). Rather than restructure
 * every screen to share one hook instance, de-duplicate at the network-call level: cache the
 * in-flight/settled promise by the proof's own payload string (its nonce), so every caller for the
 * same proof gets the exact same promise/result instead of firing a second request.
 */
let verifyPromiseCache: { payload: string; promise: Promise<TonProofVerifyResponse> } | null = null;

/**
 * Mirrors `verifyPromiseCache` above but for the payload-GENERATION step: `useTonProof` mounts
 * independently in `AppShell` + whichever screen is active, and each mount's `refreshPayload()`
 * effect used to independently call `getTonProofPayload` + `setConnectRequestParameters`. If two
 * mounts raced, the second call silently overwrote the connect request TonConnect had already
 * handed to the wallet app, so the wallet ended up signing a payload the server no longer
 * considered current (`payload_invalid_or_used`, confirmed in production logs). Sharing a single
 * in-flight/settled promise across every concurrent instance closes that race.
 *
 * Invalidated (a) on failure, so the next mount/retry actually fetches a new payload instead of
 * replaying a rejected promise, (b) once a wallet connection is observed, since the payload has
 * either just been consumed by that connect or is now irrelevant, and (c) after
 * `REFRESH_PAYLOAD_CACHE_MAX_AGE_MS` (comfortably under the backend's 300s TTL —
 * `server/src/config/index.ts`'s `tonProofPayloadTtlSeconds`), so an abandoned/cancelled connect
 * attempt doesn't leave a near-expired payload cached indefinitely for the next attempt to reuse.
 */
const REFRESH_PAYLOAD_CACHE_MAX_AGE_MS = 4 * 60 * 1000;
let refreshPayloadCache: { promise: Promise<void>; createdAt: number } | null = null;

async function performRefreshPayload(tonConnectUI: TonConnectUI): Promise<void> {
  tonConnectUI.setConnectRequestParameters({ state: "loading" });
  const initData = await waitForTelegramInitData();
  if (!initData) throw new Error("Telegram initData unavailable (waitForTelegramInitData timed out)");
  await api.telegramAuth(initData);
  const { payload } = await api.getTonProofPayload(initData);
  tonConnectUI.setConnectRequestParameters({ state: "ready", value: { tonProof: payload } });
}

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
    const isFresh = refreshPayloadCache && Date.now() - refreshPayloadCache.createdAt < REFRESH_PAYLOAD_CACHE_MAX_AGE_MS;
    if (!isFresh) {
      refreshPayloadCache = { promise: performRefreshPayload(tonConnectUI), createdAt: Date.now() };
    }
    const cached = refreshPayloadCache!;
    try {
      setPayloadError(null);
      await cached.promise;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      tonConnectUI.setConnectRequestParameters(null);
      setPayloadError(message);
      if (refreshPayloadCache === cached) refreshPayloadCache = null;
    }
  }, [tonConnectUI]);

  useEffect(() => {
    void refreshPayload();
  }, [refreshPayload]);

  useEffect(() => {
    // The payload has either just been consumed by this connect or is now stale — either way the
    // next disconnect+reconnect must fetch a genuinely fresh one, not replay this resolved promise.
    if (wallet) refreshPayloadCache = null;
  }, [wallet]);

  const tonProofResult = wallet?.connectItems?.tonProof as TonProofItemReplySuccess | undefined;

  const verify = useCallback(async () => {
    if (!wallet || !tonProofResult || !("proof" in tonProofResult)) {
      const msg = "No ton_proof on current wallet connection";
      setVerifyError(msg);
      throw new Error(msg);
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
    promise
      .then((result) => {
        setVerifyError(null);
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
