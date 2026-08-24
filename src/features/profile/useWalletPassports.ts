import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type WalletPassportsResponse } from "../../api/client";

export type WalletPassportsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: WalletPassportsResponse }
  // The endpoint is being added by a concurrent agent and may not be live yet, or may 404 for a
  // wallet with no eligibility data computed — either way, hide the section rather than crash.
  | { status: "unavailable" }
  | { status: "error" };

/**
 * Fetches per-category mint/refresh eligibility from `GET /wallets/:address/passports`
 * (server-side work in progress alongside this client work). Code defensively: a 404 here is
 * expected during rollout, not a bug.
 */
export function useWalletPassports(address: string | undefined) {
  const [state, setState] = useState<WalletPassportsState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!address) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    try {
      const data = await api.getWalletPassports(address);
      setState({ status: "ready", data });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setState({ status: "unavailable" });
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
