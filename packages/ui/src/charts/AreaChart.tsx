/**
 * AreaChart — @arc/ui wrapper over HeroUI Pro area-chart.
 * Fill colors use default accent-chart tokens (ADR 003 — business does not pass raw colors).
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import { AreaChart as ProAreaChart } from "heroui-native-pro/area-chart";

import type { ChartPoint } from "./types";

export interface ArcAreaChartProps {
  readonly data: ReadonlyArray<ChartPoint>;
  readonly height?: number;
}

type AreaDatum = { index: number; value: number };

export function AreaChart({ data, height = 192 }: ArcAreaChartProps): ReactNode {
  const series = useMemo(
    (): AreaDatum[] => data.map((p, index) => ({ index, value: p.y })),
    [data]
  );

  if (series.length === 0) {
    return null;
  }

  const heightClass = height >= 256 ? "h-64" : height >= 224 ? "h-56" : "h-48";

  return (
    <ProAreaChart
      data={series}
      xKey="index"
      yKeys={["value"]}
      wrapperClassName={`w-full ${heightClass}`}
    >
      {({
        points,
        chartBounds,
      }: {
        points: { value: Parameters<typeof ProAreaChart.Area>[0]["points"] };
        chartBounds: { bottom: number };
      }) => (
        <ProAreaChart.Area
          points={points.value}
          y0={chartBounds.bottom}
          colorClassName="accent-chart-1"
        />
      )}
    </ProAreaChart>
  );
}
