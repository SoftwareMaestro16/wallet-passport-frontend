import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { TonConnectButton } from "@tonconnect/ui-react";
import { Section, Cell, Button, Badge, Spinner } from "@telegram-apps/telegram-ui";
import { ScoreBar } from "../../shared/ScoreBar";
import { TestnetGuard } from "../../shared/TestnetGuard";
import { buildReferralLink, getSavedReferralCode } from "../../shared/referral";
import { hapticImpact, hapticSelection } from "../../app/telegram";
import { useVerifiedProfile } from "../../ton/useVerifiedProfile";
import { useTonConnectAccount } from "../../ton/useTonConnectAccount";
import { useWalletProfile } from "../profile/useWalletProfile";

export function ConnectScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isConnected, state, retry } = useVerifiedProfile();
  const { address } = useTonConnectAccount();
  // Only matters once ton_proof has verified this wallet — a completed scan for THIS address
  // (200) flips the button to "Update Passport"; no scan yet (409) or unknown keeps "Scan Wallet".
  const { state: walletProfileState } = useWalletProfile(
    isConnected && state.status === "success" ? address : undefined,
  );
  const hasCompletedScan = walletProfileState.status === "ready";
  const referralCode = getSavedReferralCode();
  const referralLink = buildReferralLink(referralCode);

  function handleScan() {
    hapticImpact("medium");
    navigate("/scanning");
  }

  function handleCopyReferral() {
    hapticSelection();
    void navigator.clipboard?.writeText(referralLink);
  }

  return (
    <div className="screen connect-screen">
      <Section>
        <div className="hero-panel">
          <h1 className="hero-title">{t("connect.title")}</h1>
          <p className="hero-copy">{t("connect.valueProp")}</p>
        </div>
      </Section>

      <Section header={t("connect.menu.title")}>
        <div className="menu-grid">
          <div className="menu-card">
            <div className="menu-card-title">
              <span>{t("connect.menu.scan.title")}</span>
              <Badge type="number" mode="primary">
                {t("connect.menu.scan.price")}
              </Badge>
            </div>
            <p>{t("connect.menu.scan.body")}</p>
          </div>
          <div className="menu-card">
            <div className="menu-card-title">
              <span>{t("connect.menu.reveal.title")}</span>
              <Badge type="number">{t("connect.menu.reveal.badge")}</Badge>
            </div>
            <p>{t("connect.menu.reveal.body")}</p>
          </div>
          <div className="menu-card">
            <div className="menu-card-title">
              <span>{t("connect.menu.mint.title")}</span>
              <Badge type="number">{t("connect.menu.mint.badge")}</Badge>
            </div>
            <p>{t("connect.menu.mint.body")}</p>
          </div>
          <div className="menu-card">
            <div className="menu-card-title">
              <span>{t("connect.menu.referral.title")}</span>
              <Badge type="number">{t("connect.menu.referral.badge")}</Badge>
            </div>
            <p>{t("connect.menu.referral.body")}</p>
          </div>
        </div>
      </Section>

      <Section footer={t("connect.testnetHint")}>
        <Cell
          multiline
          after={
            <Badge type="number" mode="primary">
              {t("connect.testnetBadge")}
            </Badge>
          }
        >
          {t("connect.testnetTitle")}
        </Cell>
      </Section>

      <TestnetGuard />

      <Section>
        <div className="connect-cta">
          <TonConnectButton />
        </div>
      </Section>

      {isConnected && state.status === "verifying" && (
        <Section>
          <Cell before={<Spinner size="s" />}>{t("profile.verifying")}</Cell>
        </Section>
      )}

      {isConnected && state.status === "backend-unreachable" && (
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

      {isConnected && state.status === "error" && (
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

      {isConnected && state.status === "success" && (
        <div className="connect-generate">
          <Button size="l" stretched onClick={handleScan}>
            {hasCompletedScan ? t("connect.updateButton") : t("connect.scanButton")}
          </Button>
          <Cell
            multiline
            after={
              <Badge type="number" mode="primary">
                {t("connect.paidScan.price")}
              </Badge>
            }
          >
            {t("connect.paidScan.prepared")}
          </Cell>
        </div>
      )}

      <Section header={t("referral.title")} footer={t("referral.footer")}>
        <Cell
          multiline
          subtitle={
            <span className="referral-link-row">
              <span className="mono referral-link">{referralLink}</span>
            </span>
          }
          after={
            <Button
              size="s"
              mode="outline"
              disabled={!referralCode}
              onClick={handleCopyReferral}
            >
              {t("referral.copy")}
            </Button>
          }
        >
          {referralCode ? t("referral.ready") : t("referral.connectToGet")}
        </Cell>
      </Section>

      <Section header={t("connect.sampleCardTitle")}>
        <div className="sample-card-body">
          <ScoreBar score={7} label={t("connect.sampleScoreLabel")} />
        </div>
        <Cell subtitle={t("connect.sampleScoreLabel")}>
          <span className="mono">EQ...sample...wallet</span>
        </Cell>
      </Section>
    </div>
  );
}
