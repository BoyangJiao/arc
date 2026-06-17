/**
 * SegmentToggle — generic single-select segmented control (Pro Segment wrapper).
 *
 * For compact granularity / scope toggles (e.g. 月/季度/年). Mirrors
 * TimeRangeSelector's Segment styling but takes arbitrary {value,label} options.
 */

import type { ReactNode } from "react";
import { Segment } from "../primitives-pro";

import { TYPO_CONTROL_LABEL } from "../tokens/typography";

export interface SegmentToggleOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentToggleProps<T extends string> {
  readonly options: ReadonlyArray<SegmentToggleOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Fill the row and stretch each item equally (default false — content width). */
  readonly fullWidth?: boolean;
}

export function SegmentToggle<T extends string>({
  options,
  value,
  onChange,
  fullWidth = false,
}: SegmentToggleProps<T>): ReactNode {
  return (
    <Segment
      className={fullWidth ? "w-full gap-0" : "gap-0"}
      value={value}
      size="sm"
      onValueChange={(next) => onChange(next as T)}
    >
      <Segment.Group
        className={`flex-row bg-surface-secondary p-0.5 gap-0 ${
          fullWidth ? "w-full self-stretch" : ""
        }`}
      >
        <Segment.Indicator className="bg-surface shadow-none" />
        {options.map((option) => (
          <Segment.Item
            key={option.value}
            value={option.value}
            className={`px-3 py-1 ${fullWidth ? "flex-1 min-w-0" : ""}`}
          >
            <Segment.Label className={`${TYPO_CONTROL_LABEL} text-center`}>
              {option.label}
            </Segment.Label>
          </Segment.Item>
        ))}
      </Segment.Group>
    </Segment>
  );
}
