const REFERRAL_CODE_KEY = "wallet-passport-referral-code";

export function saveReferralCode(code: string | undefined): void {
  if (!code) return;
  localStorage.setItem(REFERRAL_CODE_KEY, code);
}

export function getSavedReferralCode(): string | null {
  return localStorage.getItem(REFERRAL_CODE_KEY);
}

export function buildReferralLink(code: string | null | undefined): string {
  return `t.me/WalletPassportXBot/scan?startapp=ref_${code || "..."}`;
}
