import type { ReactNode } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { THEME } from "@tonconnect/ui";

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
      uiPreferences={{ theme: theme === "dark" ? THEME.DARK : THEME.LIGHT }}
      actionsConfiguration={{
        twaReturnUrl: TMA_RETURN_URL,
        returnStrategy: "back",
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
}
