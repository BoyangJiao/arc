/**
 * /insights/drawdown — 回撤 detail (Delta risk-page UX pattern, Arc data).
 *
 * Separate from 风险 (volatility). Prominent underwater drawdown curve (drawdown
 * from the running peak, ratio ≤ 0) + max-drawdown headline + a per-asset
 * "deepest drawdown" ranking. Active-portfolio scoped.
 *
 * 文案铁律: states historical drawdown neutrally — no guidance.
 */

import { useMemo, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import Decimal from "decimal.js";
import { insights, parseAssetId, type Market } from "@arc/core";
import {
  AssetAvatar,
  Card,
  CumulativeReturnChart,
  DEFAULT_TIME_RANGE,
  InScreenHeader,
  InfoTooltipButton,
  Screen,
  Separator,
  Text,
  TimeRangeSelector,
  TYPO_CAPTION,
  TYPO_METRIC,
  TYPO_OVERLINE,
  TYPO_ROW_TITLE,
  TYPO_ROW_VALUE,
  scrollContentBelowInScreenHeader,
  type PercentAxisInput,
  type TimeRange,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { resolveAssetLogoUrl } from "../../src/lib/asset-logo-url";
import {
  useActivePortfolio,
  useAssetCatalog,
  usePortfolioRiskSeries,
  useEmptyRiskSeriesView,
} from "../../src/lib/queries";

const pct1 = (d: Decimal): string => `${d.times(100).toFixed(1)}%`;
const signedDrawdown = (d: Decimal): string => (d.isZero() ? pct1(d) : `-${pct1(d)}`);

export default function DrawdownScreen() {
  const { t } = useTranslation();
  const { portfolio } = useActivePortfolio();
  const portfolioId = portfolio?.id;

  const [range, setRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const emptyView = useEmptyRiskSeriesView();
  const { data: series = emptyView } = usePortfolioRiskSeries({ portfolioId, range });

  // Drawdown on the cash-flow-adjusted growth index, not raw totalValue (which a
  // buy/sell would spike). growthIndex is index-aligned with `asOf`.
  const hasData = series.growthIndex.length >= 2;
  const maxDrawdown = useMemo(() => insights.maxDrawdown(series.growthIndex), [series.growthIndex]);

  // Underwater curve: each point's drawdown from the running peak (ratio ≤ 0).
  const curve = useMemo<ReadonlyArray<PercentAxisInput>>(() => {
    let peak = new Decimal(0);
    return series.growthIndex.map((gi, i) => {
      if (gi.greaterThan(peak)) peak = gi;
      const ratio = peak.greaterThan(0) ? gi.div(peak).minus(1) : new Decimal(0);
      return { ratio: ratio.toNumber(), asOf: series.asOf[i] ?? "" };
    });
  }, [series.growthIndex, series.asOf]);

  // Per-asset deepest drawdown ranking (market-only growth index).
  const perAsset = useMemo(() => {
    return [...series.latestHoldings.entries()]
      .filter(([, v]) => v.greaterThan(0))
      .map(([id]) => ({
        id,
        dd: insights.maxDrawdown(series.perAsset.get(id)?.growthIndex ?? []),
      }))
      .filter((r) => r.dd.greaterThan(0))
      .sort((a, b) => b.dd.comparedTo(a.dd))
      .slice(0, 8);
  }, [series]);

  const { data: catalog } = useAssetCatalog(useMemo(() => perAsset.map((r) => r.id), [perAsset]));
  const marketLabel = (m: Market) => t(`holdings.markets.${m}` as "holdings.markets.US");

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
        <InScreenHeader
          title={t("insights.drawdown.detailTitle")}
          leftType="back"
          rightSlot={
            <InfoTooltipButton
              title={t("insights.drawdown.detailTitle")}
              body={t("insights.drawdown.info")}
              closeLabel={t("insights.pnl.tooltipClose")}
            />
          }
        />
        <View className="gap-6 pb-10">
          <TimeRangeSelector value={range} onChange={setRange} />

          <Card>
            <View className="gap-1">
              <Text className={`${TYPO_CAPTION} text-muted`}>
                {t("insights.drawdown.maxLabel")}
              </Text>
              <Text className={TYPO_METRIC}>{hasData ? signedDrawdown(maxDrawdown) : "—"}</Text>
            </View>
          </Card>

          <View className="gap-3">
            <Text className={TYPO_OVERLINE}>{t("insights.drawdown.curveTitle")}</Text>
            <CumulativeReturnChart
              data={curve}
              emptyLabel={t("insights.pnl.chart.empty")}
              formatScrubDate={(iso) => iso.slice(0, 10)}
            />
          </View>

          {perAsset.length > 0 ? (
            <View className="gap-1">
              <Text className={TYPO_OVERLINE}>{t("insights.drawdown.deepestAssetsTitle")}</Text>
              {perAsset.map((r) => {
                const { market, symbol } = parseAssetId(r.id);
                const name = catalog?.get(r.id)?.name ?? symbol;
                return (
                  <View key={r.id} className="flex-row items-center gap-3 py-2.5">
                    <AssetAvatar
                      symbol={symbol}
                      market={market}
                      marketLabel={marketLabel(market)}
                      imageUrl={resolveAssetLogoUrl(market, symbol)}
                      size={36}
                    />
                    <View className="flex-1 min-w-0">
                      <Text className={TYPO_ROW_TITLE} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text className={`${TYPO_CAPTION} text-muted`} numberOfLines={1}>
                        {`${marketLabel(market)} · ${symbol}`}
                      </Text>
                    </View>
                    <Text className={TYPO_ROW_VALUE}>{signedDrawdown(r.dd)}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Separator />
          <Text className="text-muted text-xs text-center">
            {t("insights.drawdown.disclaimer")}
          </Text>
        </View>
      </Screen>
    </>
  );
}
