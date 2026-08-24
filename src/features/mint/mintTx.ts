import { Address, beginCell, Cell } from "@ton/core";
import type { MintPermit, MintPrepareResponse } from "../../api/client";

/**
 * Builds the TonConnect `sendTransaction` request for the `MintOrRefresh` message, per the ACTUAL
 * deployed contract's struct (contracts/src/common/messages.tolk — DESIGN.md's §5 code block
 * predates the `content` field being added and is stale on this point):
 *
 *   struct (0x70617373) MintOrRefresh {
 *       queryId: uint64
 *       permit: Cell<Permit>   // separate ref cell
 *       signature: bits512
 *       content: cell          // TEP-64 on-chain content cell; permit.metadataHash == content.hash()
 *   }
 *
 * The client never signs anything and never builds the content cell itself — it only
 * reconstructs the exact Permit cell the backend already hashed and signed (see buildPermitCell
 * below), and attaches the backend-provided `content` BOC (`MintPrepareResponse.content`)
 * byte-for-byte unmodified. Re-encoding `content` client-side (even to a semantically identical
 * cell) would change its hash and break the on-chain `content.hash() == permit.metadataHash`
 * check, which is exactly why the backend ships the already-built cell as opaque bytes rather
 * than a JSON shape the client would have to re-serialize.
 *
 * Permit itself is split head + 2 refs per contracts/DESIGN.md §5.1 / contracts/src/common/
 * messages.tolk (locked layout — a flat single-cell Permit overflows the 1023-bit limit):
 *
 *   Permit (head, 2 refs): protocolId, networkId, identity^, metadataHash, snapshotHash,
 *                          audit^, requestId, validSince, validTill
 *   PermitIdentity (ref 1): collectionAddress, ownerWallet, action, categoryId,
 *                          expectedRevision, newRevision
 *   PermitAudit (ref 2): evidenceRoot, referrerWallet?, referralReward, mintPrice, itemReserve
 *
 * Field order within each cell must match the Tolk struct declaration order exactly — any other
 * grouping produces a different HASHCU and invalidates the backend's Ed25519 signature.
 */

const MINT_OR_REFRESH_OPCODE = 0x70617373;

export function buildMintTransactionRequest(prepared: MintPrepareResponse) {
  return {
    validUntil: Math.floor(Date.now() / 1000) + 5 * 60,
    messages: [
      {
        address: prepared.collectionAddress,
        amount: computeMintAmount(prepared.permit).toString(),
        payload: buildMintOrRefreshCell(prepared).toBoc().toString("base64"),
      },
    ],
  };
}

/**
 * contracts/DESIGN.md §10: the contract enforces `msg.value >= permit.mintPrice +
 * permit.itemReserve`, plus `permit.referralReward` when there's a referrer (paid out of the
 * same incoming value, not on top of it — see the §10 worked example: 0.300 TON in =
 * 0.040 itemReserve + 0.020 referralReward + rest as mintPrice/revenue/fees). The permit is
 * backend-signed and already includes headroom for network fees, so we send exactly
 * mintPrice + itemReserve + referralReward and nothing else — never a hardcoded placeholder.
 */
function computeMintAmount(permit: MintPermit): bigint {
  return BigInt(permit.mintPrice) + BigInt(permit.itemReserve) + BigInt(permit.referralReward);
}

function buildMintOrRefreshCell(prepared: MintPrepareResponse) {
  const signature = base64ToBytes(prepared.signature);
  if (signature.length !== 64) {
    throw new Error(`Expected a 64-byte (512-bit) Ed25519 signature, got ${signature.length} bytes`);
  }

  // Parsed unmodified from the backend's BOC — see MintPrepareResponse.content's doc comment for
  // why this must never be re-derived/re-encoded client-side.
  const contentCell = Cell.fromBoc(Buffer.from(prepared.content, "base64"))[0];

  return beginCell()
    .storeUint(MINT_OR_REFRESH_OPCODE, 32)
    .storeUint(0, 64) // queryId — no client-side correlation needed yet, always 0 until a UI use case requires it
    .storeRef(buildPermitCell(prepared.permit))
    .storeBuffer(Buffer.from(signature))
    .storeRef(contentCell)
    .endCell();
}

/** contracts/DESIGN.md §5.1 PermitIdentity — ref 1 off the Permit head cell. */
function buildPermitIdentityCell(permit: MintPermit) {
  return beginCell()
    .storeAddress(Address.parse(permit.collectionAddress))
    .storeAddress(Address.parse(permit.ownerWallet))
    .storeUint(permit.action, 8)
    .storeUint(permit.categoryId, 8)
    .storeUint(permit.expectedRevision, 32)
    .storeUint(permit.newRevision, 32)
    .endCell();
}

/** contracts/DESIGN.md §5.1 PermitAudit — ref 2 off the Permit head cell. */
function buildPermitAuditCell(permit: MintPermit) {
  return beginCell()
    .storeUint(hexToBigInt(permit.evidenceRoot), 256)
    .storeAddress(permit.referrerWallet ? Address.parse(permit.referrerWallet) : null)
    .storeCoins(BigInt(permit.referralReward))
    .storeCoins(BigInt(permit.mintPrice))
    .storeCoins(BigInt(permit.itemReserve))
    .endCell();
}

/**
 * Encodes the Permit head cell per contracts/DESIGN.md §5.1 (locked): protocolId, networkId,
 * identity^, metadataHash, snapshotHash, audit^, requestId, validSince, validTill — exactly the
 * Tolk struct's declared field order, with identity/audit split into their own ref cells.
 */
function buildPermitCell(permit: MintPermit) {
  return beginCell()
    .storeUint(permit.protocolId, 32)
    .storeUint(permit.networkId, 32)
    .storeRef(buildPermitIdentityCell(permit))
    .storeUint(hexToBigInt(permit.metadataHash), 256)
    .storeUint(hexToBigInt(permit.snapshotHash), 256)
    .storeRef(buildPermitAuditCell(permit))
    .storeUint(BigInt(permit.requestId), 64)
    .storeUint(permit.validSince, 32)
    .storeUint(permit.validTill, 32)
    .endCell();
}

function hexToBigInt(hex: string): bigint {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return BigInt(`0x${clean || "0"}`);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
