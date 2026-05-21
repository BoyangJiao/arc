/**
 * (tabs)/insights.tsx — per-portfolio insight cards dashboard (Stage 3 Block B).
 */

import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CrossPortfolioRebalancePlaceholderCard,
  EmptyState,
  FLOATING_TAB_BAR_BOTTOM_INSET,
  LightbulbIcon,
  Screen,
  TabScreenHeader,
  TabScrollShadow,
  Text,
  ThemedIcon,
  UserAvatar,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { InsightsActiveRebalancePanel } from "../../src/components/InsightsActiveRebalancePanel";
import { PortfolioInsightCardLoader } from "../../src/components/PortfolioInsightCardLoader";
import { useAuth } from "../../src/lib/auth";
import { usePortfolios } from "../../src/lib/queries";

export default function InsightsTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: portfolios = [], isPending, refetch, isFetching } = usePortfolios();

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
          <InsightsActiveRebalancePanel />

          {portfolios.length > 1 ? (
            <Text className="text-foreground font-semibold text-base">
              {t("rebalance.allPortfoliosSection")}
            </Text>
          ) : null}

          {portfolios.map((portfolio) => (
            <PortfolioInsightCardLoader key={portfolio.id} portfolio={portfolio} />
          ))}

          <CrossPortfolioRebalancePlaceholderCard
            title={t("portfolios.crossPortfolioPlaceholderTitle")}
            badge={t("portfolios.crossPortfolioPlaceholderBadge")}
            description={t("portfolios.crossPortfolioPlaceholderDescription")}
          />

          <Text className="text-muted text-xs text-center">{t("common.notInvestmentAdvice")}</Text>
        </ScrollView>
      </TabScrollShadow>
    </Screen>
  );
}
