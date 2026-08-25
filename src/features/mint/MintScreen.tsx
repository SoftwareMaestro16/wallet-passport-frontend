import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Section, Cell, Button, Spinner } from "@telegram-apps/telegram-ui";
import { useTonConnectAccount } from "../../ton/useTonConnectAccount";
import { getTelegramInitData } from "../../app/telegram";
import { api, ApiError } from "../../api/client";
import { TestnetGuard } from "../../shared/TestnetGuard";
import { buildMintTransactionRequest } from "./mintTx";

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
  const { isConnected, tonConnectUI } = useTonConnectAccount();
  const [state, setState] = useState<MintState>({ status: "idle" });
  const [refreshPrepared, setRefreshPrepared] = useState(false);

  async function handleMint() {
    setState({ status: "preparing" });
    try {
      const prepared = await api.prepareMint(CATEGORY, getTelegramInitData());
      setState({ status: "pending" });

      const tx = buildMintTransactionRequest(prepared);
      const result = await tonConnectUI.sendTransaction(tx);

      setState({ status: "success", txHash: result.boc?.slice(0, 16) });
    } catch (err) {
      // mintTx.ts can throw a non-ApiError (e.g. the Permit cell-overflow blocker documented
      // there) — surface it in devtools since `state.message` below is a generic i18n string.
      if (!(err instanceof ApiError)) console.error(err);
      const detail = backendErrorMessage(err) ?? (err instanceof ApiError ? `(${err.status})` : undefined);
      const message = detail ? `${t("mint.statusError")} ${detail}` : t("mint.statusError");
      setState({ status: "error", message });
    }
  }

  const isBusy = state.status === "preparing" || state.status === "pending";

  return (
    <div className="screen mint-screen">
      <Section header={t("mint.title")} footer={t("mint.description")} />

      <TestnetGuard />

      <Section>
        {!isConnected && <Cell>{t("mint.notConnected")}</Cell>}

        {state.status !== "error" && (
          <div className="mint-action">
            <Button size="l" stretched loading={isBusy} disabled={!isConnected || isBusy} onClick={handleMint}>
              {t("mint.mintButton")}
            </Button>
          </div>
        )}

        {state.status === "error" && (
          <Cell
            multiline
            after={
              <Button size="s" mode="outline" onClick={handleMint}>
                {t("mint.retry")}
              </Button>
            }
          >
            {state.message}
          </Cell>
        )}
      </Section>

      <Section>
        <Cell before={isBusy ? <Spinner size="s" /> : undefined}>
          {state.status === "idle" && t("mint.statusIdle")}
          {isBusy && t("mint.statusPending")}
          {state.status === "success" && t("mint.statusSuccess")}
          {state.status === "error" && t("common.error")}
        </Cell>
      </Section>

      <Section header={t("mint.refresh.title")} footer={t("mint.refresh.footer")}>
        <div className="status-stack">
          <div className="price-row">
            <span>{t("mint.refresh.priceLabel")}</span>
            <strong>{t("mint.refresh.price")}</strong>
          </div>
          <Button
            mode="outline"
            stretched
            disabled={!isConnected}
            onClick={() => setRefreshPrepared(true)}
          >
            {t("mint.refresh.prepareButton")}
          </Button>
        </div>
        {refreshPrepared && (
          <Cell multiline subtitle={t("mint.refresh.preparedSubtitle")}>
            {t("mint.refresh.preparedTitle")}
          </Cell>
        )}
      </Section>
    </div>
  );
}
