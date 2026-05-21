/**
 * LineChart — @arc/ui wrapper over HeroUI Pro line-chart (ADR 006 charts/).
 *
 * Subpath import discipline: never import from `heroui-native-pro` top-level
 * (chart-indicator pulls skia into Metro bundle graph).
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import { LineChart as ProLineChart } from "heroui-native-pro/line-chart";

import type { ChartPoint } from "./types";

export type ArcLineChartColor = "primary" | "secondary" | "tertiary";

const COLOR_CLASS: Record<ArcLineChartColor, string> = {
  primary: "accent-chart-1",
  secondary: "accent-chart-2",
  tertiary: "accent-chart-3",
};

export interface ArcLineChartProps {
  readonly data: ReadonlyArray<ChartPoint>;
  readonly color?: ArcLineChartColor;
  readonly height?: number;
}

type LineDatum = { index: number; value: number };

export function LineChart({ data, color = "primary", height = 192 }: ArcLineChartProps): ReactNode {
  const series = useMemo(
    (): LineDatum[] => data.map((p, index) => ({ index, value: p.y })),
    [data]
  );

  if (series.length === 0) {
    return null;
  }

  const heightClass = height >= 256 ? "h-64" : height >= 224 ? "h-56" : "h-48";

  return (
    <ProLineChart
      data={series}
      xKey="index"
      yKeys={["value"]}
      wrapperClassName={`w-full ${heightClass}`}
    >
      {({ points }: { points: { value: Parameters<typeof ProLineChart.Line>[0]["points"] } }) => (
        <ProLineChart.Line
          points={points.value}
          colorClassName={COLOR_CLASS[color]}
          curveType="natural"
        />
      )}
    </ProLineChart>
  );
}
