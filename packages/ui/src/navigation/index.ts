/**
 * navigation/ — T2 自建导航容器（ADR 006 §决策二）
 *
 * 内容：
 * - FloatingTabBar — iOS 26 风格胶囊 tab bar（自建，跨端一致）
 * - header/ — Header Atoms（HeaderBackButton / HeaderCloseButton / ... + useStackScreenOptions hook）
 */

export {
  FloatingTabBar,
  FLOATING_TAB_BAR_HEIGHT,
  FLOATING_TAB_BAR_BOTTOM_INSET,
  TAB_BAR_SAFE_OFFSET_ADDON_PX,
  type FloatingTabBarProps,
} from "./FloatingTabBar";

export * from "./header";
