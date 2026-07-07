/**
 * /insights/trade-stats — 交易统计 detail (Delta「贸易统计」pattern).
 *
 * Total trade count + per-period bar chart (月/季度/年) + most-traded assets
 * ranking + link to the full transaction history. Active-portfolio scoped.
 */

import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import { parseAssetId, type Market } from "@arc/core";
import {
  AssetAvatar,
  BarChart,
  CaretRightIcon,
  Card,
  InScreenHeader,
  InfoTooltipButton,
  Screen,
  SegmentToggle,
  Separator,
  Text,
  ThemedIcon,
  TYPO_CAPTION,
  TYPO_DISPLAY_2XL,
  TYPO_OVERLINE,
  TYPO_ROW_TITLE,
  TYPO_ROW_VALUE,
  scrollContentBelowInScreenHeader,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { resolveAssetLogoUrl } from "../../src/lib/asset-logo-url";
import { useActivePortfolio, useAssetCatalog, useTransactions } from "../../src/lib/queries";

type Granularity = "month" | "quarter" | "year";
const BUCKET_COUNT = 7;

interface Bucket {
  readonly key: string;
  readonly label: string;
  count: number;
}

/** Build the last `BUCKET_COUNT` period buckets ending at the current period. */
const buildBuckets = (granularity: Granularity, now: Date): Bucket[] => {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const buckets: Bucket[] = [];
  for (let i = BUCKET_COUNT - 1; i >= 0; i -= 1) {
    if (granularity === "year") {
      const yy = y - i;
      buckets.push({ key: `${yy}`, label: `${yy}`, count: 0 });
    } else if (granularity === "quarter") {
      const q = Math.floor(m / 3); // 0-based quarter
      const total = y * 4 + q - i;
      const by = Math.floor(total / 4);
      const bq = total % 4;
      buckets.push({ key: `${by}-Q${bq}`, label: `Q${bq + 1} ${String(by).slice(2)}`, count: 0 });
    } else {
      const total = y * 12 + m - i;
      const by = Math.floor(total / 12);
      const bm = total % 12;
      buckets.push({
        key: `${by}-${bm}`,
        label: `${by}/${String(bm + 1).padStart(2, "0")}`,
        count: 0,
      });
    }
  }
  return buckets;
};

const bucketKeyOf = (date: Date, granularity: Granularity): string => {
  const y = date.getFullYear();
  const m = date.getMonth();
  if (granularity === "year") return `${y}`;
  if (granularity === "quarter") return `${y}-Q${Math.floor(m / 3)}`;
  return `${y}-${m}`;
};

export default function TradeStatsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { portfolio } = useActivePortfolio();
  const portfolioId = portfolio?.id;
  const { data: transactions = [] } = useTransactions(portfolioId);

  const [granularity, setGranularity] = useState<Granularity>("quarter");

  const assetIds = useMemo(
    () => [...new Set(transactions.map((tx) => tx.assetId))],
    [transactions]
  );
  const { data: catalog } = useAssetCatalog(assetIds);

  const buckets = useMemo(() => {
    const list = buildBuckets(granularity, new Date());
    const byKey = new Map(list.map((b) => [b.key, b]));
    for (const tx of transactions) {
      const bucket = byKey.get(bucketKeyOf(new Date(tx.tradeDate), granularity));
      if (bucket) bucket.count += 1;
    }
    return list;
  }, [transactions, granularity]);

  const chartData = useMemo(
    () => buckets.map((b) => ({ label: b.label, count: b.count })),
    [buckets]
  );

  const ranking = useMemo(() => {
    const byAsset = new Map<string, number>();
    for (const tx of transactions) byAsset.set(tx.assetId, (byAsset.get(tx.assetId) ?? 0) + 1);
    return [...byAsset.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [transactions]);

  const total = transactions.length;
  const marketLabel = (m: Market) => t(`holdings.markets.${m}` as "holdings.markets.US");

  const granularityOptions = [
    { value: "month" as const, label: t("insights.tradeStats.granularity.month") },
    { value: "quarter" as const, label: t("insights.tradeStats.granularity.quarter") },
    { value: "year" as const, label: t("insights.tradeStats.granularity.year") },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
        <InScreenHeader
          title={t("insights.tradeStats.title")}
          leftType="back"
          rightSlot={
            <InfoTooltipButton
              title={t("insights.tradeStats.title")}
              body={t("insights.tradeStats.info")}
              closeLabel={t("insights.pnl.tooltipClose")}
            />
          }
        />
        <View className="gap-6 pb-10">
          <View className="flex-row items-end justify-between gap-3">
            <View className="gap-0.5">
              <Text className={`${TYPO_CAPTION} text-muted`}>
                {t("insights.tradeStats.totalLabel")}
              </Text>
              <Text className={TYPO_DISPLAY_2XL}>{total}</Text>
            </View>
            <SegmentToggle
              options={granularityOptions}
              value={granularity}
              onChange={setGranularity}
            />
          </View>

          <BarChart data={chartData} xKey="label" series={[{ key: "count" }]} height={224} />

          {ranking.length > 0 ? (
            <View className="gap-1">
              <Text className={TYPO_OVERLINE}>{t("insights.tradeStats.mostTradedTitle")}</Text>
              {ranking.map(([assetId, count], i) => {
                const { market, symbol } = parseAssetId(assetId);
                const name = catalog?.get(assetId)?.name ?? symbol;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <View key={assetId} className="flex-row items-center gap-3 py-2.5">
                    <Text className={`${TYPO_CAPTION} text-muted w-4`}>{i + 1}</Text>
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
                    <View className="items-end shrink-0">
                      <Text className={TYPO_ROW_VALUE}>
                        {t("insights.tradeStats.tradeCount", { count })}
                      </Text>
                      <Text className={`${TYPO_CAPTION} text-muted`}>{`${pct}%`}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {portfolioId ? (
            <>
              <Separator />
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/portfolio/${portfolioId}/transactions` as Href)}
                className="active:opacity-70"
              >
                <Card>
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className={TYPO_ROW_TITLE}>{t("insights.tradeStats.viewHistory")}</Text>
                    <ThemedIcon icon={CaretRightIcon} size={18} colorToken="muted" />
                  </View>
                </Card>
              </Pressable>
            </>
          ) : null}
        </View>
      </Screen>
    </>
  );
}
