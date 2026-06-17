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
  CaretRightIcon,
  Card,
  DEFAULT_TIME_RANGE,
  InsightTierBadge,
  MultiLineChart,
  Text,
  ThemedIcon,
  TYPO_LABEL,
  TYPO_SECTION_TITLE,
  type MultiLineSeries,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useActivePortfolio, useAssetCatalog, usePortfolioValueSnapshots } from "../lib/queries";

const assetValueKey = (assetId: string) => `a_${assetId.replace(/[^a-zA-Z0-9]/g, "_")}`;

export const PortfolioPerformanceSection = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const { portfolio } = useActivePortfolio();
  const portfolioId = portfolio?.id;
  const { data: valueSnapshots = [] } = usePortfolioValueSnapshots(portfolioId, DEFAULT_TIME_RANGE);

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
    </View>
  );
};
