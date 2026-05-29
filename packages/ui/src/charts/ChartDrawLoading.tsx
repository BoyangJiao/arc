/**
 * ChartDrawLoading — left-to-right draw with smooth gradient tail (CDS chartFallbackPositive).
 *
 * Single stroked path + horizontal LinearGradient opacity (no multi-band seams).
 */

import "./ensure-chart-peers";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Canvas, LinearGradient, Path, Skia, vec } from "@shopify/react-native-skia";
import { useThemeColor } from "heroui-native";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { colorWithOpacity } from "./chart-colors";
import { buildChartDrawLoadingPoints, scaledChartDrawBoundsFor } from "./chart-draw-loading-path";

export interface ChartDrawLoadingProps {
  readonly height?: number;
  readonly strokeColor?: string;
}

const heightClassFor = (height: number): string =>
  height >= 256 ? "h-64" : height >= 224 ? "h-56" : "h-48";

const DRAW_MS = 920;
const HOLD_MS = 200;

/** Visible tail as fraction of full path length. */
const TRAIL_FRAC = 0.38;
const EPS = 0.0008;

const GRADIENT_STOPS = {
  positions: [0, 0.22, 0.48, 0.72, 0.9, 1] as const,
  opacities: [0, 0.06, 0.22, 0.48, 0.78, 1] as const,
};

export function ChartDrawLoading({ height = 192, strokeColor }: ChartDrawLoadingProps): ReactNode {
  const muted = useThemeColor("muted");
  const lineColor = strokeColor ?? muted;

  const gradientColors = useMemo(
    () => GRADIENT_STOPS.opacities.map((o) => colorWithOpacity(lineColor, o)),
    [lineColor]
  );

  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: DRAW_MS, easing: Easing.out(Easing.quad) }),
        withDelay(HOLD_MS, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
  }, [progress]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };

  const layout = useMemo(
    () => (width > 0 ? scaledChartDrawBoundsFor(width, height) : null),
    [width, height]
  );

  const path = useMemo(() => {
    if (width <= 0) return null;
    const points = buildChartDrawLoadingPoints(width, height);
    const skPath = Skia.Path.Make();
    points.forEach((point, index) => {
      if (index === 0) skPath.moveTo(point.x, point.y);
      else skPath.lineTo(point.x, point.y);
    });
    return skPath;
  }, [width, height]);

  const innerW = layout ? layout.right - layout.left : 0;
  const midY = height / 2;

  const boundsLeft = layout?.left ?? 0;
  const boundsInnerW = innerW;

  const strokeStart = useDerivedValue(() => Math.max(0, progress.value - TRAIL_FRAC));
  const strokeEnd = useDerivedValue(() => {
    const p = progress.value;
    const s = Math.max(0, p - TRAIL_FRAC);
    return p > s + EPS ? p : s + EPS;
  });

  const gradientStart = useDerivedValue(() => {
    const s = Math.max(0, progress.value - TRAIL_FRAC);
    return vec(boundsLeft + s * boundsInnerW, midY);
  });

  const gradientEnd = useDerivedValue(() => {
    return vec(boundsLeft + progress.value * boundsInnerW, midY);
  });

  return (
    <View className={`w-full ${heightClassFor(height)}`} onLayout={onLayout}>
      {width > 0 && path && layout ? (
        <Canvas style={{ width, height }}>
          <Path
            path={path}
            style="stroke"
            strokeWidth={1}
            strokeCap="butt"
            strokeJoin="miter"
            start={strokeStart}
            end={strokeEnd}
          >
            <LinearGradient
              start={gradientStart}
              end={gradientEnd}
              colors={gradientColors}
              positions={[...GRADIENT_STOPS.positions]}
            />
          </Path>
        </Canvas>
      ) : null}
    </View>
  );
}
