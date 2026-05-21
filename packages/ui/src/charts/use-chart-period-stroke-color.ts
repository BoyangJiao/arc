/**
 * Resolve Skia stroke/fill color from chart period sign + user finance color mode.
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
