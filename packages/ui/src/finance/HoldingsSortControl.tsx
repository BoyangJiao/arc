/**
 * HoldingsSortControl — compact sort picker for HoldingsTable header.
 * Uses HeroUI Native Select with popover presentation.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { useThemeColor } from "heroui-native";
import { Select } from "../primitives";
import { ArrowsDownUpIcon } from "../wrappers/icons";

export type HoldingsSortKey = "value_desc" | "gain_pct_desc" | "gain_pct_asc" | "market";

export interface HoldingsSortOption {
  readonly key: HoldingsSortKey;
  readonly label: string;
}

export interface HoldingsSortControlProps {
  readonly sortKey: HoldingsSortKey;
  readonly onSortKeyChange: (key: HoldingsSortKey) => void;
  readonly options: ReadonlyArray<HoldingsSortOption>;
}

export function HoldingsSortControl({
  sortKey,
  onSortKeyChange,
  options,
}: HoldingsSortControlProps): ReactNode {
  const current = options.find((o) => o.key === sortKey);
  const mutedColor = useThemeColor("muted");

  return (
    <Select
      presentation="popover"
      value={current ? { value: current.key, label: current.label } : undefined}
      onValueChange={(opt) => {
        if (opt) onSortKeyChange(opt.value as HoldingsSortKey);
      }}
    >
      <Select.Trigger variant="unstyled">
        <View className="flex-row items-center gap-1 py-0.5">
          <ArrowsDownUpIcon size={12} color={mutedColor} />
          <Select.Value placeholder="" className="text-muted text-xs font-medium" />
          <Select.TriggerIndicator iconProps={{ size: 12, color: mutedColor }} />
        </View>
      </Select.Trigger>
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="popover" width={140} align="end">
          {options.map((opt) => (
            <Select.Item key={opt.key} value={opt.key} label={opt.label}>
              <Select.ItemLabel />
              <Select.ItemIndicator />
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}
