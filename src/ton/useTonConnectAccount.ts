import { useTonAddress, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { CHAIN } from "@tonconnect/sdk";

/** Convenience hook bundling the bits of TonConnect state the app actually needs. */
export function useTonConnectAccount() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const address = useTonAddress();

  const chain = wallet?.account?.chain;
  const isTestnet = chain === CHAIN.TESTNET;
  const isConnected = Boolean(wallet);

  return { tonConnectUI, wallet, address, chain, isTestnet, isConnected };
}
