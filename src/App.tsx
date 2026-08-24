import { HashRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TonConnectProvider } from "./ton/TonConnectProvider";
import { LanguageSwitcher } from "./shared/LanguageSwitcher";
import { ConnectScreen } from "./features/connect/ConnectScreen";
import { ProfileScreen } from "./features/profile/ProfileScreen";
import { MintScreen } from "./features/mint/MintScreen";
import "./App.css";

function Nav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const items = [
    { to: "/", label: t("nav.connect") },
    { to: "/profile", label: t("nav.profile") },
    { to: "/mint", label: t("nav.mint") },
  ];

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <Link key={item.to} to={item.to} className={pathname === item.to ? "nav-item active" : "nav-item"}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <LanguageSwitcher />
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<ConnectScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/mint" element={<MintScreen />} />
        </Routes>
      </main>

      <Nav />
    </div>
  );
}

export default function App() {
  return (
    <TonConnectProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
    </TonConnectProvider>
  );
}
