import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppRoot, Button, Tabbar } from "@telegram-apps/telegram-ui";
import { TonConnectProvider } from "./ton/TonConnectProvider";
import { LanguageSwitcher } from "./shared/LanguageSwitcher";
import { WalletIcon, ProfileIcon, MintIcon } from "./shared/icons";
import { ConnectScreen } from "./features/connect/ConnectScreen";
import { ScanningScreen } from "./features/scanning/ScanningScreen";
import { ProfileScreen } from "./features/profile/ProfileScreen";
import { MintScreen } from "./features/mint/MintScreen";
import { useTelegramAppearance } from "./app/telegram";
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

function AppShell() {
  const { pathname } = useLocation();
  // Scanning is a focused, transient step (per TON_Relics spec §23) — hiding the tab bar there
  // keeps the user from bailing into Mint/Profile mid-scan instead of watching it finish.
  const showNav = pathname !== "/scanning";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-brand-mark">WP</span>
          <span>Wallet Passport</span>
        </div>
        {showNav && <Nav />}
        <LanguageSwitcher />
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

  return (
    <AppRoot platform={platform} appearance={appearance} data-scheme={appearance} className="app-root">
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
    </AppRoot>
  );
}
