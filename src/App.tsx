import { useCallback, useEffect, useState } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppRoot, Button, Tabbar } from "@telegram-apps/telegram-ui";
import { Gem, ScanLine, UserRound } from "lucide-react";
import { TonConnectButton, useTonConnectUI } from "@tonconnect/ui-react";
import { THEME } from "@tonconnect/ui";
import { TonConnectProvider } from "./ton/TonConnectProvider";
import { ConnectScreen } from "./features/connect/ConnectScreen";
import { ScanningScreen } from "./features/scanning/ScanningScreen";
import { ProfileScreen } from "./features/profile/ProfileScreen";
import { MintScreen } from "./features/mint/MintScreen";
import {
  hapticImpact,
  isTelegramMiniApp,
  syncTelegramChrome,
  useTelegramAppearance,
  useTelegramMainButton,
} from "./app/telegram";
import { useTonConnectAccount } from "./ton/useTonConnectAccount";
import { useVerifiedProfile } from "./ton/useVerifiedProfile";
import { TelegramOnlyGate } from "./shared/TelegramOnlyGate";
import "@telegram-apps/telegram-ui/dist/styles.css";
import "./App.css";

function Nav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const items = [
    { to: "/", label: t("nav.scan"), icon: ScanLine },
    { to: "/mint", label: t("nav.mint"), icon: Gem },
    { to: "/profile", label: t("nav.profile"), icon: UserRound },
  ];

  return (
    <>
      <nav className="app-topnav" aria-label={t("nav.menu")}>
        {items.map(({ to, label, icon: Icon }) => (
          <Button
            key={to}
            size="s"
            mode={pathname === to ? "filled" : "plain"}
            onClick={() => navigate(to)}
          >
            <span className="app-topnav-item">
              <Icon size={18} />
              {label}
            </span>
          </Button>
        ))}
      </nav>
      <Tabbar className="app-tabbar">
        {items.map(({ to, label, icon: Icon }) => (
          <Tabbar.Item key={to} text={label} selected={pathname === to} onClick={() => navigate(to)}>
            <Icon />
          </Tabbar.Item>
        ))}
      </Tabbar>
    </>
  );
}

const PROFILE_THEME_STORAGE_KEY = "wallet-passport-profile-theme";

type AppTheme = "light" | "dark";

function readStoredTheme(fallback: AppTheme): AppTheme {
  try {
    const stored = localStorage.getItem(PROFILE_THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : fallback;
  } catch {
    return fallback;
  }
}

function TonConnectThemeSync({ theme }: { theme: AppTheme }) {
  const [, setOptions] = useTonConnectUI();
  useEffect(() => {
    // `setOptions` replaces `actionsConfiguration` wholesale (it's a direct field assignment
    // in the SDK, not a merge) — omitting it here would silently drop `twaReturnUrl` on every
    // theme change after the initial `TonConnectUIProvider` mount.
    setOptions({
      uiPreferences: { theme: theme === "dark" ? THEME.DARK : THEME.LIGHT },
      actionsConfiguration: { twaReturnUrl: "https://t.me" },
    });
  }, [theme, setOptions]);
  return null;
}

function AppShell({ theme }: { theme: AppTheme }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isConnected } = useTonConnectAccount();
  const { state } = useVerifiedProfile();
  const headerTitle = t("connect.title").replace(/^Wallet\s+/u, "");
  const showNav = pathname !== "/scanning";
  const scanInProgress = pathname === "/scanning";
  const canScan = isConnected && state.status === "success";

  const handleMainButtonClick = useCallback(() => {
    if (!canScan || scanInProgress) return;
    hapticImpact("medium");
    navigate("/scanning");
  }, [canScan, navigate, scanInProgress]);

  useTelegramMainButton({
    text: scanInProgress ? t("mainButton.scanning") : t("mainButton.scan"),
    visible: canScan || scanInProgress,
    loading: scanInProgress,
    disabled: !canScan || scanInProgress,
    onClick: handleMainButtonClick,
  });

  return (
    <div className="app-shell">
      <TonConnectThemeSync theme={theme} />
      <header className="app-header">
        <div className="app-header-main">
          <div className="app-brand" aria-label={t("connect.title")}>
            <span>{headerTitle}</span>
          </div>
          <TonConnectButton />
        </div>
        {showNav && <Nav />}
      </header>

      <main id="scroll-area" className="app-main">
        <div className="content-col">
          <Routes>
            <Route path="/" element={<ConnectScreen />} />
            <Route path="/scanning" element={<ScanningScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/mint" element={<MintScreen />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { platform, appearance } = useTelegramAppearance();
  // Computed once at mount, not on every render: some Telegram clients clear the
  // `tgWebAppData` URL hash shortly after launch (once they've read it), and
  // `@twa-dev/sdk`'s `WebApp.initData` can still be empty at that point (see
  // getTelegramInitData's doc comment). Re-deriving this on every render made the whole
  // app shell — including the header and its TonConnect button — flip to
  // TelegramOnlyGate a moment after mount, once the hash was gone and the SDK's own
  // initData hadn't caught up yet.
  const [isTelegram] = useState(isTelegramMiniApp);
  const allowBrowserPreview = import.meta.env.DEV;
  const [theme, setTheme] = useState<AppTheme>(() => readStoredTheme(!isTelegram && allowBrowserPreview ? "dark" : appearance));

  useEffect(() => {
    const handleThemeChange = () => setTheme(readStoredTheme(appearance));
    window.addEventListener("wallet-passport-theme-change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);
    return () => {
      window.removeEventListener("wallet-passport-theme-change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, [appearance]);

  useEffect(() => {
    syncTelegramChrome(theme);
  }, [theme]);

  return (
    <AppRoot
      platform={platform}
      appearance={theme}
      data-scheme={theme}
      data-wp-theme={theme}
      className="app-root"
    >
      {!isTelegram && !allowBrowserPreview ? (
        <TelegramOnlyGate />
      ) : (
        <TonConnectProvider theme={theme}>
          <MemoryRouter>
            <AppShell theme={theme} />
          </MemoryRouter>
        </TonConnectProvider>
      )}
    </AppRoot>
  );
}
