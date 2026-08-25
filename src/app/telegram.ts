import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";

/**
 * Thin wrapper around @twa-dev/sdk's WebApp singleton.
 * Call `bootstrapTelegram()` once on app mount (see src/main.tsx).
 */
export function bootstrapTelegram(): void {
  try {
    WebApp.ready();
    WebApp.expand();
    applyThemeVars();
    WebApp.onEvent("themeChanged", applyThemeVars);
  } catch {
    // Not running inside Telegram (e.g. plain browser during dev) — safe to ignore,
    // @twa-dev/sdk falls back to mocked values so the app still renders.
  }
}

/**
 * Maps Telegram's theme params onto CSS custom properties so regular CSS
 * can reference `var(--tg-theme-bg-color)` etc. and the app looks native
 * inside the Telegram client (light/dark, per-client accent colors).
 */
function applyThemeVars(): void {
  const root = document.documentElement.style;
  const theme = WebApp.themeParams;

  const map: Record<string, string | undefined> = {
    "--tg-theme-bg-color": theme.bg_color,
    "--tg-theme-text-color": theme.text_color,
    "--tg-theme-hint-color": theme.hint_color,
    "--tg-theme-link-color": theme.link_color,
    "--tg-theme-button-color": theme.button_color,
    "--tg-theme-button-text-color": theme.button_text_color,
    "--tg-theme-secondary-bg-color": theme.secondary_bg_color,
    "--tg-theme-header-bg-color": theme.header_bg_color,
    "--tg-theme-accent-text-color": theme.accent_text_color,
    "--tg-theme-section-bg-color": theme.section_bg_color,
    "--tg-theme-subtitle-text-color": theme.subtitle_text_color,
    "--tg-theme-destructive-text-color": theme.destructive_text_color,
  };

  for (const [key, value] of Object.entries(map)) {
    if (value) root.setProperty(key, value);
  }

  document.body.style.backgroundColor = "var(--tg-theme-bg-color, #ffffff)";
  document.body.style.color = "var(--tg-theme-text-color, #111111)";
}

/** Telegram's `language_code` for the current user, e.g. "ru", "en", "uk". */
export function getTelegramLanguageCode(): string | undefined {
  try {
    // Same @twa-dev/sdk initData bug as getTelegramInitData below — read the raw global directly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  } catch {
    return undefined;
  }
}

/**
 * Raw initData string — sent to the backend for Telegram auth validation. Never parsed/trusted
 * client-side.
 *
 * Deliberately reads `window.Telegram.WebApp.initData` directly instead of `@twa-dev/sdk`'s
 * imported `WebApp` singleton. Confirmed via production diagnostics (2026-08-25): on Telegram
 * Desktop, with the exact same `location.hash` present and non-empty in both cases,
 * `window.Telegram.WebApp.initData` correctly returned the real value while `@twa-dev/sdk`
 * (v8.0.2) `WebApp.initData` returned an empty string every time — a bug/stale-reference
 * somewhere in that package's own hash parsing, not a timing race (waiting longer never helped)
 * and not our router (same result before and after switching off HashRouter). `@twa-dev/sdk`'s
 * `WebApp` remains in use for everything else (ready/expand/theme/onEvent), which all work
 * correctly — this bypass is scoped to `initData`/`initDataUnsafe` specifically.
 */
export function getTelegramInitData(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).Telegram?.WebApp?.initData ?? "";
  } catch {
    return "";
  }
}

/**
 * `WebApp.initData` is empty for a beat after mount on at least one real client (Telegram
 * Desktop): the SDK script executes synchronously, but the native shell hands over `initData`
 * through an async postMessage handshake (visible as `[Telegram.WebView] > postEvent ...` in that
 * client's console) that hasn't necessarily resolved by the time our own module script runs —
 * confirmed in production, requests fired at mount-time synchronously read `initData: ""` and got
 * rejected, while re-reading it a moment later (manually, in devtools) returned a full valid
 * string. Poll briefly instead of trusting the very first synchronous read.
 */
export async function waitForTelegramInitData(timeoutMs = 3000, intervalMs = 100): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const initData = getTelegramInitData();
    if (initData) return initData;
    if (Date.now() >= deadline) return "";
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

function resolvePlatform(): "ios" | "base" {
  try {
    // telegram-ui's AppRoot only distinguishes "ios" vs "base" (everything else renders the
    // Android/desktop/web look, which is closest to how those Telegram clients actually render).
    return WebApp.platform === "ios" ? "ios" : "base";
  } catch {
    return "base";
  }
}

/**
 * Derived from `themeParams.bg_color`'s luminance rather than trusting `WebApp.colorScheme`
 * directly: `applyThemeVars` (the mechanism the rest of the app's CSS relies on) only ever reads
 * `themeParams`, and on at least one real Telegram client `colorScheme` disagreed with the actual
 * (correctly dark) `bg_color` — leaving `AppRoot`'s own components (SegmentedControl, Section,
 * etc.) stuck light against an otherwise-dark app. Computing both from the same field guarantees
 * they can't diverge again.
 */
function resolveAppearance(): "light" | "dark" {
  try {
    const hex = WebApp.themeParams.bg_color;
    if (!hex) return WebApp.colorScheme === "dark" ? "dark" : "light";

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5 ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Feeds `AppRoot` (`@telegram-apps/telegram-ui`) the host client's real platform/appearance
 * instead of letting it guess from `prefers-color-scheme`. Platform can't change mid-session;
 * appearance is re-read on Telegram's `themeChanged` event, same trigger `applyThemeVars` uses.
 */
export function useTelegramAppearance(): { platform: "ios" | "base"; appearance: "light" | "dark" } {
  const [appearance, setAppearance] = useState(resolveAppearance);

  useEffect(() => {
    const handler = () => setAppearance(resolveAppearance());
    try {
      WebApp.onEvent("themeChanged", handler);
      return () => WebApp.offEvent("themeChanged", handler);
    } catch {
      return undefined;
    }
  }, []);

  return { platform: resolvePlatform(), appearance };
}

export { WebApp };
