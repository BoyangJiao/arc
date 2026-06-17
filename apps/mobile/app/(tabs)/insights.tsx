/**
 * (tabs)/insights.tsx — insights dashboard, scoped to ONE portfolio at a time.
 *
 * A top PortfolioToggleGroup (shown only with ≥2 portfolios) selects which
 * portfolio's insights to view — it drives the active-portfolio id, so every
 * section (盈亏分析 entry / 资产配置 / 持仓表现 / 组合统计) follows the same
 * selection. Replaces the old per-portfolio chip + allocation loop.
 */

import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CrossPortfolioRebalancePlaceholderCard,
  EmptyState,
  FLOATING_TAB_BAR_BOTTOM_INSET,
  HeaderActionButton,
  LightbulbIcon,
  PortfolioToggleGroup,
  Screen,
  Separator,
  SparkleIcon,
  TabScreenHeader,
  TabScrollShadow,
  Text,
  ThemedIcon,
  UserAvatar,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { PortfolioAllocationSection } from "../../src/components/PortfolioAllocationSection";
import { PortfolioHoldingsPerformanceSection } from "../../src/components/PortfolioHoldingsPerformanceSection";
import { PortfolioStatsSection } from "../../src/components/PortfolioStatsSection";
import { PnlEntryCardLoader } from "../../src/components/PnlEntryCardLoader";
import { useAuth } from "../../src/lib/auth";
import { useActivePortfolio, usePortfolios } from "../../src/lib/queries";

export default function InsightsTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: portfolios = [], isPending, refetch, isFetching } = usePortfolios();
  const { activePortfolioId, setActivePortfolioId } = useActivePortfolio();
  const selectedPortfolio =
    portfolios.find((p) => p.id === activePortfolioId) ?? portfolios[0] ?? null;

  const handleAvatarPress = () => {
    router.push("/me" as Href);
  };

  const header = (
    <TabScreenHeader
      title={t("tabs.insights")}
      leftSlot={
        <Pressable onPress={handleAvatarPress} accessibilityLabel={t("me.title")} hitSlop={8}>
          <UserAvatar seed={user?.email} size={40} />
        </Pressable>
      }
      rightSlot={
        <HeaderActionButton
          icon={SparkleIcon}
          onPress={() => router.push("/ai" as Href)}
          accessibilityLabel={t("ai.title")}
        />
      }
    />
  );

  if (isPending) {
    return (
      <Screen scroll={false}>
        {header}
        <View
          className="flex-1 items-center justify-center"
          style={{ paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET }}
        >
          <Text className="text-muted">{t("common.loading")}</Text>
        </View>
      </Screen>
    );
  }

  if (portfolios.length === 0) {
    return (
      <Screen scroll={false}>
        {header}
        <EmptyState
          className="flex-1 px-8 justify-center"
          style={{ paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET }}
        >
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <ThemedIcon icon={LightbulbIcon} size={28} colorToken="foreground" weight="duotone" />
            </EmptyState.Media>
            <EmptyState.Title>{t("portfolios.emptyInsightsTitle")}</EmptyState.Title>
            <EmptyState.Description>{t("portfolios.emptyInsightsHint")}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      {header}
      <TabScrollShadow>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: FLOATING_TAB_BAR_BOTTOM_INSET,
            gap: 16,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={() => {
                void refetch();
                void queryClient.invalidateQueries({ queryKey: ["portfolioValuation"] });
                void queryClient.invalidateQueries({ queryKey: ["rebalance"] });
              }}
            />
          }
        >
          <PortfolioToggleGroup
            portfolios={portfolios}
            selectedId={selectedPortfolio?.id ?? null}
            onSelect={setActivePortfolioId}
          />

          <PnlEntryCardLoader />

          {selectedPortfolio ? <PortfolioAllocationSection portfolio={selectedPortfolio} /> : null}

          <Separator />

          <PortfolioHoldingsPerformanceSection />

          <PortfolioStatsSection />

          <Separator />

          <CrossPortfolioRebalancePlaceholderCard
            title={t("portfolios.crossPortfolioPlaceholderTitle")}
            badge={t("portfolios.crossPortfolioPlaceholderBadge")}
            description={t("portfolios.crossPortfolioPlaceholderDescription")}
          />
        </ScrollView>
      </TabScrollShadow>
    </Screen>
  );
}
