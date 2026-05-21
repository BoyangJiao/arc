/**
 * Arc-owned Skia gradient fill for area charts (ADR 013).
 */

import type { ReactElement } from "react";
import { LinearGradient, vec } from "@shopify/react-native-skia";

import { colorWithOpacity } from "./chart-colors";

export interface ChartAreaGradientProps {
  readonly top: number;
  readonly bottom: number;
  readonly color: string;
}

export function ChartAreaGradient({ top, bottom, color }: ChartAreaGradientProps): ReactElement {
  return (
    <LinearGradient
      start={vec(0, top)}
      end={vec(0, bottom)}
      colors={[colorWithOpacity(color, 0.58), colorWithOpacity(color, 0.1)]}
    />
  );
}
