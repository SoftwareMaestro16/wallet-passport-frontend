import type { MintPrepareResponse } from "../../api/client";

/**
 * Builds the TonConnect `sendTransaction` request for the mint_or_refresh message.
 *
 * STUBBED: the exact BOC/cell layout depends on PassportCollection's expected internal
 * message body (opcode + permit cell + signature cell, per ARCHITECTURE.md §5 "signed
 * -authorization flow" and §6 "deterministic slot addressing"), which is being built in
 * parallel in `contracts/`. Once `contracts/README.md` (or SMART-CONTRACTS.md) documents the
 * real TL-B layout and opcode, replace `encodeMintPayload` below with a proper cell built via
 * `@ton/core`'s `beginCell()...endCell().toBoc().toString("base64")`, matching whatever
 * `mint_or_refresh` expects (likely: opcode, category id, permit cell ref, signature ref).
 * Everything in this file is the only place that needs to change — callers only see
 * `buildMintTransactionRequest(prepared)`.
 *
 * Until then this at least exercises the full flow (prepare -> build -> sendTransaction ->
 * UI state machine) end-to-end against a mocked/dummy backend response.
 */
export function buildMintTransactionRequest(prepared: MintPrepareResponse) {
  return {
    validUntil: Math.floor(Date.now() / 1000) + 5 * 60,
    messages: [
      {
        address: prepared.collectionAddress,
        amount: "50000000", // 0.05 TON placeholder gas budget — confirm against contract's actual gas requirements.
        // TODO: match PassportCollection mint_or_refresh message layout once contracts/README.md is available.
        payload: encodeMintPayload(prepared),
      },
    ],
  };
}

function encodeMintPayload(prepared: MintPrepareResponse): string {
  // Placeholder only — NOT a valid TON message cell. Prevents accidental use by making the
  // intent obvious if inspected in devtools/network logs during the stub period.
  const stub = JSON.stringify({ __stub: true, permit: prepared.permit, signature: prepared.signature });
  return btoa(stub);
}
