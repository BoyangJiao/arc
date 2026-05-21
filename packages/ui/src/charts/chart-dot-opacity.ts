import type { ChartPoint } from "./types";
import { chartPeriodSign } from "./chart-series";

export type ChartPeriodSign = "gain" | "loss" | "neutral";

export interface ChartDotOpacityProfile {
  readonly topOpacity: number;
  readonly bottomOpacity: number;
}

/** Vertical dot falloff — loss uses stronger top brightness on dark backgrounds. */
export const dotOpacityProfileForSign = (sign: ChartPeriodSign): ChartDotOpacityProfile => {
  switch (sign) {
    case "loss":
      return { topOpacity: 0.99, bottomOpacity: 0.01 };
    case "gain":
      return { topOpacity: 0.99, bottomOpacity: 0.01 };
    case "neutral":
      return { topOpacity: 0.99, bottomOpacity: 0.01 };
  }
};

export const dotOpacityProfileForData = (data: ReadonlyArray<ChartPoint>): ChartDotOpacityProfile =>
  dotOpacityProfileForSign(chartPeriodSign(data));
