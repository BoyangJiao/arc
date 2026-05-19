/**
 * WatchlistEmptyState — Stage 2 J8 Markets Tab empty state.
 *
 * Search is provided by the parent screen's top SearchField (ADR 008 Batch 5);
 * no in-empty-state CTA button.
 */

import { type ReactNode } from "react";
import { View } from "react-native";

import { EmptyState } from "../primitives-pro";
import { TrendUpIcon } from "../wrappers/icons";
import { ThemedIcon } from "../wrappers/themed-icon";

export interface WatchlistEmptyStateProps {
  readonly title: string;
  readonly description: string;
}

export function WatchlistEmptyState(props: WatchlistEmptyStateProps): ReactNode {
  const { title, description } = props;

  return (
    <View className="flex-1 justify-center px-8">
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <ThemedIcon icon={TrendUpIcon} size={28} colorToken="foreground" weight="duotone" />
          </EmptyState.Media>
          <EmptyState.Title>{title}</EmptyState.Title>
          <EmptyState.Description>{description}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    </View>
  );
}
