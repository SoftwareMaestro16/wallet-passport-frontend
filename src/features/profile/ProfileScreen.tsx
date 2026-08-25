import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Section, Cell, Avatar, Spinner, Button, Badge, Switch, IconButton } from "@telegram-apps/telegram-ui";
import { Info } from "lucide-react";
import { useTonConnectAccount } from "../../ton/useTonConnectAccount";
import { useVerifiedProfile } from "../../ton/useVerifiedProfile";
import { TestnetGuard } from "../../shared/TestnetGuard";
import { getTelegramUserData, hapticImpact, hapticSelection, shareReferralViaInlineMode } from "../../app/telegram";
import { setLanguage } from "../../app/i18n";
import { buildReferralLink, getSavedReferralCode } from "../../shared/referral";
import { useWalletProfile } from "./useWalletProfile";
import { useWalletPassports } from "./useWalletPassports";
import { useReferralMe } from "./useReferralMe";
import type {
  PassportCategoryName,
  ScoreFactorCode,
  WalletPassportCategoryStatus,
  WalletProfileResponse,
} from "../../api/client";

const CATEGORY_LABEL_KEYS: Record<PassportCategoryName, string> = {
  passport: "profile.categories.main",
  pioneer: "profile.categories.pioneer",
  operator: "profile.categories.operator",
  defi: "profile.categories.defi",
  collector: "profile.categories.collector",
  staker: "profile.categories.staker",
  builder: "profile.categories.builder",
};

const PROFILE_THEME_STORAGE_KEY = "wallet-passport-profile-theme";

type ProfileTheme = "light" | "dark";

function localeFor(lang: string): string {
  return lang.startsWith("ru") ? "ru-RU" : "en-US";
}

function formatNumber(n: number, lang: string): string {
  return n.toLocaleString(localeFor(lang));
}

function formatTon(nanoTon: string, lang: string): string {
  // Safe as Number here (mirrors server/src/domain/metrics/score.ts's factorE_economic comment):
  // human-scale TON amounts, nowhere near Number's precision ceiling.
  const ton = Number(BigInt(nanoTon)) / 1_000_000_000;
  return ton.toLocaleString(localeFor(lang), { maximumFractionDigits: 2 });
}

function formatDate(iso: string | null, lang: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(localeFor(lang), { year: "numeric", month: "short", day: "numeric" });
}

function factorValue(stats: WalletProfileResponse["score"], code: ScoreFactorCode): number {
  return stats.factors.find((f) => f.code === code)?.value ?? 0;
}

function factorLabelKey(code: ScoreFactorCode): string {
  return `profile.factors.${code}`;
}

function factorTone(code: ScoreFactorCode): string {
  if (code === "A" || code === "C") return "steady";
  if (code === "E" || code === "O") return "flow";
  if (code === "D" || code === "N") return "explore";
  return "craft";
}

function dominantSummaryKey(code: ScoreFactorCode | undefined): string {
  if (code === "A" || code === "C") return "profile.result.summary.steady";
  if (code === "E" || code === "O") return "profile.result.summary.flow";
  if (code === "D" || code === "N") return "profile.result.summary.explore";
  if (code === "S" || code === "B") return "profile.result.summary.craft";
  return "profile.result.summary.balanced";
}

function StatCell({ label, value }: { label: string; value: ReactNode }) {
  return <Cell subtitle={label}>{value}</Cell>;
}

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
  const { address } = useTonConnectAccount();
  const { isConnected, state } = useVerifiedProfile();
  const lang = i18n.language;
  const currentLanguage = lang === "ru" ? "ru" : "en";
  const [theme, setTheme] = useState<ProfileTheme>(getInitialProfileTheme);
  const telegramUser = getTelegramUserData();

  const walletProfile = useWalletProfile(state.status === "success" ? address : undefined);
  const walletPassports = useWalletPassports(state.status === "success" ? address : undefined);
  const referralMe = useReferralMe(state.status === "success");

  const referralCode =
    referralMe.state.status === "ready" ? referralMe.state.data.referral.code : getSavedReferralCode();
  const referralLink =
    referralMe.state.status === "ready" ? referralMe.state.data.referral.link : buildReferralLink(referralCode);
  const referralStats = referralMe.state.status === "ready" ? referralMe.state.data.stats : null;
  const [referralInfoOpen, setReferralInfoOpen] = useState(false);

  const navigate = useNavigate();

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

  return (
    <div className="screen profile-screen">
      <Section header={t("profile.title")}>
        {userInfo ? (
          <Cell
            before={
              <Avatar
                size={40}
                src={userInfo.photoUrl ?? undefined}
                acronym={userAcronym(userInfo.firstName, userInfo.username)}
              />
            }
            subtitle={userSubtitle(userInfo.username, userInfo.languageCode, t)}
            after={userInfo.isPremium ? <Badge type="number">Premium</Badge> : undefined}
          >
            {displayUserName(userInfo.firstName, userInfo.lastName, userInfo.username)}
          </Cell>
        ) : telegramUser ? (
          <Cell
            before={
              <Avatar
                size={40}
                src={telegramUser.photoUrl}
                acronym={userAcronym(telegramUser.firstName ?? null, telegramUser.username ?? null)}
              />
            }
            subtitle={userSubtitle(telegramUser.username ?? null, telegramUser.languageCode ?? null, t)}
            after={telegramUser.isPremium ? <Badge type="number">Premium</Badge> : undefined}
          >
            {displayUserName(telegramUser.firstName ?? null, telegramUser.lastName ?? null, telegramUser.username ?? null)}
          </Cell>
        ) : null}
      </Section>

      <Section header={t("profile.settings.title")}>
        <Cell
          subtitle={currentLanguage === "ru" ? t("profile.settings.languageRu") : t("profile.settings.languageEn")}
          after={
            <Switch
              checked={currentLanguage === "ru"}
              onChange={(event) => {
                hapticSelection();
                setLanguage(event.currentTarget.checked ? "ru" : "en");
              }}
              aria-label={t("profile.settings.language")}
            />
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
          <Cell before={<Spinner size="s" />}>{t("profile.verifying")}</Cell>
        </Section>
      )}

      {state.status === "success" && walletProfile.state.status === "loading" && (
        <Section>
          <Cell before={<Spinner size="s" />}>{t("profile.loadingProfile")}</Cell>
        </Section>
      )}

      {state.status === "success" && walletProfile.state.status === "not-scanned" && (
        <Section footer={t("profile.notScanned.body")}>
          <Cell
            after={
              <Button
                size="s"
                mode="outline"
                onClick={() => {
                  hapticImpact("medium");
                  navigate("/scanning");
                }}
              >
                {t("profile.notScanned.cta")}
              </Button>
            }
          >
            {t("profile.notScanned.title")}
          </Cell>
        </Section>
      )}

      {state.status === "success" && walletProfile.state.status === "error" && (
        <Section footer={t("profile.profileError")}>
          <Cell
            after={
              <Button size="s" mode="outline" onClick={walletProfile.reload}>
                {t("profile.retry")}
              </Button>
            }
          >
            {t("common.error")}
          </Cell>
        </Section>
      )}

      {state.status === "success" && walletProfile.state.status === "ready" && (
        <ProfileResult
          data={walletProfile.state.data}
          passports={walletPassports}
          lang={lang}
          t={t}
          navigate={navigate}
        />
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
        }
        footer={isConnected ? t("referral.footer") : undefined}
      >
        {!isConnected ? (
          <Cell multiline>{t("referral.connectToGet")}</Cell>
        ) : (
          <div className="referral-body">
            <div className="referral-link-row">
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

function ProfileResult({
  data,
  passports,
  lang,
  t,
  navigate,
}: {
  data: WalletProfileResponse;
  passports: ReturnType<typeof useWalletPassports>;
  lang: string;
  t: ReturnType<typeof useTranslation>["t"];
  navigate: (path: string) => void;
}) {
  const { score, stats } = data;
  const topFactors = score.dominantFactors ?? [...score.factors].sort((a, b) => b.value - a.value).slice(0, 3);
  const firstTx = formatDate(stats.firstTxAt, lang);
  const passportsList = passports.state.status === "ready" ? passports.state.data.categories : null;
  const mainCategory = passportsList?.find((c) => c.category === "passport");

  return (
    <>
      <ProfileResultBlock data={data} topFactors={topFactors} lang={lang} t={t} />

      <Section header={t("profile.sections.overview.title")} footer={stats.totalTxCount === 0 ? t("profile.sections.overview.noHistory") : undefined}>
        {firstTx && <StatCell label={t("profile.sections.overview.firstTx")} value={firstTx} />}
        <StatCell
          label={t("profile.sections.overview.age")}
          value={t("profile.summary.walletAgeDays", { count: Math.round(stats.walletAgeDays) })}
        />
        <StatCell label={t("profile.sections.overview.totalTx")} value={formatNumber(stats.totalTxCount, lang)} />
        <StatCell
          label={t("profile.sections.overview.successfulTx")}
          value={formatNumber(stats.successfulTxCount, lang)}
        />
        <StatCell label={t("profile.sections.overview.fees")} value={`${formatTon(stats.feesPaidNanoTon, lang)} TON`} />
        <StatCell
          label={t("profile.sections.overview.counterparties")}
          value={formatNumber(stats.uniqueCounterpartyCount, lang)}
        />
      </Section>

      <Section header={t("profile.sections.activity.title")}>
        <StatCell label={t("profile.sections.activity.activeDays")} value={formatNumber(stats.activeDaysCount, lang)} />
        <StatCell
          label={t("profile.sections.activity.activeMonths")}
          value={formatNumber(stats.activeMonthsCount, lang)}
        />
        <StatCell
          label={t("profile.sections.activity.consistency")}
          value={Math.round(factorValue(score, "C"))}
        />
      </Section>

      <Section
        header={t("profile.sections.jettons.title")}
        footer={!stats.dataConfidence.jettonDataAvailable ? t("profile.sections.jettons.partialData") : undefined}
      >
        <StatCell label={t("profile.sections.jettons.transfers")} value={formatNumber(stats.jettonTransferCount, lang)} />
        <StatCell label={t("profile.sections.jettons.burns")} value={formatNumber(stats.jettonBurnCount, lang)} />
        <StatCell
          label={t("profile.sections.jettons.masters")}
          value={formatNumber(stats.uniqueJettonMasterCount, lang)}
        />
      </Section>

      <Section header={t("profile.sections.builder.title")}>
        <StatCell label={t("profile.sections.builder.deployments")} value={formatNumber(stats.deploymentCount, lang)} />
        <StatCell label={t("profile.sections.builder.score")} value={Math.round(factorValue(score, "B"))} />
      </Section>

      <Section header={t("profile.sections.comingSoon.badge")}>
        <Cell subtitle={t("profile.sections.comingSoon.defi.body")} after={<Badge type="number">{t("profile.sections.comingSoon.badge")}</Badge>}>
          {t("profile.sections.comingSoon.defi.title")}
        </Cell>
        <Cell subtitle={t("profile.sections.comingSoon.nfts.body")} after={<Badge type="number">{t("profile.sections.comingSoon.badge")}</Badge>}>
          {t("profile.sections.comingSoon.nfts.title")}
        </Cell>
        <Cell subtitle={t("profile.sections.comingSoon.telegramAssets.body")} after={<Badge type="number">{t("profile.sections.comingSoon.badge")}</Badge>}>
          {t("profile.sections.comingSoon.telegramAssets.title")}
        </Cell>
        <Cell subtitle={t("profile.sections.comingSoon.staking.body")} after={<Badge type="number">{t("profile.sections.comingSoon.badge")}</Badge>}>
          {t("profile.sections.comingSoon.staking.title")}
        </Cell>
        <Cell subtitle={t("profile.sections.comingSoon.history.body")} after={<Badge type="number">{t("profile.sections.comingSoon.badge")}</Badge>}>
          {t("profile.sections.comingSoon.history.title")}
        </Cell>
        <Cell subtitle={t("profile.sections.comingSoon.rareRelics.body")} after={<Badge type="number">{t("profile.sections.comingSoon.badge")}</Badge>}>
          {t("profile.sections.comingSoon.rareRelics.title")}
        </Cell>
      </Section>

      {passportsList && (
        <EligiblePassportsBlock categories={passportsList} t={t} navigate={navigate} />
      )}

      <Section header={t("profile.actions.title")}>
        <Cell
          after={
            <Button
              size="s"
              onClick={() => {
                hapticSelection();
                navigate("/mint");
              }}
            >
              {t("profile.actions.go")}
            </Button>
          }
          subtitle={mainCategory?.existsOnChain ? t("profile.sections.passports.minted", { revision: mainCategory.revision }) : undefined}
        >
          {t("profile.actions.mint")}
        </Cell>
      </Section>
    </>
  );
}

function ProfileResultBlock({
  data,
  topFactors,
  lang,
  t,
}: {
  data: WalletProfileResponse;
  topFactors: WalletProfileResponse["score"]["factors"];
  lang: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const { score, stats } = data;
  const dominant = topFactors[0];
  const secondary = topFactors[1];
  const summary = t(dominantSummaryKey(dominant?.code), {
    primary: dominant ? t(factorLabelKey(dominant.code)) : t("profile.result.factorFallback"),
    secondary: secondary ? t(factorLabelKey(secondary.code)) : t("profile.result.factorFallback"),
    score: score.tonScore,
  });

  return (
    <Section header={t("profile.result.title")} footer={t("profile.reveal.footer")}>
      <div className="profile-result-card">
        <div className="profile-result-score">
          <div className="profile-score-hex" aria-label={`${t("profile.scoreLabel")} ${score.tonScore}`}>
            <span>{score.tonScore}</span>
            <small>{t("profile.result.scoreMax")}</small>
          </div>
          <div className="profile-result-copy">
            <Badge type="number" mode="primary">
              {score.tier}
            </Badge>
            <h2>{t("profile.reveal.ready")}</h2>
            <p>{summary}</p>
          </div>
        </div>
        <FactorRadar factors={score.factors} topFactors={topFactors} t={t} />
        <div className="profile-result-metrics">
          <div>
            <strong>{t("profile.summary.walletAgeDays", { count: Math.round(stats.walletAgeDays) })}</strong>
            <span>{t("profile.summary.walletAge")}</span>
          </div>
          <div>
            <strong>{formatNumber(stats.totalTxCount, lang)}</strong>
            <span>{t("profile.summary.transactions")}</span>
          </div>
          <div>
            <strong>{formatTon(stats.economicVolumeNanoTon, lang)} TON</strong>
            <span>{t("profile.summary.economicVolume")}</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

function FactorRadar({
  factors,
  topFactors,
  t,
}: {
  factors: WalletProfileResponse["score"]["factors"];
  topFactors: WalletProfileResponse["score"]["factors"];
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const size = 184;
  const center = size / 2;
  const maxRadius = 64;
  const ordered = factors.length > 0 ? factors : topFactors;
  const topCodes = new Set(topFactors.map((factor) => factor.code));
  const points = ordered.map((factor, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / ordered.length;
    const valueRadius = (Math.max(0, Math.min(100, factor.value)) / 100) * maxRadius;
    const axisX = center + Math.cos(angle) * maxRadius;
    const axisY = center + Math.sin(angle) * maxRadius;
    const valueX = center + Math.cos(angle) * valueRadius;
    const valueY = center + Math.sin(angle) * valueRadius;
    const labelX = center + Math.cos(angle) * (maxRadius + 18);
    const labelY = center + Math.sin(angle) * (maxRadius + 18);
    return { factor, axisX, axisY, valueX, valueY, labelX, labelY };
  });
  const polygonPoints = points.map((point) => `${point.valueX},${point.valueY}`).join(" ");
  const gridScales = [0.33, 0.66, 1];
  const axisCount = Math.max(ordered.length, 3);

  return (
    <div className="factor-radar-wrap" aria-label={t("profile.result.radarLabel")}>
      <svg className="factor-radar" viewBox={`0 0 ${size} ${size}`} role="img">
        {gridScales.map((scale) => {
          const gridPoints = Array.from({ length: axisCount }, (_, index) => {
            const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axisCount;
            return `${center + Math.cos(angle) * maxRadius * scale},${center + Math.sin(angle) * maxRadius * scale}`;
          }).join(" ");
          return <polygon key={scale} points={gridPoints} className="factor-radar-grid" />;
        })}
        {points.map((point) => (
          <line
            key={point.factor.code}
            x1={center}
            y1={center}
            x2={point.axisX}
            y2={point.axisY}
            className="factor-radar-axis"
          />
        ))}
        <polygon points={polygonPoints} className="factor-radar-shape" />
        {points.map((point) => (
          <g key={point.factor.code}>
            <circle
              cx={point.valueX}
              cy={point.valueY}
              r={topCodes.has(point.factor.code) ? 4 : 3}
              className={`factor-radar-dot factor-radar-dot-${factorTone(point.factor.code)}`}
            />
            <text x={point.labelX} y={point.labelY} textAnchor="middle" dominantBaseline="middle">
              {t(factorLabelKey(point.factor.code))}
            </text>
          </g>
        ))}
      </svg>
      <div className="factor-pill-row">
        {topFactors.map((factor) => (
          <span key={factor.code} className={`factor-pill factor-pill-${factorTone(factor.code)}`}>
            {t(factorLabelKey(factor.code))} · {Math.round(factor.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function EligiblePassportsBlock({
  categories,
  t,
  navigate,
}: {
  categories: WalletPassportCategoryStatus[];
  t: ReturnType<typeof useTranslation>["t"];
  navigate: (path: string) => void;
}) {
  const visibleCategories = categories.filter(
    (category) => category.eligible || category.canMint || category.canRefresh || category.existsOnChain,
  );
  const actionableCount = visibleCategories.filter((category) => category.canMint || category.canRefresh).length;
  const hasMainPassportAction = categories.some(
    (category) => category.category === "passport" && (category.canMint || category.canRefresh || category.eligible),
  );

  return (
    <Section
      header={t("profile.eligible.title")}
      footer={hasMainPassportAction ? t("profile.eligible.footer") : t("profile.eligible.footerLocked")}
    >
      <div className="eligible-passport-block">
        <div className="eligible-passport-head">
          <div>
            <strong>{t("profile.eligible.count", { count: visibleCategories.length })}</strong>
            <span>
              {actionableCount > 0
                ? t("profile.eligible.actionable", { count: actionableCount })
                : t("profile.eligible.noActionable")}
            </span>
          </div>
          <Button
            size="s"
            disabled={!hasMainPassportAction}
            onClick={() => {
              hapticSelection();
              navigate("/mint");
            }}
          >
            {t("profile.eligible.cta")}
          </Button>
        </div>
        {visibleCategories.length > 0 ? (
          <div className="eligible-category-grid">
            {visibleCategories.map((category) => (
              <PassportCategoryTile key={category.categoryId} category={category} t={t} />
            ))}
          </div>
        ) : (
          <Cell subtitle={t("profile.eligible.emptyHint")}>{t("profile.eligible.empty")}</Cell>
        )}
      </div>
    </Section>
  );
}

function PassportCategoryTile({
  category,
  t,
}: {
  category: WalletPassportCategoryStatus;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const label = t(CATEGORY_LABEL_KEYS[category.category] ?? category.category);
  const statusKey = category.existsOnChain
    ? "minted"
    : category.canMint
      ? "canMint"
      : category.canRefresh
        ? "canRefresh"
        : category.eligible
          ? "eligible"
          : "locked";
  const subtitle = category.existsOnChain
    ? t("profile.sections.passports.minted", { revision: category.revision })
    : t(`profile.sections.passports.${statusKey}`);

  return (
    <div className={`eligible-category-tile eligible-category-tile-${statusKey}`}>
      <span>{label}</span>
      <Badge type="number" mode={category.canMint || category.canRefresh ? "primary" : "secondary"}>
        {t(`profile.eligible.status.${statusKey}`)}
      </Badge>
      <small>{subtitle}</small>
    </div>
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
