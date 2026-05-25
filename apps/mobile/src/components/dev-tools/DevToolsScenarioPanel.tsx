/**
 * DevToolsScenarioPanel — two-level picker: feature → scenario.
 *
 * Top of the panel renders the Real / Clean env switcher (spec
 * `.specify/feature-specs/cross-stage/real-env-dev-tools.md`). Scenario
 * pickers below are gated by `envMode === 'clean'` in commit #4.
 */

import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, Switch, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useAuth } from "../../lib/auth";
import { goHrefForScenario, invokeDevSeed } from "../../lib/dev-tools/invoke-dev-seed";
import { useDevToolsFabStore } from "../../lib/dev-tools/dev-tools-fab-store";
import { useApiRateLimitSimStore } from "../../lib/dev-tools/api-rate-limit-sim";
import {
  CLEAN_EMAIL_FROM_CONFIG,
  REAL_EMAIL_FROM_CONFIG,
  detectEnvMode,
  type DevEnvMode,
} from "../../lib/dev-tools/env-mode";
import { resetCleanEnv } from "../../lib/dev-tools/run-reset-clean";
import {
  DEV_SEED_FEATURES,
  findFeatureForScenario,
  type DevSeedFeatureId,
  type DevSeedScenarioId,
  type DevSeedScenarioLabelKey,
} from "../../lib/dev-tools/scenarios";

const DESTRUCTIVE_FEATURE_IDS = new Set<DevSeedFeatureId>(["dailySnapshot", "rebalance"]);

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

  const rateLimitSimArmed = useApiRateLimitSimStore((s) => s.armed);
  const setRateLimitSimArmed = useApiRateLimitSimStore((s) => s.setArmed);

  const selectedFeature = selectedFeatureId
    ? DEV_SEED_FEATURES.find((f) => f.id === selectedFeatureId)
    : null;

  const labelFor = (key: DevSeedScenarioLabelKey) => t(`devTools.scenarios.${key}.label` as const);

  const hintFor = (key: DevSeedScenarioLabelKey) => t(`devTools.scenarios.${key}.hint` as const);

  const runScenario = useCallback(
    async (scenarioId: DevSeedScenarioId) => {
      const feature = findFeatureForScenario(scenarioId);

      const applyScenario = async () => {
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
                : selectedFeatureId === "welcome"
                  ? t("devTools.goWelcome")
                  : t("devTools.goPortfolio");

          const viaNote =
            result.via === "client-watchlist"
              ? `\n\n${t("devTools.viaClientWatchlist")}`
              : result.via === "client-rebalance"
                ? `\n\n${t("devTools.viaClientRebalance")}`
                : result.via === "client-welcome"
                  ? `\n\n${t("devTools.viaClientWelcome")}`
                  : result.via === "client-cross-market"
                    ? `\n\n${t("devTools.viaClientCrossMarket")}`
                    : result.via === "client-portfolios"
                      ? `\n\n${t("devTools.viaClientPortfolios")}`
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
      };

      if (DESTRUCTIVE_FEATURE_IDS.has(feature.id)) {
        Alert.alert(t("devTools.destructiveTitle"), t("devTools.destructiveBody"), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("devTools.destructiveConfirm"), onPress: () => void applyScenario() },
        ]);
        return;
      }

      await applyScenario();
    },
    [onApplied, router, selectedFeatureId, setPanelOpen, t]
  );

  if (!selectedFeature) {
    return (
      <View className="gap-4">
        <EnvSwitcherSection />

        <Text className="text-muted text-sm">{t("devTools.pickFeature")}</Text>

        <Card>
          <View className="p-4 flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1 pr-2">
              <Text className="text-foreground text-base font-semibold">
                {t("devTools.apiRateLimitSimLabel")}
              </Text>
              <Text className="text-muted text-xs">{t("devTools.apiRateLimitSimHint")}</Text>
            </View>
            <Switch
              isSelected={rateLimitSimArmed}
              onSelectedChange={setRateLimitSimArmed}
              accessibilityLabel={t("devTools.apiRateLimitSimLabel")}
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
                <Text className="text-muted text-xs mt-1">
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
        <Text className="text-muted text-sm">{t("devTools.backToFeatures")}</Text>
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
                  <Text className="text-success text-xs">{t("devTools.applied")}</Text>
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
              : selectedFeature.id === "rebalance"
                ? t("devTools.goInsights")
                : selectedFeature.id === "welcome"
                  ? t("devTools.goWelcome")
                  : t("devTools.goPortfolio")}
          </Button.Label>
        </Button>
      ) : null}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// EnvSwitcherSection — Real vs Clean DEV env top-of-panel widget.
//
// Spec: `.specify/feature-specs/cross-stage/real-env-dev-tools.md` §决策 1–3.
// Switch flow = signInWithOtpCode(target) → router.replace(/sign-in?email=&codeSent=1) → signOut.
// Reset flow  = resetCleanEnv(queryClient) (no confirm per §决策 3) → router.replace(/welcome).
// ──────────────────────────────────────────────────────────────────────────

function EnvSwitcherSection(): React.ReactNode {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, signOut, signInWithOtpCode } = useAuth();
  const setPanelOpen = useDevToolsFabStore((s) => s.setPanelOpen);

  const [busy, setBusy] = useState<"switching" | "resetting" | null>(null);

  const envMode: DevEnvMode = detectEnvMode(user?.email);
  const realEmail = REAL_EMAIL_FROM_CONFIG;
  const cleanEmail = CLEAN_EMAIL_FROM_CONFIG;
  const envConfigured = !!realEmail && !!cleanEmail;

  const modeLabel =
    envMode === "real"
      ? t("devTools.env.modeRealLabel")
      : envMode === "clean"
        ? t("devTools.env.modeCleanLabel")
        : t("devTools.env.modeUnknownLabel");

  const handleSwitch = useCallback(
    async (target: "real" | "clean") => {
      const targetEmail = target === "real" ? realEmail : cleanEmail;
      if (!targetEmail) {
        Alert.alert(t("devTools.errorTitle"), t("devTools.env.emailNotConfigured"));
        return;
      }
      setBusy("switching");
      try {
        // 1. Fire OTP for the target email up front. Doing this BEFORE signOut
        //    means the user starts seeing the new code in their inbox while we
        //    tear down the current session.
        const { error: sendErr } = await signInWithOtpCode(targetEmail);
        if (sendErr) {
          throw sendErr;
        }

        // 2. Hand off the navigation. AppShell's auth redirect treats
        //    inAuthFlow=true (segments[0]==='sign-in') as a no-op, so our
        //    query params survive signOut even if the auth subscription fires
        //    a redundant router.replace("/sign-in") (params reapply on next
        //    render via useLocalSearchParams).
        setPanelOpen(false);
        router.replace({
          pathname: "/sign-in",
          params: { email: targetEmail, codeSent: "1" },
        });

        // 3. Drop the current session. AuthProvider's listener flips session=null.
        const { error: outErr } = await signOut();
        if (outErr) throw outErr;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert(t("devTools.errorTitle"), t("devTools.env.switchError", { message }));
      } finally {
        setBusy(null);
      }
    },
    [cleanEmail, realEmail, router, setPanelOpen, signInWithOtpCode, signOut, t]
  );

  const handleReset = useCallback(async () => {
    setBusy("resetting");
    try {
      const summary = await resetCleanEnv(queryClient);
      setPanelOpen(false);
      router.replace("/welcome");
      Alert.alert(
        t("devTools.env.resetSuccessTitle"),
        t("devTools.env.resetSuccessBody", {
          tables: String(summary.deletedFromTables.length),
          keys: String(summary.clearedAsyncStorageKeys.length),
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(t("devTools.errorTitle"), t("devTools.env.resetError", { message }));
    } finally {
      setBusy(null);
    }
  }, [queryClient, router, setPanelOpen, t]);

  return (
    <Card>
      <View className="p-4 gap-3">
        <Text className="text-foreground text-base font-semibold">
          {t("devTools.env.sectionLabel")}
        </Text>

        <View className="gap-0.5">
          <Text className="text-muted text-xs">
            {t("devTools.env.signedInAs")}:{" "}
            <Text className="text-foreground">{user?.email ?? "—"}</Text>
          </Text>
          <Text className="text-muted text-xs">{modeLabel}</Text>
        </View>

        {!envConfigured ? (
          <Text className="text-warning text-xs">{t("devTools.env.emailNotConfigured")}</Text>
        ) : null}

        <View className="flex-row gap-2 flex-wrap">
          {envMode !== "real" && envConfigured ? (
            <Button
              variant="secondary"
              isDisabled={busy !== null}
              onPress={() => void handleSwitch("real")}
            >
              <Button.Label>{t("devTools.env.switchToReal")}</Button.Label>
            </Button>
          ) : null}
          {envMode !== "clean" && envConfigured ? (
            <Button
              variant="secondary"
              isDisabled={busy !== null}
              onPress={() => void handleSwitch("clean")}
            >
              <Button.Label>{t("devTools.env.switchToClean")}</Button.Label>
            </Button>
          ) : null}
          {envMode === "clean" ? (
            <Button variant="danger" isDisabled={busy !== null} onPress={() => void handleReset()}>
              <Button.Label>{t("devTools.env.reset")}</Button.Label>
            </Button>
          ) : null}
        </View>

        {busy === "switching" ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator />
            <Text className="text-muted text-xs">{t("devTools.env.switchingHint")}</Text>
          </View>
        ) : null}

        {envMode === "real" ? (
          <Text className="text-muted text-xs">{t("devTools.env.noticeRealScenarios")}</Text>
        ) : envMode === "unknown" ? (
          <Text className="text-muted text-xs">{t("devTools.env.noticeUnknown")}</Text>
        ) : null}
      </View>
    </Card>
  );
}
