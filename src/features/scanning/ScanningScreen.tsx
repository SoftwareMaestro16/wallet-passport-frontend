import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Section, Progress, Button, Placeholder } from "@telegram-apps/telegram-ui";
import { AlertTriangle, Check } from "lucide-react";
import { useTonConnectAccount } from "../../ton/useTonConnectAccount";
import { hapticImpact, hapticNotification, hapticSelection, setClosingConfirmation } from "../../app/telegram";
import { ScanIcon } from "../../shared/icons";
import { useScanProgress, SCAN_STEP_COUNT } from "./useScanProgress";

const RING_SIZE = 156;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = RING_CIRCUMFERENCE * (1 - clamped / 100);
  return (
    <div className="scan-ring-wrap" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped}>
      <svg className="scan-ring" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
        <circle className="scan-ring-track" cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} />
        <circle
          className="scan-ring-value"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="scan-ring-center">
        <span className="scanning-progress-value">{label}</span>
      </div>
    </div>
  );
}

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

  useEffect(() => {
    const stillRunning = !progress.done && !progress.failed;
    setClosingConfirmation(stillRunning);
    return () => setClosingConfirmation(false);
  }, [progress.done, progress.failed]);

  if (!isConnected) return null;

  const stepLabels = Array.from({ length: SCAN_STEP_COUNT }, (_, i) => t(`scanning.steps.${i}`));
  const progressPercent = Math.max(0, Math.min(100, Math.round(progress.progressPct)));
  const progressDetail = t(progress.detailKey, progress.detailValues);

  if (progress.failed) {
    return (
      <div className="screen scanning-screen">
        <Section>
          <Placeholder
            header={t("scanning.failed")}
            description={progress.errorMessage ?? t("scanning.failedHint")}
            action={
              <div className="empty-actions">
                <Button
                  size="m"
                  mode="outline"
                  onClick={() => {
                    hapticSelection();
                    navigate("/", { replace: true });
                  }}
                >
                  {t("scanning.backToConnect")}
                </Button>
                <Button
                  size="m"
                  onClick={() => {
                    didFinishHaptic.current = false;
                    hapticImpact("light");
                    progress.retry();
                  }}
                >
                  {t("scanning.retry")}
                </Button>
              </div>
            }
          >
            <span className="state-icon state-icon-danger" aria-hidden="true">
              <AlertTriangle size={28} strokeWidth={2} />
            </span>
          </Placeholder>
        </Section>
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
      >
        <div className="scanning-body">
          <ProgressRing percent={progressPercent} label={t("scanning.progressPct", { percent: progressPercent })} />
          <Progress className="scanning-progress-bar" value={progressPercent} />
          <div className="scanning-copy">
            <span className="scanning-step">{stepLabels[progress.stepIndex]}</span>
            <span className="scanning-progress-copy">{progressDetail}</span>
          </div>
          <ol className="scan-steps" aria-label={t("scanning.title")}>
            {stepLabels.map((label, index) => {
              const state =
                progress.done || index < progress.stepIndex ? "done" : index === progress.stepIndex ? "active" : "pending";
              return (
                <li key={label} className={`scan-step scan-step-${state}`} aria-current={state === "active" ? "step" : undefined}>
                  <span className="scan-step-icon" aria-hidden="true">
                    {state === "done" && <Check size={14} strokeWidth={3} />}
                    {state === "active" && <span className="scan-step-dot" />}
                  </span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </Section>

      <p className="scanning-hint">{t("scanning.subtitle")}</p>

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
