/**
 * WatchlistSearchField — read-only search affordance that opens the search modal.
 *
 * ADR 008 Batch 5: replaces a full-width primary CTA with an always-visible SearchField
 * on the Markets tab (crypto-wallet pattern).
 */

import { type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { SearchField } from "../primitives";

export interface WatchlistSearchFieldProps {
  readonly placeholder: string;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
}

export function WatchlistSearchField({
  placeholder,
  accessibilityLabel,
  onPress,
}: WatchlistSearchFieldProps): ReactNode {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="active:opacity-80"
    >
      <View pointerEvents="none">
        <SearchField value="" onChange={() => {}}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={placeholder} />
          </SearchField.Group>
        </SearchField>
      </View>
    </Pressable>
  );
}
