/**
 * TabScrollShadow — wraps tab-root `ScrollView` with HeroUI `ScrollShadow` (crypto-wallet
 * `app/(tabs)/index.tsx` pattern: `ScrollShadow` + `LinearGradientComponent={LinearGradient}`).
 *
 * Uses `visibility="auto"` so top/bottom gradient feathers appear when content overflows.
 * Bottom shadow softens content over the floating tab bar without a separate BlurView layer.
 */

import { type ReactElement } from "react";

import { ScrollShadow } from "../primitives";
import { LinearGradient } from "../wrappers/linear-gradient";

export interface TabScrollShadowProps {
  children: ReactElement;
  /** Container fills space below `TabScreenHeader`. */
  className?: string;
  /** Gradient feather size in px (default tuned to tab bar inset). */
  size?: number;
}

export function TabScrollShadow({
  children,
  className = "flex-1",
  size = 80,
}: TabScrollShadowProps): ReactElement {
  return (
    <ScrollShadow
      className={className}
      LinearGradientComponent={LinearGradient}
      visibility="auto"
      size={size}
    >
      {children}
    </ScrollShadow>
  );
}
