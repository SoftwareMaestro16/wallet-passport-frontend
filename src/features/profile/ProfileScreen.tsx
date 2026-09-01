import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Section, Cell, Avatar, Badge, Switch, SegmentedControl, IconButton, Button, Spinner } from "@telegram-apps/telegram-ui";
import { Info, Link2 } from "lucide-react";
import { useVerifiedProfile } from "../../ton/useVerifiedProfile";
import { useTonConnectAccount } from "../../ton/useTonConnectAccount";
import { TestnetGuard } from "../../shared/TestnetGuard";
import { getTelegramUserData, hapticImpact, hapticSelection, shareReferralViaInlineMode } from "../../app/telegram";
import { setLanguage } from "../../app/i18n";
import { buildReferralLink, getSavedReferralCode } from "../../shared/referral";
import { useReferralMe } from "./useReferralMe";
import { formatNumber } from "./formatters";

const PROFILE_THEME_STORAGE_KEY = "wallet-passport-profile-theme";

type ProfileTheme = "light" | "dark";

function getInitialProfileTheme(): ProfileTheme {
  try {
    const stored = localStorage.getItem(PROFILE_THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;

    const appRootTheme = document.querySelector<HTMLElement>(".app-root")?.dataset.scheme;
    if (appRootTheme === "dark" || appRootTheme === "light") return appRootTheme;

    const app = (window as any).Telegram?.WebApp;
    const hex = app?.themeParams?.bg_color;
    if (hex && hex.length >= 7) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5 ? "dark" : "light";
    }

    return app?.colorScheme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyProfileTheme(theme: ProfileTheme): void {
  try {
    localStorage.setItem(PROFILE_THEME_STORAGE_KEY, theme);
  } catch {}

  document.documentElement.setAttribute("data-wp-theme", theme);
  const appRoot = document.querySelector<HTMLElement>(".app-root");
  appRoot?.setAttribute("data-wp-theme", theme);
  appRoot?.setAttribute("data-scheme", theme);
  window.dispatchEvent(new Event("wallet-passport-theme-change"));
}

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { isConnected, state } = useVerifiedProfile();
  const { address: walletAddress } = useTonConnectAccount();
  const lang = i18n.language;
  const currentLanguage = lang === "ru" ? "ru" : "en";
  const [theme, setTheme] = useState<ProfileTheme>(getInitialProfileTheme);
  const telegramUser = getTelegramUserData();

  const referralMe = useReferralMe(state.status === "success", walletAddress || null);

  const referralCode =
    referralMe.state.status === "ready" ? referralMe.state.data.referral.code : getSavedReferralCode();
  const referralLink =
    referralMe.state.status === "ready" ? referralMe.state.data.referral.link : buildReferralLink(referralCode);
  const referralStats = referralMe.state.status === "ready" ? referralMe.state.data.stats : null;
  const [referralInfoOpen, setReferralInfoOpen] = useState(false);

  useEffect(() => {
    applyProfileTheme(theme);
  }, [theme]);

  function handleCopyReferral() {
    hapticSelection();
    void navigator.clipboard?.writeText(referralLink);
  }

  function handleShareReferral() {
    hapticImpact("light");
    if (!referralCode || shareReferralViaInlineMode(referralCode)) return;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}`, "_blank", "noopener,noreferrer");
  }

  const userInfo = referralMe.state.status === "ready" ? referralMe.state.data.user : null;

  const headerUser = userInfo ?? (telegramUser
    ? {
        photoUrl: telegramUser.photoUrl ?? null,
        firstName: telegramUser.firstName ?? null,
        lastName: telegramUser.lastName ?? null,
        username: telegramUser.username ?? null,
        languageCode: telegramUser.languageCode ?? null,
        isPremium: telegramUser.isPremium ?? false,
      }
    : null);

  return (
    <div className="screen profile-screen">
      <Section header={t("profile.title")}>
        {headerUser && (
          <div className="profile-header-card">
            <Avatar
              size={48}
              src={headerUser.photoUrl ?? undefined}
              acronym={userAcronym(headerUser.firstName, headerUser.username)}
            />
            <div className="profile-header-copy">
              <span className="profile-header-name">
                {displayUserName(headerUser.firstName, headerUser.lastName, headerUser.username)}
              </span>
              <span className="profile-header-subtitle">
                {userSubtitle(headerUser.username, headerUser.languageCode, t)}
              </span>
            </div>
            {headerUser.isPremium && (
              <Badge type="number" className="profile-header-badge">
                Premium
              </Badge>
            )}
          </div>
        )}
      </Section>

      <Section header={t("profile.settings.title")}>
        <Cell
          after={
            <SegmentedControl className="profile-language-segmented" aria-label={t("profile.settings.language")}>
              <SegmentedControl.Item
                selected={currentLanguage === "ru"}
                onClick={() => {
                  if (currentLanguage === "ru") return;
                  hapticSelection();
                  setLanguage("ru");
                }}
              >
                {t("profile.settings.languageRu")}
              </SegmentedControl.Item>
              <SegmentedControl.Item
                selected={currentLanguage === "en"}
                onClick={() => {
                  if (currentLanguage === "en") return;
                  hapticSelection();
                  setLanguage("en");
                }}
              >
                {t("profile.settings.languageEn")}
              </SegmentedControl.Item>
            </SegmentedControl>
          }
        >
          {t("profile.settings.language")}
        </Cell>
        <Cell
          subtitle={theme === "dark" ? t("profile.settings.themeDark") : t("profile.settings.themeLight")}
          after={
            <Switch
              checked={theme === "dark"}
              onChange={(event) => {
                hapticSelection();
                setTheme(event.currentTarget.checked ? "dark" : "light");
              }}
              aria-label={t("profile.settings.theme")}
            />
          }
        >
          {t("profile.settings.theme")}
        </Cell>
      </Section>

      {isConnected && <TestnetGuard />}

      <ReferralBlock
        isConnected={isConnected}
        referralCode={referralCode}
        referralLink={referralLink}
        referralStats={referralStats}
        referralInfoOpen={referralInfoOpen}
        setReferralInfoOpen={setReferralInfoOpen}
        onCopy={handleCopyReferral}
        onShare={handleShareReferral}
        lang={lang}
        t={t}
      />

      {state.status === "verifying" && (
        <Section>
          <Cell multiline before={<Spinner size="s" />}>
            {t("profile.verifying")}
          </Cell>
        </Section>
      )}
    </div>
  );
}

function ReferralBlock({
  isConnected,
  referralCode,
  referralLink,
  referralStats,
  referralInfoOpen,
  setReferralInfoOpen,
  onCopy,
  onShare,
  lang,
  t,
}: {
  isConnected: boolean;
  referralCode: string | null;
  referralLink: string;
  referralStats: { invited: number; walletConnected: number; scanned: number } | null;
  referralInfoOpen: boolean;
  setReferralInfoOpen: (open: boolean) => void;
  onCopy: () => void;
  onShare: () => void;
  lang: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <>
      <Section
        header={
          <Section.Header>
            <span className="referral-section-header">
              <span>{t("referral.title")}</span>
            {isConnected && (
              <IconButton
                size="s"
                mode="plain"
                className="referral-info-button"
                onClick={() => {
                  hapticSelection();
                  setReferralInfoOpen(true);
                }}
                aria-label={t("referral.info.open")}
              >
                <Info size={20} strokeWidth={2} />
              </IconButton>
            )}
            </span>
          </Section.Header>
        }
        footer={isConnected && t("referral.footer") ? t("referral.footer") : undefined}
      >
        {!isConnected ? (
          <Cell multiline>{t("referral.connectToGet")}</Cell>
        ) : (
          <div className="referral-body">
            <div className="referral-link-row">
              <Link2 size={18} strokeWidth={2} aria-hidden="true" />
              <span className="mono referral-link">{referralLink}</span>
            </div>
            <div className="referral-actions">
              <Button size="s" mode="outline" disabled={!referralCode} onClick={onCopy} stretched>
                {t("referral.copy")}
              </Button>
              <Button size="s" disabled={!referralCode} onClick={onShare} stretched>
                {t("referral.shareInline")}
              </Button>
            </div>
            {referralStats && (
              <div className="referral-stats-grid">
                <div>
                  <strong>{formatNumber(referralStats.invited, lang)}</strong>
                  <span>{t("referral.stats.invited")}</span>
                </div>
                <div>
                  <strong>{formatNumber(referralStats.walletConnected, lang)}</strong>
                  <span>{t("referral.stats.walletConnected")}</span>
                </div>
                <div>
                  <strong>{formatNumber(referralStats.scanned, lang)}</strong>
                  <span>{t("referral.stats.scanned")}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {referralInfoOpen && (
        <div className="referral-modal-backdrop" role="presentation" onClick={() => setReferralInfoOpen(false)}>
          <div
            className="referral-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="referral-info-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="referral-modal-icon">
              <Info size={28} strokeWidth={2} />
            </div>
            <h2 id="referral-info-title">{t("referral.info.title")}</h2>
            <p>{t("referral.info.body")}</p>
            <div className="referral-credit-list">
              <div>
                <strong>{t("referral.info.inviter.title")}</strong>
                <span>{t("referral.info.inviter.body")}</span>
              </div>
              <div>
                <strong>{t("referral.info.invited.title")}</strong>
                <span>{t("referral.info.invited.body")}</span>
              </div>
              <div>
                <strong>{t("referral.info.scanned.title")}</strong>
                <span>{t("referral.info.scanned.body")}</span>
              </div>
            </div>
            <p className="referral-modal-note">{t("referral.info.reputationNote")}</p>
            <div className="referral-modal-actions">
              <Button mode="outline" size="s" stretched disabled={!referralCode} onClick={onCopy}>
                {t("referral.copy")}
              </Button>
              <Button size="s" stretched disabled={!referralCode} onClick={onShare}>
                {t("referral.shareInline")}
              </Button>
            </div>
            <Button
              mode="plain"
              size="s"
              stretched
              onClick={() => {
                hapticSelection();
                setReferralInfoOpen(false);
              }}
            >
              {t("referral.info.close")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function displayUserName(firstName: string | null, lastName: string | null, username: string | null): string {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || (username ? `@${username}` : "Telegram user");
}

function userAcronym(firstName: string | null, username: string | null): string {
  return (firstName || username || "WP").slice(0, 2).toUpperCase();
}

function userSubtitle(
  username: string | null,
  languageCode: string | null,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const lang = languageCode === "ru" ? t("profile.telegramLanguage.ru") : t("profile.telegramLanguage.en");
  return username ? `@${username} · ${lang}` : lang;
}
