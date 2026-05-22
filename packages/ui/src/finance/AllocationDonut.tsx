/**
 * AllocationDonut — single-ring allocation by asset (Block C decision #9).
 * Simplified from DeviationDonut (no target ring).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import Decimal from "decimal.js";
import Svg, { G, Path } from "react-native-svg";

import { Text } from "../primitives/Text";
import { TYPO_CAPTION, TYPO_CAPTION_FOREGROUND } from "../tokens/typography";

export interface AllocationDonutSlice {
  readonly label: string;
  readonly value: Decimal;
  readonly color?: string;
}

export interface AllocationDonutProps {
  readonly slices: ReadonlyArray<AllocationDonutSlice>;
  readonly size?: number;
}

/* eslint-disable no-restricted-syntax -- SVG stroke/fill palette */
const SLICE_COLORS = ["#006fee", "#7828c8", "#f5a524", "#f31260", "#71717a", "#17c964"] as const;
/* eslint-enable no-restricted-syntax */

const polar = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (cx: number, cy: number, r: number, start: number, end: number): string => {
  if (end - start >= 359.99) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;
  }
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
};

export function AllocationDonut({ slices, size = 160 }: AllocationDonutProps): ReactNode {
  const total = slices.reduce((sum, s) => sum.plus(s.value), new Decimal(0));
  if (total.isZero()) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const strokeWidth = size * 0.14;

  let cursor = 0;

  return (
    <View className="flex-row items-center gap-4">
      <Svg width={size} height={size}>
        <G>
          {slices.map((slice, index) => {
            const pct = slice.value.div(total).times(100);
            const sweep = pct.toNumber();
            if (sweep <= 0) return null;
            const start = cursor;
            const end = cursor + (sweep / 100) * 360;
            cursor = end;
            const stroke = slice.color ?? SLICE_COLORS[index % SLICE_COLORS.length]!;
            return (
              <Path
                key={slice.label}
                d={arcPath(cx, cy, radius, start, end)}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
              />
            );
          })}
        </G>
      </Svg>
      <View className="flex-1 gap-1">
        {slices.map((slice, index) => {
          const pct = slice.value.div(total).times(100);
          const color = slice.color ?? SLICE_COLORS[index % SLICE_COLORS.length];
          return (
            <View key={slice.label} className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-2 flex-1 min-w-0">
                <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <Text className={TYPO_CAPTION_FOREGROUND} numberOfLines={1}>
                  {slice.label}
                </Text>
              </View>
              <Text className={TYPO_CAPTION}>{pct.toFixed(0)}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
