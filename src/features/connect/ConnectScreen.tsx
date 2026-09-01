import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Section, Cell, Button, Spinner, Placeholder } from "@telegram-apps/telegram-ui";
import { Sparkles, Wallet } from "lucide-react";
import { hapticImpact } from "../../app/telegram";
import { useVerifiedProfile } from "../../ton/useVerifiedProfile";
import { useTonConnectAccount } from "../../ton/useTonConnectAccount";
import { useWalletProfile } from "../profile/useWalletProfile";
import { ScanResult } from "./ScanResult";

export function ConnectScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isConnected, state } = useVerifiedProfile();
  const { address } = useTonConnectAccount();
  const walletProfile = useWalletProfile(isConnected && state.status === "success" ? address : undefined);
  const hasCompletedScan = walletProfile.state.status === "ready";
  const isVerified = isConnected && state.status === "success";

  function handleScan() {
    hapticImpact("medium");
    navigate("/scanning");
  }

  return (
    <div className="screen connect-screen">
      <Section>
        <div className="hero-panel">
          <h1 className="hero-title">{t("connect.title")}</h1>
          <p className="hero-copy">{t("connect.valueProp")}</p>
          <p className="connect-free-copy">
            <Sparkles size={16} strokeWidth={2.2} aria-hidden="true" />
            {t("connect.freeScan")}
          </p>
        </div>
      </Section>

      {!isConnected && (
        <Section>
          <Placeholder header={t("connect.connectHint")}>
            <span className="state-icon" aria-hidden="true">
              <Wallet size={28} strokeWidth={2} />
            </span>
          </Placeholder>
        </Section>
      )}

      {isConnected && state.status === "verifying" && (
        <Section>
          <Cell multiline before={<Spinner size="s" />}>
            {t("profile.verifying")}
          </Cell>
        </Section>
      )}

      {isVerified && (
        <div className="connect-generate">
          <Button size="l" stretched onClick={handleScan}>
            {hasCompletedScan ? t("connect.updateButton") : t("connect.scanButton")}
          </Button>
        </div>
      )}

      {isVerified && walletProfile.state.status === "loading" && (
        <Section>
          <Cell multiline before={<Spinner size="s" />}>
            {t("profile.loadingProfile")}
          </Cell>
        </Section>
      )}

      {isVerified && walletProfile.state.status === "error" && (
        <Section footer={t("profile.profileError")}>
          <Cell
            multiline
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

      {isVerified && walletProfile.state.status === "ready" && (
        <ScanResult data={walletProfile.state.data} lang={i18n.language} t={t} />
      )}
    </div>
  );
}
