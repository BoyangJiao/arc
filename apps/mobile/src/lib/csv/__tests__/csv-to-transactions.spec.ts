/**
 * Tests for L3 csvToTransactions validator.
 * Uses a minimal "arc-native-like" columnMap (canonical = actual column names)
 * to test validation logic directly, without a profile dependency.
 *
 * Profile-specific tests live in profiles.spec.ts.
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { csvToTransactions, type CanonicalField } from "../csv-to-transactions";
import { CSV_HEADER } from "../../transactions-to-csv";

// Identity columnMap: canonical field name == actual CSV column name
// (matches Arc export format)
const IDENTITY_MAP: Readonly<Record<CanonicalField, string>> = {
  asset_id: "asset_id",
  type: "type",
  shares: "shares",
  price_per_share: "price_per_share",
  currency: "currency",
  fee: "fee",
  trade_date: "trade_date",
  notes: "notes",
};

/** Build a minimal valid CSV row string (header + one row). */
const makeRow = (overrides: Partial<Record<string, string>> = {}): string => {
  const defaults: Record<string, string> = {
    portfolio_id: "pid-1",
    portfolio_name: "Default",
    asset_id: "CN:600519",
    type: "BUY",
    shares: "10",
    price_per_share: "1800.00",
    currency: "CNY",
    fee: "0.5",
    trade_date: "2024-01-05",
    notes: "",
  };
  const row = { ...defaults, ...overrides };
  const values = CSV_HEADER.split(",").map((col) => {
    const v = row[col] ?? "";
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  });
  return `${CSV_HEADER}\r\n${values.join(",")}`;
};

describe("csvToTransactions — fileError cases", () => {
  it("returns fileError for empty input", () => {
    const result = csvToTransactions("", IDENTITY_MAP);
    expect(result.fileError).toBeDefined();
    expect(result.rows).toHaveLength(0);
  });

  it("returns fileError for whitespace-only input", () => {
    const result = csvToTransactions("   \n  ", IDENTITY_MAP);
    expect(result.fileError).toBeDefined();
  });

  it("returns fileError when required column asset_id is missing", () => {
    const badHeader = "portfolio_id,type,shares,price_per_share,currency,fee,trade_date,notes";
    const result = csvToTransactions(
      `${badHeader}\npid,BUY,10,100,CNY,0,2024-01-01,`,
      IDENTITY_MAP
    );
    expect(result.fileError).toMatch(/asset_id/);
  });

  it("returns fileError when multiple required columns are missing", () => {
    const result = csvToTransactions("portfolio_id,notes\npid,", IDENTITY_MAP);
    expect(result.fileError).toMatch(/asset_id/);
    expect(result.fileError).toMatch(/type/);
  });

  it("returns empty rows (no fileError) for header-only CSV", () => {
    const result = csvToTransactions(CSV_HEADER, IDENTITY_MAP);
    expect(result.fileError).toBeUndefined();
    expect(result.rows).toHaveLength(0);
  });
});

describe("csvToTransactions — valid row", () => {
  it("parses a minimal valid BUY row", () => {
    const result = csvToTransactions(makeRow(), IDENTITY_MAP);
    expect(result.fileError).toBeUndefined();
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.ok).toBe(true);
    if (!row.ok) return;

    expect(row.value.assetId).toBe("CN:600519");
    expect(row.value.market).toBe("CN");
    expect(row.value.symbol).toBe("600519");
    expect(row.value.type).toBe("BUY");
    expect(row.value.shares.equals(new Decimal("10"))).toBe(true);
    expect(row.value.pricePerShare.equals(new Decimal("1800.00"))).toBe(true);
    expect(row.value.currency).toBe("CNY");
    expect(row.value.fee.equals(new Decimal("0.5"))).toBe(true);
    expect(row.value.tradeDate).toBe("2024-01-05");
    expect(row.value.notes).toBeUndefined();
  });

  it("parses all TransactionType values", () => {
    for (const type of ["BUY", "SELL", "DIVIDEND", "SPLIT", "ADJUSTMENT"]) {
      const result = csvToTransactions(makeRow({ type }), IDENTITY_MAP);
      const row = result.rows[0];
      expect(row.ok).toBe(true);
      if (row.ok) expect(row.value.type).toBe(type);
    }
  });

  it("parses all Currency values", () => {
    for (const currency of ["CNY", "HKD", "USD", "JPY", "BTC", "ETH"]) {
      const result = csvToTransactions(makeRow({ currency }), IDENTITY_MAP);
      const row = result.rows[0];
      expect(row.ok).toBe(true);
      if (row.ok) expect(row.value.currency).toBe(currency);
    }
  });

  it("preserves notes field when non-empty", () => {
    const result = csvToTransactions(makeRow({ notes: "from alipay" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(true);
    if (row.ok) expect(row.value.notes).toBe("from alipay");
  });

  it("sets notes to undefined when empty string", () => {
    const result = csvToTransactions(makeRow({ notes: "" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(true);
    if (row.ok) expect(row.value.notes).toBeUndefined();
  });

  it("accepts price_per_share = 0 (e.g. DIVIDEND type)", () => {
    const result = csvToTransactions(
      makeRow({ type: "DIVIDEND", price_per_share: "0" }),
      IDENTITY_MAP
    );
    const row = result.rows[0];
    expect(row.ok).toBe(true);
  });

  it("accepts fee = 0", () => {
    const result = csvToTransactions(makeRow({ fee: "0" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(true);
    if (row.ok) expect(row.value.fee.isZero()).toBe(true);
  });

  it("parses US stock asset_id correctly", () => {
    const result = csvToTransactions(
      makeRow({ asset_id: "US:AAPL", currency: "USD" }),
      IDENTITY_MAP
    );
    const row = result.rows[0];
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(row.value.market).toBe("US");
    expect(row.value.symbol).toBe("AAPL");
  });

  it("parses CRYPTO asset_id", () => {
    const result = csvToTransactions(
      makeRow({ asset_id: "CRYPTO:btc", currency: "BTC" }),
      IDENTITY_MAP
    );
    const row = result.rows[0];
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(row.value.market).toBe("CRYPTO");
  });
});

describe("csvToTransactions — invalid rows (bad rows don't block good rows)", () => {
  it("reports error for invalid type without blocking other rows", () => {
    const csv = `${CSV_HEADER}\r\npid,P,CN:600519,INVALID_TYPE,10,100,CNY,0,2024-01-01,\r\npid,P,CN:000001,BUY,5,50,CNY,0.1,2024-01-02,`;
    const result = csvToTransactions(csv, IDENTITY_MAP);
    expect(result.fileError).toBeUndefined();
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].ok).toBe(false);
    expect(result.rows[1].ok).toBe(true);
  });

  it("reports error for shares = 0", () => {
    const result = csvToTransactions(makeRow({ shares: "0" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(false);
    if (!row.ok) expect(row.errors.some((e) => e.includes("shares"))).toBe(true);
  });

  it("reports error for negative shares", () => {
    const result = csvToTransactions(makeRow({ shares: "-5" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(false);
    if (!row.ok) expect(row.errors.some((e) => e.includes("shares"))).toBe(true);
  });

  it("reports error for non-numeric shares", () => {
    const result = csvToTransactions(makeRow({ shares: "abc" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(false);
    if (!row.ok) {
      expect(row.errors.some((e) => e.includes("shares"))).toBe(true);
      expect(row.line).toBe(2); // line 1 = header, line 2 = first data row
    }
  });

  it("reports error for negative price_per_share", () => {
    const result = csvToTransactions(makeRow({ price_per_share: "-1" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(false);
    if (!row.ok) expect(row.errors.some((e) => e.includes("price_per_share"))).toBe(true);
  });

  it("reports error for negative fee", () => {
    const result = csvToTransactions(makeRow({ fee: "-0.1" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(false);
    if (!row.ok) expect(row.errors.some((e) => e.includes("fee"))).toBe(true);
  });

  it("reports error for invalid asset_id format", () => {
    const result = csvToTransactions(makeRow({ asset_id: "NOTANID" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(false);
    if (!row.ok) expect(row.errors.some((e) => e.includes("asset_id"))).toBe(true);
  });

  it("reports error for unknown market in asset_id", () => {
    const result = csvToTransactions(makeRow({ asset_id: "LME:COPPER" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(false);
    if (!row.ok) expect(row.errors.some((e) => e.includes("asset_id"))).toBe(true);
  });

  it("reports error for unknown currency", () => {
    const result = csvToTransactions(makeRow({ currency: "EUR" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(false);
    if (!row.ok) expect(row.errors.some((e) => e.includes("currency"))).toBe(true);
  });

  it("reports error for invalid trade_date", () => {
    const result = csvToTransactions(makeRow({ trade_date: "not-a-date" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(false);
    if (!row.ok) expect(row.errors.some((e) => e.includes("trade_date"))).toBe(true);
  });

  it("reports error for trade_date in wrong format (DD/MM/YYYY)", () => {
    const result = csvToTransactions(makeRow({ trade_date: "05/01/2024" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(false);
  });

  it("accumulates multiple errors per row", () => {
    const result = csvToTransactions(
      makeRow({ shares: "abc", currency: "INVALID", trade_date: "bad" }),
      IDENTITY_MAP
    );
    const row = result.rows[0];
    expect(row.ok).toBe(false);
    if (!row.ok) expect(row.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("csvToTransactions — RFC 4180 quoted fields", () => {
  it("parses notes with comma inside (quoted field)", () => {
    const csv = `${CSV_HEADER}\r\npid,P,CN:600519,BUY,10,100,CNY,0,2024-01-05,"buy,hold"`;
    const result = csvToTransactions(csv, IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(true);
    if (row.ok) expect(row.value.notes).toBe("buy,hold");
  });

  it("parses notes with double-quote escape", () => {
    const csv = `${CSV_HEADER}\r\npid,P,CN:600519,BUY,10,100,CNY,0,2024-01-05,"say ""hi"""`;
    const result = csvToTransactions(csv, IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(true);
    if (row.ok) expect(row.value.notes).toBe('say "hi"');
  });
});

describe("csvToTransactions — Decimal precision", () => {
  it("preserves full Decimal precision for shares", () => {
    const result = csvToTransactions(makeRow({ shares: "123456789.123456789" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(true);
    if (row.ok) expect(row.value.shares.toString()).toBe("123456789.123456789");
  });

  it("preserves full Decimal precision for price_per_share", () => {
    // Use a value within normal decimal range (toExpNeg=-7 by default)
    const result = csvToTransactions(makeRow({ price_per_share: "0.0001234567890" }), IDENTITY_MAP);
    const row = result.rows[0];
    expect(row.ok).toBe(true);
    if (row.ok) expect(row.value.pricePerShare.equals(new Decimal("0.0001234567890"))).toBe(true);
  });

  it("rejects Infinity for shares", () => {
    const result = csvToTransactions(makeRow({ shares: "Infinity" }), IDENTITY_MAP);
    expect(result.rows[0].ok).toBe(false);
  });

  it("rejects NaN for fee", () => {
    const result = csvToTransactions(makeRow({ fee: "NaN" }), IDENTITY_MAP);
    expect(result.rows[0].ok).toBe(false);
  });
});

describe("csvToTransactions — multiple rows", () => {
  it("correctly reports line numbers (1-indexed, header = line 1)", () => {
    const csv = [
      CSV_HEADER,
      "pid,P,CN:600519,BUY,10,100,CNY,0,2024-01-05,", // line 2 — valid
      "pid,P,BADID,BUY,10,100,CNY,0,2024-01-05,", // line 3 — invalid
      "pid,P,CN:000001,SELL,5,50,CNY,0,2024-01-06,", // line 4 — valid
    ].join("\r\n");

    const result = csvToTransactions(csv, IDENTITY_MAP);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].ok).toBe(true);
    expect(result.rows[0].line).toBe(2);
    expect(result.rows[1].ok).toBe(false);
    expect(result.rows[1].line).toBe(3);
    expect(result.rows[2].ok).toBe(true);
    expect(result.rows[2].line).toBe(4);
  });

  it("counts valid vs invalid correctly", () => {
    const csv = [
      CSV_HEADER,
      "pid,P,CN:600519,BUY,10,100,CNY,0,2024-01-05,",
      "pid,P,CN:600519,BUY,10,100,CNY,0,2024-01-05,",
      "pid,P,BADID,BADTYPE,abc,xyz,INVALID,neg,baddate,",
    ].join("\r\n");

    const result = csvToTransactions(csv, IDENTITY_MAP);
    const valid = result.rows.filter((r) => r.ok);
    const invalid = result.rows.filter((r) => !r.ok);
    expect(valid).toHaveLength(2);
    expect(invalid).toHaveLength(1);
  });
});
