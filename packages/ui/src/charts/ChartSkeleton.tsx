/**
 * ChartSkeleton — placeholder while chart data refetches (time-range switch).
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Skeleton } from "../primitives";

export interface ChartSkeletonProps {
  readonly height?: number;
}

const heightClassFor = (height: number): string =>
  height >= 256 ? "h-64" : height >= 224 ? "h-56" : "h-48";

export function ChartSkeleton({ height = 192 }: ChartSkeletonProps): ReactNode {
  return (
    <View className={`w-full ${heightClassFor(height)} justify-center gap-2`}>
      <Skeleton className="h-full w-full rounded-xl" />
    </View>
  );
}
