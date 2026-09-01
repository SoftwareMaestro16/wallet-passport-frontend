import type { ReactNode } from "react";
import type { useTranslation } from "react-i18next";
import { Section, Cell, Badge } from "@telegram-apps/telegram-ui";
import type { WalletProfileResponse } from "../../api/client";
import {
  dominantSummaryKey,
  factorLabelKey,
  factorTone,
  factorValue,
  formatDate,
  formatNumber,
  formatTon,
} from "../profile/formatters";

/** Key/value row: label on the left, value right-aligned so long labels never collide with numbers. */
function StatCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Cell multiline className="stat-cell" after={<span className="stat-value">{value}</span>}>
      {label}
    </Cell>
  );
}

const COMING_SOON_KEYS = ["defi", "nfts", "telegramAssets", "staking", "history", "rareRelics"] as const;

export function ScanResult({
  data,
  lang,
  t,
}: {
  data: WalletProfileResponse;
  lang: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const { score, stats } = data;
  const topFactors = score.dominantFactors ?? [...score.factors].sort((a, b) => b.value - a.value).slice(0, 3);
  const firstTx = formatDate(stats.firstTxAt, lang);
  const jettonFooter = !stats.dataConfidence.jettonDataAvailable ? t("profile.sections.jettons.partialData") : undefined;

  return (
    <>
      <ScanResultScoreBlock data={data} topFactors={topFactors} lang={lang} t={t} />

      <Section
        header={t("profile.sections.overview.title")}
        footer={stats.totalTxCount === 0 ? t("profile.sections.overview.noHistory") : undefined}
      >
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
      </Section>

      <Section header={t("profile.sections.activity.title")}>
        <StatCell label={t("profile.sections.activity.activeDays")} value={formatNumber(stats.activeDaysCount, lang)} />
        <StatCell
          label={t("profile.sections.activity.activeMonths")}
          value={formatNumber(stats.activeMonthsCount, lang)}
        />
        <StatCell label={t("profile.sections.activity.consistency")} value={Math.round(factorValue(score, "C"))} />
      </Section>

      <Section header={t("profile.sections.jettons.title")} footer={jettonFooter}>
        <StatCell label={t("profile.sections.jettons.transfers")} value={formatNumber(stats.jettonTransferCount, lang)} />
        <StatCell label={t("profile.sections.jettons.burns")} value={formatNumber(stats.jettonBurnCount, lang)} />
        <StatCell
          label={t("profile.sections.jettons.masters")}
          value={formatNumber(stats.uniqueJettonMasterCount, lang)}
        />
      </Section>

      <Section header={t("profile.sections.builder.title")}>
        <StatCell label={t("profile.sections.builder.deployments")} value={formatNumber(stats.deploymentCount, lang)} />
        <StatCell label={t("profile.sections.builder.score")} value={Math.round(factorValue(score, "B"))} />
      </Section>

      <Section header={t("profile.sections.comingSoon.badge")}>
        {COMING_SOON_KEYS.map((key) => (
          <Cell
            key={key}
            multiline
            subtitle={t(`profile.sections.comingSoon.${key}.body`)}
            after={<Badge type="number">{t("profile.sections.comingSoon.badge")}</Badge>}
          >
            {t(`profile.sections.comingSoon.${key}.title`)}
          </Cell>
        ))}
      </Section>
    </>
  );
}

function ScanResultScoreBlock({
  data,
  topFactors,
  lang,
  t,
}: {
  data: WalletProfileResponse;
  topFactors: WalletProfileResponse["score"]["factors"];
  lang: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const { score, stats } = data;
  const dominant = topFactors[0];
  const secondary = topFactors[1];
  const summary = t(dominantSummaryKey(dominant?.code), {
    primary: dominant ? t(factorLabelKey(dominant.code)) : t("profile.result.factorFallback"),
    secondary: secondary ? t(factorLabelKey(secondary.code)) : t("profile.result.factorFallback"),
    score: score.tonScore,
  });
  const footer = t("profile.reveal.footer");

  return (
    <Section header={t("profile.result.title")} footer={footer || undefined}>
      <div className="profile-result-card">
        <div className="profile-result-score">
          <div className="profile-score-hex" aria-label={`${t("profile.scoreLabel")} ${score.tonScore}`}>
            <span>{score.tonScore}</span>
            <small>{t("profile.result.scoreMax")}</small>
          </div>
          <div className="profile-result-copy">
            <Badge type="number" mode="primary">
              {score.tier}
            </Badge>
            <h2>{t("profile.reveal.ready")}</h2>
            <p>{summary}</p>
          </div>
        </div>
        <FactorRadar factors={score.factors} topFactors={topFactors} t={t} />
        <div className="profile-result-metrics">
          <div>
            <strong>{t("profile.summary.walletAgeDays", { count: Math.round(stats.walletAgeDays) })}</strong>
            <span>{t("profile.summary.walletAge")}</span>
          </div>
          <div>
            <strong>{formatNumber(stats.totalTxCount, lang)}</strong>
            <span>{t("profile.summary.transactions")}</span>
          </div>
          <div>
            <strong>{formatTon(stats.economicVolumeNanoTon, lang)} TON</strong>
            <span>{t("profile.summary.economicVolume")}</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

function FactorRadar({
  factors,
  topFactors,
  t,
}: {
  factors: WalletProfileResponse["score"]["factors"];
  topFactors: WalletProfileResponse["score"]["factors"];
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const size = 184;
  const center = size / 2;
  const maxRadius = 64;
  const ordered = factors.length > 0 ? factors : topFactors;
  const topCodes = new Set(topFactors.map((factor) => factor.code));
  const points = ordered.map((factor, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / ordered.length;
    const valueRadius = (Math.max(0, Math.min(100, factor.value)) / 100) * maxRadius;
    const axisX = center + Math.cos(angle) * maxRadius;
    const axisY = center + Math.sin(angle) * maxRadius;
    const valueX = center + Math.cos(angle) * valueRadius;
    const valueY = center + Math.sin(angle) * valueRadius;
    const labelX = center + Math.cos(angle) * (maxRadius + 18);
    const labelY = center + Math.sin(angle) * (maxRadius + 18);
    return { factor, axisX, axisY, valueX, valueY, labelX, labelY };
  });
  const polygonPoints = points.map((point) => `${point.valueX},${point.valueY}`).join(" ");
  const gridScales = [0.33, 0.66, 1];
  const axisCount = Math.max(ordered.length, 3);

  return (
    <div className="factor-radar-wrap" aria-label={t("profile.result.radarLabel")}>
      <svg className="factor-radar" viewBox={`0 0 ${size} ${size}`} role="img">
        {gridScales.map((scale) => {
          const gridPoints = Array.from({ length: axisCount }, (_, index) => {
            const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axisCount;
            return `${center + Math.cos(angle) * maxRadius * scale},${center + Math.sin(angle) * maxRadius * scale}`;
          }).join(" ");
          return <polygon key={scale} points={gridPoints} className="factor-radar-grid" />;
        })}
        {points.map((point) => (
          <line
            key={point.factor.code}
            x1={center}
            y1={center}
            x2={point.axisX}
            y2={point.axisY}
            className="factor-radar-axis"
          />
        ))}
        <polygon points={polygonPoints} className="factor-radar-shape" />
        {points.map((point) => (
          <g key={point.factor.code}>
            <circle
              cx={point.valueX}
              cy={point.valueY}
              r={topCodes.has(point.factor.code) ? 4 : 3}
              className={`factor-radar-dot factor-radar-dot-${factorTone(point.factor.code)}`}
            />
            <text x={point.labelX} y={point.labelY} textAnchor="middle" dominantBaseline="middle">
              {t(factorLabelKey(point.factor.code))}
            </text>
          </g>
        ))}
      </svg>
      <div className="factor-pill-row">
        {topFactors.map((factor) => (
          <span key={factor.code} className={`factor-pill factor-pill-${factorTone(factor.code)}`}>
            {t(factorLabelKey(factor.code))} · {Math.round(factor.value)}
          </span>
        ))}
      </div>
    </div>
  );
}
