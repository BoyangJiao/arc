/**
 * useCsvImport — pick a CSV file, parse it, write valid rows to a target portfolio.
 *
 * Three-phase flow matching /me/import screen:
 *   idle → picking → parsed (preview) → importing → done | error
 *
 * Spec: .specify/feature-specs/stage-3/csv-import-stage-3.md
 * - Decision 1a: ignores CSV portfolio_id; imports to UI-selected target portfolio
 * - Decision 4a: skips US online symbol validation (batch import avoids rate-limiting)
 * - Decision 4: reuses ensureAssetRow + transactions.insert (ADR 007 — no bypass)
 * - Decision 5: uses symbol as asset name fallback
 * - Decision 6: no deduplication; pure append; UI must warn beforehand
 */

import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "./supabase";
import { ensureAssetRow } from "./queries/use-transactions";
import { csvToTransactions, type CsvParseResult, type ParsedRow } from "./csv/csv-to-transactions";
import { detectProfile, arcNativeProfile } from "./csv/profiles";
import { parseRawCsv } from "./csv/csv-raw-parse";

// ─── Types ────────────────────────────────────────────────────────────────

export type ImportPhase = "idle" | "picking" | "parsed" | "importing" | "done" | "error";

export interface ImportResult {
  /** How many rows were successfully written to the DB. */
  readonly successCount: number;
  /** How many rows failed during DB write (network / RLS errors). */
  readonly failCount: number;
  /** Per-row write failures (row index → error message). */
  readonly writeErrors: ReadonlyArray<{ line: number; message: string }>;
}

export interface UseCsvImportResult {
  readonly phase: ImportPhase;
  /** Parsed CSV result (available when phase === 'parsed' or 'importing'). */
  readonly parseResult: CsvParseResult | null;
  /** Count of ok rows in parseResult. */
  readonly validCount: number;
  /** Invalid rows (ok === false). */
  readonly invalidRows: readonly ParsedRow[];
  /** Error message (file-level or operational). */
  readonly errorMessage: string | null;
  /** Import result (available when phase === 'done'). */
  readonly importResult: ImportResult | null;
  /** Trigger file picker → auto-parses on success. */
  readonly pickAndParse: () => Promise<void>;
  /** Write valid rows to targetPortfolioId. Call only when phase === 'parsed'. */
  readonly importValid: (targetPortfolioId: string) => Promise<void>;
  /** Reset to idle. */
  readonly reset: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Read file text from a URI (native) or a File object (web). */
const readFileText = async (uri: string, webFile: File | undefined): Promise<string> => {
  if (Platform.OS === "web" && webFile) {
    return webFile.text();
  }
  return new ExpoFile(uri).text();
};

// ─── Hook ────────────────────────────────────────────────────────────────

export const useCsvImport = (): UseCsvImportResult => {
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setPhase("idle");
    setParseResult(null);
    setErrorMessage(null);
    setImportResult(null);
  };

  const pickAndParse = async (): Promise<void> => {
    setPhase("picking");
    setErrorMessage(null);
    setParseResult(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/csv", "*/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        setPhase("idle");
        return;
      }

      const asset = result.assets[0];
      if (!asset) {
        setPhase("idle");
        return;
      }

      const text = await readFileText(asset.uri, asset.file);

      // L1 parse to get header for profile detection
      const { header } = parseRawCsv(text);
      const profile = detectProfile(header) ?? arcNativeProfile;

      const parsed = csvToTransactions(text, profile.columnMap);

      // Apply optional normalizers from the profile
      let finalParsed = parsed;
      if (profile.normalize && !parsed.fileError && parsed.rows.length > 0) {
        // Normalizers apply before L3 — this is a post-parse re-run with normalization.
        // For arc-native (no normalizers), this branch is a no-op.
        // For future profiles with normalizers, we'd re-run csvToTransactions with
        // pre-processed records. Since arc-native has no normalizers and it's the only
        // profile this sprint, we keep this as a documented seam without implementation.
        // TODO: thread normalizers into L1→L3 pipeline when adding Alipay profile.
        finalParsed = parsed;
      }

      setParseResult(finalParsed);
      setPhase("parsed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setPhase("error");
    }
  };

  const importValid = async (targetPortfolioId: string): Promise<void> => {
    if (!parseResult || phase !== "parsed") return;

    setPhase("importing");

    const validRows = parseResult.rows.filter((r): r is Extract<ParsedRow, { ok: true }> => r.ok);

    let successCount = 0;
    let failCount = 0;
    const writeErrors: Array<{ line: number; message: string }> = [];

    for (const row of validRows) {
      try {
        const { assetId, market, symbol, currency } = row.value;

        // Decision 4a: skip US online validation; use symbol as name fallback (decision 5)
        await ensureAssetRow({
          id: assetId,
          market,
          symbol,
          name: symbol,
          currency,
        });

        const { error } = await supabase.from("transactions").insert({
          portfolio_id: targetPortfolioId,
          asset_id: assetId,
          type: row.value.type,
          shares: row.value.shares.toString(),
          price_per_share: row.value.pricePerShare.toString(),
          currency: row.value.currency,
          fee: row.value.fee.toString(),
          trade_date: row.value.tradeDate,
          notes: row.value.notes ?? null,
        });

        if (error) throw error;
        successCount++;
      } catch (err) {
        failCount++;
        writeErrors.push({
          line: row.line,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Invalidate queries so portfolio/holdings/chart refresh (law 2 — holdings = Σ(transactions))
    queryClient.invalidateQueries({ queryKey: ["transactions", targetPortfolioId] });
    queryClient.invalidateQueries({ queryKey: ["portfolios"] });

    setImportResult({ successCount, failCount, writeErrors });
    setPhase("done");
  };

  const validRows = parseResult?.rows.filter((r) => r.ok) ?? [];
  const invalidRows = parseResult?.rows.filter((r) => !r.ok) ?? [];

  return {
    phase,
    parseResult,
    validCount: validRows.length,
    invalidRows,
    errorMessage,
    importResult,
    pickAndParse,
    importValid,
    reset,
  };
};
