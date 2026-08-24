import { useTranslation } from "react-i18next";
import { TonConnectButton } from "@tonconnect/ui-react";
import { ScoreBar } from "../../shared/ScoreBar";
import { TestnetGuard } from "../../shared/TestnetGuard";

export function ConnectScreen() {
  const { t } = useTranslation();

  return (
    <div className="screen connect-screen">
      <span className="badge">{t("connect.testnetBadge")}</span>
      <h1>{t("connect.title")}</h1>
      <p className="value-prop">{t("connect.valueProp")}</p>

      <TestnetGuard />

      <div className="connect-cta">
        <TonConnectButton />
      </div>

      <div className="sample-card">
        <p className="sample-card-title">{t("connect.sampleCardTitle")}</p>
        <ScoreBar score={7} label={t("connect.sampleScoreLabel")} />
        <div className="sample-card-address">EQ...sample...wallet</div>
      </div>
    </div>
  );
}
