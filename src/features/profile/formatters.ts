import type { ScoreFactorCode, WalletProfileResponse } from "../../api/client";

export function localeFor(lang: string): string {
  return lang.startsWith("ru") ? "ru-RU" : "en-US";
}

export function formatNumber(n: number, lang: string): string {
  return n.toLocaleString(localeFor(lang));
}

export function formatTon(nanoTon: string, lang: string): string {
  // Safe as Number here (mirrors server/src/domain/metrics/score.ts's factorE_economic comment):
  // human-scale TON amounts, nowhere near Number's precision ceiling.
  const ton = Number(BigInt(nanoTon)) / 1_000_000_000;
  return ton.toLocaleString(localeFor(lang), { maximumFractionDigits: 2 });
}

export function formatDate(iso: string | null, lang: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(localeFor(lang), { year: "numeric", month: "short", day: "numeric" });
}

export function factorValue(stats: WalletProfileResponse["score"], code: ScoreFactorCode): number {
  return stats.factors.find((f) => f.code === code)?.value ?? 0;
}

export function factorLabelKey(code: ScoreFactorCode): string {
  return `profile.factors.${code}`;
}

export function factorTone(code: ScoreFactorCode): string {
  if (code === "A" || code === "C") return "steady";
  if (code === "E" || code === "O") return "flow";
  if (code === "D" || code === "N") return "explore";
  return "craft";
}

export function dominantSummaryKey(code: ScoreFactorCode | undefined): string {
  if (code === "A" || code === "C") return "profile.result.summary.steady";
  if (code === "E" || code === "O") return "profile.result.summary.flow";
  if (code === "D" || code === "N") return "profile.result.summary.explore";
  if (code === "S" || code === "B") return "profile.result.summary.craft";
  return "profile.result.summary.balanced";
}
