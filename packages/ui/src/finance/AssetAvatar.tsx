/**
 * AssetAvatar — 36px visual anchor for holdings / watchlist rows.
 *
 * Monogram: symbol first 2 chars on deterministic gradient.
 * Optional remote image (crypto logos) overlays monogram; falls back on error.
 * Market badge: bottom-right corner chip.
 */

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Image, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Text } from "../primitives/Text";
import { TYPO_AVATAR_BADGE, TYPO_AVATAR_MONOGRAM } from "../tokens/typography";

import { gradientForSeed, MARKET_BADGE_CODE, monogramFromSymbol } from "./asset-avatar-utils";
import type { RebalanceMarket } from "./rebalance-types";

export interface AssetAvatarProps {
  readonly symbol: string;
  readonly market: RebalanceMarket;
  /** Full market label for accessibility (i18n from parent). */
  readonly marketLabel: string;
  readonly imageUrl?: string | null;
  readonly size?: number;
  readonly className?: string;
}

const DEFAULT_SIZE = 36;

export function AssetAvatar({
  symbol,
  market,
  marketLabel,
  imageUrl,
  size = DEFAULT_SIZE,
  className,
}: AssetAvatarProps): ReactNode {
  const [imageFailed, setImageFailed] = useState(false);
  const monogram = useMemo(() => monogramFromSymbol(symbol), [symbol]);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);
  const [startColor, endColor] = useMemo(
    () => gradientForSeed(`${market}:${symbol}`),
    [market, symbol]
  );
  const showImage = !!imageUrl && !imageFailed;
  const badgeCode = MARKET_BADGE_CODE[market];
  const radius = size / 2;
  const badgeSize = Math.max(14, Math.round(size * 0.38));
  const monogramSize = Math.max(11, Math.round(size * 0.33));

  return (
    <View
      className={className}
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel={`${symbol}, ${marketLabel}`}
    >
      <LinearGradient
        colors={[startColor, endColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {!showImage ? (
          <Text
            className={TYPO_AVATAR_MONOGRAM}
            style={{ fontSize: monogramSize, lineHeight: monogramSize + 2 }}
          >
            {monogram}
          </Text>
        ) : null}
        {showImage ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: size, height: size, position: "absolute" }}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : null}
      </LinearGradient>
      <View
        className="absolute bg-surface border border-border items-center justify-center"
        style={{
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
          right: -2,
          bottom: -2,
        }}
      >
        <Text
          className={TYPO_AVATAR_BADGE}
          style={{ fontSize: Math.max(8, Math.round(badgeSize * 0.45)) }}
        >
          {badgeCode}
        </Text>
      </View>
    </View>
  );
}
