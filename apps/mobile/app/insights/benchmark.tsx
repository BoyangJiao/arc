/**
 * /insights/benchmark — 指数对标 detail (#9; Delta「投资组合表现」UX pattern).
 *
 * Grouped bars per calendar bucket (月/季度/年): 本组合 per-bucket TWR vs each
 * selected benchmark's price return. Benchmark chips toggle ≤2 selections.
 * Active-portfolio scoped. 文案铁律: neutral — no "跑输就该换/调仓" guidance.
 */

import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Stack } from "expo-router";
import {
  BarChart,
  InScreenHeader,
  InfoTooltipButton,
  Screen,
  SegmentToggle,
  Text,
  TYPO_CAPTION,
  TYPO_CAPTION_FOREGROUND,
  TYPO_OVERLINE,
  scrollContentBelowInScreenHeader,
  type ArcBarChartRow,
  type ArcBarChartSeries,
} from "@arc/ui";
import type { insights } from "@arc/core";
import { useTranslation } from "@arc/i18n";

import { BENCHMARKS, benchmarkById, defaultBenchmarkId } from "../../src/lib/benchmark-catalog";
import { useBenchmarkSelectionStore } from "../../src/lib/store/benchmark-selection";
import { useActivePortfolio, useBenchmarkComparison } from "../../src/lib/queries";
import { useUserPreferences } from "../../src/lib/user-preferences";

type Granularity = insights.BucketGranularity;

// Bar + matching legend-dot color tokens (literal so Tailwind scans them).
const SERIES_STYLE = [
  { bar: "accent-chart-1", dot: "bg-accent-chart-1" },
  { bar: "accent-chart-3", dot: "bg-accent-chart-3" },
  { bar: "accent-chart-4", dot: "bg-accent-chart-4" },
] as const;

export default function BenchmarkScreen() {
  const { t } = useTranslation();
  const { prefs } = useUserPreferences();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";

  const { portfolio } = useActivePortfolio();
  const portfolioId = portfolio?.id;

  const [granularity, setGranularity] = useState<Granularity>("year");
  const selectionByPortfolio = useBenchmarkSelectionStore((s) => s.byPortfolio);
  const toggle = useBenchmarkSelectionStore((s) => s.toggle);

  const selected = portfolioId ? (selectionByPortfolio[portfolioId] ?? []) : [];
  const effectiveIds = useMemo(
    () => (selected.length > 0 ? selected : [defaultBenchmarkId(reportingCurrency)]),
    [selected, reportingCurrency]
  );

  const { data: rows = [] } = useBenchmarkComparison({
    portfolioId,
    granularity,
    benchmarkIds: effectiveIds,
  });

  const benchmarkName = (id: string) =>
    t(
      `insights.benchmark.names.${benchmarkById(id)?.nameKey ?? id}` as "insights.benchmark.names.SPX"
    );

  // Only buckets where the portfolio actually has a return (post-inception).
  const shown = useMemo(() => rows.filter((r) => r.portfolioReturn !== null), [rows]);

  const chartData = useMemo<ArcBarChartRow[]>(
    () =>
      shown.map((r) => {
        const row: ArcBarChartRow = { label: r.label, port: r.portfolioReturn ?? 0 };
        for (const id of effectiveIds) row[`bm_${id}`] = r.benchmarkReturns[id] ?? 0;
        return row;
      }),
    [shown, effectiveIds]
  );

  const series = useMemo<ArcBarChartSeries[]>(
    () => [
      { key: "port", colorClassName: SERIES_STYLE[0].bar },
      ...effectiveIds.map((id, i) => ({
        key: `bm_${id}`,
        colorClassName: SERIES_STYLE[(i % 2) + 1].bar,
      })),
    ],
    [effectiveIds]
  );

  const legend = [
    { label: t("insights.benchmark.portfolioLabel"), dot: SERIES_STYLE[0].dot },
    ...effectiveIds.map((id, i) => ({
      label: benchmarkName(id),
      dot: SERIES_STYLE[(i % 2) + 1].dot,
    })),
  ];

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
          title={t("insights.benchmark.title")}
          leftType="back"
          rightSlot={
            <InfoTooltipButton
              title={t("insights.benchmark.title")}
              body={t("insights.benchmark.info")}
              closeLabel={t("insights.pnl.tooltipClose")}
            />
          }
        />
        <View className="gap-6 pb-10">
          <View className="flex-row justify-end">
            <SegmentToggle
              options={granularityOptions}
              value={granularity}
              onChange={setGranularity}
            />
          </View>

          {chartData.length > 0 ? (
            <View className="gap-3">
              <BarChart data={chartData} xKey="label" series={series} height={240} />
              <View className="flex-row flex-wrap gap-x-4 gap-y-1.5">
                {legend.map((l) => (
                  <View key={l.label} className="flex-row items-center gap-1.5">
                    <View className={`w-2.5 h-2.5 rounded-full ${l.dot}`} />
                    <Text className={TYPO_CAPTION_FOREGROUND}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text className={`${TYPO_CAPTION} text-muted text-center py-8`}>
              {t("insights.benchmark.empty")}
            </Text>
          )}

          {/* Benchmark chips (toggle ≤2). */}
          <View className="gap-2">
            <Text className={TYPO_OVERLINE}>{t("insights.benchmark.pickLabel")}</Text>
            <View className="flex-row flex-wrap gap-2">
              {BENCHMARKS.map((b) => {
                const active = effectiveIds.includes(b.id);
                return (
                  <Pressable
                    key={b.id}
                    accessibilityRole="button"
                    onPress={() => portfolioId && toggle(portfolioId, b.id)}
                    className={`px-3 py-1.5 rounded-full border active:opacity-70 ${
                      active ? "bg-accent-soft border-accent-soft" : "border-border"
                    }`}
                  >
                    <Text
                      className={
                        active ? "text-accent-soft-foreground text-sm" : "text-muted text-sm"
                      }
                    >
                      {benchmarkName(b.id)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text className="text-muted text-xs text-center">
            {t("insights.benchmark.disclaimer")}
          </Text>
        </View>
      </Screen>
    </>
  );
}
