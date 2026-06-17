/**
 * /insights/asset-value — 资产价值 detail (Delta「资产价值」UX pattern).
 *
 * Multi-asset value-over-time with a time-range selector, a scrub-synced header
 * legend (per-asset value at the touched date), and selectable asset chips
 * (toggle which holdings are plotted). Top holdings by latest reporting value;
 * active-portfolio scoped.
 */

import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Stack } from "expo-router";
import { parseAssetId } from "@arc/core";
import {
  ALLOCATION_PALETTE,
  DEFAULT_TIME_RANGE,
  InScreenHeader,
  InfoTooltipButton,
  MultiLineScrubChart,
  Screen,
  Text,
  TimeRangeSelector,
  TYPO_CAPTION,
  TYPO_CAPTION_FOREGROUND,
  TYPO_ROW_VALUE,
  scrollContentBelowInScreenHeader,
  type MultiLineSeries,
  type TimeRange,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { currencySymbol, formatMoney } from "../../src/lib/format-money";
import {
  useActivePortfolio,
  useAssetCatalog,
  usePortfolioValueSnapshots,
} from "../../src/lib/queries";
import { useAmountRedacted } from "../../src/lib/use-amount-redacted";
import { useUserPreferences } from "../../src/lib/user-preferences";

const MAX_SERIES = 6;
const seriesKey = (assetId: string) => `a_${assetId.replace(/[^a-zA-Z0-9]/g, "_")}`;

export default function AssetValueScreen() {
  const { t } = useTranslation();
  const { prefs } = useUserPreferences();
  const { amountsHidden } = useAmountRedacted();
  const reportingCurrency = prefs?.reportingCurrency ?? "CNY";

  const { portfolio } = useActivePortfolio();
  const portfolioId = portfolio?.id;
  const [range, setRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const { data: snapshots = [] } = usePortfolioValueSnapshots(portfolioId, range);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  // Candidate holdings = top MAX_SERIES by latest reporting value (stable color by rank).
  const candidates = useMemo(() => {
    const latest = snapshots[snapshots.length - 1];
    if (!latest) return [];
    return [...latest.perAssetReporting.entries()]
      .filter(([, v]) => v.greaterThan(0))
      .sort((a, b) => b[1].comparedTo(a[1]))
      .slice(0, MAX_SERIES)
      .map(([id], i) => ({
        id,
        key: seriesKey(id),
        symbol: parseAssetId(id).symbol,
        color: ALLOCATION_PALETTE[i % ALLOCATION_PALETTE.length]!,
      }));
  }, [snapshots]);

  const { data: catalog } = useAssetCatalog(
    useMemo(() => candidates.map((c) => c.id), [candidates])
  );

  const visible = useMemo(() => candidates.filter((c) => !hidden.has(c.id)), [candidates, hidden]);

  const series = useMemo<MultiLineSeries[]>(
    () => visible.map((c) => ({ key: c.key, label: c.symbol, color: c.color })),
    [visible]
  );

  const data = useMemo<Record<string, number>[]>(
    () =>
      snapshots.map((snap, i) => {
        const row: Record<string, number> = { index: i };
        for (const c of candidates) {
          row[c.key] = snap.perAssetReporting.get(c.id)?.toNumber() ?? 0;
        }
        return row;
      }),
    [snapshots, candidates]
  );

  const effectiveIndex = activeIndex ?? snapshots.length - 1;
  const activeSnapshot = snapshots[effectiveIndex];
  const money = (id: string): string => {
    const value = activeSnapshot?.perAssetReporting.get(id);
    return value ? formatMoney(value, reportingCurrency, { redact: amountsHidden }) : "—";
  };

  const toggle = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (candidates.length - next.size > 1) next.add(id); // keep ≥1 visible
      return next;
    });
  };

  const sym = currencySymbol(reportingCurrency);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
        <InScreenHeader
          title={t("insights.assetValue.title")}
          leftType="back"
          rightSlot={
            <InfoTooltipButton
              title={t("insights.assetValue.title")}
              body={t("insights.assetValue.info")}
              closeLabel={t("insights.pnl.tooltipClose")}
            />
          }
        />
        <View className="gap-5 pb-10">
          <TimeRangeSelector value={range} onChange={setRange} />

          {/* Scrub-synced header legend (value at the touched date). */}
          {visible.length > 0 ? (
            <View className="gap-2">
              {activeSnapshot ? (
                <Text className={`${TYPO_CAPTION} text-muted`}>
                  {activeSnapshot.asOf.slice(0, 10)}
                </Text>
              ) : null}
              <View className="flex-row flex-wrap gap-x-5 gap-y-2">
                {visible.map((c) => (
                  <View key={c.id} className="gap-0.5">
                    <View className="flex-row items-center gap-1.5">
                      <View className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                      <Text className={TYPO_CAPTION_FOREGROUND}>{c.symbol}</Text>
                    </View>
                    <Text className={TYPO_ROW_VALUE}>{money(c.id)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <MultiLineScrubChart
            data={data}
            series={series}
            heightClass="h-72"
            onActiveIndexChange={setActiveIndex}
          />

          {/* Selectable asset chips (toggle which holdings are plotted). */}
          {candidates.length > 1 ? (
            <View className="flex-row flex-wrap gap-2">
              {candidates.map((c) => {
                const isVisible = !hidden.has(c.id);
                const name = catalog?.get(c.id)?.name ?? c.symbol;
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={name}
                    onPress={() => toggle(c.id)}
                    className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border active:opacity-70"
                    style={{ borderColor: c.color, opacity: isVisible ? 1 : 0.4 }}
                  >
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <Text className={TYPO_CAPTION_FOREGROUND}>{c.symbol}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Text className="text-muted text-xs text-center">
            {`${sym} · ${t("insights.pnl.disclaimer")}`}
          </Text>
        </View>
      </Screen>
    </>
  );
}
