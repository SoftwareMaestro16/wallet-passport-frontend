const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Telegram initData string, sent as a header for backend auth (see TMAGUIDE.md §2). */
  initData?: string;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, initData, headers, ...rest } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(initData ? { "X-Telegram-Init-Data": initData } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, data, `Request to ${path} failed with ${res.status}`);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
};

// ---- Typed endpoint helpers -------------------------------------------------
// Shapes mirror ARCHITECTURE.md §5 (signed-authorization flow) and the TonConnect
// ton_proof flow from TMAGUIDE.md §3. Adjust once server/src/http routes are finalized.

export interface TonProofPayloadResponse {
  payload: string;
}

export interface TonProofVerifyRequest {
  address: string;
  network: string;
  publicKey?: string;
  walletStateInit?: string;
  proof: {
    timestamp: number;
    domain: { lengthBytes: number; value: string };
    signature: string;
    payload: string;
  };
}

export interface TonProofVerifyResponse {
  sessionToken: string;
  profile: {
    walletAddress: string;
    scoreDisplay?: number;
  };
}

/**
 * Flat API shape for the `Permit` struct in contracts/DESIGN.md §5.1 / contracts/src/common/
 * messages.tolk. `mintTx.ts` groups these fields into the locked 3-cell (head + PermitIdentity
 * ref + PermitAudit ref) layout when building the on-chain cell — the wire/API shape doesn't
 * need to mirror the cell grouping, only the cell-building code does.
 */
export interface MintPermit {
  /** Deploy-time config echoed by the backend (contracts/DESIGN.md §5.1) — never hardcode. */
  protocolId: number;
  /** Deploy-time chain id echoed by the backend (contracts/DESIGN.md §5.1) — never hardcode. */
  networkId: number;
  collectionAddress: string;
  ownerWallet: string;
  /** ACTION_MINT = 1 | ACTION_REFRESH = 2 (uint8, contracts/src/common/messages.tolk). */
  action: number;
  categoryId: number;
  expectedRevision: number;
  newRevision: number;
  /** 256-bit values as 64-char hex strings (no 0x prefix). */
  metadataHash: string;
  snapshotHash: string;
  evidenceRoot: string;
  /** Null when there's no referrer. */
  referrerWallet: string | null;
  /** nanoTON amounts as decimal strings (avoids float precision loss). */
  referralReward: string;
  mintPrice: string;
  itemReserve: string;
  requestId: string;
  validSince: number;
  validTill: number;
}

export interface MintPrepareResponse {
  permit: MintPermit;
  signature: string; // base64-encoded 512-bit Ed25519 signature
  collectionAddress: string;
}

export const api = {
  getTonProofPayload: (initData: string) =>
    apiClient.get<TonProofPayloadResponse>("/auth/ton-proof/payload", { initData }),

  verifyTonProof: (payload: TonProofVerifyRequest, initData: string) =>
    apiClient.post<TonProofVerifyResponse>("/auth/ton-proof/verify", payload, { initData }),

  prepareMint: (category: "MAIN", initData: string) =>
    apiClient.get<MintPrepareResponse>(`/passports/${category}/mint/prepare`, { initData }),
};
