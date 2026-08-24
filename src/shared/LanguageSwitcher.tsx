import { useTranslation } from "react-i18next";
import { SegmentedControl } from "@telegram-apps/telegram-ui";
import { setLanguage } from "../app/i18n";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language === "ru" ? "ru" : "en";

  return (
    <SegmentedControl>
      <SegmentedControl.Item selected={current === "ru"} onClick={() => setLanguage("ru")}>
        RU
      </SegmentedControl.Item>
      <SegmentedControl.Item selected={current === "en"} onClick={() => setLanguage("en")}>
        EN
      </SegmentedControl.Item>
    </SegmentedControl>
  );
}
