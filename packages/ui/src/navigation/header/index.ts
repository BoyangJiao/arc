/**
 * navigation/header/ — Header building blocks.
 *
 * Two flavors:
 *   1. HeaderAtoms — slot atoms for React Navigation Stack header (legacy, ADR 006 §决策五)
 *   2. InScreenHeader — full self-contained in-page header (preferred for modal/secondary,
 *                       ADR 008 Batch 3 — avoids "叠层" + status-bar white-strip bugs)
 */

export {
  HeaderBackButton,
  HeaderCloseButton,
  HeaderActionButton,
  HeaderTextButton,
  useStackScreenOptions,
  type HeaderBackButtonProps,
  type HeaderCloseButtonProps,
  type HeaderActionButtonProps,
  type HeaderTextButtonProps,
  type BackType,
  type UseStackScreenOptionsArgs,
} from "./HeaderAtoms";

export { HeaderSaveButton, type HeaderSaveButtonProps } from "./HeaderSaveButton";

export {
  InScreenHeader,
  type InScreenHeaderProps,
  type InScreenHeaderLeftType,
} from "./InScreenHeader";

export { TabScreenHeader, type TabScreenHeaderProps } from "./TabScreenHeader";

export { scrollContentBelowInScreenHeader } from "./scrollContentBelowInScreenHeader";
