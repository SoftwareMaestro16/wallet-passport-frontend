import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTonConnectAccount } from "../../ton/useTonConnectAccount";
import { useTonProof } from "../../ton/useTonProof";
import { ScoreBar } from "../../shared/ScoreBar";
import { TestnetGuard } from "../../shared/TestnetGuard";
import type { TonProofVerifyResponse } from "../../api/client";

type VerifyState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "success"; data: TonProofVerifyResponse }
  | { status: "error" };

export function ProfileScreen() {
  const { t } = useTranslation();
  const { isConnected, address, tonConnectUI } = useTonConnectAccount();
  const { verify, hasProof } = useTonProof();
  const [state, setState] = useState<VerifyState>({ status: "idle" });

  useEffect(() => {
    if (!isConnected || !hasProof || state.status !== "idle") return;

    setState({ status: "verifying" });
    verify()
      .then((data) => setState({ status: "success", data }))
      .catch(() => setState({ status: "error" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, hasProof]);

  if (!isConnected) {
    return (
      <div className="screen profile-screen">
        <h1>{t("profile.title")}</h1>
        <p>{t("mint.notConnected")}</p>
      </div>
    );
  }

  return (
    <div className="screen profile-screen">
      <h1>{t("profile.title")}</h1>
      <TestnetGuard />

      <div className="wallet-row">
        <span className="wallet-label">{t("profile.walletLabel")}</span>
        <span className="wallet-address">{shortAddress(address)}</span>
      </div>

      {state.status === "verifying" && <p className="hint">{t("profile.verifying")}</p>}

      {state.status === "error" && (
        <div className="error-box">
          <p>{t("profile.verifyError")}</p>
          <button type="button" onClick={() => setState({ status: "idle" })}>
            {t("profile.retry")}
          </button>
        </div>
      )}

      {state.status === "success" && (
        <>
          <ScoreBar score={state.data.profile.scoreDisplay ?? 0} label={t("profile.scoreLabel")} />
          <p className="hint">{t("profile.comingSoon")}</p>
        </>
      )}

      {state.status === "idle" && !hasProof && (
        // Wallet connected without a ton_proof result yet (e.g. proof payload fetch
        // failed and connect proceeded without it) — nothing to verify against.
        <p className="hint">{t("profile.verifyError")}</p>
      )}

      <button type="button" className="secondary-btn" onClick={() => tonConnectUI.disconnect()}>
        {t("profile.disconnect")}
      </button>
    </div>
  );
}

function shortAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
