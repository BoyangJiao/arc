/**
 * me/export.tsx — CSV export confirmation screen.
 *
 * Stage 3 Block F, spec §决策 4:
 *   - Shows transaction/portfolio count before export (replaces Me-row direct trigger)
 *   - Exports all portfolios (backup semantics, §决策 1a)
 *   - Numbers are Decimal full-precision, original currency, RFC 4180 notes (§决策 2)
 */

import { Alert, View } from "react-native";
import { Button, InScreenHeader, Screen, Text, scrollContentBelowInScreenHeader } from "@arc/ui";
import { useTranslation } from "@arc/i18n";

import { useCsvExport } from "../../src/lib/use-csv-export";

export default function ExportScreen() {
  const { t } = useTranslation();
  const { txCount, portfolioCount, isLoading, status, errorMessage, exportCsv } = useCsvExport();

  const isEmpty = !isLoading && txCount === 0;
  const isExporting = status === "exporting";

  const handleExport = async () => {
    await exportCsv();
    if (errorMessage) {
      Alert.alert(t("export.errorPrefix"), errorMessage);
    }
  };

  return (
    <Screen contentContainerStyle={scrollContentBelowInScreenHeader}>
      <InScreenHeader title={t("export.title")} leftType="back" />

      <View className="gap-6 px-1 py-6">
        <Text className="text-muted text-sm">{t("export.description")}</Text>

        {!isLoading && !isEmpty && (
          <Text className="text-foreground text-base font-medium">
            {t("export.summary", { count: txCount, portfolios: portfolioCount })}
          </Text>
        )}

        {isEmpty && (
          <View className="gap-2">
            <Text className="text-foreground text-base font-medium">{t("export.emptyTitle")}</Text>
            <Text className="text-muted text-sm">{t("export.emptyDescription")}</Text>
          </View>
        )}

        <Button onPress={handleExport} isDisabled={isEmpty || isExporting || isLoading}>
          <Button.Label>
            {isExporting ? t("export.exporting") : t("export.exportButton")}
          </Button.Label>
        </Button>
      </View>
    </Screen>
  );
}
