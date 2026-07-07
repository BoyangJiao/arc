/**
 * Floating date at top of chart — UI-thread position; text updates only on index change.
 */

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { CHART_SCRUB_DATE_LABEL_BOTTOM_PAD } from "./chart-scrub-layout";
import { Text } from "../primitives/Text";
import { TYPO_CAPTION } from "../tokens/typography";

export interface ChartScrubDateLabelProps {
  readonly x: SharedValue<number>;
  readonly isActive: SharedValue<boolean>;
  readonly xIndex: SharedValue<number>;
  readonly plotLeft: number;
  readonly plotRight: number;
  readonly labels: ReadonlyArray<string>;
}

const anchorLeftForCrosshair = (
  xPos: number,
  textWidth: number,
  plotLeft: number,
  plotRight: number
): number => {
  "worklet";
  if (textWidth <= 0) return xPos;
  const plotWidth = plotRight - plotLeft;
  const relX = xPos - plotLeft;

  if (relX <= textWidth / 2) return plotLeft;
  if (relX >= plotWidth - textWidth / 2) return plotRight - textWidth;
  return xPos - textWidth / 2;
};

export function ChartScrubDateLabel({
  x,
  isActive,
  xIndex,
  plotLeft,
  plotRight,
  labels,
}: ChartScrubDateLabelProps): ReactNode {
  const [labelIndex, setLabelIndex] = useState(0);
  const labelWidth = useSharedValue(0);
  const plotLeftSv = useSharedValue(plotLeft);
  const plotRightSv = useSharedValue(plotRight);

  useEffect(() => {
    plotLeftSv.value = plotLeft;
    plotRightSv.value = plotRight;
  }, [plotLeft, plotRight, plotLeftSv, plotRightSv]);

  const setLabelIndexClamped = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, labels.length - 1));
      setLabelIndex(clamped);
    },
    [labels.length]
  );

  useAnimatedReaction(
    () => ({
      active: isActive.value,
      index: Math.round(xIndex.value),
    }),
    (current, previous) => {
      "worklet";
      if (!current.active) return;
      if (previous?.active && previous.index === current.index) return;
      runOnJS(setLabelIndexClamped)(current.index);
    },
    [setLabelIndexClamped]
  );

  const onTextLayout = useCallback(
    (event: LayoutChangeEvent) => {
      labelWidth.value = event.nativeEvent.layout.width;
    },
    [labelWidth]
  );

  const containerStyle = useAnimatedStyle(() => {
    "worklet";
    const active = isActive.value;
    const left = anchorLeftForCrosshair(
      x.value,
      labelWidth.value,
      plotLeftSv.value,
      plotRightSv.value
    );
    return {
      opacity: active ? 1 : 0,
      left,
    };
  });

  if (labels.length === 0) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.container, containerStyle]}>
      <Text className={TYPO_CAPTION} onLayout={onTextLayout}>
        {labels[labelIndex] ?? ""}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    zIndex: 20,
    paddingBottom: CHART_SCRUB_DATE_LABEL_BOTTOM_PAD,
  },
});
