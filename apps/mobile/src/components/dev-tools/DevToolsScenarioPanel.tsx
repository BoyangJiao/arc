/**
 * DevToolsScenarioPanel — seed scenario picker (shared by FAB sheet + /me/dev-tools).
 */

import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Button, Card, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { invokeDevSeed } from "../../lib/dev-tools/invoke-dev-seed";
import { useDevToolsFabStore } from "../../lib/dev-tools/dev-tools-fab-store";
import {
  DEV_SEED_SCENARIOS,
  type DevSeedScenarioId,
  type DevSeedScenarioLabelKey,
} from "../../lib/dev-tools/scenarios";

export interface DevToolsScenarioPanelProps {
  /** Called after a scenario is applied successfully (e.g. close FAB sheet). */
  onApplied?: () => void;
  /** Show navigation CTA to Portfolio tab. */
  showGoPortfolio?: boolean;
}

export function DevToolsScenarioPanel({
  onApplied,
  showGoPortfolio = true,
}: DevToolsScenarioPanelProps): React.ReactNode {
  const { t } = useTranslation();
  const router = useRouter();
  const setPanelOpen = useDevToolsFabStore((s) => s.setPanelOpen);
  const [activeId, setActiveId] = useState<DevSeedScenarioId | null>(null);
  const [lastSuccess, setLastSuccess] = useState<DevSeedScenarioId | null>(null);

  const labelFor = (key: DevSeedScenarioLabelKey) => t(`devTools.scenarios.${key}.label` as const);

  const hintFor = (key: DevSeedScenarioLabelKey) => t(`devTools.scenarios.${key}.hint` as const);

  const runScenario = useCallback(
    async (scenarioId: DevSeedScenarioId) => {
      setActiveId(scenarioId);
      try {
        await invokeDevSeed(scenarioId);
        setLastSuccess(scenarioId);
        onApplied?.();
        Alert.alert(t("devTools.successTitle"), t("devTools.successBody"), [
          {
            text: t("devTools.goPortfolio"),
            onPress: () => {
              setPanelOpen(false);
              router.replace("/(tabs)" as Href);
            },
          },
          { text: t("common.close") },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert(t("devTools.errorTitle"), message);
      } finally {
        setActiveId(null);
      }
    },
    [onApplied, router, setPanelOpen, t]
  );

  return (
    <View className="gap-4">
      <Text className="text-muted text-sm">{t("devTools.subtitle")}</Text>

      {DEV_SEED_SCENARIOS.map(({ id, labelKey }) => {
        const loading = activeId === id;
        return (
          <Pressable
            key={id}
            disabled={activeId !== null}
            onPress={() => void runScenario(id)}
            className="active:opacity-70"
          >
            <Card>
              <View className="p-4 flex-row items-center justify-between gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-foreground text-base font-semibold">
                    {labelFor(labelKey)}
                  </Text>
                  <Text className="text-muted text-xs">{hintFor(labelKey)}</Text>
                </View>
                {loading ? (
                  <ActivityIndicator />
                ) : lastSuccess === id ? (
                  <Text className="text-accent text-xs">{t("devTools.applied")}</Text>
                ) : null}
              </View>
            </Card>
          </Pressable>
        );
      })}

      <Text className="text-muted text-xs text-center">{t("devTools.reloadHint")}</Text>

      {showGoPortfolio && (
        <Button
          variant="ghost"
          onPress={() => {
            setPanelOpen(false);
            router.replace("/(tabs)" as Href);
          }}
        >
          <Button.Label>{t("devTools.goPortfolio")}</Button.Label>
        </Button>
      )}
    </View>
  );
}
