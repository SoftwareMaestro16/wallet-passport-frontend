# Wallet Passport — Telegram Mini App (client)

Testnet-only MVP frontend for Wallet Passport. Vite + React + TypeScript + `@tonconnect/ui-react` +
`@telegram-apps/telegram-ui`. See `../ARCHITECTURE.md` for the full system picture.

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

## UI kit — `@telegram-apps/telegram-ui`

Every screen is built from this kit's primitives (`Section`, `Cell`, `Button`, `Tabbar`, `Banner`,
`SegmentedControl`, `Progress`, `Spinner`, `Avatar`, `Badge`, ...) instead of hand-rolled HTML/CSS,
so the app reads as a native Telegram surface rather than a generic web page. `TonConnectButton`
(from `@tonconnect/ui-react`) is the one exception — TonConnect owns that component, we only style
its surrounding layout with the kit.

**Anything new under `src/features/*` or `src/shared/*` must be built from this kit's components,
not raw `<div>`/`<button>` markup** — that's how the app stays visually consistent and picks up
theme/platform changes for free.

The whole tree is wrapped in the kit's `AppRoot` (`src/App.tsx`), which needs `platform`
(`"ios" | "base"`) and `appearance` (`"light" | "dark"`) to render Telegram's actual look instead of
guessing from `prefers-color-scheme`. `useTelegramAppearance()` (`src/app/telegram.ts`) derives both
from `@twa-dev/sdk`'s `WebApp.platform`/`WebApp.colorScheme` and re-reads appearance on Telegram's
`themeChanged` event. **Any screen added later must render inside `AppRoot` (it already does, by
virtue of being routed inside `AppShell`) — don't reach for the kit's components outside that tree,
their styling depends on `AppRoot`'s context.**

Import `@telegram-apps/telegram-ui/dist/styles.css` once near the root (already done in `App.tsx`,
before `./App.css` so local overrides still win the cascade).

## Telegram WebApp bootstrap

`src/app/telegram.ts` wraps `@twa-dev/sdk`. `bootstrapTelegram()` (called once in `main.tsx`) calls
`WebApp.ready()`/`expand()` and maps Telegram's theme params onto CSS vars
(`--tg-theme-bg-color`, `--tg-theme-button-color`, etc.) on `<html>`. `src/App.css`/`src/index.css`
consume those directly for the few bits of layout the kit doesn't own, and — importantly —
telegram-ui's own `--tgui--*` design tokens (`AppRoot`'s CSS) default to reading the *same*
`--tg-theme-*` vars (e.g. `--tgui--bg_color: var(--tg-theme-bg-color, #fff)`), so this one bit of
bootstrap code feeds both the legacy vars and the new kit's palette with the host Telegram client's
real per-user theme colors, not just a light/dark boolean.

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

Per `TON_Relics_Technical_Spec_v0.5.docx` §23 the intended flow is Landing → Scanning → Reveal;
today that maps to Connect → Scanning → Profile (Profile stands in for "Reveal" until the real
scoring engine exists server-side). `src/App.tsx` hides the `Tabbar` while on `/scanning` so the
user isn't tempted to bail into another tab mid-scan.

- **Connect** (`src/features/connect`) — value prop copy (RU/EN), `TonConnectButton`, a static
  sample score card (mock data, not wired to any API). Once connected and `ton_proof`-verified
  (via the shared `useVerifiedProfile` hook, see below), shows a "Generate"/"Сгенерировать" button
  that navigates to `/scanning`.
- **Scanning** (`src/features/scanning`) — animated progress screen (kit `Spinner` + `Progress` +
  a rotating status line cycling through `scanning.steps.0..6`), reached from Connect's "Generate"
  button, auto-navigates to `/profile` when done (or immediately on "Skip"). **This is a UI-only
  simulation** — `src/features/scanning/useScanProgress.ts` drives it off a `setInterval` sized to
  land in the product spec's real 60-120s deep-scan window (currently ~75s), because there is no
  backend scan/scoring endpoint yet (that's its own much larger milestone: TON Center ingestion,
  transaction canonicalization, the real scoring formula). `ScanningScreen.tsx` only ever reads
  `{ stepIndex, progressPct, done }` and calls `skip()` from that hook, so swapping the simulated
  timer for a real `GET /wallets/:address/scan-status`-style poll later is a one-file change.
- **Profile** (`src/features/profile`) — after connect, runs the `ton_proof` flow
  (`src/ton/useTonProof.ts`) via the shared `src/ton/useVerifiedProfile.ts` hook (also used by
  Connect to gate the "Generate" button, so both screens agree on one verify-on-connect flow):
  fetches a challenge payload from the backend, attaches it to TonConnect's connect request via
  `setConnectRequestParameters` so the wallet signs it as part of connecting, then POSTs the signed
  proof to the backend for verification. Shows a score bar + "coming soon" placeholder on success
  (backend has no real scoring yet).
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
- [ ] Replace the simulated timer in `src/features/scanning/useScanProgress.ts` with a real
      scan-status poll once the backend exposes one — `ScanningScreen.tsx` shouldn't need to change.
- [ ] Consider code-splitting (`vite build` currently warns about a >500kB chunk — fine for MVP,
      worth revisiting before a real launch).

## Git

Repo is initialized locally with an initial commit. Remote `origin` is set to
`https://github.com/SoftwareMaestro16/wallet-passport-frontend.git` but **not pushed** — push
separately once GitHub auth is confirmed.
