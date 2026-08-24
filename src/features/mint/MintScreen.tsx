import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTonConnectAccount } from "../../ton/useTonConnectAccount";
import { getTelegramInitData } from "../../app/telegram";
import { api, ApiError, type MintPrepareResponse } from "../../api/client";
import { TestnetGuard } from "../../shared/TestnetGuard";

type MintState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "pending" }
  | { status: "success"; txHash?: string }
  | { status: "error"; message: string };

const CATEGORY = "MAIN" as const;

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
      const message = err instanceof ApiError ? `${t("mint.statusError")} (${err.status})` : t("mint.statusError");
      setState({ status: "error", message });
    }
  }

  return (
    <div className="screen mint-screen">
      <h1>{t("mint.title")}</h1>
      <p>{t("mint.description")}</p>
      <TestnetGuard />

      {!isConnected && <p className="hint">{t("mint.notConnected")}</p>}

      <button
        type="button"
        className="primary-btn"
        disabled={!isConnected || state.status === "preparing" || state.status === "pending"}
        onClick={handleMint}
      >
        {t("mint.mintButton")}
      </button>

      <p className="hint status-line">
        {state.status === "idle" && t("mint.statusIdle")}
        {state.status === "preparing" && t("mint.statusPending")}
        {state.status === "pending" && t("mint.statusPending")}
        {state.status === "success" && t("mint.statusSuccess")}
        {state.status === "error" && state.message}
      </p>
    </div>
  );
}

/**
 * Builds the TonConnect `sendTransaction` request for the mint_or_refresh message.
 *
 * STUBBED: the exact BOC/cell layout depends on PassportCollection's expected internal
 * message body (opcode + permit cell + signature cell, per ARCHITECTURE.md §5 "signed
 * -authorization flow" and §6 "deterministic slot addressing"), which is being built in
 * parallel in `contracts/`. Once `contracts/README.md` (or SMART-CONTRACTS.md) documents the
 * real TL-B layout and opcode, replace the `payload` below with a proper cell built via
 * `@ton/core`'s `beginCell()...endCell().toBoc().toString("base64")`, matching whatever
 * `mint_or_refresh` expects (likely: opcode, category id, permit cell ref, signature ref).
 *
 * Until then this at least exercises the full flow (prepare -> build -> sendTransaction ->
 * UI state machine) end-to-end against a mocked/dummy backend response.
 */
function buildMintTransactionRequest(prepared: MintPrepareResponse) {
  // TODO: match PassportCollection mint_or_refresh message layout once contracts/README.md is available.
  // For now we forward the backend-provided permit/signature as opaque base64 strings; this WILL need
  // to become a proper Cell built with @ton/core once the contract's exact TL-B schema is known.
  return {
    validUntil: Math.floor(Date.now() / 1000) + 5 * 60,
    messages: [
      {
        address: prepared.collectionAddress,
        amount: "50000000", // 0.05 TON placeholder gas budget — confirm against contract's actual gas requirements.
        // TODO: replace with a real BOC once the mint_or_refresh cell layout is finalized.
        payload: encodeStubPayload(prepared),
      },
    ],
  };
}

function encodeStubPayload(prepared: MintPrepareResponse): string {
  // Placeholder only — NOT a valid TON message cell. Prevents accidental use by making the
  // intent obvious if inspected in devtools/network logs during the stub period.
  const stub = JSON.stringify({ __stub: true, permit: prepared.permit, signature: prepared.signature });
  return btoa(stub);
}
