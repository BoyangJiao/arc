/**
 * wrappers/ — T1 layer (ADR 006 §决策二):
 * non-HeroUI third-party packages we depend on, exposed via stable interfaces.
 *
 * Business code never imports from `lucide-react-native`, `react-native-svg`,
 * `react-native-safe-area-context`, `@gorhom/*`, `@dicebear/*` directly. All
 * such imports go through this layer.
 */

export * from "./icons";
