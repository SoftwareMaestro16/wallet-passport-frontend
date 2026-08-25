import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Section, Cell, Spinner, Progress, Caption, Button } from "@telegram-apps/telegram-ui";
import { useTonConnectAccount } from "../../ton/useTonConnectAccount";
import { hapticImpact, hapticNotification, hapticSelection } from "../../app/telegram";
import { ScanIcon } from "../../shared/icons";
import { useScanProgress, SCAN_STEP_COUNT } from "./useScanProgress";

export function ScanningScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isConnected, address } = useTonConnectAccount();
  const progress = useScanProgress(address || undefined, isConnected);
  const didStartHaptic = useRef(false);
  const didFinishHaptic = useRef(false);

  // Reached directly (deep link, back-forward cache) without a connected wallet — nothing to scan.
  useEffect(() => {
    if (!isConnected) navigate("/", { replace: true });
  }, [isConnected, navigate]);

  useEffect(() => {
    if (!progress.done) return;
    if (!didFinishHaptic.current) {
      didFinishHaptic.current = true;
      hapticNotification("success");
    }
    const timeout = setTimeout(() => navigate("/profile", { replace: true }), 500);
    return () => clearTimeout(timeout);
  }, [progress.done, navigate]);

  useEffect(() => {
    if (!isConnected || didStartHaptic.current) return;
    didStartHaptic.current = true;
    hapticImpact("medium");
  }, [isConnected]);

  useEffect(() => {
    if (!progress.failed || didFinishHaptic.current) return;
    didFinishHaptic.current = true;
    hapticNotification("error");
  }, [progress.failed]);

  if (!isConnected) return null;

  const stepLabels = Array.from({ length: SCAN_STEP_COUNT }, (_, i) => t(`scanning.steps.${i}`));
  const progressPercent = Math.max(0, Math.min(100, Math.round(progress.progressPct)));
  const progressDetail = t(progress.detailKey, progress.detailValues);

  if (progress.failed) {
    return (
      <div className="screen scanning-screen">
        <Section footer={progress.errorMessage ? undefined : t("scanning.failedHint")}>
          <Cell
            multiline
            after={
              <Button
                size="s"
                mode="outline"
                onClick={() => {
                  didFinishHaptic.current = false;
                  hapticImpact("light");
                  progress.retry();
                }}
              >
                {t("scanning.retry")}
              </Button>
            }
          >
            {progress.errorMessage ? `${t("scanning.failed")} (${progress.errorMessage})` : t("scanning.failed")}
          </Cell>
        </Section>

        <Button
          mode="plain"
          size="s"
          stretched
          onClick={() => {
            hapticSelection();
            navigate("/", { replace: true });
          }}
        >
          {t("scanning.backToConnect")}
        </Button>
      </div>
    );
  }

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
          <div className="scanning-progress-head">
            <strong className="scanning-progress-value">{t("scanning.progressPct", { percent: progressPercent })}</strong>
          </div>
          <Progress value={progress.progressPct} />
          <Caption level="1" weight="2" className="scanning-step">
            {stepLabels[progress.stepIndex]}
          </Caption>
          <Caption level="1" weight="2" className="scanning-progress-copy">
            {progressDetail}
          </Caption>
        </div>
      </Section>

      <Button
        mode="plain"
        size="s"
        stretched
        onClick={() => {
          hapticSelection();
          progress.skip();
        }}
      >
        {t("scanning.skip")}
      </Button>
    </div>
  );
}
