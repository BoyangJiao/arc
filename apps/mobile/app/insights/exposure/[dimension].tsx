/**
 * /insights/exposure/[dimension] — 市场敞口 / 币种敞口 detail (Delta 多样性 style).
 *
 * Big interactive donut (Pro pie-chart) + center total + expandable breakdown
 * legend: tap a group row to reveal its member assets. dimension ∈ market|currency.
 */

import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import Decimal from "decimal.js";
import { insights, parseAssetId } from "@arc/core";
import {
  ALLOCATION_PALETTE,
  AssetAvatar,
  CaretRightIcon,
  DonutChart,
  InScreenHeader,
  NAVIGATION_COLORS,
  Screen,
  Text,
  ThemedIcon,
  TYPO_CAPTION,
  TYPO_CAPTION_FOREGROUND,
  TYPO_DISPLAY_2XL,
  TYPO_LABEL,
  TYPO_ROW_TITLE,
  TYPO_ROW_VALUE,
  scrollContentBelowInScreenHeader,
  type DonutChartDatum,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { resolveAssetLogoUrl } from "../../../src/lib/asset-logo-url";
import { formatMoney } from "../../../src/lib/format-money";
import {
  useActivePortfolio,
  useAssetCatalog,
  usePortfolioValuation,
  useTransactions,
} from "../../../src/lib/queries";
import { useAmountRedacted } from "../../../src/lib/use-amount-redacted";
import { useUserPreferences } from "../../../src/lib/user-preferences";
import { useColorMode } from "../../../src/lib/theme";

type Dimension = "market" | "currency" | "account";

export default function ExposureDetailScreen() {
  const { t } = useTranslation();
  const { colorMode } = useColorMode();
  const { prefs } = useUserPreferences();
  const { amountsHidden } = useAmountRedacted();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";

  const { dimension: dimensionParam, portfolioId: queryPortfolioId } = useLocalSearchParams<{
    dimension?: string;
    portfolioId?: string;
  }>();
  const dimension: Dimension =
    dimensionParam === "currency"
      ? "currency"
      : dimensionParam === "account"
        ? "account"
        : "market";

  const { activePortfolioId } = useActivePortfolio();
  const portfolioId =
    typeof queryPortfolioId === "string" && queryPortfolioId.length > 0
      ? queryPortfolioId
      : (activePortfolioId ?? undefined);

  const { data: valuation } = usePortfolioValuation(portfolioId, reportingCurrency);
  const perAsset = useMemo(() => valuation?.perAsset ?? [], [valuation]);
  const { data: transactions = [] } = useTransactions(portfolioId);

  const groups = useMemo<ReadonlyArray<insights.ExposureGroupBreakdown<string>>>(() => {
    if (dimension === "currency") return insights.currencyExposureBreakdown(perAsset);
    if (dimension === "account") return insights.accountExposureBreakdown(perAsset, transactions);
    return insights.marketExposureBreakdown(perAsset);
  }, [dimension, perAsset, transactions]);

  const assetIds = useMemo(() => perAsset.map((v) => v.assetId), [perAsset]);
  const { data: catalog } = useAssetCatalog(assetIds);

  const [expanded, setExpanded] = useState<string>("");

  const groupLabel = (group: string): string => {
    if (dimension === "account")
      return group === insights.ACCOUNT_UNASSIGNED
        ? t("insights.exposure.unassignedAccount")
        : group;
    return dimension === "currency"
      ? t(`insights.currencies.${group}` as "insights.currencies.CNY")
      : t(`holdings.markets.${group}` as "holdings.markets.US");
  };

  const total = useMemo(
    () => groups.reduce((sum, g) => sum.plus(g.value), new Decimal(0)),
    [groups]
  );
  const money = (amount: Decimal): string =>
    formatMoney(amount, reportingCurrency, { redact: amountsHidden });

  const donutData: DonutChartDatum[] = groups.map((g, i) => ({
    key: groupLabel(g.group),
    value: g.value.toNumber(),
    color: ALLOCATION_PALETTE[i % ALLOCATION_PALETTE.length]!,
  }));

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedGroup = selectedIndex != null ? groups[selectedIndex] : undefined;

  const donutCenter = selectedGroup ? (
    <View className="items-center px-6">
      <Text className={`${TYPO_CAPTION} text-muted`}>{groupLabel(selectedGroup.group)}</Text>
      <Text className={TYPO_DISPLAY_2XL}>{money(selectedGroup.value)}</Text>
      <Text className={`${TYPO_CAPTION} text-muted`}>
        {`${selectedGroup.weight.times(100).toFixed(0)}%`}
      </Text>
    </View>
  ) : (
    <View className="items-center">
      <Text className={`${TYPO_CAPTION} text-muted`}>{t("insights.exposure.totalLabel")}</Text>
      <Text className={TYPO_DISPLAY_2XL}>{money(total)}</Text>
    </View>
  );

  const title =
    dimension === "currency"
      ? t("insights.exposure.currencyTitle")
      : dimension === "account"
        ? t("insights.exposure.accountTitle")
        : t("insights.exposure.marketTitle");

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
        <InScreenHeader title={title} leftType="back" />
        <View className="gap-6 pb-10">
          <DonutChart
            data={donutData}
            heightClass="h-56"
            insetColor={NAVIGATION_COLORS[colorMode].background}
            onSlicePress={setSelectedIndex}
            center={donutCenter}
          />

          <View className="gap-1">
            {groups.map((g, i) => {
              const color = ALLOCATION_PALETTE[i % ALLOCATION_PALETTE.length]!;
              const isOpen = expanded === g.group;
              const hasMembers = g.members.length > 1;
              return (
                <View key={g.group}>
                  <Pressable
                    accessibilityRole={hasMembers ? "button" : undefined}
                    onPress={hasMembers ? () => setExpanded(isOpen ? "" : g.group) : undefined}
                    className="flex-row items-center justify-between gap-3 py-2.5 active:opacity-70"
                  >
                    <View className="flex-row items-center gap-2 flex-1 min-w-0">
                      <View
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <Text className={TYPO_ROW_TITLE} numberOfLines={1}>
                        {groupLabel(g.group)}
                      </Text>
                      {hasMembers ? (
                        <View style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}>
                          <ThemedIcon icon={CaretRightIcon} size={14} colorToken="muted" />
                        </View>
                      ) : null}
                    </View>
                    <View className="flex-row items-baseline gap-2 shrink-0">
                      <Text className={TYPO_ROW_VALUE}>{money(g.value)}</Text>
                      <Text className={`${TYPO_LABEL} text-muted w-10 text-right`}>
                        {`${g.weight.times(100).toFixed(0)}%`}
                      </Text>
                    </View>
                  </Pressable>

                  {isOpen
                    ? g.members.map((m) => {
                        const { market, symbol } = parseAssetId(m.assetId);
                        const name = catalog?.get(m.assetId)?.name ?? symbol;
                        return (
                          <View
                            key={m.assetId}
                            className="flex-row items-center justify-between gap-3 py-2 pl-5"
                          >
                            <View className="flex-row items-center gap-2 flex-1 min-w-0">
                              <AssetAvatar
                                symbol={symbol}
                                market={market}
                                marketLabel={t(
                                  `holdings.markets.${market}` as "holdings.markets.US"
                                )}
                                imageUrl={resolveAssetLogoUrl(market, symbol)}
                                size={22}
                              />
                              <Text className={TYPO_CAPTION_FOREGROUND} numberOfLines={1}>
                                {name}
                              </Text>
                            </View>
                            <View className="flex-row items-baseline gap-2 shrink-0">
                              <Text className={TYPO_CAPTION_FOREGROUND}>{money(m.value)}</Text>
                              <Text className={`${TYPO_CAPTION} text-muted w-10 text-right`}>
                                {`${m.weightInGroup.times(100).toFixed(0)}%`}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    : null}
                </View>
              );
            })}
          </View>
        </View>
      </Screen>
    </>
  );
}
