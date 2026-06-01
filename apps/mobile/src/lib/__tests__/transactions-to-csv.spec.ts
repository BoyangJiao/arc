import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import type { Transaction } from "@arc/core";

import { CSV_HEADER, escapeCsvField, transactionsToCsv } from "../transactions-to-csv";

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "tx-1",
  portfolioId: "p-1",
  assetId: "CN:600519",
  type: "BUY",
  shares: new Decimal("100.5"),
  pricePerShare: new Decimal("1800.12345678901234"),
  currency: "CNY",
  fee: new Decimal("5.00"),
  tradeDate: "2024-01-15T00:00:00+08:00",
  notes: undefined,
  ...overrides,
});

// ─── escapeCsvField ───────────────────────────────────────────────────────────

describe("escapeCsvField", () => {
  it("passes through a plain string unchanged", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });

  it("wraps a field containing a comma in double quotes", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("wraps a field containing a double quote and escapes it", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps a field containing a newline", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("wraps a field containing a carriage return", () => {
    expect(escapeCsvField("line1\rline2")).toBe('"line1\rline2"');
  });

  it("handles a field that is only double quotes", () => {
    // '""' (2 chars) → each " becomes "" → """" (4 chars) → wrapped → """""" (6 chars)
    expect(escapeCsvField('""')).toBe('""""""');
  });
});

// ─── transactionsToCsv ───────────────────────────────────────────────────────

describe("transactionsToCsv", () => {
  const opts = { portfolioNameById: { "p-1": "My Portfolio" } };

  it("returns only the header for an empty array", () => {
    const result = transactionsToCsv([], opts);
    expect(result).toBe(CSV_HEADER);
  });

  it("emits the correct header row", () => {
    const lines = transactionsToCsv([makeTx()], opts).split("\r\n");
    expect(lines[0]).toBe(
      "portfolio_id,portfolio_name,asset_id,type,shares,price_per_share,currency,fee,trade_date,notes"
    );
  });

  it("emits one data row per transaction", () => {
    const tx1 = makeTx({ id: "tx-1" });
    const tx2 = makeTx({ id: "tx-2", assetId: "US:AAPL" });
    const lines = transactionsToCsv([tx1, tx2], opts).split("\r\n");
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it("outputs Decimal values at full precision without formatting", () => {
    const shares = new Decimal("1234567890.123456789");
    const price = new Decimal("0.00000001");
    const fee = new Decimal("0");
    const tx = makeTx({ shares, pricePerShare: price, fee });
    const lines = transactionsToCsv([tx], opts).split("\r\n");
    const cols = lines[1]!.split(",");
    // Decimal.toString() is used — exponential notation (e.g. "1e-8") is valid
    // and recoverable; we assert round-trip equality rather than a literal string.
    expect(new Decimal(cols[4]!).equals(shares)).toBe(true);
    expect(new Decimal(cols[5]!).equals(price)).toBe(true);
    expect(new Decimal(cols[7]!).equals(fee)).toBe(true);
  });

  it("uses portfolio name from map", () => {
    const lines = transactionsToCsv([makeTx()], opts).split("\r\n");
    const cols = lines[1]!.split(",");
    expect(cols[1]).toBe("My Portfolio"); // portfolio_name
  });

  it("falls back to portfolioId when name is not in map", () => {
    const tx = makeTx({ portfolioId: "unknown-id" });
    const lines = transactionsToCsv([tx], { portfolioNameById: {} }).split("\r\n");
    const cols = lines[1]!.split(",");
    expect(cols[0]).toBe("unknown-id");
    expect(cols[1]).toBe("unknown-id");
  });

  it("escapes notes containing commas (RFC 4180)", () => {
    const tx = makeTx({ notes: "fee: 5, discount: 2" });
    const row = transactionsToCsv([tx], opts).split("\r\n")[1]!;
    expect(row).toContain('"fee: 5, discount: 2"');
  });

  it("escapes notes containing double quotes (RFC 4180)", () => {
    const tx = makeTx({ notes: 'he said "buy"' });
    const row = transactionsToCsv([tx], opts).split("\r\n")[1]!;
    expect(row).toContain('"he said ""buy"""');
  });

  it("escapes notes containing newlines (RFC 4180)", () => {
    const tx = makeTx({ notes: "line1\nline2" });
    const row = transactionsToCsv([tx], opts).split("\r\n")[1]!;
    expect(row).toContain('"line1\nline2"');
  });

  it("emits empty string for undefined notes (no masking)", () => {
    const tx = makeTx({ notes: undefined });
    const cols = transactionsToCsv([tx], opts).split("\r\n")[1]!.split(",");
    expect(cols[cols.length - 1]).toBe("");
  });

  it("preserves original currency (not converted to reporting currency)", () => {
    const tx = makeTx({ currency: "USD" });
    const cols = transactionsToCsv([tx], opts).split("\r\n")[1]!.split(",");
    expect(cols[6]).toBe("USD");
  });

  it("uses CRLF line endings (RFC 4180)", () => {
    const result = transactionsToCsv([makeTx()], opts);
    expect(result).toContain("\r\n");
    expect(result).not.toMatch(/(?<!\r)\n/); // no bare LF
  });
});
