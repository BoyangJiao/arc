/**
 * UserAvatar — deterministic gradient avatar (ADR 004 landed).
 *
 * Seed is the user's email; same email always renders the same avatar.
 * Used wherever an account-identity affordance appears (Portfolio Tab top
 * bar, Me page header).
 *
 * Note on style: ADR 004 specified `gradient` from @dicebear/collection.
 * In dicebear v9 the spiritual successor — abstract glass-morphism circles
 * matching the "纯色渐变椭圆" description — is `glass`. We use `glass`
 * here. If ADR 004 needs literal correction it can be updated; behavior
 * matches intent.
 *
 * Rendering: dicebear emits SVG. We render via `react-native-svg`'s
 * `SvgXml` (already a peer dep of @arc/ui).
 */

import { useMemo } from "react";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { createAvatar } from "@dicebear/core";
import { glass } from "@dicebear/collection";

export interface UserAvatarProps {
  /** Email or any stable string — same input → same avatar. */
  seed: string | null | undefined;
  /** Size in px, applied to width + height. Default 40. */
  size?: number;
  /** Optional className for the wrapping View (rounding etc.). */
  className?: string;
}

const FALLBACK_SEED = "arc-anonymous";
const DEFAULT_SIZE = 40;

export function UserAvatar({ seed, size = DEFAULT_SIZE, className }: UserAvatarProps) {
  const svg = useMemo(() => {
    const effectiveSeed = seed && seed.length > 0 ? seed : FALLBACK_SEED;
    return createAvatar(glass, { seed: effectiveSeed, size }).toString();
  }, [seed, size]);

  const radius = size / 2;

  return (
    <View
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
      }}
      accessibilityRole="image"
      accessibilityLabel="User avatar"
    >
      <SvgXml xml={svg} width={size} height={size} />
    </View>
  );
}
