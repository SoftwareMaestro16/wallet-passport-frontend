import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Section, Cell, Button, Spinner, Placeholder } from "@telegram-apps/telegram-ui";
import { AlertTriangle, CheckCircle2, Gem, Wallet } from "lucide-react";
import { useTonConnectAccount } from "../../ton/useTonConnectAccount";
import { useVerifiedProfile } from "../../ton/useVerifiedProfile";
import { getTelegramInitData, hapticImpact, hapticNotification } from "../../app/telegram";
import { api, ApiError } from "../../api/client";
import { TestnetGuard } from "../../shared/TestnetGuard";
import { buildMintTransactionRequest } from "./mintTx";
import { useWalletPassports } from "../profile/useWalletPassports";
import { PassportEligibility } from "./PassportEligibility";

type MintState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "pending" }
  | { status: "success"; txHash?: string }
  | { status: "error"; message: string };

// Must match a slug in server/src/domain/categories.ts's PASSPORT_CATEGORIES — "passport" is the
// overall/MAIN category (categoryId 0, contracts' CATEGORY_MAIN). This previously said "MAIN",
// which categorySlugToUint8() rejects with 400 on every request, blocking every mint attempt.
const CATEGORY = "passport" as const;

/** Backend error bodies are expected to be `{ message: string }` per TMAGUIDE.md conventions; fall back gracefully if not. */
function backendErrorMessage(err: unknown): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  const body = err.body;
  if (body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string") {
    return (body as { message: string }).message;
  }
  return undefined;
}

export function MintScreen() {
  const { t } = useTranslation();
  const { isConnected, tonConnectUI, address } = useTonConnectAccount();
  const { state: verifiedState } = useVerifiedProfile();
  const isVerified = isConnected && verifiedState.status === "success";
  const walletPassports = useWalletPassports(isVerified ? address : undefined);
  const [state, setState] = useState<MintState>({ status: "idle" });
  async function handleMint() {
    hapticImpact("medium");
    setState({ status: "preparing" });
    try {
      const prepared = await api.prepareMint(CATEGORY, getTelegramInitData());
      setState({ status: "pending" });

      const tx = buildMintTransactionRequest(prepared);
      const result = await tonConnectUI.sendTransaction(tx);

      hapticNotification("success");
      setState({ status: "success", txHash: result.boc?.slice(0, 16) });
      void walletPassports.reload();
    } catch (err) {
      // mintTx.ts can throw a non-ApiError (e.g. the Permit cell-overflow blocker documented
      // there) — surface it in devtools since `state.message` below is a generic i18n string.
      if (!(err instanceof ApiError)) console.error(err);
      const detail = backendErrorMessage(err) ?? (err instanceof ApiError ? `(${err.status})` : undefined);
      const message = detail ? `${t("mint.statusError")} ${detail}` : t("mint.statusError");
      hapticNotification("error");
      setState({ status: "error", message });
    }
  }

  const isBusy = state.status === "preparing" || state.status === "pending";

  return (
    <div className="screen mint-screen">
      <Section>
        <div className="hero-panel hero-panel-compact">
          <span className="hero-eyebrow">
            <Gem size={14} strokeWidth={2.2} aria-hidden="true" />
            {t("connect.testnetBadge")}
          </span>
          <h1 className="hero-title">{t("mint.title")}</h1>
          <p className="hero-copy">{t("mint.description")}</p>
        </div>
      </Section>

      <TestnetGuard />

      {isVerified && walletPassports.state.status === "loading" && (
        <Section>
          <Cell multiline before={<Spinner size="s" />}>
            {t("profile.loadingProfile")}
          </Cell>
        </Section>
      )}

      {isVerified && walletPassports.state.status === "error" && (
        <Section footer={t("profile.profileError")}>
          <Cell
            multiline
            after={
              <Button size="s" mode="outline" onClick={walletPassports.reload}>
                {t("profile.retry")}
              </Button>
            }
          >
            {t("common.error")}
          </Cell>
        </Section>
      )}

      {isVerified && walletPassports.state.status === "ready" && (
        <PassportEligibility categories={walletPassports.state.data.categories} t={t} />
      )}

      {!isConnected ? (
        <Section>
          <Placeholder header={t("mint.notConnected")} description={t("connect.connectHint")}>
            <span className="state-icon" aria-hidden="true">
              <Wallet size={28} strokeWidth={2} />
            </span>
          </Placeholder>
        </Section>
      ) : (
        <Section>
          {state.status !== "error" && (
            <div className="mint-action">
              <Button size="l" stretched loading={isBusy} disabled={isBusy} onClick={handleMint}>
                {t("mint.mintButton")}
              </Button>
            </div>
          )}

          {state.status === "error" && (
            <Cell
              multiline
              before={
                <span className="state-icon state-icon-s state-icon-danger" aria-hidden="true">
                  <AlertTriangle size={18} strokeWidth={2.2} />
                </span>
              }
              after={
                <Button size="s" mode="outline" onClick={handleMint}>
                  {t("mint.retry")}
                </Button>
              }
            >
              {state.message}
            </Cell>
          )}

          {state.status === "idle" && (
            <Cell multiline className="mint-status-cell">
              {t("mint.statusIdle")}
            </Cell>
          )}

          {isBusy && (
            <Cell multiline before={<Spinner size="s" />}>
              {t("mint.statusPending")}
            </Cell>
          )}

          {state.status === "success" && (
            <Cell
              multiline
              before={
                <span className="state-icon state-icon-s state-icon-success" aria-hidden="true">
                  <CheckCircle2 size={18} strokeWidth={2.2} />
                </span>
              }
            >
              {t("mint.statusSuccess")}
            </Cell>
          )}
        </Section>
      )}
    </div>
  );
}
