/**
 * ChartSeriesLegend — App Store–style horizontal legend for chart series.
 *
 * Items stack up to `maxRows` per column; columns share a fixed width so labels
 * truncate with ellipsis. Horizontal scroll snaps to column boundaries
 * (magnetic anchors).
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import { ScrollView, View, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "../primitives/Text";
import { TYPO_CAPTION_FOREGROUND } from "../tokens/typography";

/** Reserved label slot width (dot + gap included in column). */
export const CHART_LEGEND_COLUMN_WIDTH = 224;
const CHART_LEGEND_COLUMN_GAP = 12;
const CHART_LEGEND_ROW_GAP = 6;
const CHART_LEGEND_ROW_HEIGHT = 20;

export interface ChartSeriesLegendItem {
  readonly key: string;
  readonly label: string;
  readonly color: string;
}

export interface ChartSeriesLegendProps {
  readonly items: ReadonlyArray<ChartSeriesLegendItem>;
  /** Max items stacked vertically per snap column (default 3). */
  readonly maxRows?: number;
  readonly columnWidth?: number;
}

/** Pack items into vertical columns of at most `maxRows` (scroll snap unit). */
export function chunkLegendColumns<T>(items: readonly T[], maxRows: number): T[][] {
  if (items.length === 0 || maxRows < 1) return [];

  const columns: T[][] = [];
  for (let index = 0; index < items.length; index += maxRows) {
    columns.push(items.slice(index, index + maxRows));
  }
  return columns;
}

function LegendCell({ item, width }: { item: ChartSeriesLegendItem; width: number }): ReactNode {
  return (
    <View
      className="flex-row items-center gap-1.5"
      style={{ width, height: CHART_LEGEND_ROW_HEIGHT }}
    >
      <View className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
      <Text
        className={`${TYPO_CAPTION_FOREGROUND} min-w-0 flex-1`}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {item.label}
      </Text>
    </View>
  );
}

function LegendColumn({
  columnKey,
  items,
  maxRows,
  columnWidth,
  columnGap,
  isLast,
}: {
  columnKey: string;
  items: readonly ChartSeriesLegendItem[];
  maxRows: number;
  columnWidth: number;
  columnGap: number;
  isLast: boolean;
}): ReactNode {
  const slots = useMemo(
    () => Array.from({ length: maxRows }, (_, rowIndex) => items[rowIndex] ?? null),
    [items, maxRows]
  );

  const columnStyle: StyleProp<ViewStyle> = {
    width: columnWidth,
    marginRight: isLast ? 0 : columnGap,
    gap: CHART_LEGEND_ROW_GAP,
  };

  return (
    <View key={columnKey} style={columnStyle}>
      {slots.map((item, rowIndex) =>
        item ? (
          <LegendCell key={item.key} item={item} width={columnWidth} />
        ) : (
          <View key={`${columnKey}-pad-${rowIndex}`} style={{ height: CHART_LEGEND_ROW_HEIGHT }} />
        )
      )}
    </View>
  );
}

export function ChartSeriesLegend({
  items,
  maxRows = 3,
  columnWidth = CHART_LEGEND_COLUMN_WIDTH,
}: ChartSeriesLegendProps): ReactNode {
  if (items.length === 0) return null;

  const columns = chunkLegendColumns(items, maxRows);
  const snapInterval = columnWidth + CHART_LEGEND_COLUMN_GAP;

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={snapInterval}
      snapToAlignment="start"
      disableIntervalMomentum
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View className="flex-row">
        {columns.map((columnItems, columnIndex) => (
          <LegendColumn
            key={columnItems.map((item) => item.key).join("-")}
            columnKey={columnItems[0]!.key}
            items={columnItems}
            maxRows={maxRows}
            columnWidth={columnWidth}
            columnGap={CHART_LEGEND_COLUMN_GAP}
            isLast={columnIndex === columns.length - 1}
          />
        ))}
      </View>
    </ScrollView>
  );
}
