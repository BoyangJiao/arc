/**
 * primitives/ — HeroUI Native 薄封装层
 *
 * 业务代码必须只 import 这里，绝不直接 import 'heroui-native' 或 'heroui-native-pro'。
 * 见 CLAUDE.md §五最后一行的铁律。
 *
 * 当 Pro GA 后或某个 Pro 组件出 bug 需要降级时，只在本层切换实现，业务代码无感。
 */

// ── HeroUI Native (OSS) re-exports ──────────────────────────────────────────
// Phase 2 batch 1（2026-05-19, audit 后扩展）：
//   按 .specify/feature-specs/cross-stage/component-audit.md §1.1 P0 列表开放。
//   未启用项（accordion / alert / checkbox / control-field / input-group /
//   input-otp / menu / popover / radio-group / select / slider /
//   spinner / tag-group / text-area）推迟到实际场景出现再加。
export {
  // Foundation
  HeroUINativeProvider,
  cn,
  Surface,
  PressableFeedback,
  // Buttons
  Button,
  CloseButton,
  LinkButton,
  // Containers
  Card,
  BottomSheet,
  Dialog,
  ListGroup,
  // Form fields (compound — Label/Input/Description/FieldError used together)
  TextField,
  Label,
  Input,
  Description,
  FieldError,
  SearchField,
  Switch,
  // Display
  Avatar,
  Chip,
  Separator,
  Skeleton,
  SkeletonGroup,
  // Feedback
  Toast,
  // Navigation
  Tabs,
  // Scroll utilities (crypto-wallet home pattern — ScrollShadow + LinearGradient)
  ScrollShadow,
} from "heroui-native";

// HeroUI Pro re-exports live in primitives-pro/ (subpath import 强制纪律).

// ── 受主题感知的基础原语 ─────────────────────────────────────────────────────
export { Text } from "./Text";
export { Screen, type ScreenProps } from "./Screen";
