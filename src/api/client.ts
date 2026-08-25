// Falls back to the known-good testnet backend when VITE_API_BASE_URL isn't set at build time
// (e.g. the Vercel dashboard env var hasn't been configured) — an empty fallback silently sends
// every request to this app's own origin instead, which 404s on every route since this is a
// static frontend with no API routes of its own.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://walletpassport-185-163-47-190.sslip.io";

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
    // The API and this static frontend are on different origins by design (no shared domain),
    // so the session cookie (server/src/auth/session.ts) needs an explicit opt-in to cross-origin
    // credentials — the server's CORS config allows it for this exact origin, but the browser
    // still won't attach/store the cookie without this on every request.
    credentials: "include",
    headers: {
      // Fastify's default JSON parser rejects an empty body when this header is present
      // (FST_ERR_CTP_EMPTY_JSON_BODY) — only send it when there's an actual body to parse.
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
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

export interface TelegramAuthResponse {
  user: { id: string; username: string | null; referralCode: string };
  expiresAt: string;
}

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
  /**
   * Base64 BOC of the exact `ItemContentEnvelope{displayName, tep64Content}` cell
   * (contracts/src/common/structs.tolk) the backend hashed into `permit.metadataHash`. Must be
   * attached UNMODIFIED as the 4th field of `MintOrRefresh` (contracts/src/common/messages.tolk)
   * — see client/src/features/mint/mintTx.ts. Never re-encode this client-side: doing so
   * produces a different cell (even if semantically identical), which changes `content.hash()`
   * and makes the on-chain `content.hash() == permit.metadataHash` check fail.
   */
  content: string;
}

// ---- Wallet scan / profile / passports (Scan Wallet feature) ---------------
// Shapes mirror server/src/http/routes/wallets.ts and server/src/domain/metrics/{score,rawStats}.ts
// directly (read there before changing these, they are not guesses).

export type ScanJobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export interface ScanStartResponse {
  jobId: string;
  status: ScanJobStatus;
  walletAddress: string;
}

export interface ScanStatusResponse {
  jobId: string;
  walletAddress: string;
  status: ScanJobStatus;
  txFetched: number;
  txTotal: number | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  /**
   * Being added concurrently server-side alongside this client work — may be briefly absent
   * during rollout (older ScanJob rows, or a server build that hasn't shipped it yet). Every
   * reader of this field must treat `undefined` as "no phase signal", never as an error.
   */
  phase?: string;
}

export type ScoreFactorCode = "A" | "C" | "E" | "O" | "D" | "N" | "S" | "B";

export interface ScoreFactor {
  code: ScoreFactorCode;
  factor: string;
  value: number;
}

export interface WalletScoreResult {
  tonScore: number; // 0..1000
  tier: string;
  core: number;
  specialization: number;
  base: number;
  factors: ScoreFactor[];
}

export interface DataConfidence {
  jettonDataAvailable: boolean;
  nftDataAvailable: boolean;
  stakingDataAvailable: boolean;
  overallScore: number;
}

export interface RawWalletStats {
  walletAddress: string;
  firstTxAt: string | null;
  walletAgeDays: number;
  activeDaysCount: number;
  activeMonthsCount: number;
  totalTxCount: number;
  successfulTxCount: number;
  uniqueCounterpartyCount: number;
  uniqueContractLikeCount: number;
  deploymentCount: number;
  feesPaidNanoTon: string;
  rawInboundNanoTon: string;
  rawOutboundNanoTon: string;
  economicVolumeNanoTon: string;
  jettonTransferCount: number;
  jettonBurnCount: number;
  uniqueJettonMasterCount: number;
  nftTransferCount: number;
  uniqueNftCollectionCount: number;
  stakingPositionCount: number;
  dataConfidence: DataConfidence;
}

export interface WalletProfileResponse {
  walletAddress: string;
  isOwnWallet: boolean;
  scan: {
    jobId: string;
    scanUpperLt: string | null;
    completedAt: string | null;
  };
  score: WalletScoreResult;
  stats: RawWalletStats;
}

/**
 * `GET /wallets/:address/passports` is being added concurrently by another agent and may 404
 * until it ships — every caller must treat that as "hide the section", never a crash.
 */
export type PassportCategoryName =
  | "MAIN"
  | "PIONEER"
  | "OPERATOR"
  | "DEFI"
  | "COLLECTOR"
  | "STAKER"
  | "BUILDER";

export interface WalletPassportCategoryStatus {
  categoryId: string;
  category: PassportCategoryName;
  eligible: boolean;
  exists: boolean;
  revision: number;
  canMint: boolean;
  canRefresh: boolean;
}

export interface WalletPassportsResponse {
  walletAddress: string;
  categories: WalletPassportCategoryStatus[];
}

export const api = {
  // Must succeed before verifyTonProof: that route requires an existing session cookie, which
  // only this call issues (see server/src/http/routes/auth.ts). initData is sent as a header on
  // every request already, but nothing lazily creates the session/user from it — this is the one
  // explicit login step.
  telegramAuth: (initData: string) =>
    apiClient.post<TelegramAuthResponse>("/auth/telegram", { initData }, { initData }),

  getTonProofPayload: (initData: string) =>
    apiClient.post<TonProofPayloadResponse>("/auth/ton-proof/payload", undefined, { initData }),

  verifyTonProof: (payload: TonProofVerifyRequest, initData: string) =>
    apiClient.post<TonProofVerifyResponse>("/auth/ton-proof/verify", payload, { initData }),

  prepareMint: (category: "passport", initData: string) =>
    apiClient.get<MintPrepareResponse>(`/passports/${category}/mint/prepare`, { initData }),

  startWalletScan: (address: string) =>
    apiClient.post<ScanStartResponse>(`/wallets/${encodeURIComponent(address)}/scan`),

  getScanStatus: (address: string) =>
    apiClient.get<ScanStatusResponse>(`/wallets/${encodeURIComponent(address)}/scan-status`),

  getWalletProfile: (address: string) =>
    apiClient.get<WalletProfileResponse>(`/wallets/${encodeURIComponent(address)}/profile`),

  getWalletPassports: (address: string) =>
    apiClient.get<WalletPassportsResponse>(`/wallets/${encodeURIComponent(address)}/passports`),
};
