/**
 * HoldingsTable — multi-market grouped holdings list.
 */

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import type { RebalanceMarket } from "./rebalance-types";

import { Text } from "../primitives/Text";

import { HoldingRow, type HoldingRowProps } from "./HoldingRow";

/** Market section order — Block C spec decision #4. */
export const HOLDINGS_MARKET_ORDER: readonly RebalanceMarket[] = [
  "US",
  "CN",
  "HK",
  "FUND",
  "CRYPTO",
  "CASH",
] as const;

export interface HoldingsTableRow extends Omit<HoldingRowProps, "onPress"> {
  readonly assetId: string;
  readonly market: RebalanceMarket;
}

export interface HoldingsTableProps {
  readonly rows: ReadonlyArray<HoldingsTableRow>;
  /** Parent formats section header including market subtotal (dual-currency aware). */
  readonly getSectionHeader: (market: RebalanceMarket) => string;
  readonly collapseLabel: string;
  readonly expandLabel: string;
  readonly onRowPress: (assetId: string) => void;
}

const groupByMarket = (
  rows: ReadonlyArray<HoldingsTableRow>
): Map<RebalanceMarket, HoldingsTableRow[]> => {
  const map = new Map<RebalanceMarket, HoldingsTableRow[]>();
  for (const row of rows) {
    const list = map.get(row.market) ?? [];
    list.push(row);
    map.set(row.market, list);
  }
  return map;
};

export function HoldingsTable({
  rows,
  getSectionHeader,
  collapseLabel,
  expandLabel,
  onRowPress,
}: HoldingsTableProps): ReactNode {
  const grouped = useMemo(() => groupByMarket(rows), [rows]);
  const [collapsed, setCollapsed] = useState<Partial<Record<RebalanceMarket, boolean>>>({});

  if (rows.length === 0) return null;

  return (
    <View className="gap-3">
      {HOLDINGS_MARKET_ORDER.map((market) => {
        const sectionRows = grouped.get(market);
        if (!sectionRows || sectionRows.length === 0) return null;

        const isCollapsed = collapsed[market] === true;
        const header = getSectionHeader(market);

        return (
          <View key={market} className="gap-2">
            <Pressable
              className="flex-row items-center justify-between py-1"
              onPress={() => setCollapsed((prev) => ({ ...prev, [market]: !isCollapsed }))}
              accessibilityRole="button"
              accessibilityLabel={isCollapsed ? expandLabel : collapseLabel}
            >
              <Text className="text-foreground font-semibold text-sm">{header}</Text>
              <Text className="text-muted text-xs">
                {isCollapsed ? expandLabel : collapseLabel}
              </Text>
            </Pressable>
            {!isCollapsed
              ? sectionRows.map((row) => (
                  <HoldingRow
                    key={row.assetId}
                    symbol={row.symbol}
                    name={row.name}
                    sharesLabel={row.sharesLabel}
                    priceLabel={row.priceLabel}
                    nativeValueLabel={row.nativeValueLabel}
                    reportingValueLabel={row.reportingValueLabel}
                    changePercent={row.changePercent}
                    formatPercent={row.formatPercent}
                    onPress={() => onRowPress(row.assetId)}
                  />
                ))
              : null}
          </View>
        );
      })}
    </View>
  );
}
