/**
 * DevToolsFloatingOverlay — global draggable FAB + bottom sheet (__DEV__ + signed in).
 *
 * Mount in root AppShell above the navigation stack so it appears on every screen.
 */

import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
// Root-level overlay (same exemption as app/_layout.tsx) — needs raw insets for FAB bounds.
// eslint-disable-next-line no-restricted-imports -- dev-only global FAB; not a page layout
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FLOATING_TAB_BAR_BOTTOM_INSET, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useAuth } from "../../lib/auth";
import { useDevToolsFabStore } from "../../lib/dev-tools/dev-tools-fab-store";
import { DevToolsScenarioPanel } from "./DevToolsScenarioPanel";

const FAB_SIZE = 52;
const DOCK_PEEK = 28;
const EDGE_MARGIN = 12;

export function DevToolsFloatingOverlay(): ReactNode {
  const { t } = useTranslation();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const { x, y, docked, panelOpen, setPosition, setDocked, setPanelOpen, toggleDocked } =
    useDevToolsFabStore();

  const bounds = useMemo(() => {
    const top = insets.top + EDGE_MARGIN;
    const bottom = screenH - insets.bottom - FLOATING_TAB_BAR_BOTTOM_INSET - FAB_SIZE - EDGE_MARGIN;
    const left = EDGE_MARGIN;
    const right = screenW - FAB_SIZE - EDGE_MARGIN;
    return { top, bottom, left, right };
  }, [insets.bottom, insets.top, screenH, screenW]);

  const defaultX = bounds.right;
  const defaultY = bounds.bottom;

  const translateX = useSharedValue(x ?? defaultX);
  const translateY = useSharedValue(y ?? defaultY);
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  const clampPosition = useCallback(
    (nextX: number, nextY: number) => {
      const clampedX = Math.min(Math.max(nextX, bounds.left), bounds.right);
      const clampedY = Math.min(Math.max(nextY, bounds.top), bounds.bottom);
      setPosition(clampedX, clampedY);
      return { x: clampedX, y: clampedY };
    },
    [bounds, setPosition]
  );

  const applyDockedPosition = useCallback(
    (edge: "left" | "right", currentY: number) => {
      const dockedX = edge === "left" ? -FAB_SIZE + DOCK_PEEK : screenW - DOCK_PEEK;
      const yClamped = Math.min(Math.max(currentY, bounds.top), bounds.bottom);
      translateX.value = withSpring(dockedX, { damping: 18, stiffness: 220 });
      translateY.value = withSpring(yClamped, { damping: 18, stiffness: 220 });
    },
    [bounds.bottom, bounds.top, screenW, translateX, translateY]
  );

  useEffect(() => {
    if (docked === "left" || docked === "right") {
      applyDockedPosition(docked, y ?? defaultY);
      return;
    }
    translateX.value = withSpring(x ?? defaultX, { damping: 18, stiffness: 220 });
    translateY.value = withSpring(y ?? defaultY, { damping: 18, stiffness: 220 });
  }, [applyDockedPosition, defaultX, defaultY, docked, x, y, translateX, translateY]);

  const persistFromGesture = useCallback(
    (nextX: number, nextY: number) => {
      const { x: cx, y: cy } = clampPosition(nextX, nextY);
      translateX.value = cx;
      translateY.value = cy;
    },
    [clampPosition, translateX, translateY]
  );

  const undockIfNeeded = useCallback(() => {
    if (useDevToolsFabStore.getState().docked) {
      setDocked(null);
    }
  }, [setDocked]);

  const pan = Gesture.Pan()
    .minDistance(10)
    .onStart(() => {
      runOnJS(undockIfNeeded)();
      dragStartX.value = translateX.value;
      dragStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = dragStartX.value + e.translationX;
      translateY.value = dragStartY.value + e.translationY;
    })
    .onEnd(() => {
      runOnJS(persistFromGesture)(translateX.value, translateY.value);
    });

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const handleFabPress = useCallback(() => {
    if (docked) {
      setDocked(null);
      return;
    }
    setPanelOpen(true);
  }, [docked, setDocked, setPanelOpen]);

  if (!__DEV__ || !session) {
    return null;
  }

  const dockedVisual = docked !== null;
  const expandChevron = docked === "left" ? "›" : "‹";

  return (
    <>
      <View style={styles.fabLayer} pointerEvents="box-none">
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.fabContainer, fabStyle]} pointerEvents="box-none">
            <Pressable
              onPress={handleFabPress}
              accessibilityLabel={t("devTools.fabOpen")}
              className="bg-surface-tertiary border border-border items-center justify-center shadow-md"
              style={[
                styles.fabExpanded,
                dockedVisual && styles.fabDocked,
                docked === "left" && styles.fabDockedLeft,
                docked === "right" && styles.fabDockedRight,
              ]}
            >
              <Text className="text-foreground text-xs font-bold tracking-wide">
                {dockedVisual ? expandChevron : "DEV"}
              </Text>
            </Pressable>

            {!dockedVisual && (
              <Pressable
                onPress={toggleDocked}
                accessibilityLabel={t("devTools.fabDock")}
                hitSlop={8}
                className="absolute -left-1 top-4 w-[18px] h-5 rounded-md bg-surface border border-border items-center justify-center"
              >
                <Text className="text-muted text-[10px] font-semibold">◂</Text>
              </Pressable>
            )}
          </Animated.View>
        </GestureDetector>
      </View>

      <Modal
        visible={panelOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPanelOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-foreground/40"
          onPress={() => setPanelOpen(false)}
        >
          <Pressable
            className="bg-surface max-h-[82%] rounded-t-3xl px-5 pt-4"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4 px-1">
              <Text className="text-foreground text-lg font-semibold">{t("devTools.title")}</Text>
              <Pressable onPress={() => setPanelOpen(false)} hitSlop={12}>
                <Text className="text-muted text-base">{t("devTools.closePanel")}</Text>
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            >
              <DevToolsScenarioPanel onApplied={() => setPanelOpen(false)} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  fabContainer: {
    position: "absolute",
    left: 0,
    top: 0,
    width: FAB_SIZE + 24,
    height: FAB_SIZE,
  },
  fabExpanded: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
  },
  fabDocked: {
    width: DOCK_PEEK,
    borderRadius: 10,
  },
  fabDockedLeft: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  fabDockedRight: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
});
