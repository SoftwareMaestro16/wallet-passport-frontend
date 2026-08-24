import { useEffect, useState } from "react";
import { useTonConnectAccount } from "./useTonConnectAccount";
import { useTonProof } from "./useTonProof";
import type { TonProofVerifyResponse } from "../api/client";

export type VerifiedProfileState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "success"; data: TonProofVerifyResponse }
  | { status: "error" };

/**
 * Shared `ton_proof` verification gate — Connect uses it to decide when the "Generate" action
 * unlocks, Profile uses it to render the result. Wraps `useTonProof` (never touch that hook's
 * logic) so both screens share one verify-on-connect flow instead of diverging over time.
 */
export function useVerifiedProfile() {
  const { isConnected } = useTonConnectAccount();
  const { verify, hasProof } = useTonProof();
  const [state, setState] = useState<VerifiedProfileState>({ status: "idle" });

  useEffect(() => {
    if (!isConnected || !hasProof || state.status !== "idle") return;

    setState({ status: "verifying" });
    verify()
      .then((data) => setState({ status: "success", data }))
      .catch(() => setState({ status: "error" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, hasProof]);

  return { isConnected, hasProof, state, retry: () => setState({ status: "idle" }) };
}
