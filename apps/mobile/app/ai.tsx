/**
 * ai.tsx — AI assistant placeholder (Stage 3 Block E P2).
 *
 * Per stage-3-roadmap §三 Block E + §七 decision 3: light up the AI entry with a
 * placeholder + preset question chips; no LLM wired (that is V1.0+). The chips are
 * display-only previews of the kinds of analytical questions Arc will answer —
 * descriptive (not advice), per the constitution's copy rules.
 */

import { View } from "react-native";
import { InScreenHeader, Chip, Screen, Text, scrollContentBelowInScreenHeader } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

const PRESET_KEYS = ["periodChange", "topMover", "drift", "realized"] as const;

export default function AiScreen() {
  const { t } = useTranslation();

  return (
    <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
      <InScreenHeader title={t("ai.title")} leftType="back" />
      <View className="gap-6 px-1 py-4">
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-foreground text-xl font-semibold">{t("ai.heroTitle")}</Text>
            <Chip size="sm" variant="soft" color="default">
              <Chip.Label>{t("ai.comingSoon")}</Chip.Label>
            </Chip>
          </View>
          <Text className="text-muted text-sm">{t("ai.heroDescription")}</Text>
        </View>

        <View className="gap-2">
          <Text className="text-muted text-xs uppercase tracking-wide">{t("ai.presetsTitle")}</Text>
          <View className="flex-row flex-wrap gap-2">
            {PRESET_KEYS.map((key) => (
              <Chip key={key} size="md" variant="soft" color="default">
                <Chip.Label>{t(`ai.presets.${key}` as "ai.presets.periodChange")}</Chip.Label>
              </Chip>
            ))}
          </View>
        </View>

        <Text className="text-muted text-xs">{t("ai.disclaimer")}</Text>
      </View>
    </Screen>
  );
}
