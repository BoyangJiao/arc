/**
 * ChartPressOverlay — crosshair + indicator; optional scrub callback (Arc L2).
 */

import "./ensure-chart-peers";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { useThemeColor } from "heroui-native";
import {
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useChartPressState, type ChartBounds } from "victory-native";
import { ChartCrosshair } from "heroui-native-pro/chart-crosshair";
import { ChartIndicator } from "heroui-native-pro/chart-indicator";

import { colorWithOpacity } from "./chart-colors";
import {
  CHART_SCRUB_CROSSHAIR_TOP_GAP,
  CHART_SCRUB_HEADER_PADDING_TOP,
} from "./chart-scrub-layout";
import { ChartScrubDateLabel } from "./ChartScrubDateLabel";
import { ChartScrubFutureMask } from "./ChartScrubFutureMask";
import type { ChartScrubState } from "../finance/chart-scrub";

type NumericChartPressState = ReturnType<
  typeof useChartPressState<{ x: number; y: { value: number } }>
>["state"];

export type { NumericChartPressState };

export interface ChartPressOverlayProps {
  readonly height: number;
  readonly valuePrefix?: string;
  readonly indicatorColor?: string;
  /** Floating price pill on chart — off for portfolio hero (value lives in header). */
  readonly showValueLabel?: boolean;
  readonly scrubPoints?: ReadonlyArray<{ readonly asOf?: string }>;
  readonly scrubDateLabels?: ReadonlyArray<string>;
  readonly onScrubChange?: (state: ChartScrubState | null) => void;
  /** UI-thread mirror of the current scrub price (every frame). */
  readonly scrubValueSv?: SharedValue<number>;
  /** UI-thread mirror of whether the user is scrubbing. */
  readonly scrubActiveSv?: SharedValue<boolean>;
  readonly children: (ctx: {
    chartPressState: NumericChartPressState;
    isActive: boolean;
    onChartBoundsChange: (bounds: ChartBounds) => void;
    renderOverlays: (chartBounds: ChartBounds) => ReactNode;
  }) => ReactNode;
}

const heightClassFor = (height: number): string =>
  height >= 256 ? "h-64" : height >= 224 ? "h-56" : "h-48";

const readPressNumber = (value: unknown): number => {
  "worklet";
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "get" in value) {
    return (value as { get: () => number }).get();
  }
  return 0;
};

export function ChartPressOverlay({
  height,
  valuePrefix = "",
  indicatorColor,
  showValueLabel = true,
  scrubPoints = [],
  scrubDateLabels = [],
  onScrubChange,
  scrubValueSv,
  scrubActiveSv,
  children,
}: ChartPressOverlayProps): ReactNode {
  const { state, isActive } = useChartPressState<{ x: number; y: { value: number } }>({
    x: 0,
    y: { value: 0 },
  });
  const [chartBounds, setChartBounds] = useState<ChartBounds | null>(null);
  const xIndex = useSharedValue(0);
  const backgroundColor = useThemeColor("background");
  const scrubMaskColor = colorWithOpacity(backgroundColor, 0.78);

  const heroScrubChrome = !showValueLabel && scrubDateLabels.length > 0;
  /** Dim data to the right of the crosshair — hero (date in overlay) and asset detail (value chip). */
  const showScrubFutureMask = heroScrubChrome || showValueLabel;
  const crosshairTopGap = heroScrubChrome ? CHART_SCRUB_CROSSHAIR_TOP_GAP : 0;

  const emitScrub = useCallback(
    (index: number, value: number, active: boolean) => {
      if (!onScrubChange) return;
      if (!active) {
        onScrubChange(null);
        return;
      }
      const clamped = Math.max(0, Math.min(index, scrubPoints.length - 1));
      onScrubChange({
        index: clamped,
        value,
        asOf: scrubPoints[clamped]?.asOf,
      });
    },
    [onScrubChange, scrubPoints]
  );

  const clearScrub = useCallback(() => {
    emitScrub(0, 0, false);
  }, [emitScrub]);

  useAnimatedReaction(
    () => {
      "worklet";
      const index = Math.round(readPressNumber(state.x.value.value));
      const active = state.isActive.value;
      const yVal = readPressNumber(state.y.value.value);
      xIndex.value = index;
      // UI-thread mirrors so the hero number can flip at 60fps without
      // routing each scrub frame through React state (JS thread).
      if (scrubValueSv) scrubValueSv.value = yVal;
      if (scrubActiveSv) scrubActiveSv.value = active;
      return { active, xIndex: index, yVal };
    },
    (current, previous) => {
      "worklet";
      if (!onScrubChange) return;
      if (!current.active) {
        if (previous?.active) {
          runOnJS(clearScrub)();
        }
        return;
      }
      if (
        previous?.active &&
        previous.xIndex === current.xIndex &&
        previous.yVal === current.yVal
      ) {
        return;
      }
      runOnJS(emitScrub)(current.xIndex, current.yVal, true);
    },
    [onScrubChange, clearScrub]
  );

  const labelText = useDerivedValue(() => {
    "worklet";
    const price = state.y.value.value.get();
    return `${valuePrefix}${price.toFixed(2)}`;
  });

  const renderOverlays = (bounds: ChartBounds): ReactNode =>
    isActive ? (
      <>
        {showScrubFutureMask ? (
          <ChartScrubFutureMask
            scrubX={state.x.position}
            top={bounds.top + crosshairTopGap}
            bottom={bounds.bottom}
            right={bounds.right}
            maskColor={scrubMaskColor}
          />
        ) : null}
        <ChartIndicator
          x={state.x.position}
          y={state.y.value.position}
          innerColor={indicatorColor}
        />
        <ChartCrosshair
          x={state.x.position}
          top={bounds.top + crosshairTopGap}
          bottom={bounds.bottom}
        />
      </>
    ) : null;

  const overlayBody = children({
    chartPressState: state,
    isActive,
    onChartBoundsChange: setChartBounds,
    renderOverlays,
  });

  const heightClass = heightClassFor(height);

  if (heroScrubChrome) {
    return (
      <View
        className="relative w-full overflow-hidden"
        style={{ paddingTop: CHART_SCRUB_HEADER_PADDING_TOP }}
      >
        <View className={heightClass}>{overlayBody}</View>
        {chartBounds ? (
          <ChartScrubDateLabel
            x={state.x.position}
            isActive={state.isActive}
            xIndex={xIndex}
            plotLeft={chartBounds.left}
            plotRight={chartBounds.right}
            labels={scrubDateLabels}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View className={`relative w-full ${heightClass}`}>
      <ChartCrosshair.Anchor
        chartBounds={chartBounds ?? undefined}
        isActive={state.isActive}
        x={state.x.position}
      >
        {overlayBody}
        {showValueLabel ? (
          <ChartCrosshair.Value
            className="min-w-24 px-2 py-1 rounded-md bg-surface-secondary"
            value={labelText}
          />
        ) : null}
      </ChartCrosshair.Anchor>
    </View>
  );
}
