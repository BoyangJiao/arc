/**
 * /me/portfolios — manage active + archived portfolios.
 *
 * Each active row: tap to make active; "⋮" opens an options BottomSheet
 * (rename always; delete only for non-default portfolios). The default
 * portfolio is the oldest non-archived one (activeList is ordered created_at
 * ascending) and cannot be deleted.
 *
 * Delete respects the data-safety chain (constitution §3.2): it archives then
 * hard-deletes behind the name-typed HardDeleteConfirmDialog.
 *
 * Dividend auto-calc toggle is intentionally deferred (needs a dividend data
 * source + compute engine + migration — separate spec).
 */

import { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  BottomSheet,
  Button,
  DotsThreeVerticalIcon,
  HardDeleteConfirmDialog,
  InScreenHeader,
  ListGroup,
  PencilSimpleIcon,
  PressableFeedback,
  Screen,
  Text,
  ThemedIcon,
  TrashIcon,
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
  const [sheetTarget, setSheetTarget] = useState<Portfolio | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Portfolio | null>(null);
  const [confirmName, setConfirmName] = useState("");

  const archived = useMemo(() => allList.filter((p) => p.archivedAt !== null), [allList]);

  // Default = oldest non-archived portfolio (query orders created_at ascending).
  const defaultPortfolioId = activeList[0]?.id;

  const { data: txCount = 0 } = usePortfolioTransactionCount(hardDeleteTarget?.id);

  const displayName = (p: Portfolio) =>
    resolvePortfolioDisplayName(p.name, t("portfolio.myPortfolio"));

  const promptRename = (portfolio: Portfolio) => {
    Alert.prompt(
      t("portfolios.renameTitle"),
      displayName(portfolio),
      async (text) => {
        if (!text?.trim()) return;
        try {
          await rename.mutateAsync({ id: portfolio.id, name: text.trim() });
        } catch (err) {
          Alert.alert(t("common.error"), err instanceof Error ? err.message : String(err));
        }
      },
      "plain-text",
      displayName(portfolio)
    );
  };

  // Close the options sheet first, then run the follow-up action after the
  // sheet's exit animation so its FullWindowOverlay doesn't clash with the
  // system prompt / confirm dialog (same pattern as the CSV import screen).
  const handleSheetRename = (portfolio: Portfolio) => {
    setSheetTarget(null);
    setTimeout(() => promptRename(portfolio), 380);
  };

  const handleSheetDelete = (portfolio: Portfolio) => {
    setSheetTarget(null);
    setTimeout(() => {
      setHardDeleteTarget(portfolio);
      setConfirmName("");
    }, 380);
  };

  const runHardDelete = (target: Portfolio) => {
    void (async () => {
      try {
        // Satisfy the archived-before-delete precondition for active portfolios.
        if (!target.archivedAt) await archive.mutateAsync(target.id);
        await hardDelete.mutateAsync({ id: target.id, confirmName });
        if (target.id === activePortfolioId) {
          const next = activeList.find((p) => p.id !== target.id);
          setActivePortfolioId(next?.id ?? null);
        }
        setHardDeleteTarget(null);
        setConfirmName("");
      } catch (err) {
        Alert.alert(t("common.error"), err instanceof Error ? err.message : String(err));
      }
    })();
  };

  return (
    <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
      <InScreenHeader title={t("portfolios.title")} leftType="back" />

      <Text className="text-muted text-xs mb-2">{t("portfolios.active")}</Text>
      <ListGroup>
        {activeList.map((portfolio) => {
          const isActive = portfolio.id === activePortfolioId;
          const isDefault = portfolio.id === defaultPortfolioId;
          const name = displayName(portfolio);
          return (
            <ListGroup.Item key={portfolio.id}>
              <Pressable
                className="flex-1 flex-row items-center active:opacity-70"
                onPress={() => setActivePortfolioId(portfolio.id)}
              >
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>
                    {isActive ? "● " : "○ "}
                    {name}
                  </ListGroup.ItemTitle>
                  <Text className="text-muted text-xs">
                    {portfolio.reportingCurrency}
                    {isDefault ? ` · ${t("portfolios.defaultBadge")}` : ""}
                    {isActive ? ` · ${t("portfolios.activeMarker")}` : ""}
                  </Text>
                </ListGroup.ItemContent>
              </Pressable>
              <Pressable
                accessibilityLabel={t("portfolios.moreActions")}
                hitSlop={8}
                className="px-2 py-1 active:opacity-60"
                onPress={() => setSheetTarget(portfolio)}
              >
                <ThemedIcon icon={DotsThreeVerticalIcon} size={20} colorToken="muted" />
              </Pressable>
            </ListGroup.Item>
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
                const name = displayName(portfolio);
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

      {/* Per-portfolio options sheet */}
      <BottomSheet
        isOpen={!!sheetTarget}
        onOpenChange={(open) => {
          if (!open) setSheetTarget(null);
        }}
      >
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content>
            <View className="px-5 pb-10 gap-2">
              <BottomSheet.Title className="text-foreground text-lg font-semibold mb-2">
                {sheetTarget ? displayName(sheetTarget) : ""}
              </BottomSheet.Title>

              <Pressable
                className="flex-row items-center gap-3 py-3 active:opacity-60"
                onPress={() => sheetTarget && handleSheetRename(sheetTarget)}
              >
                <ThemedIcon icon={PencilSimpleIcon} size={20} colorToken="foreground" />
                <Text className="text-foreground text-base">{t("portfolios.rename")}</Text>
              </Pressable>

              {sheetTarget && sheetTarget.id !== defaultPortfolioId ? (
                <Pressable
                  className="flex-row items-center gap-3 py-3 active:opacity-60"
                  onPress={() => handleSheetDelete(sheetTarget)}
                >
                  <ThemedIcon icon={TrashIcon} size={20} colorToken="warning" />
                  <Text className="text-danger text-base">{t("portfolios.delete")}</Text>
                </Pressable>
              ) : (
                <Text className="text-muted text-xs py-2">
                  {t("portfolios.cannotDeleteDefault")}
                </Text>
              )}
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

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
        isPending={hardDelete.isPending || archive.isPending}
        onConfirm={() => {
          if (!hardDeleteTarget) return;
          runHardDelete(hardDeleteTarget);
        }}
      />
    </Screen>
  );
}
