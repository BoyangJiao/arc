/**
 * (tabs)/insights.tsx — Insights Tab (Stage 1 = empty state)
 *
 * Per IA v2.2 §四: "Stage 1 = 空态 + Coming soon"
 * Central illustration + text, no action buttons.
 *
 * Fix 6b: replaces emoji + handrolled layout with HeroUI Pro EmptyState
 * + Lucide Lightbulb icon (matches the insights tab bar icon).
 */

import { EmptyState, FLOATING_TAB_BAR_BOTTOM_INSET, Lightbulb, Screen } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

export default function InsightsTab() {
  const { t } = useTranslation();

  return (
    <Screen scroll={false} contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET }}>
      <EmptyState className="flex-1 px-8 justify-center">
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <Lightbulb size={28} className="text-muted" />
          </EmptyState.Media>
          <EmptyState.Title>{t("insights.title")}</EmptyState.Title>
          <EmptyState.Description>{t("insights.comingSoon")}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    </Screen>
  );
}
