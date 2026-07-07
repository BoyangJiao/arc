/**
 * useCsvExport — fetch all user transactions, build CSV, write to cache dir,
 * then invoke system share sheet.
 *
 * Spec: .specify/feature-specs/stage-3/csv-export-stage-3.md §commit 3
 *
 * Uses the SDK 55 class-based FileSystem API:
 *   new File(Paths.cache, filename) → file.write(content) → file.uri
 *
 * Web fallback: expo-sharing is not available on web → triggers a Blob download
 * instead (non-blocking; Stage 3 ships primarily on iOS).
 */

import { useState } from "react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { useAllTransactions } from "./queries";
import { usePortfolios } from "./queries";
import { transactionsToCsv } from "./transactions-to-csv";

export type CsvExportStatus = "idle" | "exporting" | "done" | "error";

export interface UseCsvExportResult {
  /** Total number of transactions available to export. */
  readonly txCount: number;
  /** Number of distinct portfolios with transactions. */
  readonly portfolioCount: number;
  /** True while loading initial transaction count. */
  readonly isLoading: boolean;
  /** Current export status (for button / progress state). */
  readonly status: CsvExportStatus;
  /** Error message if status === 'error'. */
  readonly errorMessage: string | null;
  /** Trigger the export; resolves after share sheet is dismissed. */
  readonly exportCsv: () => Promise<void>;
}

/** ISO date portion only (YYYY-MM-DD) for the filename. */
const todayDateStr = (): string => new Date().toISOString().slice(0, 10);

export const useCsvExport = (): UseCsvExportResult => {
  const txQuery = useAllTransactions();
  const portfoliosQuery = usePortfolios({ includeArchived: true });

  const [status, setStatus] = useState<CsvExportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const transactions = txQuery.data ?? [];
  const portfolios = portfoliosQuery.data ?? [];

  const portfolioNameById = Object.fromEntries(portfolios.map((p) => [p.id, p.name]));

  const txCount = transactions.length;
  const portfolioCount = new Set(transactions.map((t) => t.portfolioId)).size;
  const isLoading = txQuery.isLoading || portfoliosQuery.isLoading;

  const exportCsv = async (): Promise<void> => {
    if (transactions.length === 0) return;

    setStatus("exporting");
    setErrorMessage(null);

    try {
      const csv = transactionsToCsv(transactions, { portfolioNameById });
      const filename = `arc-transactions-${todayDateStr()}.csv`;

      if (Platform.OS === "web") {
        // Web fallback: trigger browser download via Blob
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setStatus("done");
        return;
      }

      // SDK 55 class-based FileSystem API
      const file = new File(Paths.cache, filename);
      file.write(csv);

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error("Sharing is not available on this device.");
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: "text/csv",
        dialogTitle: filename,
      });

      setStatus("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatus("error");
    }
  };

  return {
    txCount,
    portfolioCount,
    isLoading,
    status,
    errorMessage,
    exportCsv,
  };
};
