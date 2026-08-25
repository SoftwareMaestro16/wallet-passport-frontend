import { useEffect, useState } from "react";

type TonBalanceState = {
  balanceTon: string | null;
  isLoading: boolean;
};

export function useTonBalance(address: string | null): TonBalanceState {
  const [state, setState] = useState<TonBalanceState>({ balanceTon: null, isLoading: false });

  useEffect(() => {
    if (!address) {
      setState({ balanceTon: null, isLoading: false });
      return;
    }

    setState({ balanceTon: null, isLoading: false });
  }, [address]);

  return state;
}
