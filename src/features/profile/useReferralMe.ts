import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type ReferralMeResponse } from "../../api/client";

export type ReferralMeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: ReferralMeResponse }
  // Session exists but no ACTIVE wallet binding yet (server returns 409, see
  // server/src/http/routes/referrals.ts) — referral codes are now per-wallet.
  | { status: "noWallet" }
  | { status: "error" };

export function useReferralMe(active: boolean, walletAddress: string | null) {
  const [state, setState] = useState<ReferralMeState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!active) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    try {
      setState({ status: "ready", data: await api.getMyReferral() });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setState({ status: "noWallet" });
        return;
      }
      setState({ status: "error" });
    }
    // `walletAddress` is otherwise unused in this body — it's a dependency purely to force a
    // re-fetch when the connected wallet changes, since the referral code is scoped to the
    // active wallet binding (server/src/domain/referral.ts) and switching wallets must not
    // keep showing the previous wallet's code/stats.
  }, [active, walletAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}
