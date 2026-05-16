/**
 * navigation/header/ — React Navigation Stack header building blocks.
 * Per ADR 006 §决策五: atoms injected via slots, never a wrapper "TopBar".
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
