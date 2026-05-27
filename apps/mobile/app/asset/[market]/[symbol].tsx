/**
 * Asset detail — /asset/[market]/[symbol]
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import {
  Button,
  DotsThreeVerticalIcon,
  HeaderActionButton,
  InScreenHeader,
  LineChart,
  Screen,
  Text,
  TimeRangeSelector,
  TwrInlineLabel,
  computePeriodChange,
  formatCompactChangeLine,
  formatSignedPercent,
  useBusinessClasses,
  typographyClass,
  type TimeRange,
  DEFAULT_TIME_RANGE,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { composeAssetId, type Market } from "@arc/core";

import { formatMoney, currencySymbol } from "../../../src/lib/format-money";
import { useActivePortfolio } from "../../../src/lib/queries/use-active-portfolio";
import { openingSnapshotDateByAsset } from "../../../src/lib/holdings-presenter";
import {
  historicalQuotesToChartPoints,
  useAssetDetail,
  useAssetTwr,
  useDeleteAssetTransactions,
  useHistoricalQuotes,
  usePortfolioHoldings,
} from "../../../src/lib/queries";

export default function AssetDetailScreen() {
  const { t } = useTranslation();
  const businessClasses = useBusinessClasses();
  const router = useRouter();
  const { market, symbol } = useLocalSearchParams<{ market: string; symbol: string }>();
  const [range, setRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const { portfolio } = useActivePortfolio();
  const deleteAssetTransactions = useDeleteAssetTransactions();

  const detail = useAssetDetail(market, symbol);
  const assetId = market && symbol ? composeAssetId(market as Market, symbol) : undefined;
  const { transactions } = usePortfolioHoldings(portfolio?.id);
  const openingSnapshotDate = useMemo(() => {
    if (!assetId || !transactions) return null;
    return openingSnapshotDateByAsset(transactions).get(assetId) ?? null;
  }, [assetId, transactions]);
  const hasOpeningSnapshot = openingSnapshotDate !== null;
  const historical = useHistoricalQuotes(assetId, range);
  const assetTwr = useAssetTwr({
    portfolioId: portfolio?.id,
    assetId,
    range,
  });
  const chartData = historicalQuotesToChartPoints(historical.data ?? []);

  useEffect(() => {
    if (market === "CASH") {
      router.back();
    }
  }, [market, router]);

  const holdingLabel = useMemo(() => {
    const name = detail.data?.name ?? symbol ?? "";
    return name !== symbol ? `${name} (${symbol})` : name;
  }, [detail.data?.name, symbol]);

  const handleConfirmRemove = useCallback(() => {
    if (!portfolio?.id || !assetId) return;
    Alert.alert(
      t("portfolioDetail.removeHoldingTitle"),
      t("portfolioDetail.removeHoldingMessage", { symbol: holdingLabel }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("portfolioDetail.removeHolding"),
          style: "destructive",
          onPress: () => {
            void deleteAssetTransactions
              .mutateAsync({ portfolioId: portfolio.id, assetId })
              .then(() => {
                router.back();
              })
              .catch(() => {
                Alert.alert(t("common.error"), t("portfolioDetail.removeHoldingFailed"));
              });
          },
        },
      ]
    );
  }, [assetId, deleteAssetTransactions, holdingLabel, portfolio?.id, router, t]);

  // ActionSheet 风格的 more 菜单 — 使用 Alert（iOS 上自动呈现为 ActionSheet 风格的多按钮弹层）。
  // 避免 BottomSheet 依赖 @gorhom/bottom-sheet（未安装 → 运行时 undefined）。
  const handleOpenMore = useCallback(() => {
    Alert.alert(t("assetDetail.more"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("assetDetail.removeFromPortfolio"),
        style: "destructive",
        onPress: handleConfirmRemove,
      },
    ]);
  }, [handleConfirmRemove, t]);

  if (market === "CASH") {
    return null;
  }

  const quote = detail.data?.latestQuote;
  const changePercent = quote?.changePercent ?? null;
  const currency = detail.data?.currency ?? quote?.currency ?? "CNY";
  const currencySym = currencySymbol(currency);
  const hasHolding = !!detail.data?.holding;

  const periodChange = useMemo(() => {
    if (!quote || chartData.length === 0) return null;
    return computePeriodChange(quote.price.toNumber(), chartData[0]!.y);
  }, [quote, chartData]);

  const changeColorClass =
    periodChange !== null
      ? periodChange.delta.isPositive()
        ? businessClasses.gain.text
        : periodChange.delta.isNegative()
          ? businessClasses.loss.text
          : businessClasses.pnlNeutral.text
      : changePercent === null
        ? businessClasses.pnlNeutral.text
        : changePercent.isPositive()
          ? businessClasses.gain.text
          : changePercent.isNegative()
            ? businessClasses.loss.text
            : businessClasses.pnlNeutral.text;

  const handleAddTx = () => {
    if (!portfolio?.id || !market || !symbol) return;
    router.push(
      `/portfolio/${portfolio.id}/transactions/new?prefillMarket=${market}&prefillSymbol=${symbol}` as Href
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <InScreenHeader
          title={detail.data?.name ?? symbol ?? ""}
          leftType="back"
          rightSlot={
            hasHolding ? (
              <HeaderActionButton
                icon={DotsThreeVerticalIcon}
                onPress={handleOpenMore}
                accessibilityLabel={t("assetDetail.more")}
              />
            ) : null
          }
        />
        <View className="gap-4">
          <View>
            <Text className="text-muted text-sm">
              {assetId} · {t("common.disclaimer")}
            </Text>
            {quote ? (
              <View className="flex-row items-center gap-2 mt-2">
                <Text className="text-foreground text-2xl font-bold">
                  {formatMoney(quote.price, quote.currency)}
                </Text>
                {periodChange ? (
                  <Text className={typographyClass("rowValue", changeColorClass)}>
                    {formatCompactChangeLine(periodChange.delta, periodChange.percent, currencySym)}
                  </Text>
                ) : changePercent !== null ? (
                  <Text className={typographyClass("rowValue", changeColorClass)}>
                    {formatSignedPercent(changePercent)}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text className="text-muted mt-2">{t("common.loading")}</Text>
            )}
          </View>

          <TimeRangeSelector value={range} onChange={setRange} />
          <LineChart
            key={range}
            data={chartData}
            height={224}
            loading={historical.isFetching && !historical.data}
            valuePrefix={currencySym}
          />

          {detail.data?.holding ? (
            <View className="gap-2 border-t border-border pt-4">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-foreground font-semibold">{t("assetDetail.myHolding")}</Text>
                {hasOpeningSnapshot && openingSnapshotDate ? (
                  <Text className="text-muted text-xs">
                    {t("holdings.badge.snapshot", { date: openingSnapshotDate })}
                  </Text>
                ) : null}
              </View>
              <Text className="text-muted text-sm">
                {t("assetDetail.shares", {
                  shares: detail.data.holding.shares.toFixed(4),
                })}
              </Text>
              <Text className="text-muted text-sm">
                {t("assetDetail.avgCost", {
                  cost: formatMoney(detail.data.holding.averageCost, detail.data.currency),
                })}
              </Text>
              {detail.data.unrealizedPnL !== null ? (
                <Text className="text-foreground text-sm">
                  {t("assetDetail.unrealizedPnL", {
                    pnl: formatMoney(detail.data.unrealizedPnL, detail.data.currency),
                  })}
                </Text>
              ) : null}
              {hasOpeningSnapshot ? (
                <Text className="text-muted text-sm">{t("assetDetail.twr.hidden.reason")}</Text>
              ) : (
                <TwrInlineLabel
                  range={range}
                  result={assetTwr.isError ? undefined : assetTwr.data}
                  loading={assetTwr.isLoading}
                  unavailable={t("twr.unavailable")}
                  twrAbbrevLabel={t("twr.label")}
                  tooltipTitle={t("twr.tooltipTitle")}
                  tooltipBody={t("assetDetail.twr.tooltip")}
                  closeLabel={t("common.close")}
                />
              )}
              <Text className="text-muted text-xs">{t("assetDetail.costBasis.tooltip")}</Text>
            </View>
          ) : null}

          <Button onPress={handleAddTx}>
            <Button.Label>{t("assetDetail.addTransactionCta")}</Button.Label>
          </Button>
        </View>
      </Screen>
    </>
  );
}
