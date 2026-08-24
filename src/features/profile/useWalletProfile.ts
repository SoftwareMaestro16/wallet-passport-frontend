import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type WalletProfileResponse } from "../../api/client";

export type WalletProfileState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: WalletProfileResponse }
  // GET /wallets/:address/profile responds 409 until a scan has completed for this wallet — an
  // honest "nothing to show yet", never an error.
  | { status: "not-scanned" }
  | { status: "error" };

/**
 * Fetches the real scan-derived profile (score + rawStats) for a wallet address, per
 * server/src/http/routes/wallets.ts's `GET /wallets/:address/profile`. Distinct from
 * `useVerifiedProfile` (ton_proof identity verification) — this is the actual scan result data,
 * used by both ConnectScreen (to decide "Scan Wallet" vs "Update Passport" copy) and
 * ProfileScreen (to render the result sections).
 */
export function useWalletProfile(address: string | undefined) {
  const [state, setState] = useState<WalletProfileState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!address) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    try {
      const data = await api.getWalletProfile(address);
      setState({ status: "ready", data });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setState({ status: "not-scanned" });
      } else {
        setState({ status: "error" });
      }
    }
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}
