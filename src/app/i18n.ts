import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ru from "../locales/ru.json";
import en from "../locales/en.json";
import { getTelegramLanguageCode } from "./telegram";

const STORAGE_KEY = "wallet-passport-lang";

/** Russian is the default/primary language; anything that isn't "ru" falls back to English. */
function resolveInitialLanguage(): "ru" | "en" {
  const tgLang = getTelegramLanguageCode();
  if (tgLang) return tgLang === "ru" ? "ru" : "en";

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "ru" || stored === "en") return stored;
  return "ru";
}

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: resolveInitialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: "ru" | "en"): void {
  localStorage.setItem(STORAGE_KEY, lang);
  void i18n.changeLanguage(lang);
}

export default i18n;
