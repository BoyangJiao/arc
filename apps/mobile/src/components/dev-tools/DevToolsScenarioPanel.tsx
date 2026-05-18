/**
 * DevToolsScenarioPanel — two-level picker: feature → scenario.
 */

import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Switch, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { goHrefForScenario, invokeDevSeed } from "../../lib/dev-tools/invoke-dev-seed";
import { useDevToolsFabStore } from "../../lib/dev-tools/dev-tools-fab-store";
import { useWatchlistRateLimitSimStore } from "../../lib/dev-tools/watchlist-rate-limit-sim";
import {
  DEV_SEED_FEATURES,
  type DevSeedFeatureId,
  type DevSeedScenarioId,
  type DevSeedScenarioLabelKey,
} from "../../lib/dev-tools/scenarios";

export interface DevToolsScenarioPanelProps {
  onApplied?: () => void;
  showGoTab?: boolean;
}

export function DevToolsScenarioPanel({
  onApplied,
  showGoTab = true,
}: DevToolsScenarioPanelProps): React.ReactNode {
  const { t } = useTranslation();
  const router = useRouter();
  const setPanelOpen = useDevToolsFabStore((s) => s.setPanelOpen);

  const [selectedFeatureId, setSelectedFeatureId] = useState<DevSeedFeatureId | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<DevSeedScenarioId | null>(null);
  const [lastSuccessId, setLastSuccessId] = useState<DevSeedScenarioId | null>(null);

  const rateLimitSimArmed = useWatchlistRateLimitSimStore((s) => s.armed);
  const setRateLimitSimArmed = useWatchlistRateLimitSimStore((s) => s.setArmed);

  const selectedFeature = selectedFeatureId
    ? DEV_SEED_FEATURES.find((f) => f.id === selectedFeatureId)
    : null;

  const labelFor = (key: DevSeedScenarioLabelKey) => t(`devTools.scenarios.${key}.label` as const);

  const hintFor = (key: DevSeedScenarioLabelKey) => t(`devTools.scenarios.${key}.hint` as const);

  const runScenario = useCallback(
    async (scenarioId: DevSeedScenarioId) => {
      setActiveScenarioId(scenarioId);
      try {
        const result = await invokeDevSeed(scenarioId);
        setLastSuccessId(scenarioId);
        onApplied?.();

        const goHref = goHrefForScenario(scenarioId);
        const goLabel =
          selectedFeatureId === "watchlist"
            ? t("devTools.goMarkets")
            : selectedFeatureId === "rebalance"
              ? t("devTools.goInsights")
              : t("devTools.goPortfolio");

        const viaNote =
          result.via === "client-watchlist"
            ? `\n\n${t("devTools.viaClientWatchlist")}`
            : result.via === "client-rebalance"
              ? `\n\n${t("devTools.viaClientRebalance")}`
              : "";

        Alert.alert(t("devTools.successTitle"), `${t("devTools.successBody")}${viaNote}`, [
          {
            text: goLabel,
            onPress: () => {
              setPanelOpen(false);
              router.replace(goHref);
            },
          },
          { text: t("common.close") },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert(t("devTools.errorTitle"), message);
      } finally {
        setActiveScenarioId(null);
      }
    },
    [onApplied, router, selectedFeatureId, setPanelOpen, t]
  );

  if (!selectedFeature) {
    return (
      <View className="gap-4">
        <Text className="text-muted text-sm">{t("devTools.pickFeature")}</Text>

        <Card>
          <View className="p-4 flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1 pr-2">
              <Text className="text-foreground text-base font-semibold">
                {t("devTools.watchlistRateLimitSimLabel")}
              </Text>
              <Text className="text-muted text-xs">{t("devTools.watchlistRateLimitSimHint")}</Text>
            </View>
            <Switch
              isSelected={rateLimitSimArmed}
              onSelectedChange={setRateLimitSimArmed}
              accessibilityLabel={t("devTools.watchlistRateLimitSimLabel")}
            />
          </View>
        </Card>

        {DEV_SEED_FEATURES.map((feature) => (
          <Pressable
            key={feature.id}
            disabled={activeScenarioId !== null}
            onPress={() => setSelectedFeatureId(feature.id)}
            className="active:opacity-70"
          >
            <Card>
              <View className="p-4 gap-1">
                <Text className="text-foreground text-base font-semibold">
                  {t(`devTools.features.${feature.labelKey}.label` as const)}
                </Text>
                <Text className="text-muted text-xs">
                  {t(`devTools.features.${feature.labelKey}.description` as const)}
                </Text>
                <Text className="text-accent text-xs mt-1">
                  {t("devTools.scenarioCount", { count: feature.scenarios.length })}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))}

        <Text className="text-muted text-xs text-center">{t("devTools.reloadHint")}</Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <Pressable
        onPress={() => {
          setSelectedFeatureId(null);
          setLastSuccessId(null);
        }}
        hitSlop={8}
        className="self-start"
      >
        <Text className="text-accent text-sm">{t("devTools.backToFeatures")}</Text>
      </Pressable>

      <View className="gap-1">
        <Text className="text-foreground text-base font-semibold">
          {t(`devTools.features.${selectedFeature.labelKey}.label` as const)}
        </Text>
        <Text className="text-muted text-xs">
          {t(`devTools.features.${selectedFeature.labelKey}.description` as const)}
        </Text>
      </View>

      {selectedFeature.scenarios.map(({ id, labelKey }) => {
        const loading = activeScenarioId === id;
        return (
          <Pressable
            key={id}
            disabled={activeScenarioId !== null}
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
                ) : lastSuccessId === id ? (
                  <Text className="text-accent text-xs">{t("devTools.applied")}</Text>
                ) : null}
              </View>
            </Card>
          </Pressable>
        );
      })}

      <Text className="text-muted text-xs text-center">{t("devTools.reloadHint")}</Text>

      {showGoTab ? (
        <Button
          variant="ghost"
          onPress={() => {
            setPanelOpen(false);
            router.replace(selectedFeature.goHref);
          }}
        >
          <Button.Label>
            {selectedFeature.id === "watchlist"
              ? t("devTools.goMarkets")
              : t("devTools.goPortfolio")}
          </Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
