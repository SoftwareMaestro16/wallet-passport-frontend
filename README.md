# Wallet Passport — Telegram Mini App (client)

Testnet-only MVP frontend for Wallet Passport. Vite + React + TypeScript + `@tonconnect/ui-react`.
See `../ARCHITECTURE.md` for the full system picture.

## Setup

```bash
npm install
cp .env.example .env   # then edit VITE_API_BASE_URL if needed
npm run dev
```

Build: `npm run build`. Preview inside Telegram requires an HTTPS tunnel (ngrok/cloudflared) pointed
at the dev server, registered as a Mini App with @BotFather.

## Env vars

- `VITE_API_BASE_URL` — base URL of the backend API (see `../server`). Placeholder in
  `.env.example` points at `https://walletpassport-185-163-47-190.sslip.io/api`, the sslip.io box
  used during early development. **Update once the real backend domain/routing is finalized.**

## i18n

`i18next` + `react-i18next`, two flat locale files: `src/locales/ru.json` (primary/default) and
`src/locales/en.json`. Language resolution order (`src/app/i18n.ts`):

1. `localStorage["wallet-passport-lang"]` if the user already picked one via the switcher.
2. Telegram's `WebApp.initDataUnsafe.user.language_code` — `ru` stays `ru`, everything else falls
   back to `en`.
3. Default: `ru`.

The switcher (top-right corner, `src/shared/LanguageSwitcher.tsx`) lets the user override
auto-detection at any time.

## Telegram WebApp bootstrap

`src/app/telegram.ts` wraps `@twa-dev/sdk`. `bootstrapTelegram()` (called once in `main.tsx`) calls
`WebApp.ready()`/`expand()` and maps Telegram's theme params onto CSS vars
(`--tg-theme-bg-color`, `--tg-theme-button-color`, etc.), which `src/App.css` consumes so the app
follows the host Telegram client's light/dark theme instead of looking like a bare webpage.

`getTelegramInitData()` returns the raw, still-signed `initData` string, sent as an
`X-Telegram-Init-Data` header on API calls (see `src/api/client.ts`) — the backend re-validates it
per `TMAGUIDE.md` §2; the client never parses/trusts it itself.

## TonConnect — testnet

**There is no single `network: testnet` switch** in current `@tonconnect/ui-react` — TonConnect is
wallet-agnostic, and which chain a wallet is on is reported by the wallet after connecting
(`wallet.account.chain`, a `CHAIN` value from `@tonconnect/sdk`: `CHAIN.TESTNET === "-3"`).

The approach used here (see the long comment in `src/ton/TonConnectProvider.tsx`):

1. Ship a normal manifest (`public/tonconnect-manifest.json`) — any testnet-capable wallet
   (Tonkeeper testnet build, MyTonWallet testnet toggle, TON Space testnet) connects fine against it.
2. `src/ton/useTonConnectAccount.ts` exposes `isTestnet` (`wallet.account.chain === CHAIN.TESTNET`).
3. `src/shared/TestnetGuard.tsx` renders a warning banner on Connect/Profile/Mint whenever a wallet
   is connected but reporting mainnet, asking the user to switch their wallet to testnet.
4. **This is a client-side UX nicety only, not a trust boundary.** The backend must independently
   re-check the chain on every `ton_proof` verify and mint-prepare call — a malicious client could
   trivially skip step 3.

If a future `@tonconnect/ui-react` release adds a first-class testnet flag or a
`walletsListConfiguration` filter for testnet-only wallets, prefer that and remove this workaround.

### `tonconnect-manifest.json`

`public/tonconnect-manifest.json` uses `https://walletpassport-185-163-47-190.sslip.io` as a
placeholder `url`/`iconUrl` domain — **this MUST match wherever the Mini App is actually hosted**,
since wallets validate the manifest's `url` against the page origin. Update this file (and
`VITE_API_BASE_URL`) together once the real deploy domain is known.

## Screens

- **Connect** (`src/features/connect`) — value prop copy (RU/EN), `TonConnectButton`, a static
  sample score card (mock data, not wired to any API).
- **Profile** (`src/features/profile`) — after connect, runs the `ton_proof` flow
  (`src/ton/useTonProof.ts`): fetches a challenge payload from the backend, attaches it to
  TonConnect's connect request via `setConnectRequestParameters` so the wallet signs it as part of
  connecting, then POSTs the signed proof to the backend for verification. Shows a score bar +
  "coming soon" placeholder on success (backend has no real scoring yet).
- **Mint** (`src/features/mint`) — "Mint TON Passport (testnet)" for category `MAIN`. Calls
  `GET /passports/MAIN/mint/prepare`, gets back `{ permit, signature, collectionAddress }`, and
  drives an idle → preparing → pending → success/error UI state machine around
  `tonConnectUI.sendTransaction(...)`.

  **Stubbed on purpose:** the cell-encoding is isolated in `src/features/mint/mintTx.ts`
  (`buildMintTransactionRequest` / `encodeMintPayload`) — it does NOT build a real TON message
  cell, it base64-encodes a JSON placeholder so the flow is exercisable end-to-end today.
  `MintScreen.tsx` only imports `buildMintTransactionRequest` and never sees the encoding; it
  owns the idle → preparing → pending → success/error state machine, backend error-message
  surfacing (`err.body.message` when the API returns one, falling back to the HTTP status), and
  a retry affordance on failure. The actual `mint_or_refresh` message body (opcode + permit cell
  ref + signature ref, per `ARCHITECTURE.md` §5/§6) is being designed in parallel in
  `contracts/`. Search for:

  ```
  // TODO: match PassportCollection mint_or_refresh message layout once contracts/README.md is available.
  ```

  Once `contracts/README.md` or `SMART-CONTRACTS.md` documents the real TL-B layout, replace the
  stub in `mintTx.ts` with a proper `@ton/core` `beginCell()...endCell()` BOC — that file is the
  only thing that should need to change.

## API client

`src/api/client.ts` — small typed `fetch` wrapper (`apiClient.get/post`) pointed at
`VITE_API_BASE_URL`, plus a thin `api.*` layer with the endpoint shapes this app currently expects
(`getTonProofPayload`, `verifyTonProof`, `prepareMint`). These are best-guess shapes based on
`ARCHITECTURE.md`/`TMAGUIDE.md` — **adjust to match `server/src/http` routes once they exist.**

## TODO before this is real

- [ ] Confirm real backend routes/response shapes for `auth/ton-proof/*` and
      `passports/:category/mint/prepare`; update `src/api/client.ts` types accordingly.
- [ ] Replace the mint cell stub (`src/features/mint/mintTx.ts`) once
      `contracts/README.md` documents the `mint_or_refresh` message layout.
- [ ] Point `public/tonconnect-manifest.json` and `.env.example` at the real deploy domain.
- [ ] Wire the real score/domain-card data into Profile once the scoring engine exists
      (`SCORING.md`, not yet written per `ARCHITECTURE.md`).
- [ ] Consider code-splitting (`vite build` currently warns about a >500kB chunk — fine for MVP,
      worth revisiting before a real launch).

## Git

Repo is initialized locally with an initial commit. Remote `origin` is set to
`https://github.com/SoftwareMaestro16/wallet-passport-frontend.git` but **not pushed** — push
separately once GitHub auth is confirmed.
