/**
 * primitives/ — HeroUI Native 薄封装层
 *
 * 业务代码必须只 import 这里，绝不直接 import 'heroui-native' 或 'heroui-native-pro'。
 * 见 CLAUDE.md §五最后一行的铁律。
 *
 * 当 Pro GA 后或某个 Pro 组件出 bug 需要降级时，只在本层切换实现，业务代码无感。
 */

// ── HeroUI Native (OSS) re-exports ──────────────────────────────────────────
export { Button, Card, Switch, HeroUINativeProvider } from "heroui-native";

// ── HeroUI Native Pro re-exports ────────────────────────────────────────────
// 待业务实际使用时按需打开（避免不必要的打包体积/peer 警告）：
// export { NumberField, DatePicker, DateRangePicker, Stepper } from "heroui-native-pro";

// ── 受主题感知的基础原语 ─────────────────────────────────────────────────────
export { Text } from "./Text";
export { Screen, type ScreenProps } from "./Screen";
