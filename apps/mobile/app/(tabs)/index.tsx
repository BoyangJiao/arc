/**
 * (tabs)/index.tsx — Portfolio Tab (Home)
 */

import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Decimal from "decimal.js";
import { parseAssetId, type Market } from "@arc/core";
import {
  Card,
  DailySnapshotCard,
  FLOATING_TAB_BAR_BOTTOM_INSET,
  HoldingsTable,
  PortfolioValueOverTimeCard,
  Screen,
  TabScreenHeader,
  TabScrollShadow,
  Text,
  UserAvatar,
  DEFAULT_TIME_RANGE,
  type TimeRange,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { resolvePortfolioDisplayName } from "@arc/core";

import {
  PortfolioTabHeaderCenter,
  PortfolioTabHeaderManageButton,
} from "../../src/components/PortfolioTabHeader";
import { useAuth } from "../../src/lib/auth";
import { currencySymbol, formatMoney } from "../../src/lib/format-money";
import {
  buildHoldingsTableRows,
  formatMarketSectionHeader,
} from "../../src/lib/holdings-presenter";
import {
  useActivePortfolio,
  useAssetCatalog,
  useDailyDelta,
  usePortfolioHoldings,
  usePortfolioValuation,
  usePortfolioValueSnapshots,
  snapshotsToChartPoints,
  snapshotPeakTrough,
} from "../../src/lib/queries";
import { useUserPreferences } from "../../src/lib/user-preferences";

const ZERO = new Decimal(0);

const formatSignedDecimal = (value: Decimal): string => {
  if (value.isZero()) return value.toFixed(2);
  const sign = value.isPositive() ? "+" : "-";
  return `${sign}${value.abs().toFixed(2)}`;
};

export default function PortfolioTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [chartRange, setChartRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);

  const { prefs } = useUserPreferences();

  const { portfolio: activePortfolio, isLoading: activeLoading } = useActivePortfolio();

  const activeId = activePortfolio?.id;
  const reportingCurrency = activePortfolio?.reportingCurrency ?? prefs?.reportingCurrency ?? "CNY";
  const { holdings, isPending: holdingsPending } = usePortfolioHoldings(activeId);
  const {
    data: valuation,
    isFetching: valuationFetching,
    isError: valuationError,
    refreshFromLive,
  } = usePortfolioValuation(activeId, reportingCurrency);

  const dailyDelta = useDailyDelta(activeId, reportingCurrency);
  const snapshots = usePortfolioValueSnapshots(activeId, chartRange);

  const assetIds = useMemo(() => holdings.map((h) => h.assetId), [holdings]);
  const catalog = useAssetCatalog(assetIds);

  const formatPercent = (d: Decimal) => `${d.isPositive() ? "+" : ""}${d.toFixed(2)}%`;

  const holdingsRows = useMemo(
    () =>
      buildHoldingsTableRows({
        holdings,
        perAsset: valuation?.perAsset ?? [],
        catalog: catalog.data,
        reportingCurrency,
        formatPercent,
        sharesLabel: (shares, symbol) =>
          t("portfolio.sharesRow", { shares: shares.toFixed(2), symbol }),
      }),
    [holdings, valuation?.perAsset, catalog.data, reportingCurrency, t]
  );

  const chartPoints = snapshotsToChartPoints(snapshots.data ?? []);
  const { peak, trough } = snapshotPeakTrough(snapshots.data ?? []);

  const marketLabel = (m: Market) => t(`holdings.markets.${m}` as "holdings.markets.US");

  const holdingsCount = holdings.length;
  const pricedCount = valuation?.perAsset.length ?? 0;
  const hasPartialQuotes =
    holdingsCount > 0 && pricedCount > 0 && pricedCount < holdingsCount && !valuationFetching;
  const hasHoldings = holdingsCount > 0;
  const totalValueText = formatMoney(
    hasHoldings && valuation ? valuation.totalValue : ZERO,
    reportingCurrency
  );

  const handleAvatarPress = () => {
    router.push("/me" as Href);
  };

  const handleRowPress = (assetId: string) => {
    const { market, symbol } = parseAssetId(assetId);
    router.push(`/asset/${market}/${symbol}` as Href);
  };

  return (
    <Screen scroll={false} contentContainerStyle={{ flexGrow: 1 }}>
      <TabScreenHeader
        title={t("tabs.portfolio")}
        centerSlot={<PortfolioTabHeaderCenter />}
        leftSlot={
          <Pressable onPress={handleAvatarPress} accessibilityLabel={t("me.title")} hitSlop={8}>
            <UserAvatar seed={user?.email} size={40} />
          </Pressable>
        }
        rightSlot={<PortfolioTabHeaderManageButton />}
      />

      <TabScrollShadow>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET,
            flexGrow: 1,
            gap: 16,
          }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={valuationFetching && !!valuation}
              onRefresh={() => refreshFromLive()}
            />
          }
        >
          <View>
            <Text className="text-muted text-sm mb-1">{t("portfolio.totalValue")}</Text>
            <Text className="text-foreground text-4xl font-bold">{totalValueText}</Text>
            {hasHoldings && (
              <Text className="text-muted text-xs mt-1">{t("common.disclaimer")}</Text>
            )}
            {hasPartialQuotes && (
              <Text className="text-muted text-xs mt-1">
                {t("portfolio.partialQuotes", { loaded: pricedCount, total: holdingsCount })}{" "}
                {t("portfolio.partialQuotesMissing", { missing: holdingsCount - pricedCount })}
              </Text>
            )}
            {valuationError && (
              <Text className="text-danger text-xs mt-1">{t("common.error")}</Text>
            )}
          </View>

          {activePortfolio ? (
            <PortfolioValueOverTimeCard
              title={t("portfolio.navOverTime")}
              totalValueLabel={totalValueText}
              peakLabel={t("portfolio.peak")}
              troughLabel={t("portfolio.trough")}
              peakValue={peak ? formatMoney(peak, reportingCurrency) : "—"}
              troughValue={trough ? formatMoney(trough, reportingCurrency) : "—"}
              disclaimer={t("common.disclaimer")}
              chartData={chartPoints}
              range={chartRange}
              onRangeChange={setChartRange}
              loading={snapshots.isFetching}
              emptyMessage={t("portfolio.noSnapshotHistory")}
            />
          ) : null}

          {dailyDelta.data ? (
            <DailySnapshotCard
              delta={dailyDelta.data}
              title={t("dailySnapshot.title")}
              noBaselineMessage={t("dailySnapshot.noBaseline")}
              disclaimer={t("common.disclaimer")}
              formatAmount={(amount) =>
                `${currencySymbol(reportingCurrency)}${formatSignedDecimal(amount)}`
              }
              formatPercent={(percent) => `${formatSignedDecimal(percent)}%`}
              formatAssetLabel={(assetId) => parseAssetId(assetId).symbol}
              onMoverPress={(assetId) => {
                const { market, symbol } = parseAssetId(assetId);
                router.push(`/asset/${market}/${symbol}` as Href);
              }}
            />
          ) : null}

          {activeLoading ? (
            <Text className="text-muted">{t("common.loading")}</Text>
          ) : !activePortfolio ? (
            <Card>
              <View className="p-6 items-center">
                <Text className="text-muted text-center mb-2">{t("portfolio.noPortfolios")}</Text>
                <Text className="text-muted text-xs text-center">
                  {t("portfolio.noPortfoliosHint")}
                </Text>
              </View>
            </Card>
          ) : null}

          {hasHoldings && !holdingsPending ? (
            <HoldingsTable
              rows={holdingsRows}
              getSectionHeader={(market) =>
                formatMarketSectionHeader(
                  marketLabel(market),
                  holdingsRows.filter((r) => r.market === market),
                  valuation?.perAsset ?? [],
                  reportingCurrency
                )
              }
              collapseLabel={t("holdings.collapse")}
              expandLabel={t("holdings.expand")}
              onRowPress={handleRowPress}
            />
          ) : null}

          {activePortfolio && !hasHoldings && !holdingsPending && !valuationFetching && (
            <Card>
              <Pressable
                onPress={() =>
                  router.push(`/portfolio/${activePortfolio.id}/transactions/new` as Href)
                }
              >
                <View className="p-6 items-center">
                  <Text className="text-muted text-center mb-2">{t("portfolio.empty")}</Text>
                  <Text className="text-foreground font-semibold">
                    {t("portfolio.emptyAction")}
                  </Text>
                </View>
              </Pressable>
            </Card>
          )}

          <Text className="text-muted text-xs text-center">{t("common.notInvestmentAdvice")}</Text>
        </ScrollView>
      </TabScrollShadow>
    </Screen>
  );
}
