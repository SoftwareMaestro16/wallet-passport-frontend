import { useCallback, useEffect, useState } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppRoot, Button, Tabbar } from "@telegram-apps/telegram-ui";
import { TonConnectProvider } from "./ton/TonConnectProvider";
import { WalletIcon, ProfileIcon, MintIcon } from "./shared/icons";
import { ConnectScreen } from "./features/connect/ConnectScreen";
import { ScanningScreen } from "./features/scanning/ScanningScreen";
import { ProfileScreen } from "./features/profile/ProfileScreen";
import { MintScreen } from "./features/mint/MintScreen";
import { hapticImpact, isTelegramMiniApp, useTelegramAppearance, useTelegramMainButton } from "./app/telegram";
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
    { to: "/", label: t("nav.scan"), icon: WalletIcon },
    { to: "/profile", label: t("nav.profile"), icon: ProfileIcon },
    { to: "/mint", label: t("nav.mint"), icon: MintIcon },
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

function shortHeaderAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
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

function AppShell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { address, isConnected, tonConnectUI } = useTonConnectAccount();
  const { state } = useVerifiedProfile();
  const headerTitle = t("connect.title").replace(/^Wallet\s+/u, "");
  // Scanning is a focused, transient step (per TON_Relics spec §23) — hiding the tab bar there
  // keeps the user from bailing into Mint/Profile mid-scan instead of watching it finish.
  const showNav = pathname !== "/scanning";
  const scanInProgress = pathname === "/scanning";
  const canScan = isConnected && state.status === "success";

  const handleMainButtonClick = useCallback(() => {
    if (!canScan || scanInProgress) return;
    hapticImpact("medium");
    navigate("/scanning");
  }, [canScan, navigate, scanInProgress]);

  const handleWalletClick = useCallback(() => {
    hapticImpact("light");
    if (isConnected) {
      void tonConnectUI.disconnect();
      return;
    }

    void tonConnectUI.openModal();
  }, [isConnected, tonConnectUI]);

  useTelegramMainButton({
    text: scanInProgress ? t("mainButton.scanning") : t("mainButton.scan"),
    visible: canScan || scanInProgress,
    loading: scanInProgress,
    disabled: !canScan || scanInProgress,
    onClick: handleMainButtonClick,
  });

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-main">
          <div className="app-brand" aria-label={t("connect.title")}>
            <span>{headerTitle}</span>
          </div>
          <button
            type="button"
            className="app-tonconnect-button"
            onClick={handleWalletClick}
            aria-label={isConnected ? t("profile.disconnect") : t("connect.connectButton")}
            title={isConnected ? t("profile.disconnect") : t("connect.connectButton")}
          >
            <span className="app-tonconnect-icon" aria-hidden="true">
              TON
            </span>
            <span className="app-tonconnect-label">
              {isConnected ? shortHeaderAddress(address) : t("connect.connectButton")}
            </span>
          </button>
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
  const isTelegram = isTelegramMiniApp();
  const [theme, setTheme] = useState<AppTheme>(() => readStoredTheme(appearance));

  useEffect(() => {
    const handleThemeChange = () => setTheme(readStoredTheme(appearance));
    window.addEventListener("wallet-passport-theme-change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);
    return () => {
      window.removeEventListener("wallet-passport-theme-change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, [appearance]);

  return (
    <AppRoot
      platform={platform}
      appearance={theme}
      data-scheme={theme}
      data-wp-theme={theme}
      className="app-root"
    >
      {!isTelegram ? (
        <TelegramOnlyGate />
      ) : (
        <TonConnectProvider>
          {/*
            Telegram Desktop delivers launch params (initData, platform, theme) as a URL hash
            fragment (`#tgWebAppData=...&tgWebAppPlatform=tdesktop&...`) -- @twa-dev/sdk reads this
            exactly once, synchronously, at module-evaluation time, and never re-reads it. A
            HashRouter here fights over the same `location.hash` for its own routing and can mangle
            it before/after that one read, which is exactly what caused every request to see a
            permanently empty initData in production regardless of retries. This app never needs
            shareable/bookmarkable sub-URLs, so MemoryRouter (no window.location interaction at all)
            removes the conflict entirely rather than trying to sequence around it.
          */}
          <MemoryRouter>
            <AppShell />
          </MemoryRouter>
        </TonConnectProvider>
      )}
    </AppRoot>
  );
}
