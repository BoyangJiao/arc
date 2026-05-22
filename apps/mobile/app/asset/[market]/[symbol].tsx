/**
 * Asset detail — /asset/[market]/[symbol]
 */

import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import Decimal from "decimal.js";
import {
  Button,
  InScreenHeader,
  LineChart,
  Screen,
  Text,
  TimeRangeSelector,
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
import {
  historicalQuotesToChartPoints,
  useAssetDetail,
  useHistoricalQuotes,
} from "../../../src/lib/queries";
export default function AssetDetailScreen() {
  const { t } = useTranslation();
  const businessClasses = useBusinessClasses();
  const router = useRouter();
  const { market, symbol } = useLocalSearchParams<{ market: string; symbol: string }>();
  const [range, setRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const { portfolio } = useActivePortfolio();

  const detail = useAssetDetail(market, symbol);
  const assetId = market && symbol ? composeAssetId(market as Market, symbol) : undefined;
  const historical = useHistoricalQuotes(assetId, range);
  const chartData = historicalQuotesToChartPoints(historical.data ?? []);

  useEffect(() => {
    if (market === "CASH") {
      router.back();
    }
  }, [market, router]);

  if (market === "CASH") {
    return null;
  }

  const quote = detail.data?.latestQuote;
  const changePercent = quote?.changePercent ?? null;

  const changeColorClass =
    changePercent === null
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
        <InScreenHeader title={detail.data?.name ?? symbol ?? ""} leftType="back" />
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
                {changePercent !== null ? (
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
            data={chartData}
            height={224}
            loading={historical.isFetching}
            valuePrefix={currencySymbol(detail.data?.currency ?? quote?.currency ?? "CNY")}
          />

          {detail.data?.holding ? (
            <View className="gap-2 border-t border-border pt-4">
              <Text className="text-foreground font-semibold">{t("assetDetail.myHolding")}</Text>
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
