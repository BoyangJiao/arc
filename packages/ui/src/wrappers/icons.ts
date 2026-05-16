/**
 * wrappers/icons.ts — Lucide icon re-export hub (ADR 006 §决策二 T1 layer).
 *
 * Business code only imports icons from `@arc/ui`; never from `lucide-react-native`.
 * Why a wrapper: lets us swap out the icon source (e.g. heroicons, custom set,
 * SVG asset bundle) later by changing one file. Business code zero churn.
 *
 * Curated subset — add new icons here when first used. Keeping the list explicit
 * prevents accidental "every Lucide icon ships in our bundle" bloat.
 */

export {
  // Bottom tab bar
  BarChart3,
  TrendingUp,
  Lightbulb,
  // Header / list nav
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  // Empty state / placeholders
  TrendingDown,
  Sparkles,
  // Future (Stage 2+) — uncomment when actually used:
  // Bell,        // notifications
  // Search,      // global search
  // Plus,        // FAB
  // Settings,    // gear
  type LucideIcon,
} from "lucide-react-native";
