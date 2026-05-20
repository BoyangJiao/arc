/**
 * /me/portfolios — manage active + archived portfolios.
 */

import { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  Button,
  HardDeleteConfirmDialog,
  InScreenHeader,
  ListGroup,
  PressableFeedback,
  Screen,
  Text,
  scrollContentBelowInScreenHeader,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";
import { resolvePortfolioDisplayName, type Portfolio } from "@arc/core";

import {
  useActivePortfolio,
  useArchivePortfolio,
  useHardDeletePortfolio,
  usePortfolios,
  usePortfolioTransactionCount,
  useRenamePortfolio,
  useUnarchivePortfolio,
} from "../../../src/lib/queries";

export default function PortfoliosListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { activePortfolioId, setActivePortfolioId } = useActivePortfolio();
  const { data: activeList = [] } = usePortfolios();
  const { data: allList = [] } = usePortfolios({ includeArchived: true });
  const archive = useArchivePortfolio();
  const unarchive = useUnarchivePortfolio();
  const rename = useRenamePortfolio();
  const hardDelete = useHardDeletePortfolio();

  const [archivedOpen, setArchivedOpen] = useState(false);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Portfolio | null>(null);
  const [confirmName, setConfirmName] = useState("");

  const archived = useMemo(() => allList.filter((p) => p.archivedAt !== null), [allList]);

  const { data: txCount = 0 } = usePortfolioTransactionCount(hardDeleteTarget?.id);

  const promptRename = (portfolio: Portfolio) => {
    Alert.prompt(
      t("portfolios.renameTitle"),
      portfolio.name,
      async (text) => {
        if (!text?.trim()) return;
        try {
          await rename.mutateAsync({ id: portfolio.id, name: text.trim() });
        } catch (err) {
          Alert.alert(t("common.error"), err instanceof Error ? err.message : String(err));
        }
      },
      "plain-text",
      portfolio.name
    );
  };

  const handleArchive = async (portfolio: Portfolio) => {
    try {
      await archive.mutateAsync(portfolio.id);
      if (portfolio.id === activePortfolioId) {
        const next = activeList.find((p) => p.id !== portfolio.id);
        setActivePortfolioId(next?.id ?? null);
      }
    } catch (err) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
      <InScreenHeader title={t("portfolios.title")} leftType="back" />

      <Text className="text-muted text-xs mb-2">{t("portfolios.active")}</Text>
      <ListGroup>
        {activeList.map((portfolio) => {
          const isActive = portfolio.id === activePortfolioId;
          const name = resolvePortfolioDisplayName(portfolio.name, t("portfolio.myPortfolio"));
          return (
            <PressableFeedback
              key={portfolio.id}
              animation={false}
              onLongPress={() => {
                Alert.alert(name, undefined, [
                  {
                    text: t("portfolios.rename"),
                    onPress: () => promptRename(portfolio),
                  },
                  {
                    text: t("portfolios.archive"),
                    style: "destructive",
                    onPress: () => void handleArchive(portfolio),
                  },
                  { text: t("common.cancel"), style: "cancel" },
                ]);
              }}
              onPress={() => setActivePortfolioId(portfolio.id)}
            >
              <PressableFeedback.Scale>
                <ListGroup.Item>
                  <ListGroup.ItemContent>
                    <ListGroup.ItemTitle>
                      {isActive ? "● " : "○ "}
                      {name}
                    </ListGroup.ItemTitle>
                    <Text className="text-muted text-xs">
                      {portfolio.reportingCurrency}
                      {isActive ? ` · ${t("portfolios.activeMarker")}` : ""}
                    </Text>
                  </ListGroup.ItemContent>
                </ListGroup.Item>
              </PressableFeedback.Scale>
              <PressableFeedback.Ripple />
            </PressableFeedback>
          );
        })}
      </ListGroup>

      <Button className="mt-4" onPress={() => router.push("/me/portfolios/new" as Href)}>
        <Button.Label>{t("portfolios.newCta")}</Button.Label>
      </Button>

      {archived.length > 0 ? (
        <View className="mt-8">
          <Pressable onPress={() => setArchivedOpen((v) => !v)}>
            <Text className="text-muted text-sm mb-2">
              {archivedOpen ? t("portfolios.archivedCollapse") : t("portfolios.archivedExpand")} —{" "}
              {t("portfolios.archived")} ({archived.length})
            </Text>
          </Pressable>
          {archivedOpen ? (
            <ListGroup>
              {archived.map((portfolio) => {
                const name = resolvePortfolioDisplayName(
                  portfolio.name,
                  t("portfolio.myPortfolio")
                );
                return (
                  <ListGroup.Item key={portfolio.id}>
                    <ListGroup.ItemContent>
                      <ListGroup.ItemTitle>○ {name}</ListGroup.ItemTitle>
                      <Text className="text-muted text-xs">{portfolio.reportingCurrency}</Text>
                    </ListGroup.ItemContent>
                    <View className="flex-row gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => void unarchive.mutateAsync(portfolio.id)}
                      >
                        <Button.Label>{t("portfolios.unarchive")}</Button.Label>
                      </Button>
                      <Button
                        size="sm"
                        variant="danger-soft"
                        onPress={() => {
                          setHardDeleteTarget(portfolio);
                          setConfirmName("");
                        }}
                      >
                        <Button.Label>{t("portfolios.hardDelete")}</Button.Label>
                      </Button>
                    </View>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          ) : null}
        </View>
      ) : null}

      <HardDeleteConfirmDialog
        open={!!hardDeleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setHardDeleteTarget(null);
            setConfirmName("");
          }
        }}
        portfolioName={hardDeleteTarget?.name ?? ""}
        transactionCount={txCount}
        confirmValue={confirmName}
        onConfirmValueChange={setConfirmName}
        title={t("portfolios.hardDeleteTitle")}
        description={
          hardDeleteTarget
            ? t("portfolios.hardDeleteDescription", {
                name: hardDeleteTarget.name,
                count: txCount,
              })
            : ""
        }
        inputLabel={
          hardDeleteTarget
            ? t("portfolios.hardDeleteInputLabel", { name: hardDeleteTarget.name })
            : ""
        }
        confirmLabel={t("portfolios.hardDeleteConfirm")}
        cancelLabel={t("common.cancel")}
        isPending={hardDelete.isPending}
        onConfirm={() => {
          if (!hardDeleteTarget) return;
          void hardDelete
            .mutateAsync({ id: hardDeleteTarget.id, confirmName })
            .then(() => {
              setHardDeleteTarget(null);
              setConfirmName("");
            })
            .catch((err) => {
              Alert.alert(t("common.error"), err instanceof Error ? err.message : String(err));
            });
        }}
      />
    </Screen>
  );
}
