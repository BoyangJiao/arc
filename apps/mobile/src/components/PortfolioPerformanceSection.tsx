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

import { benchmarkById, defaultBenchmarkId, PORTFOLIO_COLOR } from "../lib/benchmark-catalog";
import {
  useActivePortfolio,
  useAssetCatalog,
  useBenchmarkComparison,
  usePortfolioValueSnapshots,
} from "../lib/queries";
import { useUserPreferences } from "../lib/user-preferences";

const assetValueKey = (assetId: string) => `a_${assetId.replace(/[^a-zA-Z0-9]/g, "_")}`;

export const PortfolioPerformanceSection = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const { prefs } = useUserPreferences();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";

  const { portfolio } = useActivePortfolio();
  const portfolioId = portfolio?.id;
  const { data: valueSnapshots = [] } = usePortfolioValueSnapshots(portfolioId, DEFAULT_TIME_RANGE);

  // ─── 指数对标 entry preview (本组合 vs default benchmark, yearly thumbnail) ──
  const previewBenchmarkId = defaultBenchmarkId(reportingCurrency);
  const { data: benchmarkRows = [] } = useBenchmarkComparison({
    portfolioId,
    granularity: "year",
    benchmarkIds: [previewBenchmarkId],
  });
  const benchmarkPreviewData = useMemo<ArcBarChartRow[]>(
    () =>
      benchmarkRows
        .filter((r) => r.portfolioReturn !== null)
        .map((r) => ({
          label: r.label,
          port: r.portfolioReturn ?? 0,
          bm: r.benchmarkReturns[previewBenchmarkId] ?? 0,
        })),
    [benchmarkRows, previewBenchmarkId]
  );
  const benchmarkPreviewSeries = useMemo<ArcBarChartSeries[]>(
    () => [
      { key: "port", color: PORTFOLIO_COLOR },
      { key: "bm", color: benchmarkById(previewBenchmarkId)?.color ?? PORTFOLIO_COLOR },
    ],
    [previewBenchmarkId]
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

  const assetValueData = useMemo<Record<string, number>[]>(
    () =>
      valueSnapshots.map((snap, i) => {
        const row: Record<string, number> = { index: i };
        for (const id of topAssetIds) {
          row[assetValueKey(id)] = snap.perAssetReporting.get(id)?.toNumber() ?? 0;
        }
        return row;
      }),
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
            {benchmarkPreviewData.length > 0 ? (
              <BarChart
                data={benchmarkPreviewData}
                xKey="label"
                series={benchmarkPreviewSeries}
                height={140}
                barWidth={8}
              />
            ) : null}
          </View>
        </Card>
      </Pressable>
    </View>
  );
};
