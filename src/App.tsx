import { useCallback, useEffect, useRef, useState } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppRoot, Button, Tabbar } from "@telegram-apps/telegram-ui";
import { Copy, Gem, ScanLine, UserRound, Wallet } from "lucide-react";
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
import { useTonBalance } from "./ton/useTonBalance";
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

function shortHeaderAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
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
  const { balanceTon, isLoading: balanceLoading } = useTonBalance(isConnected ? address : null);
  const { state } = useVerifiedProfile();
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const walletSheetRef = useRef<HTMLDivElement | null>(null);
  const walletButtonRef = useRef<HTMLButtonElement | null>(null);
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
      setWalletSheetOpen((open) => !open);
      return;
    }

    void tonConnectUI.openModal();
  }, [isConnected, tonConnectUI]);

  const handleWalletCopy = useCallback(async () => {
    if (!address) return;
    try {
      await copyText(address);
      hapticImpact("light");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      hapticImpact("rigid");
    }
  }, [address]);

  const handleWalletDisconnect = useCallback(() => {
    hapticImpact("medium");
    setWalletSheetOpen(false);
    void tonConnectUI.disconnect();
  }, [tonConnectUI]);

  useEffect(() => {
    if (!isConnected) {
      setWalletSheetOpen(false);
      setCopied(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!walletSheetOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (walletSheetRef.current?.contains(target) || walletButtonRef.current?.contains(target)) return;
      setWalletSheetOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWalletSheetOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [walletSheetOpen]);

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
            ref={walletButtonRef}
            type="button"
            className="app-tonconnect-button"
            onClick={handleWalletClick}
            aria-expanded={isConnected ? walletSheetOpen : undefined}
            aria-haspopup={isConnected ? "dialog" : undefined}
            aria-label={isConnected ? t("wallet.open") : t("connect.connectButton")}
            title={isConnected ? t("wallet.open") : t("connect.connectButton")}
          >
            <span className="app-tonconnect-icon" aria-hidden="true">
              <Wallet size={19} strokeWidth={2.1} />
            </span>
            <span className="app-tonconnect-label">
              {isConnected ? shortHeaderAddress(address) : t("wallet.connectShort")}
            </span>
          </button>
          {isConnected && walletSheetOpen && (
            <div className="wallet-sheet-backdrop" aria-hidden="true" />
          )}
          {isConnected && walletSheetOpen && (
            <div
              ref={walletSheetRef}
              className="wallet-sheet"
              role="dialog"
              aria-modal="false"
              aria-label={t("wallet.sheetTitle")}
            >
              <div className="wallet-sheet-handle" aria-hidden="true" />
              <div className="wallet-sheet-head">
                <span className="wallet-sheet-icon" aria-hidden="true">
                  <Wallet size={21} strokeWidth={2.1} />
                </span>
                <div className="wallet-sheet-title">
                  <strong>{t("wallet.sheetTitle")}</strong>
                  <span>{shortHeaderAddress(address)}</span>
                </div>
              </div>
              <div className="wallet-sheet-info">
                <div>
                  <span>{t("wallet.balance")}</span>
                  <strong>{balanceLoading ? t("common.loading") : (balanceTon ?? t("wallet.balanceUnavailable"))}</strong>
                </div>
                <div>
                  <span>{t("wallet.address")}</span>
                  <strong className="mono">{address}</strong>
                </div>
              </div>
              <div className="wallet-sheet-actions">
                <button
                  type="button"
                  className="wallet-copy-button"
                  onClick={handleWalletCopy}
                  aria-label={copied ? t("wallet.copied") : t("wallet.copy")}
                  title={copied ? t("wallet.copied") : t("wallet.copy")}
                >
                  <Copy size={20} strokeWidth={2.1} />
                </button>
                <button type="button" className="wallet-disconnect-button" onClick={handleWalletDisconnect}>
                  {t("profile.disconnect")}
                </button>
              </div>
            </div>
          )}
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
