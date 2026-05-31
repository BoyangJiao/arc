/**
 * me/subscription.tsx — subscription tiers placeholder (Stage 3 Block E P2).
 *
 * Per stage-3-roadmap §三 Block E + §七 decision 2: show the Free / Pro / Pro+
 * tiers with feature bullets and a "coming soon" note; no pricing numbers and no
 * payment wiring (Apple IAP / Stripe is Stage 4). Pricing strategy is an Opus
 * discussion item, so we deliberately show "敬请期待" instead of a fabricated price.
 */

import { View } from "react-native";
import {
  Card,
  InScreenHeader,
  Chip,
  Screen,
  Text,
  scrollContentBelowInScreenHeader,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

const TIER_KEYS = ["free", "pro", "proPlus"] as const;
const FEATURES_PER_TIER = 3;

export default function SubscriptionScreen() {
  const { t } = useTranslation();

  return (
    <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
      <InScreenHeader title={t("subscription.title")} leftType="back" />
      <View className="gap-4 px-1 py-4">
        <Text className="text-muted text-sm">{t("subscription.intro")}</Text>

        {TIER_KEYS.map((tier) => (
          <Card key={tier}>
            <View className="gap-3 p-4">
              <View className="flex-row items-center gap-2">
                <Text className="text-foreground text-lg font-semibold">
                  {t(`subscription.tiers.${tier}.name` as "subscription.tiers.free.name")}
                </Text>
                <Chip size="sm" variant="soft" color="default">
                  <Chip.Label>{t("subscription.comingSoon")}</Chip.Label>
                </Chip>
              </View>
              <View className="gap-1.5">
                {Array.from({ length: FEATURES_PER_TIER }, (_, i) => (
                  <Text key={i} className="text-muted text-sm">
                    ·{" "}
                    {t(
                      `subscription.tiers.${tier}.features.${i}` as "subscription.tiers.free.features.0"
                    )}
                  </Text>
                ))}
              </View>
            </View>
          </Card>
        ))}

        <Text className="text-muted text-xs">{t("subscription.disclaimer")}</Text>
      </View>
    </Screen>
  );
}
