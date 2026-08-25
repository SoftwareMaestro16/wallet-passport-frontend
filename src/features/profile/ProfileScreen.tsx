import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Section, Cell, Avatar, Spinner, Button, Badge } from "@telegram-apps/telegram-ui";
import { useTonConnectAccount } from "../../ton/useTonConnectAccount";
import { useVerifiedProfile } from "../../ton/useVerifiedProfile";
import { ScoreBar } from "../../shared/ScoreBar";
import { TestnetGuard } from "../../shared/TestnetGuard";
import { shareReferralViaInlineMode } from "../../app/telegram";
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

function ComingSoonCell({ title, body, badge }: { title: string; body: string; badge: string }) {
  return (
    <Section header={title}>
      <Cell subtitle={body} after={<Badge type="number">{badge}</Badge>}>
        {title}
      </Cell>
    </Section>
  );
}

function StatCell({ label, value }: { label: string; value: ReactNode }) {
  return <Cell subtitle={label}>{value}</Cell>;
}

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { address, tonConnectUI } = useTonConnectAccount();
  const { isConnected, state, retry } = useVerifiedProfile();
  const lang = i18n.language;

  const walletProfile = useWalletProfile(state.status === "success" ? address : undefined);
  const walletPassports = useWalletPassports(state.status === "success" ? address : undefined);
  const referralMe = useReferralMe(state.status === "success");

  const navigate = useNavigate();

  if (!isConnected) {
    return (
      <div className="screen profile-screen">
        <Section header={t("profile.title")}>
          <Cell>{t("mint.notConnected")}</Cell>
        </Section>
      </div>
    );
  }

  return (
    <div className="screen profile-screen">
      <Section header={t("profile.title")}>
        {referralMe.state.status === "ready" && (
          <Cell
            before={
              <Avatar
                size={40}
                src={referralMe.state.data.user.photoUrl ?? undefined}
                acronym={userAcronym(referralMe.state.data.user.firstName, referralMe.state.data.user.username)}
              />
            }
            subtitle={userSubtitle(referralMe.state.data.user.username, referralMe.state.data.user.languageCode, t)}
            after={referralMe.state.data.user.isPremium ? <Badge type="number">Premium</Badge> : undefined}
          >
            {displayUserName(referralMe.state.data.user.firstName, referralMe.state.data.user.lastName, referralMe.state.data.user.username)}
          </Cell>
        )}
        <Cell before={<Avatar size={40} acronym={acronymFor(address)} />} subtitle={t("profile.walletLabel")}>
          <span className="mono">{shortAddress(address)}</span>
        </Cell>
      </Section>

      <TestnetGuard />

      {state.status === "verifying" && (
        <Section>
          <Cell before={<Spinner size="s" />}>{t("profile.verifying")}</Cell>
        </Section>
      )}

      {state.status === "error" && (
        <Section footer={t("profile.verifyError")}>
          <Cell
            after={
              <Button size="s" mode="outline" onClick={retry}>
                {t("profile.retry")}
              </Button>
            }
          >
            {t("common.error")}
          </Cell>
        </Section>
      )}

      {state.status === "backend-unreachable" && (
        <Section footer={t("profile.backendUnreachable")}>
          <Cell
            after={
              <Button size="s" mode="outline" onClick={retry}>
                {t("profile.retry")}
              </Button>
            }
          >
            {t("common.error")}
          </Cell>
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
              <Button size="s" mode="outline" onClick={() => navigate("/scanning")}>
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
          referralMe={referralMe}
        />
      )}

      <Button mode="outline" stretched onClick={() => tonConnectUI.disconnect()}>
        {t("profile.disconnect")}
      </Button>
    </div>
  );
}

function ProfileResult({
  data,
  passports,
  lang,
  t,
  navigate,
  referralMe,
}: {
  data: WalletProfileResponse;
  passports: ReturnType<typeof useWalletPassports>;
  lang: string;
  t: ReturnType<typeof useTranslation>["t"];
  navigate: (path: string) => void;
  referralMe: ReturnType<typeof useReferralMe>;
}) {
  const { score, stats } = data;
  const topFactors = [...score.factors].sort((a, b) => b.value - a.value).slice(0, 3);
  const firstTx = formatDate(stats.firstTxAt, lang);
  const passportsList = passports.state.status === "ready" ? passports.state.data.categories : null;
  const mainCategory = passportsList?.find((c) => c.category === "passport");
  const referralCode =
    referralMe.state.status === "ready" ? referralMe.state.data.referral.code : getSavedReferralCode();
  const referralLink =
    referralMe.state.status === "ready" ? referralMe.state.data.referral.link : buildReferralLink(referralCode);
  const referralStats = referralMe.state.status === "ready" ? referralMe.state.data.stats : null;

  return (
    <>
      <Section header={t("profile.reveal.title")} footer={t("profile.reveal.footer")}>
        <Cell
          multiline
          after={
            <Badge type="number" mode="primary">
              {score.tier}
            </Badge>
          }
          subtitle={t("profile.reveal.subtitle")}
        >
          {t("profile.reveal.ready")}
        </Cell>
      </Section>

      <Section header={t("profile.summary.title")}>
        <div className="sample-card-body">
          <ScoreBar score={score.tonScore} max={1000} label={`${t("profile.summary.title")} — ${score.tier}`} />
        </div>
        <StatCell
          label={t("profile.summary.walletAge")}
          value={t("profile.summary.walletAgeDays", { count: Math.round(stats.walletAgeDays) })}
        />
        <StatCell label={t("profile.summary.transactions")} value={formatNumber(stats.totalTxCount, lang)} />
        <StatCell label={t("profile.summary.activeDays")} value={formatNumber(stats.activeDaysCount, lang)} />
        <StatCell
          label={t("profile.summary.economicVolume")}
          value={`${formatTon(stats.economicVolumeNanoTon, lang)} TON`}
        />
        <Cell subtitle={t("profile.summary.strongestCategories")} multiline>
          {topFactors.map((f) => `${f.factor} ${Math.round(f.value)}`).join(" · ")}
        </Cell>
      </Section>

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
        <StatCell
          label={t("profile.sections.overview.dataConfidence")}
          value={`${stats.dataConfidence.overallScore}%`}
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

      <ComingSoonCell
        title={t("profile.sections.comingSoon.defi.title")}
        body={t("profile.sections.comingSoon.defi.body")}
        badge={t("profile.sections.comingSoon.badge")}
      />

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

      <ComingSoonCell
        title={t("profile.sections.comingSoon.nfts.title")}
        body={t("profile.sections.comingSoon.nfts.body")}
        badge={t("profile.sections.comingSoon.badge")}
      />
      <ComingSoonCell
        title={t("profile.sections.comingSoon.telegramAssets.title")}
        body={t("profile.sections.comingSoon.telegramAssets.body")}
        badge={t("profile.sections.comingSoon.badge")}
      />
      <ComingSoonCell
        title={t("profile.sections.comingSoon.staking.title")}
        body={t("profile.sections.comingSoon.staking.body")}
        badge={t("profile.sections.comingSoon.badge")}
      />

      <Section header={t("profile.sections.builder.title")}>
        <StatCell label={t("profile.sections.builder.deployments")} value={formatNumber(stats.deploymentCount, lang)} />
        <StatCell label={t("profile.sections.builder.score")} value={Math.round(factorValue(score, "B"))} />
      </Section>

      <ComingSoonCell
        title={t("profile.sections.comingSoon.history.title")}
        body={t("profile.sections.comingSoon.history.body")}
        badge={t("profile.sections.comingSoon.badge")}
      />
      <ComingSoonCell
        title={t("profile.sections.comingSoon.rareRelics.title")}
        body={t("profile.sections.comingSoon.rareRelics.body")}
        badge={t("profile.sections.comingSoon.badge")}
      />

      {/* Endpoint is being added concurrently and may 404 pre-rollout — hide the section entirely
          rather than show a stub, per the honesty requirement (no fabricated/placeholder state). */}
      {passportsList && (
        <Section header={t("profile.sections.passports.title")}>
          {passportsList.map((cat) => (
            <PassportCategoryCell key={cat.categoryId} category={cat} t={t} />
          ))}
        </Section>
      )}

      <Section header={t("profile.actions.title")}>
        <Cell
          after={
            <Button size="s" onClick={() => navigate("/mint")}>
              {t("profile.actions.go")}
            </Button>
          }
          subtitle={mainCategory?.existsOnChain ? t("profile.sections.passports.minted", { revision: mainCategory.revision }) : undefined}
        >
          {t("profile.actions.mint")}
        </Cell>
        <Cell
          multiline
          subtitle={t("profile.actions.refreshHint")}
          after={<Badge type="number">{t("profile.actions.refreshPrice")}</Badge>}
        >
          {t("profile.actions.refresh")}
        </Cell>
        <Cell subtitle={t("profile.actions.viewRelicsHint")} after={<Badge type="number">{t("profile.sections.comingSoon.badge")}</Badge>}>
          {t("profile.actions.viewRelics")}
        </Cell>
        <Cell subtitle={t("profile.actions.shareHint")} after={<Badge type="number">{t("profile.sections.comingSoon.badge")}</Badge>}>
          {t("profile.actions.share")}
        </Cell>
        <Cell subtitle={t("profile.actions.compareHint")} after={<Badge type="number">{t("profile.sections.comingSoon.badge")}</Badge>}>
          {t("profile.actions.compare")}
        </Cell>
      </Section>

      <Section header={t("referral.title")} footer={t("referral.footer")}>
        <Cell
          multiline
          subtitle={<span className="mono referral-link">{referralLink}</span>}
          after={
            <div className="referral-actions">
              <Button
                size="s"
                mode="outline"
                disabled={!referralCode}
                onClick={() => void navigator.clipboard?.writeText(referralLink)}
              >
                {t("referral.copy")}
              </Button>
              <Button
                size="s"
                disabled={!referralCode}
                onClick={() => {
                  if (!referralCode || shareReferralViaInlineMode(referralCode)) return;
                  window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}`, "_blank", "noopener,noreferrer");
                }}
              >
                {t("referral.shareInline")}
              </Button>
            </div>
          }
        >
          {referralCode ? t("referral.ready") : t("referral.connectToGet")}
        </Cell>
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
      </Section>
    </>
  );
}

function PassportCategoryCell({
  category,
  t,
}: {
  category: WalletPassportCategoryStatus;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const label = t(CATEGORY_LABEL_KEYS[category.category] ?? category.category);
  const subtitle = category.existsOnChain
    ? t("profile.sections.passports.minted", { revision: category.revision })
    : category.eligible
      ? t("profile.sections.passports.eligible")
      : t("profile.sections.passports.notEligible");
  const badgeText = category.canMint
    ? t("profile.sections.passports.canMint")
    : category.canRefresh
      ? t("profile.sections.passports.canRefresh")
      : t("profile.sections.passports.locked");

  return (
    <Cell subtitle={subtitle} after={<Badge type="number">{badgeText}</Badge>}>
      {label}
    </Cell>
  );
}

function shortAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function acronymFor(address: string): string {
  return address ? address.slice(2, 4).toUpperCase() : "??";
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
