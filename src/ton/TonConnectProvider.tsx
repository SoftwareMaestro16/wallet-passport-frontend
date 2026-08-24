import type { ReactNode } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

const MANIFEST_URL = `${window.location.origin}/tonconnect-manifest.json`;

/**
 * TESTNET NOTE (read this before touching TonConnect config):
 *
 * `@tonconnect/ui-react` (current versions) has no single "network: testnet" switch that
 * forces every connected wallet onto testnet — TonConnect is wallet-agnostic, and which chain
 * a wallet operates on is reported by the wallet itself after connect
 * (`wallet.account.chain`, a `CHAIN` value from `@tonconnect/sdk`: `CHAIN.MAINNET` = "-239",
 * `CHAIN.TESTNET` = "-3").
 *
 * Practical approach used here (document/replace once a real testnet-only wallet list exists):
 *   1. Ship a normal manifest — testnet-capable wallets (Tonkeeper testnet build, MyTonWallet
 *      testnet toggle, TON Space testnet) work with any valid manifest.
 *   2. After connect, `useTonConnectAccount()` (src/ton/useTonConnectAccount.ts) checks
 *      `wallet.account.chain === CHAIN.TESTNET` and the UI shows a "switch wallet to testnet"
 *      warning if it isn't — see `src/shared/TestnetGuard.tsx`.
 *   3. All backend calls (`mint/prepare`, `ton_proof` verify) must independently re-check the
 *      chain server-side; the client-side guard is a UX nicety only, never a trust boundary.
 *
 * If a future `@tonconnect/ui-react` release adds a first-class testnet flag or a
 * `walletsListConfiguration` filter for testnet-only wallets, prefer that and delete this note.
 */
export function TonConnectProvider({ children }: { children: ReactNode }) {
  return (
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      actionsConfiguration={{
        twaReturnUrl: "https://t.me",
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
}
