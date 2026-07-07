import type { ChartPoint } from "../charts/types";

export interface ChartScrubState {
  readonly index: number;
  readonly value: number;
  readonly asOf?: string;
}

export const scrubStateFromChartPoint = (point: ChartPoint, index: number): ChartScrubState => ({
  index,
  value: point.y,
  asOf: point.asOf ?? point.label,
});

export const periodStartValue = (data: ReadonlyArray<ChartPoint>): number | null =>
  data.length > 0 ? data[0]!.y : null;
