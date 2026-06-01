/**
 * me/import.tsx — CSV import 3-step screen.
 *
 * Steps:
 *  1. idle/picking/error — main screen: select file button
 *  2. parsed/importing   — BottomSheet: preview + warning alert + portfolio selector
 *  3. done               — BottomSheet: success summary + 完成 button (closes sheet)
 *
 * Sheet open/close is driven entirely by `phase`:
 *   open  → parsed | importing | done
 *   close → idle | error          (useEffect; "picking" leaves state unchanged so
 *                                  the picker can appear above a still-open sheet
 *                                  and close naturally when cancelled → idle → close)
 *
 * Spec: .specify/feature-specs/stage-3/csv-import-stage-3.md §决策 3 + §决策 6
 */

import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import {
  BottomSheet,
  Button,
  InScreenHeader,
  ListGroup,
  Screen,
  Text,
  ThemedIcon,
  WarningIcon,
  scrollContentBelowInScreenHeader,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useCsvImport } from "../../src/lib/use-csv-import";
import {
  usePortfolios,
  useActivePortfolio,
  useEnsureDefaultPortfolio,
} from "../../src/lib/queries";
import { useUserPreferences } from "../../src/lib/user-preferences";

export default function ImportScreen() {
  const { t } = useTranslation();

  const {
    phase,
    parseResult,
    validCount,
    invalidRows,
    importResult,
    errorMessage,
    pickAndParse,
    importValid,
    reset,
  } = useCsvImport();

  const portfoliosQuery = usePortfolios();
  const { activePortfolioId } = useActivePortfolio();
  const ensureDefaultPortfolio = useEnsureDefaultPortfolio();
  const { prefs } = useUserPreferences();

  const [targetPortfolioId, setTargetPortfolioId] = useState<string | undefined>(
    activePortfolioId ?? undefined
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const portfolios = portfoliosQuery.data ?? [];
  const portfoliosLoading = portfoliosQuery.isPending;
  const selectedPortfolio = portfolios.find((p) => p.id === targetPortfolioId) ?? portfolios[0];
  const effectivePortfolioId = selectedPortfolio?.id;

  const isPicking = phase === "picking";
  const isParsed = phase === "parsed";
  const isImporting = phase === "importing";
  const isDone = phase === "done";
  const isError = phase === "error";

  const fileError = parseResult?.fileError;

  // Drive sheet open/close from phase.
  // "picking" is intentionally excluded: the system file picker appears above
  // the sheet, so we leave the sheet in its current state while picking.
  // When the picker is cancelled, phase → "idle" → sheet closes cleanly.
  useEffect(() => {
    if (isParsed || isImporting || isDone) {
      setSheetOpen(true);
    } else if (phase === "idle" || phase === "error") {
      setSheetOpen(false);
    }
  }, [phase, isParsed, isImporting, isDone]);

  const handleImport = async () => {
    // CSV import is a valid transaction-entry path — if the user has no portfolio
    // yet, auto-create a default one and import into it (no pre-creation required).
    let portfolioId = effectivePortfolioId;
    if (!portfolioId) {
      try {
        portfolioId = await ensureDefaultPortfolio.mutateAsync({
          reportingCurrency: prefs?.reportingCurrency ?? "CNY",
        });
      } catch (err) {
        Alert.alert(t("common.error"), err instanceof Error ? err.message : String(err));
        return;
      }
    }
    await importValid(portfolioId);
  };

  // User explicitly finishes — reset and close.
  const handleDone = () => {
    reset();
    setTargetPortfolioId(activePortfolioId ?? undefined);
    // setSheetOpen(false) will be called by the useEffect when phase → "idle"
  };

  // "更换文件": close the sheet first (via reset → idle → useEffect), then open
  // the system picker after the sheet close animation completes (~350ms).
  // This avoids BottomSheet's FullWindowOverlay conflicting with DocumentPicker.
  const handleChangeFile = () => {
    reset();
    setTargetPortfolioId(activePortfolioId ?? undefined);
    setTimeout(() => void pickAndParse(), 380);
  };

  // User closes sheet by swiping down or tapping overlay.
  const handleSheetClose = (open: boolean) => {
    if (open) return;
    setSheetOpen(false);
    // Only reset if there's active state to clear; idle/error already reset.
    if (phase !== "idle" && phase !== "error") {
      reset();
      setTargetPortfolioId(activePortfolioId ?? undefined);
    }
  };

  return (
    <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
      <InScreenHeader title={t("import.title")} leftType="back" />

      <View className="flex-1 gap-6 px-5 py-6">
        {/* Description */}
        <Text className="text-muted text-sm">{t("import.description")}</Text>

        {/* ── Step 1: File selection ── */}
        <Button onPress={pickAndParse} isDisabled={isPicking || isImporting}>
          <Button.Label>{isPicking ? t("common.loading") : t("import.selectFile")}</Button.Label>
        </Button>

        {/* ── Error state (file read failure) ── */}
        {isError && (
          <View className="gap-4">
            <Text className="text-foreground text-lg font-semibold">{t("import.errorTitle")}</Text>
            {errorMessage && <Text className="text-danger text-sm">{errorMessage}</Text>}
          </View>
        )}

        {/* ── File-level parse error (bad format) ── */}
        {fileError && (
          <View className="flex-row items-start gap-3 rounded-2xl bg-danger-soft px-4 py-3">
            <ThemedIcon icon={WarningIcon} size={16} colorToken="foreground" weight="fill" />
            <Text className="text-danger flex-1 text-xs">
              {t("import.fileError", { message: fileError })}
            </Text>
          </View>
        )}
      </View>

      {/* ── Steps 2 + 3: Preview / Done sheet ── */}
      <BottomSheet isOpen={sheetOpen} onOpenChange={handleSheetClose}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content>
            <ScrollView
              bounces={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 20 }}
            >
              {/* ── Step 2: Preview ── */}
              {(isParsed || isImporting) && !fileError && (
                <>
                  {/* Row count summary */}
                  <View className="gap-1 pt-2">
                    {validCount > 0 && (
                      <BottomSheet.Title className="text-foreground text-xl font-semibold">
                        {t("import.validRows", { count: validCount })}
                      </BottomSheet.Title>
                    )}
                    {invalidRows.length > 0 && (
                      <Text className="text-warning text-sm">
                        {t("import.invalidRows", { count: invalidRows.length })}
                      </Text>
                    )}
                    {validCount === 0 && invalidRows.length === 0 && (
                      <BottomSheet.Title className="text-muted text-base">
                        {t("export.emptyTitle")}
                      </BottomSheet.Title>
                    )}
                  </View>

                  {/* Invalid row list (first 5) */}
                  {invalidRows.length > 0 && (
                    <ListGroup>
                      {invalidRows.slice(0, 5).map((row) => (
                        <ListGroup.Item key={row.line}>
                          <ListGroup.ItemContent>
                            <ListGroup.ItemTitle className="text-danger text-xs">
                              {t("import.rowError", {
                                line: row.line,
                                errors: row.ok ? "" : row.errors.join("; "),
                              })}
                            </ListGroup.ItemTitle>
                          </ListGroup.ItemContent>
                        </ListGroup.Item>
                      ))}
                      {invalidRows.length > 5 && (
                        <ListGroup.Item>
                          <ListGroup.ItemContent>
                            <ListGroup.ItemTitle className="text-muted text-xs">
                              {`… ${invalidRows.length - 5} more`}
                            </ListGroup.ItemTitle>
                          </ListGroup.ItemContent>
                        </ListGroup.Item>
                      )}
                    </ListGroup>
                  )}

                  {/* Duplicate warning Alert */}
                  <View className="flex-row items-start gap-3 rounded-2xl bg-warning-soft px-4 py-3">
                    <ThemedIcon icon={WarningIcon} size={16} colorToken="warning" weight="fill" />
                    <Text className="text-warning flex-1 text-xs">
                      {t("import.duplicateWarning")}
                    </Text>
                  </View>

                  {/* Target portfolio selector — or a hint when none exists yet */}
                  {portfoliosLoading ? (
                    <Text className="text-muted text-sm">{t("common.loading")}</Text>
                  ) : portfolios.length === 0 ? (
                    <Text className="text-muted text-sm">
                      {t("import.willCreatePortfolio", {
                        name: t("portfolio.myPortfolio"),
                      })}
                    </Text>
                  ) : (
                    <View className="gap-2">
                      <Text className="text-muted text-xs font-medium uppercase">
                        {t("import.targetPortfolio")}
                      </Text>
                      <ListGroup>
                        {portfolios.map((p) => (
                          <Button
                            key={p.id}
                            variant={p.id === effectivePortfolioId ? "secondary" : "ghost"}
                            onPress={() => setTargetPortfolioId(p.id)}
                          >
                            <Button.Label>{p.name}</Button.Label>
                          </Button>
                        ))}
                      </ListGroup>
                    </View>
                  )}

                  {/* Action buttons — import auto-creates a portfolio when none exists */}
                  <View className="gap-3 pt-2">
                    <Button
                      onPress={handleImport}
                      isDisabled={
                        validCount === 0 ||
                        portfoliosLoading ||
                        isImporting ||
                        ensureDefaultPortfolio.isPending
                      }
                    >
                      <Button.Label>
                        {isImporting || ensureDefaultPortfolio.isPending
                          ? t("import.importing")
                          : t("import.importButton", { count: validCount })}
                      </Button.Label>
                    </Button>
                    <Button variant="ghost" onPress={handleChangeFile} isDisabled={isImporting}>
                      <Button.Label>{t("import.changeFile")}</Button.Label>
                    </Button>
                  </View>
                </>
              )}

              {/* ── Step 3: Done (in sheet) ── */}
              {isDone && importResult && (
                <View className="gap-5 pt-2">
                  <BottomSheet.Title className="text-foreground text-xl font-semibold">
                    {t("import.doneTitle")}
                  </BottomSheet.Title>
                  <Text className="text-foreground text-base">
                    {t("import.doneResult", {
                      success: importResult.successCount,
                      count: importResult.successCount,
                    })}
                  </Text>
                  {importResult.failCount > 0 && (
                    <Text className="text-warning text-sm">
                      {t("import.doneSkipped", { count: importResult.failCount })}
                    </Text>
                  )}
                  {importResult.writeErrors.length > 0 && (
                    <ListGroup>
                      {importResult.writeErrors.slice(0, 5).map((e) => (
                        <ListGroup.Item key={e.line}>
                          <ListGroup.ItemContent>
                            <ListGroup.ItemTitle className="text-danger text-xs">
                              {t("import.rowError", { line: e.line, errors: e.message })}
                            </ListGroup.ItemTitle>
                          </ListGroup.ItemContent>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                  <View className="gap-3 pt-2">
                    <Button onPress={handleDone}>
                      <Button.Label>{t("common.done")}</Button.Label>
                    </Button>
                    <Button variant="ghost" onPress={handleDone}>
                      <Button.Label>{t("import.importAnother")}</Button.Label>
                    </Button>
                  </View>
                </View>
              )}
            </ScrollView>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </Screen>
  );
}
