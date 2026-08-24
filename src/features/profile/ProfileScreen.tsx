import { useTranslation } from "react-i18next";
import { Section, Cell, Avatar, Spinner, Button } from "@telegram-apps/telegram-ui";
import { useTonConnectAccount } from "../../ton/useTonConnectAccount";
import { useVerifiedProfile } from "../../ton/useVerifiedProfile";
import { ScoreBar } from "../../shared/ScoreBar";
import { TestnetGuard } from "../../shared/TestnetGuard";

export function ProfileScreen() {
  const { t } = useTranslation();
  const { address, tonConnectUI } = useTonConnectAccount();
  const { isConnected, state, retry } = useVerifiedProfile();

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

      {state.status === "success" && (
        <Section footer={t("profile.comingSoon")}>
          <div className="sample-card-body">
            <ScoreBar score={state.data.profile.scoreDisplay ?? 0} label={t("profile.scoreLabel")} />
          </div>
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

      <Button mode="outline" stretched onClick={() => tonConnectUI.disconnect()}>
        {t("profile.disconnect")}
      </Button>
    </div>
  );
}

function shortAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function acronymFor(address: string): string {
  return address ? address.slice(2, 4).toUpperCase() : "??";
}
