import type { ReactNode } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { THEME } from "@tonconnect/ui";
import type { PartialColorsSet } from "@tonconnect/ui";

/**
 * Brand colours for TonConnect's own UI (the header "Connect Wallet" button + wallet modal), kept
 * in sync with the app's design tokens in src/App.css — see design-system/wallet-passport/MASTER.md.
 * Only the keys we override are listed; TonConnect merges the rest from its built-in theme.
 */
export const tonConnectColorsSet: Partial<Record<THEME, PartialColorsSet>> = {
  [THEME.DARK]: {
    connectButton: { background: "#f59e0b", foreground: "#0f172a" },
    accent: "#fbbf24",
    background: { primary: "#222735", secondary: "#272f42", segment: "#272f42", tint: "#334155", qr: "#f8fafc" },
    text: { primary: "#f8fafc", secondary: "#94a3b8" },
  },
  [THEME.LIGHT]: {
    connectButton: { background: "#f59e0b", foreground: "#0f172a" },
    accent: "#b45309",
    background: { primary: "#ffffff", secondary: "#f1f5f9", segment: "#f1f5f9", tint: "#e2e8f0", qr: "#ffffff" },
    text: { primary: "#0f172a", secondary: "#475569" },
  },
};

const MANIFEST_URL = `${window.location.origin}/tonconnect-manifest.json`;

// Must match the exact Mini App URL (bot username + short name) so mobile Tonkeeper can
// return the user here after signing. Using the generic `https://t.me` (previous default)
// dropped the user onto Telegram's main screen with no way back to the app, which looked
// like "connect didn't work" — the connection actually succeeded but the return step failed.
const TMA_RETURN_URL = "https://t.me/WalletPassportXBot/scan" as `https://${string}`;

export function TonConnectProvider({ children, theme }: { children: ReactNode; theme: "light" | "dark" }) {
  return (
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      uiPreferences={{ theme: theme === "dark" ? THEME.DARK : THEME.LIGHT, colorsSet: tonConnectColorsSet }}
      actionsConfiguration={{
        twaReturnUrl: TMA_RETURN_URL,
        returnStrategy: "back",
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
}
