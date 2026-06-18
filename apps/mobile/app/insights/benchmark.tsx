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

import {
  BENCHMARKS,
  benchmarkById,
  defaultBenchmarkId,
  PORTFOLIO_COLOR,
} from "../../src/lib/benchmark-catalog";
import { useBenchmarkSelectionStore } from "../../src/lib/store/benchmark-selection";
import { useActivePortfolio, useBenchmarkComparison } from "../../src/lib/queries";
import { useUserPreferences } from "../../src/lib/user-preferences";

type Granularity = insights.BucketGranularity;
const benchmarkColor = (id: string): string => benchmarkById(id)?.color ?? PORTFOLIO_COLOR;

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
      { key: "port", color: PORTFOLIO_COLOR },
      ...effectiveIds.map((id) => ({ key: `bm_${id}`, color: benchmarkColor(id) })),
    ],
    [effectiveIds]
  );

  const legend = [
    { label: t("insights.benchmark.portfolioLabel"), color: PORTFOLIO_COLOR },
    ...effectiveIds.map((id) => ({ label: benchmarkName(id), color: benchmarkColor(id) })),
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
                    <View
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: l.color }}
                    />
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
                    className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border active:opacity-70 ${
                      active ? "bg-surface-secondary border-foreground/30" : "border-border"
                    }`}
                  >
                    <View
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: b.color, opacity: active ? 1 : 0.4 }}
                    />
                    <Text className={active ? "text-foreground text-sm" : "text-muted text-sm"}>
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
