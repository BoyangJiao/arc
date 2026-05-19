/**
 * TabScreenHeader — fixed top bar for root tab screens (Portfolio / Markets / Insights).
 *
 * Layout matches crypto-wallet wallet-header + Arc reference screens (Home / Portfolios):
 *   - Left: Me entry (typically UserAvatar)
 *   - Center: page title
 *   - Right: page-specific actions (search, manage, …)
 *
 * Use with Screen scroll={false} + inner ScrollView so the header stays visible while content scrolls.
 */

import { type ReactNode } from "react";
import { View } from "react-native";

import { Text } from "../../primitives/Text";

export interface TabScreenHeaderProps {
  title: string;
  /** Me / profile entry — left slot (fixed width for title centering). */
  leftSlot: ReactNode;
  /** Page actions — search icon, manage, etc. */
  rightSlot?: ReactNode;
}

const SLOT_WIDTH = 64;
const HEADER_HEIGHT = 44;

export function TabScreenHeader({ title, leftSlot, rightSlot }: TabScreenHeaderProps) {
  return (
    <View
      className="flex-row items-center px-4 bg-background"
      style={{ height: HEADER_HEIGHT }}
      accessibilityRole="header"
    >
      <View style={{ width: SLOT_WIDTH }} className="items-start justify-center">
        {leftSlot}
      </View>
      <View className="flex-1 items-center px-2">
        <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={{ width: SLOT_WIDTH }} className="items-end justify-center">
        {rightSlot ?? null}
      </View>
    </View>
  );
}
