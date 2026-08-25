import type { ReactNode } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { THEME } from "@tonconnect/ui";

const MANIFEST_URL = `${window.location.origin}/tonconnect-manifest.json`;

export function TonConnectProvider({ children, theme }: { children: ReactNode; theme: "light" | "dark" }) {
  return (
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      uiPreferences={{ theme: theme === "dark" ? THEME.DARK : THEME.LIGHT }}
      actionsConfiguration={{
        twaReturnUrl: "https://t.me",
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
}
