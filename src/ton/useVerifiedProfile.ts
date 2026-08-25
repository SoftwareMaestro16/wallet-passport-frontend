import { useEffect, useRef, useState } from "react";
import { useIsConnectionRestored } from "@tonconnect/ui-react";
import { useTonConnectAccount } from "./useTonConnectAccount";
import { useTonProof } from "./useTonProof";

export type VerifiedProfileState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "success" };

/**
 * Shared ton_proof verification gate.
 *
 * Critical ordering: on page load, TonConnect asynchronously restores a previously
 * connected wallet (see `tonConnectUI.connectionRestored` in @tonconnect/ui). Until that
 * promise resolves, `useTonWallet` may report empty or an intermediate state. Reacting to
 * those transient states used to auto-disconnect the persisted wallet before restore
 * finished — hence the "kicked out on every reload" bug. Every branch below gates on
 * `isRestored` first.
 *
 * A restored connection has no fresh ton_proof (proofs are one-shot, only issued at
 * connect time), and we can't retroactively obtain one. We treat a restored connection as
 * verified for UI purposes so the address stays in the header and Scan/Mint stay enabled;
 * the backend session cookie (`credentials: "include"`) set by the original verify still
 * gates real API calls, so security isn't downgraded.
 */
export function useVerifiedProfile() {
  const isRestored = useIsConnectionRestored();
  const { isConnected, tonConnectUI } = useTonConnectAccount();
  const { verify, hasProof, payloadError } = useTonProof();
  const [state, setState] = useState<VerifiedProfileState>({ status: "idle" });
  // True after we've decided what to do with the first wallet event of this session — used
  // to distinguish "wallet just came back from restore" from "wallet just freshly connected".
  const decidedRef = useRef(false);

  useEffect(() => {
    if (!isRestored) return;

    if (!isConnected) {
      setState({ status: "idle" });
      decidedRef.current = false;
      return;
    }
    if (state.status !== "idle") return;

    // A fresh connect after wallet restore finished should carry ton_proof. If the wallet
    // is restored (no fresh proof) OR the backend was unreachable before connect, keep
    // the connection but skip verify — the address stays visible, session cookie (if any)
    // still gates backend calls.
    if (!hasProof || payloadError) {
      decidedRef.current = true;
      setState({ status: "success" });
      return;
    }

    decidedRef.current = true;
    setState({ status: "verifying" });
    verify()
      .then(() => setState({ status: "success" }))
      .catch(() => {
        void tonConnectUI.disconnect();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestored, isConnected, hasProof, payloadError]);

  return { isConnected: isRestored && isConnected, hasProof, state };
}
