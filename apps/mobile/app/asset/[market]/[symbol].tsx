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
  Screen,
  StarIcon,
  Text,
  TwrInlineLabel,
  type TimeRange,
  DEFAULT_TIME_RANGE,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { composeAssetId, type Market } from "@arc/core";

import { AssetDetailChartSection } from "../../../src/components/AssetDetailChartSection";
import { AssetDetailPriceHeader } from "../../../src/components/AssetDetailPriceHeader";
import { resolveAssetDetailChartStatus } from "../../../src/lib/asset-detail-chart-status";
import { formatMoney, currencySymbol } from "../../../src/lib/format-money";
import { useAmountRedacted } from "../../../src/lib/use-amount-redacted";
import { useActivePortfolio } from "../../../src/lib/queries/use-active-portfolio";
import {
  historicalQuotesToChartPoints,
  useAddWatchlistItem,
  useAssetDetail,
  useAssetTwr,
  useDeleteAssetTransactions,
  useHistoricalQuotes,
  useRemoveWatchlistItem,
  useWatchlistBase,
} from "../../../src/lib/queries";

export default function AssetDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { market, symbol } = useLocalSearchParams<{ market: string; symbol: string }>();
  const [range, setRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const [chartScrubbing, setChartScrubbing] = useState(false);
  const { portfolio } = useActivePortfolio();
  const { amountsHidden } = useAmountRedacted();
  const deleteAssetTransactions = useDeleteAssetTransactions();

  const detail = useAssetDetail(market, symbol);
  const assetId = market && symbol ? composeAssetId(market as Market, symbol) : undefined;
  const historical = useHistoricalQuotes(assetId, range);
  const assetTwr = useAssetTwr({
    portfolioId: portfolio?.id,
    assetId,
    range,
  });
  const chartData = useMemo(
    () => historicalQuotesToChartPoints(historical.data ?? []),
    [historical.data]
  );

  useEffect(() => {
    if (market === "CASH") {
      router.back();
    }
  }, [market, router]);

  const formatScrubDate = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(i18n.language.startsWith("zh") ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(iso)),
    [i18n.language]
  );

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

  // Watchlist toggle — star icon in header. Filled = in watchlist, outline = not.
  const watchlist = useWatchlistBase();
  const addWatchlist = useAddWatchlistItem();
  const removeWatchlist = useRemoveWatchlistItem();
  const watchlistEntry = useMemo(
    () => (assetId ? (watchlist.data?.find((row) => row.asset.id === assetId) ?? null) : null),
    [assetId, watchlist.data]
  );
  const isInWatchlist = !!watchlistEntry;
  const watchlistPending = addWatchlist.isPending || removeWatchlist.isPending;

  const handleToggleWatchlist = useCallback(() => {
    if (!assetId || !market || !symbol || watchlistPending) return;
    if (watchlistEntry) {
      removeWatchlist.mutate(watchlistEntry.id, {
        onError: () => {
          Alert.alert(t("common.error"), t("assetDetail.watchlistRemoveFailed"));
        },
      });
    } else {
      addWatchlist.mutate(
        {
          symbol,
          name: detail.data?.name ?? symbol,
          market: market as Market,
          currency: detail.data?.currency,
        },
        {
          onError: () => {
            Alert.alert(t("common.error"), t("assetDetail.watchlistAddFailed"));
          },
        }
      );
    }
  }, [
    assetId,
    market,
    symbol,
    watchlistPending,
    watchlistEntry,
    removeWatchlist,
    addWatchlist,
    detail.data?.name,
    detail.data?.currency,
    t,
  ]);

  if (market === "CASH") {
    return null;
  }

  const quote = detail.data?.latestQuote;
  const currency = detail.data?.currency ?? quote?.currency ?? "CNY";
  const currencySym = currencySymbol(currency);
  const hasHolding = !!detail.data?.holding;
  const chartPeriodLoading = historical.isFetching && chartData.length === 0;
  const chartStatus = resolveAssetDetailChartStatus(historical, chartData.length);

  const handleAddTx = () => {
    if (!portfolio?.id || !market || !symbol) return;
    router.push(
      `/portfolio/${portfolio.id}/transactions/new?prefillMarket=${market}&prefillSymbol=${symbol}` as Href
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen scrollEnabled={!chartScrubbing}>
        <InScreenHeader
          title={detail.data?.name ?? symbol ?? ""}
          leftType="back"
          rightSlot={
            <View className="flex-row items-center gap-1">
              <HeaderActionButton
                icon={StarIcon}
                weight={isInWatchlist ? "fill" : "regular"}
                colorToken={isInWatchlist ? "accent" : "foreground"}
                onPress={handleToggleWatchlist}
                accessibilityLabel={t(
                  isInWatchlist ? "assetDetail.removeFromWatchlist" : "assetDetail.addToWatchlist"
                )}
              />
              {hasHolding ? (
                <HeaderActionButton
                  icon={DotsThreeVerticalIcon}
                  onPress={handleOpenMore}
                  accessibilityLabel={t("assetDetail.more")}
                />
              ) : null}
            </View>
          }
        />
        <View>
          <AssetDetailPriceHeader
            assetId={assetId}
            disclaimer={t("common.disclaimer")}
            quote={
              quote
                ? {
                    price: quote.price,
                    currency: quote.currency,
                    changePercent: quote.changePercent ?? null,
                  }
                : undefined
            }
            chartData={chartData}
            range={range}
            periodChangeLabel={t(`portfolio.periodChangeByRange.${range}`)}
            chartPeriodLoading={chartPeriodLoading}
            chartPeriodUnavailable={chartStatus === "error"}
            unavailableLabel={t("twr.unavailable")}
            detailPending={detail.isPending}
            loadingLabel={t("common.loading")}
            amountsHidden={amountsHidden}
          />

          <AssetDetailChartSection
            range={range}
            onRangeChange={setRange}
            chartData={chartData}
            chartStatus={chartStatus}
            chartErrorTitle={t("assetDetail.chart.loadErrorTitle")}
            chartErrorDescription={t("assetDetail.chart.loadErrorDescription")}
            chartEmptyTitle={t("assetDetail.chart.noDataTitle")}
            chartEmptyDescription={t("assetDetail.chart.noDataDescription")}
            valuePrefix={currencySym}
            formatScrubDate={formatScrubDate}
            onScrubbingChange={setChartScrubbing}
          />

          {detail.data?.holding ? (
            <View className="mt-4 gap-2 border-t border-border pt-4">
              <Text className="text-muted text-sm">
                {t("assetDetail.dataCompleteness.disclosure")}
              </Text>
              <Text className="text-foreground font-semibold">{t("assetDetail.myHolding")}</Text>
              <Text className="text-muted text-sm">
                {t("assetDetail.shares", {
                  shares: detail.data.holding.shares.toFixed(4),
                })}
              </Text>
              <Text className="text-muted text-sm">
                {t("assetDetail.avgCost", {
                  cost: formatMoney(detail.data.holding.averageCost, detail.data.currency, {
                    redact: amountsHidden,
                  }),
                })}
              </Text>
              {detail.data.unrealizedPnL !== null ? (
                <Text className="text-foreground text-sm">
                  {t("assetDetail.unrealizedPnL", {
                    pnl: formatMoney(detail.data.unrealizedPnL, detail.data.currency, {
                      redact: amountsHidden,
                    }),
                  })}
                </Text>
              ) : null}
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
              <Text className="text-muted text-xs">{t("assetDetail.costBasis.tooltip")}</Text>
            </View>
          ) : null}

          <View className="mt-4">
            <Button onPress={handleAddTx}>
              <Button.Label>{t("assetDetail.addTransactionCta")}</Button.Label>
            </Button>
          </View>
        </View>
      </Screen>
    </>
  );
}
