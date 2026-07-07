/**
 * PortfolioPerformanceSection — 投资组合表现 group on the Insights tab.
 *
 * Portfolio-level performance views. Currently hosts 资产价值 (multi-asset value
 * over time, tap → /insights/asset-value). 收益报告 was removed (2026-06-17);
 * 组合 vs 基准 (#9 benchmark comparison) will land here once the index adapter
 * exists. Active-portfolio scoped; renders nothing without valued holdings.
 *
 * (Formerly PortfolioHoldingsPerformanceSection / 持仓表现.)
 */

import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { parseAssetId } from "@arc/core";
import {
  ALLOCATION_PALETTE,
  BarChart,
  CaretRightIcon,
  Card,
  DEFAULT_TIME_RANGE,
  InsightTierBadge,
  MultiLineChart,
  Text,
  ThemedIcon,
  TYPO_LABEL,
  TYPO_SECTION_TITLE,
  type ArcBarChartRow,
  type ArcBarChartSeries,
  type MultiLineSeries,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import {
  benchmarkById,
  ENTRY_PREVIEW_BENCHMARK_IDS,
  ENTRY_PREVIEW_GRANULARITY,
  PORTFOLIO_COLOR,
} from "../lib/benchmark-catalog";
import { buildForwardFilledAssetSeries } from "../lib/snapshot-asset-series";
import {
  useActivePortfolio,
  useAssetCatalog,
  useBenchmarkComparison,
  usePortfolioValueSnapshots,
} from "../lib/queries";

const assetValueKey = (assetId: string) => `a_${assetId.replace(/[^a-zA-Z0-9]/g, "_")}`;
const benchmarkSeriesKey = (id: string) => `bm_${id}`;

export const PortfolioPerformanceSection = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const { portfolio } = useActivePortfolio();
  const portfolioId = portfolio?.id;
  const { data: valueSnapshots = [] } = usePortfolioValueSnapshots(portfolioId, DEFAULT_TIME_RANGE);

  // ─── 指数对标 entry preview (季度 · 沪深300 + 中证500) ─────────────────────
  const {
    data: benchmarkRows = [],
    isPending: benchmarkPending,
    isFetching: benchmarkFetching,
  } = useBenchmarkComparison({
    portfolioId,
    granularity: ENTRY_PREVIEW_GRANULARITY,
    benchmarkIds: ENTRY_PREVIEW_BENCHMARK_IDS,
  });
  const benchmarkPreviewData = useMemo<ArcBarChartRow[]>(
    () =>
      benchmarkRows
        .filter((r) => r.portfolioReturn !== null)
        .map((r) => {
          const row: ArcBarChartRow = { label: r.label, port: r.portfolioReturn ?? 0 };
          for (const id of ENTRY_PREVIEW_BENCHMARK_IDS) {
            row[benchmarkSeriesKey(id)] = r.benchmarkReturns[id] ?? 0;
          }
          return row;
        }),
    [benchmarkRows]
  );
  const benchmarkPreviewLoading =
    benchmarkPending || (benchmarkFetching && benchmarkPreviewData.length === 0);
  const benchmarkPreviewSeries = useMemo<ArcBarChartSeries[]>(
    () => [
      { key: "port", color: PORTFOLIO_COLOR },
      ...ENTRY_PREVIEW_BENCHMARK_IDS.map((id) => ({
        key: benchmarkSeriesKey(id),
        color: benchmarkById(id)?.color ?? PORTFOLIO_COLOR,
      })),
    ],
    []
  );

  // ─── 资产价值 (top holdings by latest reporting value) ─────────────────────
  const topAssetIds = useMemo(() => {
    const latest = valueSnapshots[valueSnapshots.length - 1];
    if (!latest) return [];
    return [...latest.perAssetReporting.entries()]
      .filter(([, v]) => v.greaterThan(0))
      .sort((a, b) => b[1].comparedTo(a[1]))
      .slice(0, 6)
      .map(([id]) => id);
  }, [valueSnapshots]);

  const { data: catalog } = useAssetCatalog(topAssetIds);

  const assetValueData = useMemo(
    () => buildForwardFilledAssetSeries(valueSnapshots, topAssetIds, assetValueKey),
    [valueSnapshots, topAssetIds]
  );
  const assetValueSeries = useMemo<MultiLineSeries[]>(
    () =>
      topAssetIds.map((id, i) => ({
        key: assetValueKey(id),
        label: catalog?.get(id)?.name ?? parseAssetId(id).symbol,
        color: ALLOCATION_PALETTE[i % ALLOCATION_PALETTE.length]!,
      })),
    [topAssetIds, catalog]
  );

  if (!portfolio) return null;
  if (assetValueSeries.length === 0) return null;

  return (
    <View className="gap-3">
      <View className="px-0.5">
        <Text className={TYPO_SECTION_TITLE}>{t("insights.portfolioPerformance.title")}</Text>
      </View>

      <Card>
        <View className="gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("insights.assetValue.title")}
            onPress={() => router.push("/insights/asset-value" as Href)}
            className="flex-row items-center justify-between gap-2 active:opacity-70"
          >
            <View className="flex-row items-center gap-2">
              <Text className={TYPO_LABEL}>{t("insights.assetValue.title")}</Text>
              <InsightTierBadge tier="pro" />
            </View>
            <ThemedIcon icon={CaretRightIcon} size={16} colorToken="muted" />
          </Pressable>
          <MultiLineChart data={assetValueData} series={assetValueSeries} />
        </View>
      </Card>

      {/* 指数对标 — entry → /insights/benchmark (#9). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("insights.benchmark.title")}
        onPress={() => router.push("/insights/benchmark" as Href)}
        className="active:opacity-70"
      >
        <Card>
          <View className="gap-3">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-2">
                <Text className={TYPO_LABEL}>{t("insights.benchmark.title")}</Text>
                <InsightTierBadge tier="proPlus" />
              </View>
              <ThemedIcon icon={CaretRightIcon} size={16} colorToken="muted" />
            </View>
            {benchmarkPreviewLoading ? (
              <Text className="text-muted text-sm text-center py-6">{t("common.loading")}</Text>
            ) : benchmarkPreviewData.length > 0 ? (
              <BarChart
                data={benchmarkPreviewData}
                xKey="label"
                series={benchmarkPreviewSeries}
                height={140}
                barWidth={6}
              />
            ) : null}
          </View>
        </Card>
      </Pressable>

      {/* 业绩归因 — entry → /insights/attribution (#8). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("insights.attribution.title")}
        onPress={() => router.push("/insights/attribution" as Href)}
        className="active:opacity-70"
      >
        <Card>
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2">
              <Text className={TYPO_LABEL}>{t("insights.attribution.title")}</Text>
              <InsightTierBadge tier="pro" />
            </View>
            <ThemedIcon icon={CaretRightIcon} size={16} colorToken="muted" />
          </View>
        </Card>
      </Pressable>
    </View>
  );
};
