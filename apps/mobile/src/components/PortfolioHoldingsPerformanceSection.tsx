/**
 * PortfolioHoldingsPerformanceSection — 持仓表现 group on the Insights tab.
 *
 * IA (insights-enrichment-stage-3 §taxonomy): per-asset breakdown views live
 * together, separate from portfolio-level P&L (盈亏分析 detail) and from
 * risk/activity stats (组合统计). Hosts:
 *   - 收益报告 (Returns report) — per-asset unrealized P&L table (Free)
 *   - 资产价值 (Asset value) — multi-asset value-over-time, top holdings (Pro)
 *
 * Active-portfolio scoped (matches 盈亏分析 entry). Renders nothing when the
 * active portfolio has no valued holdings.
 */

import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import type Decimal from "decimal.js";
import { parseAssetId, type Currency, type Market } from "@arc/core";
import {
  ALLOCATION_PALETTE,
  CaretRightIcon,
  Card,
  DEFAULT_TIME_RANGE,
  InsightTierBadge,
  MultiLineChart,
  RankingRow,
  Text,
  ThemedIcon,
  TYPO_LABEL,
  TYPO_SECTION_TITLE,
  formatCompactChangeLine,
  formatSignedPercent,
  type MultiLineSeries,
  type PnlSign,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { resolveAssetLogoUrl } from "../lib/asset-logo-url";
import { formatSharesWithUnit } from "../lib/rebalance-format";
import { currencySymbol } from "../lib/format-money";
import {
  useActivePortfolio,
  useAssetCatalog,
  usePortfolioValuation,
  usePortfolioValueSnapshots,
} from "../lib/queries";
import { useAmountRedacted } from "../lib/use-amount-redacted";
import { useUserPreferences } from "../lib/user-preferences";

const signOf = (value: Decimal | null | undefined): PnlSign =>
  !value || value.isZero() ? "neutral" : value.isNegative() ? "loss" : "gain";

const assetValueKey = (assetId: string) => `a_${assetId.replace(/[^a-zA-Z0-9]/g, "_")}`;

export const PortfolioHoldingsPerformanceSection = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { prefs } = useUserPreferences();
  const { amountsHidden } = useAmountRedacted();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";
  const sym = currencySymbol(reportingCurrency);

  const { portfolio } = useActivePortfolio();
  const portfolioId = portfolio?.id;

  const valuationQuery = usePortfolioValuation(portfolioId, reportingCurrency);
  const valuation = valuationQuery.data ?? null;
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

  const assetIds = useMemo(() => {
    const ids = new Set<string>(topAssetIds);
    valuation?.perAsset.forEach((v) => ids.add(v.assetId));
    return [...ids];
  }, [topAssetIds, valuation]);
  const { data: catalog } = useAssetCatalog(assetIds);

  const marketLabel = (m: Market) => t(`holdings.markets.${m}` as "holdings.markets.US");
  const signedAmount = (amount: Decimal): string =>
    formatCompactChangeLine(amount, null, sym, { redactAmount: amountsHidden });

  const shareUnits = useMemo(
    () => ({ share: t("rebalance.units.share"), fund: t("rebalance.units.fund") }),
    [t]
  );

  // ─── 收益报告 (per-asset unrealized P&L; realized deferred — needs historical FX) ──
  const returnsRows = useMemo(() => {
    if (!valuation) return [];
    return [...valuation.perAsset]
      .sort((a, b) => b.unrealizedPnL.comparedTo(a.unrealizedPnL))
      .map((v) => {
        const { market, symbol } = parseAssetId(v.assetId);
        return {
          assetId: v.assetId,
          name: catalog?.get(v.assetId)?.name ?? symbol,
          symbol,
          market,
          marketLabel: marketLabel(market),
          imageUrl: resolveAssetLogoUrl(market, symbol),
          symbolLabel: formatSharesWithUnit(
            v.shares,
            market,
            v.nativeCurrency as Currency,
            shareUnits
          ),
          contributionLabel: signedAmount(v.unrealizedPnL),
          sign: signOf(v.unrealizedPnL),
          rightSubLabel: formatSignedPercent(v.unrealizedPnLPercent),
        };
      });
  }, [valuation, catalog, shareUnits, amountsHidden]);

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

  const handleRowPress = (assetId: string) => {
    const { market, symbol } = parseAssetId(assetId);
    router.push(`/asset/${market}/${symbol}` as Href);
  };

  if (!portfolio) return null;
  if (returnsRows.length === 0 && assetValueSeries.length === 0) return null;

  return (
    <View className="gap-3">
      <View className="px-0.5">
        <Text className={TYPO_SECTION_TITLE}>{t("insights.holdingsPerformance.title")}</Text>
      </View>

      {returnsRows.length > 0 ? (
        <Card>
          <View className="gap-3">
            <Text className={TYPO_LABEL}>{t("insights.returns.title")}</Text>
            <View className="-my-1">
              {returnsRows.map((row) => (
                <RankingRow
                  key={row.assetId}
                  name={row.name}
                  symbol={row.symbol}
                  market={row.market}
                  marketLabel={row.marketLabel}
                  imageUrl={row.imageUrl}
                  symbolLabel={row.symbolLabel}
                  contributionLabel={row.contributionLabel}
                  sign={row.sign}
                  rightSubLabel={row.rightSubLabel}
                  onPress={() => handleRowPress(row.assetId)}
                />
              ))}
            </View>
          </View>
        </Card>
      ) : null}

      {assetValueSeries.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("insights.assetValue.title")}
          onPress={() => router.push("/insights/asset-value" as Href)}
          className="active:opacity-70"
        >
          <Card>
            <View className="gap-3">
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-row items-center gap-2">
                  <Text className={TYPO_LABEL}>{t("insights.assetValue.title")}</Text>
                  <InsightTierBadge tier="pro" />
                </View>
                <ThemedIcon icon={CaretRightIcon} size={16} colorToken="muted" />
              </View>
              <MultiLineChart data={assetValueData} series={assetValueSeries} />
            </View>
          </Card>
        </Pressable>
      ) : null}
    </View>
  );
};
