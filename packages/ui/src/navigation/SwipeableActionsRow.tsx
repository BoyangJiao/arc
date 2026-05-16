/**
 * SwipeableActionsRow — iOS-style swipe-to-reveal row actions (ADR 006 navigation layer).
 *
 * Swipe left on the row to reveal action buttons (e.g. Delete). Business code passes
 * actions as data; does not import react-native-gesture-handler directly.
 */

import { useRef, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import { Text } from "../primitives/Text";
import { SWIPE_ACTION_COLORS } from "../tokens/navigation-colors";

export interface SwipeAction {
  key: string;
  label: string;
  onPress: () => void;
  /** iOS destructive styling (red background). */
  destructive?: boolean;
  accessibilityLabel?: string;
}

export interface SwipeableActionsRowProps {
  children: ReactNode;
  actions: readonly SwipeAction[];
}

const ACTION_WIDTH = 80;

export function SwipeableActionsRow({ children, actions }: SwipeableActionsRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);

  const renderRightActions = () => (
    <View style={styles.actionsContainer}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          onPress={() => {
            swipeableRef.current?.close();
            action.onPress();
          }}
          style={[styles.action, action.destructive && styles.actionDestructive]}
        >
          <Text style={[styles.actionLabel, action.destructive && styles.actionLabelDestructive]}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  actionsContainer: {
    flexDirection: "row",
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SWIPE_ACTION_COLORS.neutralBg,
  },
  actionDestructive: {
    backgroundColor: SWIPE_ACTION_COLORS.destructiveBg,
  },
  actionLabel: {
    color: SWIPE_ACTION_COLORS.label,
    fontSize: 14,
    fontWeight: "600",
  },
  actionLabelDestructive: {
    color: SWIPE_ACTION_COLORS.label,
  },
});
