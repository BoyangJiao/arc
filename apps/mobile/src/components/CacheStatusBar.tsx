/**
 * CacheStatusBar — lightweight status row shown below the Portfolio Hero.
 *
 * Spec: offline-cache-stage-3.md §决策 4a
 *
 * Shows three states:
 *   1. Offline: amber "no internet" row (decision: distinct from stale data)
 *   2. Refreshing: muted "更新中…" text beside the last-updated time
 *   3. Idle: muted "更新于 HH:MM" — gives the stale jump a narrative so the
 *      user understands the jump when fresh data arrives.
 *
 * Compliance:
 *   - No hardcoded colors — uses token classes (text-muted, text-warning)
 *   - No forbidden copy — "更新于" / "offline" are neutral, not advice
 *   - amountsHidden does NOT apply here (times are not financial amounts)
 */

import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useTranslation } from "@arc/i18n";
import { Text } from "@arc/ui";

interface CacheStatusBarProps {
  /** ISO timestamp string of when data was last fetched. Null = not yet loaded. */
  readonly dataUpdatedAt: number | null;
  /** True while a background refetch is in progress. */
  readonly isRefreshing: boolean;
}

const formatTime = (epochMs: number, locale: string): string => {
  return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(epochMs));
};

export function CacheStatusBar({ dataUpdatedAt, isRefreshing }: CacheStatusBarProps) {
  const { t, i18n } = useTranslation();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  // Subscribe to network state. Unsubscribe on unmount.
  const unsubRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? null);
    });
    unsubRef.current = unsub;
    return () => {
      unsubRef.current?.();
    };
  }, []);

  // Offline row — distinct visual from stale data.
  if (isConnected === false) {
    return (
      <View className="flex-row items-center gap-1.5 py-1">
        <Text className="text-warning text-xs">{t("cache.offline")}</Text>
      </View>
    );
  }

  // No data yet — nothing to show.
  if (!dataUpdatedAt) return null;

  const timeStr = formatTime(dataUpdatedAt, i18n.language);

  return (
    <View className="flex-row items-center gap-1.5 py-0.5">
      <Text className="text-muted text-xs">
        {isRefreshing ? t("cache.refreshing") : t("cache.updatedAt", { time: timeStr })}
      </Text>
    </View>
  );
}
