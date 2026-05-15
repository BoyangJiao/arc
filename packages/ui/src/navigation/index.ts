/**
 * navigation/ — T2 自建导航容器（ADR 006 §决策二）
 *
 * 当前内容：
 * - FloatingTabBar — iOS 26 风格胶囊 tab bar（自建，跨端一致）
 *
 * 待 Fix 6 扩展：
 * - header/ — Header Atoms（HeaderBackButton / HeaderCloseButton / ... + useStackScreenOptions hook）
 */

export {
  FloatingTabBar,
  FLOATING_TAB_BAR_HEIGHT,
  FLOATING_TAB_BAR_BOTTOM_INSET,
  type FloatingTabBarProps,
} from "./FloatingTabBar";
