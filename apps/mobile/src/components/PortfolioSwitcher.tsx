/**
 * PortfolioSwitcher — active portfolio dropdown (Portfolio Tab only).
 */

import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Button, Dialog, Text } from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { resolvePortfolioDisplayName } from "@arc/core";

import { useActivePortfolio, usePortfolios } from "../lib/queries";

export const PortfolioSwitcher = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: portfolios = [] } = usePortfolios();
  const { portfolio, activePortfolioId, setActivePortfolioId } = useActivePortfolio();

  if (!portfolio) return null;

  const unarchived = portfolios;
  const showChevron = unarchived.length > 1;
  const displayName = resolvePortfolioDisplayName(portfolio.name, t("portfolio.myPortfolio"));

  if (!showChevron) {
    return <Text className="text-foreground font-semibold text-base">{displayName}</Text>;
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={displayName}
        hitSlop={8}
        className="flex-row items-center gap-1 max-w-[200px]"
      >
        <Text className="text-foreground font-semibold text-base" numberOfLines={1}>
          {displayName}
        </Text>
        <Text className="text-muted text-sm">▼</Text>
      </Pressable>

      <Dialog isOpen={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Title>{t("portfolios.title")}</Dialog.Title>
            <View className="gap-2 mt-3">
              {unarchived.map((p) => {
                const isActive = p.id === activePortfolioId;
                const name = resolvePortfolioDisplayName(p.name, t("portfolio.myPortfolio"));
                return (
                  <Button
                    key={p.id}
                    variant={isActive ? "secondary" : "ghost"}
                    onPress={() => {
                      setActivePortfolioId(p.id);
                      setOpen(false);
                    }}
                  >
                    <Button.Label>
                      {isActive ? "● " : "○ "}
                      {name} ({p.reportingCurrency})
                    </Button.Label>
                  </Button>
                );
              })}
              <Button
                variant="ghost"
                onPress={() => {
                  setOpen(false);
                  router.push("/me/portfolios" as Href);
                }}
              >
                <Button.Label>{t("portfolios.switcherManage")}</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
};
