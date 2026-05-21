/**
 * Coinbase-style dot grid clipped to area path — vertical opacity falloff replaces fill gradient.
 */

import { memo, useMemo, type ReactElement } from "react";
import { Circle, Group } from "@shopify/react-native-skia";
import { useAreaPath } from "victory-native";
import type { PointsArray } from "victory-native";

import { colorWithOpacity } from "./chart-colors";

export interface ChartAreaDotFillProps {
  readonly points: PointsArray;
  readonly y0: number;
  readonly color: string;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly spacing?: number;
  readonly dotRadius?: number;
  readonly topOpacity: number;
  readonly bottomOpacity: number;
}

const shapeKeyFor = (points: PointsArray): string => {
  if (points.length === 0) return "0";
  const mid = points[Math.floor(points.length / 2)]!;
  const last = points[points.length - 1]!;
  return `${points.length}:${points[0]!.y}:${mid.y}:${last.y}`;
};

/** Smooth falloff — dense / bright at top, sparse feel at bottom. */
const opacityAtY = (
  y: number,
  top: number,
  bottom: number,
  topOpacity: number,
  bottomOpacity: number
): number => {
  const span = Math.max(1, bottom - top);
  const t = Math.max(0, Math.min(1, (y - top) / span));
  const eased = (1 - t) * (1 - t);
  return bottomOpacity + (topOpacity - bottomOpacity) * eased;
};

export const ChartAreaDotFill = memo(function ChartAreaDotFill({
  points,
  y0,
  color,
  left,
  right,
  top,
  bottom,
  spacing = 5,
  dotRadius = 1,
  topOpacity,
  bottomOpacity,
}: ChartAreaDotFillProps): ReactElement {
  const { path } = useAreaPath(points, y0, { curveType: "linear" });
  const shapeKey = shapeKeyFor(points);

  const dots = useMemo(() => {
    const nodes: ReactElement[] = [];
    const startX = left + spacing * 0.5;
    const startY = top + spacing * 0.5;
    for (let y = startY; y <= bottom; y += spacing) {
      const rowOpacity = opacityAtY(y, top, bottom, topOpacity, bottomOpacity);
      const fill = colorWithOpacity(color, rowOpacity);
      for (let x = startX; x <= right; x += spacing) {
        nodes.push(<Circle key={`${x}-${y}`} cx={x} cy={y} r={dotRadius} color={fill} />);
      }
    }
    return nodes;
  }, [bottom, color, dotRadius, left, right, shapeKey, spacing, top, topOpacity, bottomOpacity]);

  return <Group clip={path}>{dots}</Group>;
});
