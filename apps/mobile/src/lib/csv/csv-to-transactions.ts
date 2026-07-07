/**
 * L3 — CSV → canonical ParsedTx validator.
 *
 * Operates on canonical field names (after L2 profile mapping).
 * Format-agnostic: does not import or reference any ImportProfile.
 *
 * Spec: .specify/feature-specs/stage-3/csv-import-stage-3.md §决策 2
 *
 * Validation rules per row:
 *  - type ∈ TransactionType
 *  - shares: valid finite Decimal, > 0
 *  - price_per_share: valid finite Decimal, >= 0
 *  - fee: valid finite Decimal, >= 0
 *  - asset_id: parseAssetId succeeds (market:symbol)
 *  - currency ∈ Currency
 *  - trade_date: parseable ISO 8601 / YYYY-MM-DD
 */

import Decimal from "decimal.js";
import { parseAssetId, type Currency, type Market, type TransactionType } from "@arc/core";

import { parseRawCsv } from "./csv-raw-parse";

// ─── Types ────────────────────────────────────────────────────────────────

/** Canonical field names consumed by L3 (after L2 mapping). */
export type CanonicalField =
  | "asset_id"
  | "type"
  | "shares"
  | "price_per_share"
  | "currency"
  | "fee"
  | "trade_date"
  | "notes";

/** Required canonical fields — all must be present in the resolved header. */
export const REQUIRED_CANONICAL_FIELDS: readonly CanonicalField[] = [
  "asset_id",
  "type",
  "shares",
  "price_per_share",
  "currency",
  "fee",
  "trade_date",
];

/** A successfully parsed transaction row (before portfolio assignment). */
export interface ParsedTx {
  readonly assetId: string;
  readonly market: Market;
  readonly symbol: string;
  readonly type: TransactionType;
  readonly shares: Decimal;
  readonly pricePerShare: Decimal;
  readonly currency: Currency;
  readonly fee: Decimal;
  readonly tradeDate: string;
  readonly notes: string | undefined;
}

/** A single row parse result. */
export type ParsedRow =
  | { readonly ok: true; readonly value: ParsedTx; readonly line: number }
  | { readonly ok: false; readonly line: number; readonly raw: string; readonly errors: string[] };

/** Full parse result for a CSV text input. */
export interface CsvParseResult {
  /**
   * Row-level results. Only populated when fileError is undefined.
   * Includes both ok and failed rows.
   */
  readonly rows: readonly ParsedRow[];
  /**
   * File-level error: missing required columns or no matching profile.
   * When set, rows is empty and nothing should be imported.
   */
  readonly fileError?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const VALID_MARKETS = new Set<string>(["CN", "HK", "US", "CRYPTO", "FUND", "CASH"]);
const VALID_CURRENCIES = new Set<string>(["CNY", "HKD", "USD", "JPY", "BTC", "ETH"]);
const VALID_TX_TYPES = new Set<string>(["BUY", "SELL", "DIVIDEND", "SPLIT", "ADJUSTMENT"]);

const isFiniteDecimal = (d: Decimal): boolean => d.isFinite();

const parseDecimalSafe = (raw: string): Decimal | null => {
  try {
    const d = new Decimal(raw.trim());
    return isFiniteDecimal(d) ? d : null;
  } catch {
    return null;
  }
};

/** Accept ISO 8601 date: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ variants. */
const isValidIsoDate = (raw: string): boolean => {
  const trimmed = raw.trim();
  // Require at least YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return false;
  const d = new Date(trimmed);
  return !isNaN(d.getTime());
};

// ─── Per-row validator ────────────────────────────────────────────────────

const validateRow = (record: Readonly<Record<string, string>>, line: number): ParsedRow => {
  const raw = JSON.stringify(record);
  const errors: string[] = [];

  // type
  const typeRaw = record["type"]?.trim() ?? "";
  if (!VALID_TX_TYPES.has(typeRaw)) {
    errors.push(`type 无效 "${typeRaw}"（合法值: BUY/SELL/DIVIDEND/SPLIT/ADJUSTMENT）`);
  }

  // shares
  const sharesRaw = record["shares"]?.trim() ?? "";
  const shares = parseDecimalSafe(sharesRaw);
  if (shares === null) {
    errors.push(`shares 不是合法数字 "${sharesRaw}"`);
  } else if (!shares.gt(0)) {
    errors.push(`shares 必须 > 0（当前 "${sharesRaw}"）`);
  }

  // price_per_share
  const priceRaw = record["price_per_share"]?.trim() ?? "";
  const price = parseDecimalSafe(priceRaw);
  if (price === null) {
    errors.push(`price_per_share 不是合法数字 "${priceRaw}"`);
  } else if (price.lt(0)) {
    errors.push(`price_per_share 必须 >= 0（当前 "${priceRaw}"）`);
  }

  // fee
  const feeRaw = record["fee"]?.trim() ?? "";
  const fee = parseDecimalSafe(feeRaw);
  if (fee === null) {
    errors.push(`fee 不是合法数字 "${feeRaw}"`);
  } else if (fee.lt(0)) {
    errors.push(`fee 必须 >= 0（当前 "${feeRaw}"）`);
  }

  // asset_id
  const assetIdRaw = record["asset_id"]?.trim() ?? "";
  let parsedAsset: { market: Market; symbol: string } | null = null;
  try {
    parsedAsset = parseAssetId(assetIdRaw);
    if (!VALID_MARKETS.has(parsedAsset.market)) {
      errors.push(`asset_id 中的 market 未知 "${parsedAsset.market}"`);
      parsedAsset = null;
    }
  } catch {
    errors.push(`asset_id 格式无效 "${assetIdRaw}"（应为 market:symbol）`);
  }

  // currency
  const currencyRaw = record["currency"]?.trim() ?? "";
  if (!VALID_CURRENCIES.has(currencyRaw)) {
    errors.push(`currency 无效 "${currencyRaw}"（合法值: CNY/HKD/USD/JPY/BTC/ETH）`);
  }

  // trade_date
  const tradeDateRaw = record["trade_date"]?.trim() ?? "";
  if (!isValidIsoDate(tradeDateRaw)) {
    errors.push(`trade_date 无效日期 "${tradeDateRaw}"（应为 ISO 8601 如 2024-01-05）`);
  }

  if (errors.length > 0) {
    return { ok: false, line, raw, errors };
  }

  const notesRaw = record["notes"]?.trim();
  return {
    ok: true,
    line,
    value: {
      assetId: assetIdRaw,
      market: parsedAsset!.market,
      symbol: parsedAsset!.symbol,
      type: typeRaw as TransactionType,
      shares: shares!,
      pricePerShare: price!,
      currency: currencyRaw as Currency,
      fee: fee!,
      tradeDate: tradeDateRaw,
      notes: notesRaw && notesRaw.length > 0 ? notesRaw : undefined,
    },
  };
};

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Parse and validate a CSV text string into transaction rows.
 *
 * @param text   Raw CSV text (from file read)
 * @param columnMap  Maps canonical field name → header column name (from ImportProfile).
 *                   Must cover all REQUIRED_CANONICAL_FIELDS.
 *                   Optional: notes column (omitted → notes column absent is OK).
 *
 * Returns fileError when the file is structurally broken (empty / missing columns).
 * Returns per-row ParsedRow array otherwise (each row is independently ok/fail).
 */
export const csvToTransactions = (
  text: string,
  columnMap: Readonly<Record<CanonicalField, string | readonly string[]>>
): CsvParseResult => {
  if (text.trim() === "") {
    return { rows: [], fileError: "文件为空" };
  }

  const { header, rows } = parseRawCsv(text);

  if (header.length === 0) {
    return { rows: [], fileError: "文件为空或无法解析表头" };
  }

  // Resolve canonical → actual column name (first match in header)
  const resolveColumn = (canonical: CanonicalField): string | undefined => {
    const candidates = columnMap[canonical];
    if (!candidates) return undefined;
    const arr = typeof candidates === "string" ? [candidates] : (candidates as readonly string[]);
    return arr.find((c) => header.includes(c));
  };

  // Check required columns
  const missingFields: string[] = [];
  for (const field of REQUIRED_CANONICAL_FIELDS) {
    if (!resolveColumn(field)) {
      const candidates = columnMap[field];
      const names =
        typeof candidates === "string" ? candidates : (candidates as readonly string[]).join(" / ");
      missingFields.push(`${field} (列: ${names})`);
    }
  }
  if (missingFields.length > 0) {
    return {
      rows: [],
      fileError: `缺少必需列: ${missingFields.join(", ")}`,
    };
  }

  // Build canonical → actual column mapping
  const colFor = {} as Record<CanonicalField, string>;
  for (const field of [...REQUIRED_CANONICAL_FIELDS, "notes" as CanonicalField]) {
    const resolved = resolveColumn(field);
    if (resolved) colFor[field] = resolved;
  }

  if (rows.length === 0) {
    return { rows: [] };
  }

  // Validate each row
  const parsedRows: ParsedRow[] = rows.map((row, idx) => {
    // Remap to canonical field names
    const canonical: Record<string, string> = {};
    for (const [cf, actualCol] of Object.entries(colFor)) {
      canonical[cf] = row[actualCol] ?? "";
    }
    return validateRow(canonical, idx + 2); // line 1 = header
  });

  return { rows: parsedRows };
};
