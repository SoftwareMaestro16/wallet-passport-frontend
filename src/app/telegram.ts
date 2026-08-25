import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";

/**
 * `@twa-dev/sdk` (v8.0.2) bundles its own vendored copy of Telegram's WebApp implementation and
 * unconditionally overwrites `window.Telegram.WebApp` with it. That vendored copy's own
 * `location.hash` parsing has proven unreliable in production on Telegram Desktop for at least
 * `initData` (see `getTelegramInitData`'s doc comment — confirmed via live diagnostics: the real
 * hash was present and non-empty, but the SDK's own parsed value was empty regardless). Given one
 * property from that parsing pass is known-buggy, every other property derived the same way
 * (`themeParams`, `colorScheme`, `platform`) is suspect too — read them all directly off the raw
 * global instead of trusting the `@twa-dev/sdk` import, rather than fixing one property at a time
 * reactively as each turns out to be wrong.
 */
function rawWebApp(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).Telegram?.WebApp;
}

const DESKTOP_PLATFORMS = new Set(["tdesktop", "macos"]);

function hasTelegramLaunchParams(): boolean {
  const sources = [window.location.hash.replace(/^#/, ""), window.location.search.replace(/^\?/, "")];
  return sources.some((source) => {
    const params = new URLSearchParams(source);
    return Boolean(params.get("tgWebAppData"));
  });
}

export function isTelegramMiniApp(): boolean {
  try {
    return Boolean(rawWebApp()?.initData || hasTelegramLaunchParams());
  } catch {
    return false;
  }
}

/**
 * Thin wrapper around @twa-dev/sdk's WebApp singleton — still used for method calls
 * (ready/expand/onEvent) which work correctly; only property reads are suspect (see `rawWebApp`).
 * Call `bootstrapTelegram()` once on app mount (see src/main.tsx).
 */
export function bootstrapTelegram(): void {
  try {
    WebApp.ready();
    WebApp.expand();
    const app = rawWebApp();
    if (app?.isVersionAtLeast?.("8.0") && app?.requestFullscreen) {
      app.requestFullscreen();
      if (!DESKTOP_PLATFORMS.has(app.platform)) {
        document.documentElement.setAttribute("data-tg-fullscreen-requested", "true");
      }
    }
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
  const theme = rawWebApp()?.themeParams ?? {};

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

export function syncTelegramChrome(theme: "light" | "dark"): void {
  const app = rawWebApp();
  const headerColor = theme === "dark" ? "#172432" : "#ffffff";
  const backgroundColor = theme === "dark" ? "#111b25" : "#ffffff";

  document.documentElement.style.setProperty("--wp-header-color", headerColor);
  document.documentElement.style.setProperty("--wp-bg-color", backgroundColor);
  document.body.style.backgroundColor = backgroundColor;

  try {
    if (app?.isVersionAtLeast?.("6.1")) {
      app.setHeaderColor?.(headerColor);
      app.setBackgroundColor?.(backgroundColor);
    }
  } catch {
    // no-op outside Telegram or on clients that do not support chrome color updates
  }
}

/** Telegram's `language_code` for the current user, e.g. "ru", "en", "uk". */
export function getTelegramLanguageCode(): string | undefined {
  try {
    return rawWebApp()?.initDataUnsafe?.user?.language_code;
  } catch {
    return undefined;
  }
}

export interface TelegramUserData {
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  isPremium?: boolean;
  languageCode?: string;
}

/** Telegram user fields are presentation data only; identity remains backend-validated initData. */
export function getTelegramUserData(): TelegramUserData | null {
  try {
    const user = rawWebApp()?.initDataUnsafe?.user;
    if (!user) return null;
    return {
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      photoUrl: user.photo_url,
      isPremium: user.is_premium,
      languageCode: user.language_code,
    };
  } catch {
    return null;
  }
}

export function useTelegramMainButton(options: {
  text: string;
  visible: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}): void {
  const { text, visible, loading, disabled, onClick } = options;
  useEffect(() => {
    const app = rawWebApp();
    const button = app?.MainButton;
    if (!button) return undefined;

    const handleClick = () => onClick();

    try {
      button.setText(text);
      if (disabled) button.disable();
      else button.enable();
      if (loading) button.showProgress(false);
      else button.hideProgress();
      if (visible) button.show();
      else button.hide();
      button.onClick(handleClick);
    } catch {
      return undefined;
    }

    return () => {
      try {
        button.offClick(handleClick);
        button.hideProgress();
        button.hide();
      } catch {
        // no-op outside Telegram or on clients with a partial MainButton implementation
      }
    };
  }, [text, visible, loading, disabled, onClick]);
}

export function shareReferralViaInlineMode(referralCode: string): boolean {
  const app = rawWebApp();
  try {
    if (app?.switchInlineQuery) {
      app.switchInlineQuery("invite", ["users", "groups", "channels"]);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

type HapticImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type HapticNotificationType = "error" | "success" | "warning";

function vibrateFallback(pattern: VibratePattern): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // no-op on browsers/clients without vibration support
  }
}

export function hapticImpact(style: HapticImpactStyle = "light"): void {
  const app = rawWebApp();
  try {
    if (app?.HapticFeedback?.impactOccurred) {
      app.HapticFeedback.impactOccurred(style);
      return;
    }
  } catch {
    // fall through to browser vibration
  }
  vibrateFallback(style === "heavy" ? 18 : 10);
}

export function hapticSelection(): void {
  const app = rawWebApp();
  try {
    if (app?.HapticFeedback?.selectionChanged) {
      app.HapticFeedback.selectionChanged();
      return;
    }
  } catch {
    // fall through to browser vibration
  }
  vibrateFallback(8);
}

export function hapticNotification(type: HapticNotificationType): void {
  const app = rawWebApp();
  try {
    if (app?.HapticFeedback?.notificationOccurred) {
      app.HapticFeedback.notificationOccurred(type);
      return;
    }
  } catch {
    // fall through to browser vibration
  }
  vibrateFallback(type === "error" ? [12, 24, 12] : 16);
}

/**
 * Raw initData string — sent to the backend for Telegram auth validation. Never parsed/trusted
 * client-side.
 *
 * Reads the raw global directly (see `rawWebApp`'s doc comment) rather than `@twa-dev/sdk`'s
 * imported `WebApp` singleton. Confirmed via production diagnostics (2026-08-25): on Telegram
 * Desktop, with the exact same `location.hash` present and non-empty in both cases,
 * `window.Telegram.WebApp.initData` correctly returned the real value while `@twa-dev/sdk`
 * (v8.0.2) `WebApp.initData` returned an empty string every time.
 */
export function getTelegramInitData(): string {
  try {
    return rawWebApp()?.initData ?? "";
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
    return rawWebApp()?.platform === "ios" ? "ios" : "base";
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
    const app = rawWebApp();
    const hex = app?.themeParams?.bg_color;
    if (!hex) return app?.colorScheme === "dark" ? "dark" : "light";

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
