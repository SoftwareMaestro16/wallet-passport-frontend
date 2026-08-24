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

export interface MintPrepareResponse {
  permit: string;
  signature: string;
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
