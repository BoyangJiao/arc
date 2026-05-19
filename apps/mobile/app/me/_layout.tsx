import { Stack } from "expo-router";

/**
 * Me 子栈：根栈以 `slide_from_left` 打开整个 me 分组；本栈内 push（设置等）使用默认自右推入。
 */
export default function MeStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  );
}
