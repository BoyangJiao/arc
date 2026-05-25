/**
 * FlippingNumberText — Coinbase-style rolling digit animation for monetary values.
 *
 * 接收一个已经格式化好的金额字符串（如 "¥1,234,567.89"），逐字符渲染：
 *   - 数字 0-9 → 高度固定的滚轮列，列内纵向堆叠 0-9，通过 translateY 滚到目标 digit。
 *   - 非数字（货币符号、千分位、小数点、负号、空格）→ 静态字符。
 *
 * 字符高度通过测量一个隐藏的 "0" 字符获得，无需调用方了解 typography 细节，
 * 直接将任意 typography className（如 TYPO_DISPLAY）透传即可。
 *
 * 字符数变化时（如位数增加 999 → 1234）使用 Reanimated 的 FadeIn / FadeOut
 * 进行优雅过渡；其余数字位仍可独立 flip 到新值。
 *
 * Live 模式（如图表 scrub）：传入 `liveValue` + `liveActive` 两个 sharedValue，
 * 当 `liveActive` 为 true 时每位数字直接由 worklet 即时同步到 `liveValue`
 * 当前数值上的对应位（每帧 UI 线程更新，跳过 React state，60fps 跟手）；
 * `liveActive` 由 true 切到 false 时（手指离开）平滑过渡回 React prop value
 * 对应的静态 digit；不传 sharedValue 时退化为纯 React-driven flip 动画。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { Text } from "../primitives/Text";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

const DEFAULT_DURATION_MS = 280;
/**
 * Flip duration during live scrub. Kept short so each digit can keep up with
 * the finger; because timing is restarted on the UI thread, reanimated
 * smoothly re-targets from the current offset without snapping — so target
 * changes between adjacent chart nodes produce a continuous rolling motion
 * instead of starting-over jolts.
 */
const LIVE_FLIP_DURATION_MS = 200;
/** Settle duration when scrub ends — long enough to look smooth, short enough to feel responsive. */
const LIVE_RELEASE_DURATION_MS = 260;
/** Data refresh / mount — ease-out for a clear flip landing. */
const DEFAULT_EASING = Easing.out(Easing.cubic);
/** Scrub — linear so re-targeting between nodes stays even and continuous. */
const LIVE_SCRUB_EASING = Easing.linear;

export interface FlippingNumberTextProps {
  /** Pre-formatted display string. Non-digit characters render statically. */
  readonly value: string;
  /** Typography className (e.g. `TYPO_DISPLAY`). Applied to every glyph. */
  readonly className?: string;
  /** Additional inline style applied to every glyph. */
  readonly textStyle?: StyleProp<TextStyle>;
  /** Container row style override (alignment, etc). */
  readonly style?: StyleProp<ViewStyle>;
  /** Flip animation duration for React-driven updates. Set to 0 to disable. */
  readonly duration?: number;
  /**
   * Optional UI-thread numeric driver. When `liveActive` is `true`, each digit
   * is rendered directly from `liveValue` at 60fps; React `value` is then only
   * used for layout (slot positions). Use this for interactive states like
   * chart scrub where React state is too slow.
   */
  readonly liveValue?: SharedValue<number>;
  readonly liveActive?: SharedValue<boolean>;
  /** Accessibility label, defaults to `value`. */
  readonly accessibilityLabel?: string;
}

interface FlippingDigitProps {
  /** Target digit from React-formatted string (used when not live). */
  readonly staticDigit: number;
  /** 10-exponent for this slot: 0=ones, 1=tens, -1=tenths, etc. */
  readonly position: number;
  readonly className?: string;
  readonly textStyle?: StyleProp<TextStyle>;
  readonly height: number;
  readonly duration: number;
  readonly liveValue?: SharedValue<number>;
  readonly liveActive?: SharedValue<boolean>;
}

function FlippingDigit({
  staticDigit,
  position,
  className,
  textStyle,
  height,
  duration,
  liveValue,
  liveActive,
}: FlippingDigitProps): ReactNode {
  const offset = useSharedValue(-staticDigit * height);

  // UI-thread driver: while liveActive, flip this slot's translateY to the
  // digit derived from liveValue using a short worklet-side withTiming.
  // Because timing is restarted from the current offset (not from 0) on
  // every node change, fast scrubs produce a continuous rolling animation
  // instead of restart jolts. On the falling edge of liveActive, settle
  // back to the React-driven staticDigit.
  useAnimatedReaction(
    () => {
      "worklet";
      if (!liveActive || !liveValue) return null;
      return { active: liveActive.get(), value: liveValue.get() };
    },
    (current, previous) => {
      "worklet";
      if (current === null) return;
      if (current.active) {
        const abs = Math.abs(current.value);
        const digit = Math.floor(abs / Math.pow(10, position)) % 10;
        offset.set(
          withTiming(-digit * height, {
            duration: LIVE_FLIP_DURATION_MS,
            easing: LIVE_SCRUB_EASING,
          })
        );
      } else if (previous?.active) {
        offset.set(
          withTiming(-staticDigit * height, {
            duration: LIVE_RELEASE_DURATION_MS,
            easing: DEFAULT_EASING,
          })
        );
      }
    },
    [position, height, staticDigit]
  );

  // React-driven updates (data refresh, mount, non-scrub state changes).
  // When liveActive is true, the worklet above will keep overriding offset
  // every frame, so this withTiming is harmless; we skip it to avoid the
  // brief contention right when scrub releases.
  useEffect(() => {
    if (liveActive?.value) return;
    const target = -staticDigit * height;
    if (duration > 0) {
      offset.set(withTiming(target, { duration, easing: DEFAULT_EASING }));
    } else {
      offset.set(target);
    }
  }, [staticDigit, height, duration, offset, liveActive]);

  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    return { transform: [{ translateY: offset.get() }] };
  });

  return (
    <View style={[styles.digitColumn, { height }]}>
      <Animated.View style={animatedStyle}>
        {DIGITS.map((d) => (
          <Text key={d} className={className} style={textStyle}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

interface Slot {
  /** Right-aligned position so already-rendered digits keep the same key when length grows. */
  readonly key: number;
  readonly char: string;
  /** 10-exponent for digit slots; null for static glyphs. */
  readonly position: number | null;
}

function buildSlots(value: string): readonly Slot[] {
  const chars = value.split("");
  const dotIdx = value.indexOf(".");
  const intEnd = dotIdx === -1 ? chars.length : dotIdx;
  const lastIndex = chars.length - 1;
  const slots: Slot[] = new Array<Slot>(chars.length);

  let intPos = 0;
  for (let i = intEnd - 1; i >= 0; i--) {
    const char = chars[i]!;
    const digit = isDigitChar(char);
    slots[i] = {
      char,
      key: lastIndex - i,
      position: digit ? intPos : null,
    };
    if (digit) intPos++;
  }

  if (dotIdx !== -1) {
    slots[dotIdx] = { char: chars[dotIdx]!, key: lastIndex - dotIdx, position: null };
    let decPos = -1;
    for (let i = dotIdx + 1; i < chars.length; i++) {
      const char = chars[i]!;
      const digit = isDigitChar(char);
      slots[i] = {
        char,
        key: lastIndex - i,
        position: digit ? decPos : null,
      };
      if (digit) decPos--;
    }
  }

  return slots;
}

const isDigitChar = (char: string): boolean => char >= "0" && char <= "9";

export function FlippingNumberText({
  value,
  className,
  textStyle,
  style,
  duration = DEFAULT_DURATION_MS,
  liveValue,
  liveActive,
  accessibilityLabel,
}: FlippingNumberTextProps): ReactNode {
  const [digitHeight, setDigitHeight] = useState<number | null>(null);
  const measuredRef = useRef(false);

  const slots = useMemo(() => buildSlots(value), [value]);

  const onMeasure = useCallback((event: LayoutChangeEvent) => {
    const h = event.nativeEvent.layout.height;
    if (h > 0 && !measuredRef.current) {
      measuredRef.current = true;
      setDigitHeight(h);
    }
  }, []);

  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? value}
    >
      {digitHeight === null ? (
        <Text
          className={className}
          style={textStyle}
          onLayout={onMeasure}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {value}
        </Text>
      ) : (
        slots.map(({ char, key, position }) => {
          const digit = isDigitChar(char);
          return (
            <Animated.View
              key={`${key}-${digit ? "d" : char}`}
              entering={FadeIn.duration(duration)}
              exiting={FadeOut.duration(duration / 2)}
            >
              {digit && position !== null ? (
                <FlippingDigit
                  staticDigit={Number(char)}
                  position={position}
                  className={className}
                  textStyle={textStyle}
                  height={digitHeight}
                  duration={duration}
                  liveValue={liveValue}
                  liveActive={liveActive}
                />
              ) : (
                <Text className={className} style={textStyle}>
                  {char}
                </Text>
              )}
            </Animated.View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  digitColumn: {
    overflow: "hidden",
  },
});
