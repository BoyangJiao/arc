/**
 * Skia mask over chart data to the right of scrub crosshair (Coinbase Scrubber future overlay).
 */

import type { ReactElement } from "react";
import { Rect } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

export interface ChartScrubFutureMaskProps {
  readonly scrubX: SharedValue<number>;
  readonly top: number;
  readonly bottom: number;
  readonly right: number;
  readonly maskColor: string;
}

export function ChartScrubFutureMask({
  scrubX,
  top,
  bottom,
  right,
  maskColor,
}: ChartScrubFutureMaskProps): ReactElement {
  const width = useDerivedValue(() => Math.max(0, right - scrubX.value));

  return (
    <Rect x={scrubX} y={top} width={width} height={bottom - top} color={maskColor} opacity={0.72} />
  );
}
