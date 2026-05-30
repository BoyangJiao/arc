/**
 * AmountVisibilityToggle — eye control for global amount redaction (Portfolio hero).
 */

import type { ReactNode } from "react";
import { LinkButton } from "../primitives";
import { EyeIcon, EyeSlashIcon } from "../wrappers/icons";
import { ThemedIcon } from "../wrappers/themed-icon";

export interface AmountVisibilityToggleProps {
  /** When true, amounts are hidden (eye-slash = tap to show). */
  readonly amountsHidden: boolean;
  readonly onPress: () => void;
  readonly showAmountsLabel: string;
  readonly hideAmountsLabel: string;
  readonly size?: number;
}

export function AmountVisibilityToggle(props: AmountVisibilityToggleProps): ReactNode {
  const { amountsHidden, onPress, showAmountsLabel, hideAmountsLabel, size = 20 } = props;
  const Icon = amountsHidden ? EyeSlashIcon : EyeIcon;
  const accessibilityLabel = amountsHidden ? showAmountsLabel : hideAmountsLabel;

  return (
    <LinkButton isIconOnly onPress={onPress} accessibilityLabel={accessibilityLabel} hitSlop={8}>
      <ThemedIcon icon={Icon} size={size} colorToken="muted" weight="regular" />
    </LinkButton>
  );
}
