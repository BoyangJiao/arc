/**
 * PortfolioTabHeader — active portfolio title + manage entry (no dropdown).
 *
 * Stage 3 UX: portfolio management lives at /me/portfolios via header-right icon.
 */

import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { BriefcaseIcon, HeaderActionButton, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { resolvePortfolioDisplayName } from "@arc/core";

import { useActivePortfolio } from "../lib/queries";

export const PortfolioTabHeaderCenter = () => {
  const { t } = useTranslation();
  const { portfolio, isLoading } = useActivePortfolio();

  if (isLoading) {
    return (
      <Text className="text-muted text-base font-semibold" numberOfLines={1}>
        {t("common.loading")}
      </Text>
    );
  }

  const displayName = portfolio
    ? resolvePortfolioDisplayName(portfolio.name, t("portfolio.myPortfolio"))
    : t("tabs.portfolio");

  return (
    <View className="max-w-[220px]">
      <Text className="text-foreground text-base font-semibold text-center" numberOfLines={1}>
        {displayName}
      </Text>
    </View>
  );
};

export const PortfolioTabHeaderManageButton = () => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <HeaderActionButton
      icon={BriefcaseIcon}
      onPress={() => router.push("/me/portfolios" as Href)}
      accessibilityLabel={t("portfolios.manageAccessibility")}
    />
  );
};

/** @deprecated Dropdown switcher removed — use center title + manage button. */
export const PortfolioSwitcher = PortfolioTabHeaderCenter;
