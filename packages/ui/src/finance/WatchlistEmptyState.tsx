/**
 * WatchlistEmptyState — Stage 2 J8 Markets Tab empty state.
 */

import { type ReactNode } from "react";
import { View } from "react-native";

import { Button, Text } from "../primitives";
import { EmptyState } from "../primitives-pro";
import { TrendingUp } from "../wrappers/icons";

export interface WatchlistEmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly ctaLabel: string;
  readonly onCtaPress: () => void;
}

export function WatchlistEmptyState(props: WatchlistEmptyStateProps): ReactNode {
  const { title, description, ctaLabel, onCtaPress } = props;

  return (
    <View className="flex-1 justify-center px-8">
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <TrendingUp size={28} className="text-muted" />
          </EmptyState.Media>
          <EmptyState.Title>{title}</EmptyState.Title>
          <EmptyState.Description>{description}</EmptyState.Description>
        </EmptyState.Header>
        <EmptyState.Content>
          <Button variant="primary" onPress={onCtaPress}>
            <Text>{ctaLabel}</Text>
          </Button>
        </EmptyState.Content>
      </EmptyState>
    </View>
  );
}
