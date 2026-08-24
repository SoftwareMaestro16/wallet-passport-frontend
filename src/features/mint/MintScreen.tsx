import { useState } from "react";
import { useTranslation } from "react-i18next";
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

const CATEGORY = "MAIN" as const;

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

  async function handleMint() {
    setState({ status: "preparing" });
    try {
      const prepared = await api.prepareMint(CATEGORY, getTelegramInitData());
      setState({ status: "pending" });

      const tx = buildMintTransactionRequest(prepared);
      const result = await tonConnectUI.sendTransaction(tx);

      setState({ status: "success", txHash: result.boc?.slice(0, 16) });
    } catch (err) {
      const detail = backendErrorMessage(err) ?? (err instanceof ApiError ? `(${err.status})` : undefined);
      const message = detail ? `${t("mint.statusError")} ${detail}` : t("mint.statusError");
      setState({ status: "error", message });
    }
  }

  const isBusy = state.status === "preparing" || state.status === "pending";

  return (
    <div className="screen mint-screen">
      <h1>{t("mint.title")}</h1>
      <p>{t("mint.description")}</p>
      <TestnetGuard />

      {!isConnected && <p className="hint">{t("mint.notConnected")}</p>}

      {state.status !== "error" && (
        <button type="button" className="primary-btn" disabled={!isConnected || isBusy} onClick={handleMint}>
          {t("mint.mintButton")}
        </button>
      )}

      {state.status === "error" && (
        <div className="error-box">
          <p>{state.message}</p>
          <button type="button" onClick={handleMint}>
            {t("mint.retry")}
          </button>
        </div>
      )}

      <p className="hint status-line">
        {state.status === "idle" && t("mint.statusIdle")}
        {(state.status === "preparing" || state.status === "pending") && t("mint.statusPending")}
        {state.status === "success" && t("mint.statusSuccess")}
      </p>
    </div>
  );
}
