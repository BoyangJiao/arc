/**
 * DeviationDonut — double-ring target (outer) vs current (inner) allocation view.
 *
 * Implemented with react-native-svg (Victory Native not in tree yet; spec allows
 * noting Web quality — same component on RN + Web via react-native-web).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { Text } from "../primitives/Text";
import { CHART_CATEGORICAL_PALETTE } from "../tokens/chart-palette";
import { TYPO_CAPTION, TYPO_CAPTION_FOREGROUND } from "../tokens/typography";

import type { RebalanceDonutSegment } from "./rebalance-types";

export interface DeviationDonutProps {
  readonly targetSegments: ReadonlyArray<RebalanceDonutSegment>;
  readonly currentSegments: ReadonlyArray<RebalanceDonutSegment>;
  readonly size?: number;
}

/* Canonical categorical palette (tokens/chart-palette.ts) — same source as
   AllocationDonut + TargetAllocationForm so a given asset keeps one color
   across the whole rebalance flow. */
const RING_STROKE_PALETTE = CHART_CATEGORICAL_PALETTE;

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

const Ring = ({
  cx,
  cy,
  radius,
  segments,
  strokeWidth,
}: {
  cx: number;
  cy: number;
  radius: number;
  segments: ReadonlyArray<RebalanceDonutSegment>;
  strokeWidth: number;
}): ReactNode => {
  let cursor = 0;
  return (
    <G>
      {segments.map((seg, index) => {
        const sweep = seg.percent.toNumber();
        if (sweep <= 0) return null;
        const start = cursor;
        const end = cursor + (sweep / 100) * 360;
        cursor = end;
        const d = arcPath(cx, cy, radius, start, end);
        const stroke = RING_STROKE_PALETTE[index % RING_STROKE_PALETTE.length]!;
        return (
          <Path
            key={seg.assetId}
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
        );
      })}
    </G>
  );
};

export function DeviationDonut({
  targetSegments,
  currentSegments,
  size = 200,
}: DeviationDonutProps): ReactNode {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.28;
  const outerStroke = size * 0.09;
  const innerStroke = size * 0.08;

  const legend = targetSegments.length > 0 ? targetSegments : currentSegments;

  return (
    <View className="flex-row items-center gap-4">
      <Svg width={size} height={size}>
        <Ring cx={cx} cy={cy} radius={outerR} segments={targetSegments} strokeWidth={outerStroke} />
        <Ring
          cx={cx}
          cy={cy}
          radius={innerR}
          segments={currentSegments}
          strokeWidth={innerStroke}
        />
      </Svg>
      <View className="flex-1 gap-1">
        {legend.map((seg, index) => (
          <View key={seg.assetId} className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2 flex-1 min-w-0">
              <View
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: RING_STROKE_PALETTE[index % RING_STROKE_PALETTE.length],
                }}
              />
              <Text className={TYPO_CAPTION_FOREGROUND} numberOfLines={1}>
                {seg.label}
              </Text>
            </View>
            <Text className={`${TYPO_CAPTION} tabular-nums`}>{seg.percent.toFixed(0)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
