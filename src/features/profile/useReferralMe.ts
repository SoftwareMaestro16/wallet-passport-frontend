import { useCallback, useEffect, useState } from "react";
import { api, type ReferralMeResponse } from "../../api/client";

export type ReferralMeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: ReferralMeResponse }
  | { status: "error" };

export function useReferralMe(active: boolean) {
  const [state, setState] = useState<ReferralMeState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!active) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    try {
      setState({ status: "ready", data: await api.getMyReferral() });
    } catch {
      setState({ status: "error" });
    }
  }, [active]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}
