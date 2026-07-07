/**
 * Asset detail chart plot — loading / empty / error inside fixed chart height.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { ChartDrawLoading, ChartLineIcon, CloudWarningIcon, EmptyState, ThemedIcon } from "@arc/ui";

import { ASSET_DETAIL_CHART_HEIGHT } from "../lib/asset-detail-chart-layout";

export type AssetDetailChartPlotStatus = "loading" | "ready" | "error" | "empty";

export interface AssetDetailChartEmptyPlotProps {
  readonly variant: "error" | "empty";
  readonly title: string;
  readonly description: string;
}

export function AssetDetailChartEmptyPlot({
  variant,
  title,
  description,
}: AssetDetailChartEmptyPlotProps): ReactNode {
  const Icon = variant === "error" ? CloudWarningIcon : ChartLineIcon;

  return (
    <View
      className="items-center justify-center px-4"
      style={{ height: ASSET_DETAIL_CHART_HEIGHT }}
    >
      <EmptyState>
        <EmptyState.Header className="items-center">
          <EmptyState.Media variant="icon">
            <ThemedIcon icon={Icon} size={24} colorToken="muted" weight="duotone" />
          </EmptyState.Media>
          <EmptyState.Title className="text-center text-sm">{title}</EmptyState.Title>
          <EmptyState.Description className="text-center text-xs">
            {description}
          </EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    </View>
  );
}

export function AssetDetailChartLoadingPlot(): ReactNode {
  return <ChartDrawLoading height={ASSET_DETAIL_CHART_HEIGHT} />;
}
