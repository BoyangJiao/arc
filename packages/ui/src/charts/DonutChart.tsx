/**
 * DonutChart — @arc/ui wrapper over HeroUI Pro pie-chart (ADR 006 charts/).
 *
 * Donut (innerRadius) + segmented gaps (SliceAngularInset, painted in the bg
 * color) + an absolutely-centered RN overlay slot (total / top label). Matches
 * the Pro `pie-chart` reference + Delta 多样性 donut. Animated slice paths.
 *
 * Center text is an RN overlay (not Skia PieChart.Label) — no SkFont loading.
 *
 * Interactivity (press-and-hold): the Pro pie-chart is a Skia canvas with no
 * native per-slice press, so a transparent Pressable overlays it and slices are
 * hit-tested geometrically. Crucially we hit-test against the REAL slice
 * geometry victory-native hands us in the render callback (canvas center,
 * inner/outer radius, each slice's start/end angle) — captured into a ref — so
 * there are no fragile assumptions about canvas centering or angle convention
 * (the earlier "every tap maps to the dominant slice" bug). While held, the
 * pressed slice pops (enlarged overlay + tint) like a button; the others are
 * left untouched (no dimming). Releasing clears the selection. Gated on
 * `onSlicePress` so non-interactive donuts (e.g. inside a navigate-on-tap card)
 * keep bubbling taps to their parent.
 *
 * Subpath import discipline: import the chart + hooks from the pie-chart
 * subpath, never the `heroui-native-pro` top-level (keeps unused chart code out
 * of the graph). Skia `Path` is a chart peer already pulled in via
 * ensure-chart-peers.
 */

import "./ensure-chart-peers";

import { type ReactNode, useRef, useState } from "react";
import { type GestureResponderEvent, Pressable, View } from "react-native";
import { Path } from "@shopify/react-native-skia";
import {
  PieChart as ProPieChart,
  useSlicePath,
  type PieSliceData,
} from "heroui-native-pro/pie-chart";

export interface DonutChartDatum {
  readonly key: string;
  /** Numeric magnitude (chart needs number, not Decimal). */
  readonly value: number;
  /** Slice fill (hex). */
  readonly color: string;
}

export interface DonutChartProps {
  readonly data: ReadonlyArray<DonutChartDatum>;
  /** Standard Tailwind height class for the canvas (default `h-56` = 224px). */
  readonly heightClass?: string;
  /** Inner cutout radius (default `"70%"`). */
  readonly innerRadius?: string;
  /** Centered overlay (e.g. total value). */
  readonly center?: ReactNode;
  /** Segmented-gap stroke color between slices — pass the screen bg for "cut" gaps. */
  readonly insetColor?: string;
  /**
   * Press-and-hold handler: receives the hit-tested slice index while held, then
   * `null` on release (or when a press lands in the hole / outside the ring).
   * Presence enables interactivity.
   */
  readonly onSlicePress?: (index: number | null) => void;
}

// HeroUI Pro chart generics omit field-key inference — cast at wrapper boundary (ADR 006).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party chart compound API
const ProPieChartRoot = ProPieChart as any;

interface SliceGeom {
  readonly cx: number;
  readonly cy: number;
  readonly inner: number;
  readonly outer: number;
  readonly start: number;
  readonly end: number;
}

const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

/** True when `theta` (deg, [0,360)) falls within a slice's [start,end), wrap-aware. */
const inSlice = (theta: number, start: number, end: number): boolean => {
  const s = norm360(start);
  const e = norm360(end);
  return s <= e ? theta >= s && theta < e : theta >= s || theta < e;
};

/**
 * Pressed-state overlay: a white wash over the same slice geometry, brightening
 * the held slice like a spotlight. Same radius as the base slice — enlarging the
 * radius would draw past the canvas and get clipped (UAT finding).
 */
function PressedSliceOverlay({ slice }: { slice: PieSliceData }): ReactNode {
  const path = useSlicePath({ slice });
  return <Path path={path} style="fill" color="white" opacity={0.28} />;
}

export function DonutChart({
  data,
  heightClass = "h-56",
  innerRadius = "70%",
  center,
  insetColor,
  onSlicePress,
}: DonutChartProps): ReactNode {
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);
  // Real slice geometry from victory-native, captured during render (keyed by label).
  const geomRef = useRef<Map<string, SliceGeom>>(new Map());

  if (data.length === 0) return null;

  const interactive = !!onSlicePress;
  const pressedKey =
    pressedIndex != null && pressedIndex >= 0 && pressedIndex < data.length
      ? data[pressedIndex]!.key
      : null;

  // Repopulated each render by the Pie render callback below.
  if (interactive) geomRef.current = new Map();

  const select = (index: number | null) => {
    setPressedIndex(index);
    onSlicePress?.(index);
  };

  const handlePressIn = (e: GestureResponderEvent) => {
    const geom = geomRef.current;
    if (geom.size === 0) return;
    const { locationX, locationY } = e.nativeEvent;
    // All slices share canvas center + radii; read from any captured slice.
    const first = geom.values().next().value;
    if (!first) return;
    const dx = locationX - first.cx;
    const dy = locationY - first.cy;
    const dist = Math.hypot(dx, dy);
    if (dist < first.inner * 0.85 || dist > first.outer * 1.12) {
      select(null);
      return;
    }
    // victory-native feeds slice.startAngle/endAngle straight into Skia
    // arcToOval → angles are degrees from 3 o'clock (East), clockwise (y-down).
    // Compute the tap angle in that exact frame: atan2(dy, dx).
    const theta = norm360((Math.atan2(dy, dx) * 180) / Math.PI);
    for (let i = 0; i < data.length; i += 1) {
      const g = geom.get(data[i]!.key);
      if (g && inSlice(theta, g.start, g.end)) {
        select(i);
        return;
      }
    }
    select(null);
  };

  // Mirror AreaChart: height lives ONLY on the chart wrapperClassName; the outer
  // View stays `relative w-full` (a fixed-height / items-center parent collapses
  // the Skia PolarChart canvas).
  return (
    <View className="relative w-full">
      <ProPieChartRoot
        data={data}
        labelKey="key"
        valueKey="value"
        colorKey="color"
        wrapperClassName={`w-full ${heightClass}`}
      >
        <ProPieChart.Pie innerRadius={innerRadius}>
          {({ slice }: { slice: PieSliceData }) => {
            if (interactive && slice) {
              geomRef.current.set(slice.label, {
                cx: slice.center.x,
                cy: slice.center.y,
                inner: slice.innerRadius,
                outer: slice.radius,
                start: slice.startAngle,
                end: slice.endAngle,
              });
            }
            const isPressed = pressedKey != null && slice?.label === pressedKey;
            return (
              <>
                <ProPieChart.Slice animate={{ type: "timing", duration: 450 }} />
                {isPressed ? <PressedSliceOverlay slice={slice} /> : null}
                {insetColor ? (
                  <ProPieChart.SliceAngularInset
                    angularInset={{ angularStrokeWidth: 4, angularStrokeColor: insetColor }}
                  />
                ) : null}
              </>
            );
          }}
        </ProPieChart.Pie>
      </ProPieChartRoot>
      {interactive ? (
        <Pressable
          className="absolute inset-0"
          onPressIn={handlePressIn}
          onPressOut={() => select(null)}
        />
      ) : null}
      {center ? (
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          {center}
        </View>
      ) : null}
    </View>
  );
}
