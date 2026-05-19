/**
 * HeaderSaveButton — compact primary save for InScreenHeader right slot (Batch 7c).
 *
 * ProgressButton is hold-to-confirm only (not async loading). Per component-audit §六
 * fallback: Button + inline spinner while mutation is pending.
 */

import { ActivityIndicator } from "react-native";
import { useThemeColor } from "heroui-native";

import { Button } from "../../primitives";

export interface HeaderSaveButtonProps {
  label: string;
  onPress: () => void;
  isDisabled?: boolean;
  isPending?: boolean;
}

export function HeaderSaveButton({
  label,
  onPress,
  isDisabled = false,
  isPending = false,
}: HeaderSaveButtonProps) {
  const accentForeground = useThemeColor("accent-foreground");

  return (
    <Button
      size="sm"
      variant="primary"
      isDisabled={isDisabled || isPending}
      onPress={onPress}
      accessibilityLabel={label}
    >
      {isPending ? (
        <ActivityIndicator size="small" color={accentForeground} accessibilityLabel={label} />
      ) : (
        <Button.Label>{label}</Button.Label>
      )}
    </Button>
  );
}
