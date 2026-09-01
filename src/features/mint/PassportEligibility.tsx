import type { useTranslation } from "react-i18next";
import { Section, Cell, Badge } from "@telegram-apps/telegram-ui";
import type { PassportCategoryName, WalletPassportCategoryStatus } from "../../api/client";

const CATEGORY_LABEL_KEYS: Record<PassportCategoryName, string> = {
  passport: "profile.categories.main",
  pioneer: "profile.categories.pioneer",
  operator: "profile.categories.operator",
  defi: "profile.categories.defi",
  collector: "profile.categories.collector",
  staker: "profile.categories.staker",
  builder: "profile.categories.builder",
};

export function PassportEligibility({
  categories,
  t,
}: {
  categories: WalletPassportCategoryStatus[];
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const visibleCategories = categories.filter(
    (category) => category.eligible || category.canMint || category.canRefresh || category.existsOnChain,
  );
  const actionableCount = visibleCategories.filter((category) => category.canMint || category.canRefresh).length;
  const hasMainPassportAction = categories.some(
    (category) => category.category === "passport" && (category.canMint || category.canRefresh || category.eligible),
  );
  const footer = hasMainPassportAction ? t("profile.eligible.footer") : t("profile.eligible.footerLocked");

  return (
    <Section header={t("profile.eligible.title")} footer={footer || undefined}>
      <div className="eligible-passport-block">
        <div className="eligible-passport-head">
          <div>
            <strong>{t("profile.eligible.count", { count: visibleCategories.length })}</strong>
            <span>
              {actionableCount > 0
                ? t("profile.eligible.actionable", { count: actionableCount })
                : t("profile.eligible.noActionable")}
            </span>
          </div>
        </div>
        {visibleCategories.length > 0 ? (
          <div className="eligible-category-grid">
            {visibleCategories.map((category) => (
              <PassportCategoryTile key={category.categoryId} category={category} t={t} />
            ))}
          </div>
        ) : (
          <Cell multiline subtitle={t("profile.eligible.emptyHint")}>
            {t("profile.eligible.empty")}
          </Cell>
        )}
      </div>
    </Section>
  );
}

function PassportCategoryTile({
  category,
  t,
}: {
  category: WalletPassportCategoryStatus;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const label = t(CATEGORY_LABEL_KEYS[category.category] ?? category.category);
  const statusKey = category.existsOnChain
    ? "minted"
    : category.canMint
      ? "canMint"
      : category.canRefresh
        ? "canRefresh"
        : category.eligible
          ? "eligible"
          : "locked";
  const subtitle = category.existsOnChain
    ? t("profile.sections.passports.minted", { revision: category.revision })
    : t(`profile.sections.passports.${statusKey}`);

  return (
    <div className={`eligible-category-tile eligible-category-tile-${statusKey}`}>
      <span>{label}</span>
      <Badge type="number" mode={category.canMint || category.canRefresh ? "primary" : "secondary"}>
        {t(`profile.eligible.status.${statusKey}`)}
      </Badge>
      <small>{subtitle}</small>
    </div>
  );
}
