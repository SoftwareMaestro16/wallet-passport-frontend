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
    return WebApp.initDataUnsafe?.user?.language_code;
  } catch {
    return undefined;
  }
}

/** Raw initData string — sent to the backend for Telegram auth validation. Never parsed/trusted client-side. */
export function getTelegramInitData(): string {
  try {
    return WebApp.initData ?? "";
  } catch {
    return "";
  }
}

export { WebApp };
