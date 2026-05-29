/**
 * Resolve Skia stroke/fill color from selected-range period sign + finance color mode.
 *
 * Industry default (Coinbase / Robinhood): whole line = sign(last − periodStart),
 * aligned with PortfolioHeroSection headline — not the tail segment slope.
 */

import { useMemo } from "react";
import { useThemeColor } from "heroui-native";

import { useBusinessTokens } from "../tokens/business-context";

import { chartPeriodSign } from "./chart-series";
import type { ChartPoint } from "./types";

export const useChartPeriodStrokeColor = (data: ReadonlyArray<ChartPoint>): string => {
  const tokens = useBusinessTokens();
  const gainColor = useThemeColor(tokens.gain);
  const lossColor = useThemeColor(tokens.loss);
  const neutralColor = useThemeColor("muted");

  return useMemo(() => {
    const sign = chartPeriodSign(data);
    if (sign === "gain") return gainColor;
    if (sign === "loss") return lossColor;
    return neutralColor;
  }, [data, gainColor, lossColor, neutralColor]);
};
