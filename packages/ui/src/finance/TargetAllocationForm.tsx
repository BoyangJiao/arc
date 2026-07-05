/**
 * TargetAllocationForm — target % editor (J9), redesigned to the Binance/BitePal
 * pattern: a sum-to-100 donut header + per-asset slider with a numeric readout
 * and a "Now: X%" current-weight sub-label.
 *
 * The donut ring fills to the absolute target total (gap when < 100, full at
 * 100), so "do my targets add up?" is legible at a glance. Presentational —
 * Decimal math + validation stay on the screen.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import type Decimal from "decimal.js";

import { AssetAvatar } from "./AssetAvatar";
import { Label, Slider, Text } from "../primitives";
import { NumberField } from "../primitives-pro";
import { useBusinessClasses } from "../tokens/business-context";
import { CHART_CATEGORICAL_PALETTE } from "../tokens/chart-palette";
import { TYPO_BODY_MEDIUM, TYPO_CAPTION, TYPO_LABEL, typographyClass } from "../tokens/typography";
import type { RebalanceMarket } from "./rebalance-types";

export interface TargetAllocationFormRow {
  readonly assetId: string;
  readonly label: string;
  readonly subtitle?: string;
  /** Leading asset avatar. */
  readonly symbol: string;
  readonly market: RebalanceMarket;
  readonly marketLabel: string;
  readonly imageUrl?: string | null;
  /** Pre-formatted current weight, e.g. "当前 12.3%". */
  readonly currentWeightLabel?: string;
  readonly percentInput: string;
  readonly onPercentChange: (value: string) => void;
}

export type TargetSumStatus = "under" | "over" | "ok";

export interface TargetAllocationFormProps {
  readonly rows: ReadonlyArray<TargetAllocationFormRow>;
  readonly sumActual: Decimal;
  readonly sumStatus: TargetSumStatus;
  readonly sumDelta: Decimal;
  readonly sumLabel: string;
  readonly sumHint?: string;
  readonly percentSuffix: string;
}

const parsePercentInput = (raw: string): number => {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return Number.NaN;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
};

/* Ring colors from the canonical categorical palette (tokens/chart-palette.ts)
   — same source as AllocationDonut + DeviationDonut. */
const RING_PALETTE = CHART_CATEGORICAL_PALETTE;
/* eslint-disable no-restricted-syntax -- neutral ring track, not a data color */
const TRACK_STROKE = "rgba(127,127,127,0.18)";
/* eslint-enable no-restricted-syntax */

const polar = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (cx: number, cy: number, r: number, start: number, end: number): string => {
  if (end - start >= 359.99) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
};

function SumDonut({
  segments,
  centerLabel,
  centerColorClass,
  size = 132,
}: {
  segments: ReadonlyArray<number>;
  centerLabel: string;
  centerColorClass: string;
  size?: number;
}): ReactNode {
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = size * 0.1;
  const radius = size * 0.42;
  let cursor = 0;

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={TRACK_STROKE}
          strokeWidth={strokeWidth}
        />
        <G>
          {segments.map((value, index) => {
            if (value <= 0) return null;
            const start = cursor;
            const end = Math.min(cursor + (value / 100) * 360, 359.99);
            cursor = end;
            return (
              <Path
                key={index}
                d={arcPath(cx, cy, radius, start, end)}
                fill="none"
                stroke={RING_PALETTE[index % RING_PALETTE.length]!}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
              />
            );
          })}
        </G>
      </Svg>
      <Text className={typographyClass("display", centerColorClass, "leading-none")}>
        {centerLabel}
      </Text>
    </View>
  );
}

export function TargetAllocationForm({
  rows,
  sumActual,
  sumLabel,
  sumHint,
  sumStatus,
  percentSuffix,
}: TargetAllocationFormProps): ReactNode {
  const classes = useBusinessClasses();
  const sumColorClass =
    sumStatus === "ok"
      ? classes.pnlNeutral.text
      : sumStatus === "over"
        ? classes.deviationCritical.textOnSoft
        : classes.deviationWarning.textOnSoft;

  const segments = rows.map((row) => {
    const n = parsePercentInput(row.percentInput);
    return Number.isNaN(n) ? 0 : n;
  });

  const statusCaption = sumHint ?? sumLabel;

  return (
    <View className="gap-6">
      {/* Sum-to-100 donut header. */}
      <View className="items-center gap-2">
        <SumDonut
          segments={segments}
          centerLabel={`${sumActual.toFixed(0)}%`}
          centerColorClass={sumColorClass}
        />
        <Text className={typographyClass("label", sumColorClass)}>{statusCaption}</Text>
      </View>

      {/* Per-asset slider + numeric rows. */}
      <View className="gap-6">
        {rows.map((row, index) => {
          const numericValue = parsePercentInput(row.percentInput);
          const sliderValue = Number.isNaN(numericValue) ? 0 : numericValue;
          return (
            <View key={row.assetId} className="gap-3">
              <View className="flex-row items-center gap-3">
                <AssetAvatar
                  symbol={row.symbol}
                  market={row.market}
                  marketLabel={row.marketLabel}
                  imageUrl={row.imageUrl}
                />
                <View className="flex-1 min-w-0">
                  <Text className={TYPO_BODY_MEDIUM} numberOfLines={1}>
                    {row.label}
                  </Text>
                  {row.currentWeightLabel ? (
                    <Text className={`${TYPO_CAPTION} text-muted`} numberOfLines={1}>
                      {row.currentWeightLabel}
                    </Text>
                  ) : null}
                </View>
                <View className="flex-row items-center gap-1">
                  <NumberField
                    className="w-16"
                    minValue={0}
                    maxValue={100}
                    step={0.1}
                    value={numericValue}
                    onChange={(v) => row.onPercentChange(Number.isNaN(v) ? "" : String(v))}
                  >
                    <Label className="absolute w-px h-px opacity-0 overflow-hidden">
                      {row.label}
                    </Label>
                    <NumberField.Group>
                      <NumberField.Input className="text-right" />
                    </NumberField.Group>
                  </NumberField>
                  <Text className={`${TYPO_LABEL} text-muted`}>{percentSuffix}</Text>
                </View>
              </View>

              <Slider
                value={sliderValue}
                minValue={0}
                maxValue={100}
                step={0.5}
                onChange={(v) => row.onPercentChange(String(Array.isArray(v) ? v[0] : v))}
                accessibilityLabel={row.label}
              >
                <Slider.Track className="h-2 rounded-full bg-surface-secondary">
                  <Slider.Fill
                    className="rounded-full"
                    style={{ backgroundColor: RING_PALETTE[index % RING_PALETTE.length] }}
                  />
                  <Slider.Thumb />
                </Slider.Track>
              </Slider>
            </View>
          );
        })}
      </View>
    </View>
  );
}
