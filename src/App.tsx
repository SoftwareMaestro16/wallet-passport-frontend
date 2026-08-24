import { HashRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppRoot, Tabbar } from "@telegram-apps/telegram-ui";
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
    { to: "/", label: t("nav.connect"), icon: WalletIcon },
    { to: "/profile", label: t("nav.profile"), icon: ProfileIcon },
    { to: "/mint", label: t("nav.mint"), icon: MintIcon },
  ];

  return (
    <Tabbar className="app-tabbar">
      {items.map(({ to, label, icon: Icon }) => (
        <Tabbar.Item key={to} text={label} selected={pathname === to} onClick={() => navigate(to)}>
          <Icon />
        </Tabbar.Item>
      ))}
    </Tabbar>
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
        <LanguageSwitcher />
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<ConnectScreen />} />
          <Route path="/scanning" element={<ScanningScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/mint" element={<MintScreen />} />
        </Routes>
      </main>

      {showNav && <Nav />}
    </div>
  );
}

export default function App() {
  const { platform, appearance } = useTelegramAppearance();

  return (
    <AppRoot platform={platform} appearance={appearance} data-scheme={appearance} className="app-root">
      <TonConnectProvider>
        <HashRouter>
          <AppShell />
        </HashRouter>
      </TonConnectProvider>
    </AppRoot>
  );
}
