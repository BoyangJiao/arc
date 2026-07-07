/**
 * HeroUI Pro charts resolve victory-native / skia via optional require() inside heroui-native-pro.
 * Side-effect imports keep Metro from tree-shaking them out of the monorepo bundle graph.
 */
import "@shopify/react-native-skia";
import "victory-native";
