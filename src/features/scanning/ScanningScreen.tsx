import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Section, Spinner, Progress, Caption, Button } from "@telegram-apps/telegram-ui";
import { useTonConnectAccount } from "../../ton/useTonConnectAccount";
import { ScanIcon } from "../../shared/icons";
import { useScanProgress, SCAN_STEP_COUNT } from "./useScanProgress";

export function ScanningScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isConnected } = useTonConnectAccount();
  const progress = useScanProgress(isConnected);

  // Reached directly (deep link, back-forward cache) without a connected wallet — nothing to scan.
  useEffect(() => {
    if (!isConnected) navigate("/", { replace: true });
  }, [isConnected, navigate]);

  useEffect(() => {
    if (!progress.done) return;
    const timeout = setTimeout(() => navigate("/profile", { replace: true }), 500);
    return () => clearTimeout(timeout);
  }, [progress.done, navigate]);

  if (!isConnected) return null;

  const stepLabels = Array.from({ length: SCAN_STEP_COUNT }, (_, i) => t(`scanning.steps.${i}`));

  return (
    <div className="screen scanning-screen">
      <Section
        header={
          <Section.Header>
            <span className="scanning-header-inner">
              <ScanIcon size={20} className="scan-icon-spin" />
              {t("scanning.title")}
            </span>
          </Section.Header>
        }
        footer={t("scanning.subtitle")}
      >
        <div className="scanning-body">
          <Spinner size="l" />
          <Progress value={progress.progressPct} />
          <Caption level="1" weight="2" className="scanning-step">
            {stepLabels[progress.stepIndex]}
          </Caption>
        </div>
      </Section>

      <Button mode="plain" size="s" stretched onClick={progress.skip}>
        {t("scanning.skip")}
      </Button>
    </div>
  );
}
