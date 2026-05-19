/**
 * wrappers/icons.ts — Phosphor icon re-export hub (ADR 006 §决策二 T1 layer).
 *
 * Stage 2: Lucide → phosphor-react-native（运行时 `color` prop + 主题切换可靠）。
 * Business code only imports icons from `@arc/ui`; never from `phosphor-react-native`.
 *
 * Curated subset — add icons here when first used.
 */

import type { Icon } from "phosphor-react-native";
import {
  CaretLeftIcon,
  CaretRightIcon,
  ChartPieIcon,
  LightbulbIcon,
  MagnifyingGlassIcon,
  SparkleIcon,
  TrashIcon,
  TrendDownIcon,
  TrendUpIcon,
  XIcon,
} from "phosphor-react-native";

export type { Icon as PhosphorIcon };

/** @deprecated Use PhosphorIcon */
export type LucideIcon = Icon;

// ── Canonical Phosphor exports ──────────────────────────────────────────────
export {
  CaretLeftIcon,
  CaretRightIcon,
  ChartPieIcon,
  LightbulbIcon,
  MagnifyingGlassIcon,
  SparkleIcon,
  TrashIcon,
  TrendDownIcon,
  TrendUpIcon,
  XIcon,
};

// ── Legacy Lucide names (aliases — migrate call sites to *Icon over time) ───
/** @deprecated Use CaretLeftIcon */
export const ChevronLeft = CaretLeftIcon;
/** @deprecated Use CaretRightIcon */
export const ChevronRight = CaretRightIcon;
/** @deprecated Use ChartPieIcon */
export const BarChart3 = ChartPieIcon;
/** @deprecated Use TrendUpIcon */
export const TrendingUp = TrendUpIcon;
/** @deprecated Use LightbulbIcon */
export const Lightbulb = LightbulbIcon;
/** @deprecated Use XIcon */
export const X = XIcon;
/** @deprecated Use TrashIcon */
export const Trash2 = TrashIcon;
/** @deprecated Use TrendDownIcon */
export const TrendingDown = TrendDownIcon;
/** @deprecated Use SparkleIcon */
export const Sparkles = SparkleIcon;
