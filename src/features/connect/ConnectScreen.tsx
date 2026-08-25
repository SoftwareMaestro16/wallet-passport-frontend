import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Section, Cell, Button, Spinner } from "@telegram-apps/telegram-ui";
import { hapticImpact } from "../../app/telegram";
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
          <p className="connect-free-copy">{t("connect.freeScan")}</p>
        </div>
      </Section>

      {!isConnected && (
        <Section>
          <Cell>{t("connect.connectHint")}</Cell>
        </Section>
      )}

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
        </div>
      )}
    </div>
  );
}
