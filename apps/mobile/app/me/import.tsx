/**
 * me/import.tsx — CSV import 3-step screen.
 *
 * Steps:
 *  1. idle/picking — prompt to select CSV file
 *  2. parsed — preview: valid count + invalid row list + target portfolio selector + duplicate warning
 *  3. done/error — import result summary
 *
 * Spec: .specify/feature-specs/stage-3/csv-import-stage-3.md §决策 3 + §决策 6
 */

import { ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  Button,
  InScreenHeader,
  ListGroup,
  Screen,
  Text,
  scrollContentBelowInScreenHeader,
} from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useCsvImport } from "../../src/lib/use-csv-import";
import { usePortfolios } from "../../src/lib/queries";
import { useActivePortfolio } from "../../src/lib/queries";
import { useState } from "react";

export default function ImportScreen() {
  const { t } = useTranslation();
  const router = useRouter();

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

  // Default to active portfolio
  const [targetPortfolioId, setTargetPortfolioId] = useState<string | undefined>(
    activePortfolioId ?? undefined
  );

  const portfolios = portfoliosQuery.data ?? [];
  const selectedPortfolio = portfolios.find((p) => p.id === targetPortfolioId) ?? portfolios[0];
  const effectivePortfolioId = selectedPortfolio?.id;

  const isPicking = phase === "picking";
  const isParsed = phase === "parsed";
  const isImporting = phase === "importing";
  const isDone = phase === "done";
  const isError = phase === "error";

  const hasFile = isParsed || isImporting || isDone;
  const fileError = parseResult?.fileError;

  const handleImport = async () => {
    if (!effectivePortfolioId) return;
    await importValid(effectivePortfolioId);
  };

  const handleReset = () => {
    reset();
    setTargetPortfolioId(activePortfolioId ?? undefined);
  };

  return (
    <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
      <InScreenHeader title={t("import.title")} leftType="back" />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-1 py-6">
        {/* Description */}
        <Text className="text-muted text-sm">{t("import.description")}</Text>

        {/* ── Step 1: File selection ── */}
        {!hasFile && !isDone && (
          <Button onPress={pickAndParse} isDisabled={isPicking}>
            <Button.Label>{isPicking ? t("common.loading") : t("import.selectFile")}</Button.Label>
          </Button>
        )}

        {/* ── File-level error ── */}
        {fileError && (
          <View className="rounded-xl bg-danger-soft p-4">
            <Text className="text-danger text-sm">
              {t("import.fileError", { message: fileError })}
            </Text>
          </View>
        )}

        {/* ── Step 2: Preview / validation report ── */}
        {isParsed && !fileError && (
          <>
            {/* Summary counts */}
            <View className="gap-2">
              {validCount > 0 && (
                <Text className="text-foreground text-base font-medium">
                  {t("import.validRows", { count: validCount })}
                </Text>
              )}
              {invalidRows.length > 0 && (
                <Text className="text-warning text-sm">
                  {t("import.invalidRows", { count: invalidRows.length })}
                </Text>
              )}
              {validCount === 0 && invalidRows.length === 0 && !fileError && (
                <Text className="text-muted text-sm">{t("export.emptyTitle")}</Text>
              )}
            </View>

            {/* Invalid row list (first 5) */}
            {invalidRows.length > 0 && (
              <ListGroup>
                {invalidRows.slice(0, 5).map((row) => (
                  <ListGroup.Item key={row.ok ? row.line : row.line}>
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

            {/* Duplicate warning */}
            <View className="rounded-xl bg-warning-soft p-4">
              <Text className="text-warning-foreground text-xs">
                {t("import.duplicateWarning")}
              </Text>
            </View>

            {/* Target portfolio selector */}
            {portfolios.length === 0 ? (
              <Text className="text-muted text-sm">{t("import.noPortfolios")}</Text>
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

            {/* Action buttons */}
            <View className="gap-3">
              <Button
                onPress={handleImport}
                isDisabled={validCount === 0 || !effectivePortfolioId || isImporting}
              >
                <Button.Label>
                  {isImporting
                    ? t("import.importing")
                    : t("import.importButton", { count: validCount })}
                </Button.Label>
              </Button>
              <Button variant="ghost" onPress={pickAndParse} isDisabled={isImporting}>
                <Button.Label>{t("import.changeFile")}</Button.Label>
              </Button>
            </View>
          </>
        )}

        {/* ── Step 3: Done ── */}
        {isDone && importResult && (
          <View className="gap-4">
            <Text className="text-foreground text-lg font-semibold">{t("import.doneTitle")}</Text>
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
            <Button variant="ghost" onPress={handleReset}>
              <Button.Label>{t("import.importAnother")}</Button.Label>
            </Button>
          </View>
        )}

        {/* ── Error state ── */}
        {isError && (
          <View className="gap-4">
            <Text className="text-foreground text-lg font-semibold">{t("import.errorTitle")}</Text>
            {errorMessage && <Text className="text-danger text-sm">{errorMessage}</Text>}
            <Button onPress={handleReset}>
              <Button.Label>{t("import.tryAgain")}</Button.Label>
            </Button>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
