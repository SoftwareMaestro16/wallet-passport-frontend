import { useTranslation } from "react-i18next";
import { useTonConnectAccount } from "../ton/useTonConnectAccount";

/**
 * Shows a warning banner when the connected wallet is reporting mainnet instead of testnet.
 * See the long comment in src/ton/TonConnectProvider.tsx for why this check exists client-side
 * and why it is a UX nicety, not a security boundary (the backend must re-check independently).
 */
export function TestnetGuard() {
  const { t } = useTranslation();
  const { isConnected, isTestnet } = useTonConnectAccount();

  if (!isConnected || isTestnet) return null;

  return <div className="testnet-warning">{t("testnetGuard.warning")}</div>;
}
