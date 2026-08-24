import { useTranslation } from "react-i18next";
import { setLanguage } from "../app/i18n";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language === "ru" ? "ru" : "en";

  return (
    <div className="lang-switcher" role="group" aria-label="Language">
      <button
        type="button"
        className={current === "ru" ? "lang-btn active" : "lang-btn"}
        onClick={() => setLanguage("ru")}
      >
        RU
      </button>
      <button
        type="button"
        className={current === "en" ? "lang-btn active" : "lang-btn"}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
    </div>
  );
}
