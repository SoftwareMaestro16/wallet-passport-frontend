import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { TonConnectButton } from "@tonconnect/ui-react";
import { Section, Cell, Button, Badge, Spinner } from "@telegram-apps/telegram-ui";
import { ScoreBar } from "../../shared/ScoreBar";
import { TestnetGuard } from "../../shared/TestnetGuard";
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

  return (
    <div className="screen connect-screen">
      <Section footer={t("connect.valueProp")}>
        <Cell
          multiline
          after={
            <Badge type="number" mode="primary">
              {t("connect.testnetBadge")}
            </Badge>
          }
        >
          {t("connect.title")}
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
          <Button size="l" stretched onClick={() => navigate("/scanning")}>
            {hasCompletedScan ? t("connect.updateButton") : t("connect.scanButton")}
          </Button>
        </div>
      )}

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
