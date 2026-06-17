/**
 * PortfolioStatsSection — 组合统计 group on the Insights tab.
 *
 * IA (insights-enrichment-stage-3 §taxonomy): activity + risk indicators, kept
 * separate from portfolio-level P&L (盈亏分析) and per-asset breakdown (持仓表现).
 * Hosts:
 *   - 交易统计 (Trade activity) — trade count + assets traded (Free)
 *   - 风险 (Risk) — annualized volatility from the EOD value series (Pro)
 *   - 回撤 (Drawdown) — max drawdown in range (Pro)
 *
 * Active-portfolio scoped. Risk/drawdown require ≥2 EOD snapshots; otherwise only
 * 交易统计 shows. Volatility/drawdown were moved out of /insights/pnl-analysis.
 */

import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Decimal from "decimal.js";
import { insights } from "@arc/core";
import {
  CaretRightIcon,
  Card,
  DEFAULT_TIME_RANGE,
  InsightTierBadge,
  Text,
  ThemedIcon,
  TYPO_CAPTION,
  TYPO_LABEL,
  TYPO_METRIC,
  TYPO_SECTION_TITLE,
  type InsightTier,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useActivePortfolio, usePortfolioValueSnapshots, useTransactions } from "../lib/queries";

const pct1 = (d: Decimal): string => `${d.times(100).toFixed(1)}%`;

const StatCard = ({
  title,
  tier = "free",
  value,
  caption,
  onPress,
}: {
  title: string;
  tier?: InsightTier;
  value: string;
  caption: string;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={title}
    onPress={onPress}
    className="active:opacity-70"
  >
    <Card>
      <View className="gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <Text className={TYPO_LABEL}>{title}</Text>
            <InsightTierBadge tier={tier} />
          </View>
          <ThemedIcon icon={CaretRightIcon} size={16} colorToken="muted" />
        </View>
        <Text className={TYPO_METRIC}>{value}</Text>
        <Text className={`${TYPO_CAPTION} text-muted`}>{caption}</Text>
      </View>
    </Card>
  </Pressable>
);

export const PortfolioStatsSection = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { portfolio } = useActivePortfolio();
  const portfolioId = portfolio?.id;

  const { data: transactions = [] } = useTransactions(portfolioId);
  const { data: valueSnapshots = [] } = usePortfolioValueSnapshots(portfolioId, DEFAULT_TIME_RANGE);

  const tradeCount = transactions.length;
  const tradedAssetCount = useMemo(
    () => new Set(transactions.map((tx) => tx.assetId)).size,
    [transactions]
  );

  const valueSeries = useMemo(() => valueSnapshots.map((s) => s.totalValue), [valueSnapshots]);
  const hasRiskData = valueSeries.length >= 2;
  const annualVol = useMemo(() => insights.annualizedVolatility(valueSeries, 252), [valueSeries]);
  const maxDrawdown = useMemo(() => insights.maxDrawdown(valueSeries), [valueSeries]);

  if (!portfolio) return null;

  return (
    <View className="gap-3">
      <View className="px-0.5">
        <Text className={TYPO_SECTION_TITLE}>{t("insights.stats.title")}</Text>
      </View>

      <StatCard
        title={t("insights.tradeStats.title")}
        value={`${tradeCount}`}
        caption={t("insights.tradeStats.summary", { count: tradedAssetCount })}
        onPress={() => router.push("/insights/trade-stats" as Href)}
      />

      {hasRiskData ? (
        <>
          <StatCard
            title={t("insights.risk.title")}
            tier="pro"
            value={pct1(annualVol)}
            caption={t("insights.risk.volatilityLabel")}
            onPress={() => router.push("/insights/risk" as Href)}
          />

          <StatCard
            title={t("insights.drawdown.title")}
            tier="pro"
            value={maxDrawdown.isZero() ? pct1(maxDrawdown) : `-${pct1(maxDrawdown)}`}
            caption={t("insights.drawdown.maxLabel")}
            onPress={() => router.push("/insights/drawdown" as Href)}
          />
        </>
      ) : null}
    </View>
  );
};
