import { useTranslation } from "react-i18next";
import { useTonConnectAccount } from "../ton/useTonConnectAccount";

/**
 * Shows a warning banner when the connected wallet is reporting mainnet instead of testnet.
 * See the long comment in src/ton/TonConnectProvider.tsx for why this check exists client-side
 * and why it is a UX nicety, not a security boundary (the backend must re-check independently).
 */
export function TestnetGuard() {
  const { i18n } = useTranslation();
  const { isConnected, isTestnet } = useTonConnectAccount();

  if (!isConnected || isTestnet) return null;

  const isRu = i18n.language === "ru";
  return (
    <div className="testnet-warning">
      {isRu
        ? "Кошелёк подключён к mainnet. Переключите кошелёк в тестовую сеть (testnet), чтобы пользоваться Wallet Passport (testnet MVP)."
        : "Wallet is connected to mainnet. Switch your wallet to testnet to use Wallet Passport (testnet MVP)."}
    </div>
  );
}
