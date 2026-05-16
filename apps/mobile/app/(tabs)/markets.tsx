/**
 * (tabs)/markets.tsx — Markets Tab (Stage 1 = empty state)
 *
 * Per IA v2.2 §四: "Stage 1 = 空态 + Coming soon"
 * Central illustration + text, no action buttons (avoid promising what can't be delivered).
 *
 * Fix 6b: replaces the audit-flagged emoji + handrolled layout with HeroUI Pro
 * EmptyState compound + Lucide TrendingUp icon (consistent with the tab bar
 * icon set; ADR 006 §决策三 T1 wrapper).
 */

import { EmptyState, FLOATING_TAB_BAR_BOTTOM_INSET, Screen, TrendingUp } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

export default function MarketsTab() {
  const { t } = useTranslation();

  return (
    <Screen scroll={false} contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET }}>
      <EmptyState className="flex-1 px-8 justify-center">
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <TrendingUp size={28} className="text-muted" />
          </EmptyState.Media>
          <EmptyState.Title>{t("markets.title")}</EmptyState.Title>
          <EmptyState.Description>{t("markets.comingSoon")}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    </Screen>
  );
}
