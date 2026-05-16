/**
 * Screen — 全屏页面布局原语
 *
 * 解决两件事：
 *   1. 安全区适配（默认避开 status bar / notch / home indicator）
 *   2. 默认 ScrollView + 一致的 contentContainer padding
 *
 * 业务页面统一用 `<Screen>` 包裹，不直接用裸 ScrollView/SafeAreaView，
 * 这样 status bar 遮挡 / 安全区错误这种问题在 1 个地方修，不在 N 个页面修。
 *
 * NOTE: SafeAreaView from react-native-safe-area-context is a third-party
 * component that does NOT participate in Uniwind's runtime theme-switching.
 * className passed to it gets statically resolved and won't react to dark mode.
 * We therefore apply className to a Uniwind-aware <View> wrapper, and use
 * SafeAreaView purely for its safe-area inset behaviour (style-only, no className).
 *
 * @example
 *   <Screen>
 *     <Text>...</Text>
 *   </Screen>
 *
 *   // 不要 scroll（如登录页通常 fit one screen）：
 *   <Screen scroll={false}>...</Screen>
 *
 *   // Modal / sheet 内部不需要 top safe area：
 *   <Screen edges={['bottom']}>...</Screen>
 */

import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View, type ScrollViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

export interface ScreenProps {
  /** 默认 true（包 ScrollView）；scroll=false 时纯 View（fixed layout 用，如登录页）*/
  scroll?: boolean;
  /** 哪些边缘需要避开系统区。默认 ['top']（避开刘海/状态栏，底部 Tab Bar 自己有 safe area）*/
  edges?: ReadonlyArray<Edge>;
  /** 容器 className（默认 `flex-1 bg-background`）*/
  className?: string;
  /** ScrollView 的 contentContainerStyle（默认 `padding: 24, gap: 16`）*/
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
  /** ScrollView 是否 keyboardDismiss on tap. 默认 'on-drag'（用户滚动时收起键盘）*/
  keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
  /** Pull-to-refresh (scroll=true only). */
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
  children: ReactNode;
}

const DEFAULT_CONTENT_STYLE = { padding: 24, gap: 16 } as const;
const DEFAULT_EDGES: ReadonlyArray<Edge> = ["top"];

export function Screen({
  scroll = true,
  edges = DEFAULT_EDGES,
  className = "flex-1 bg-background",
  contentContainerStyle = DEFAULT_CONTENT_STYLE,
  keyboardShouldPersistTaps = "handled",
  refreshing = false,
  onRefresh,
  children,
}: ScreenProps) {
  if (!scroll) {
    return (
      <View className={className}>
        <SafeAreaView edges={edges} style={{ flex: 1 }}>
          <View className="flex-1">{children}</View>
        </SafeAreaView>
      </View>
    );
  }
  return (
    <View className={className}>
      <SafeAreaView edges={edges} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
