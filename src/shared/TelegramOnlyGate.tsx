import { Button, Caption, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

const TELEGRAM_APP_URL = "https://t.me/WalletPassportXBot/scan";

export function TelegramOnlyGate() {
  const { t } = useTranslation();

  return (
    <div className="telegram-only-shell">
      <div className="telegram-only-top">
        <div className="app-brand">
          <span className="app-brand-mark">WP</span>
          <span>Wallet Passport</span>
        </div>
        <LanguageSwitcher />
      </div>

      <main className="telegram-only-main">
        <section className="telegram-only-panel" aria-labelledby="telegram-only-title">
          <div className="telegram-only-icon" aria-hidden="true">
            WP
          </div>
          <Title id="telegram-only-title" level="1" weight="1">
            {t("telegramOnly.title")}
          </Title>
          <Caption className="telegram-only-copy">{t("telegramOnly.body")}</Caption>
          <Button size="l" stretched onClick={() => window.location.assign(TELEGRAM_APP_URL)}>
            {t("telegramOnly.openButton")}
          </Button>
          <Caption className="telegram-only-hint">{t("telegramOnly.hint")}</Caption>
        </section>
      </main>
    </div>
  );
}
