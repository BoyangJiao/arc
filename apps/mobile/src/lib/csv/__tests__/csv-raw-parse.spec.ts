import { describe, it, expect } from "vitest";
import { parseRawCsv, splitCsvLine } from "../csv-raw-parse";

describe("splitCsvLine", () => {
  it("splits a simple comma-separated line", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("returns single field for a line with no commas", () => {
    expect(splitCsvLine("hello")).toEqual(["hello"]);
  });

  it("handles an empty string as one empty field", () => {
    expect(splitCsvLine("")).toEqual([""]);
  });

  it("handles consecutive commas as empty fields", () => {
    expect(splitCsvLine("a,,c")).toEqual(["a", "", "c"]);
  });

  it("handles quoted field with comma inside", () => {
    expect(splitCsvLine('"a,b",c')).toEqual(["a,b", "c"]);
  });

  it("handles quoted field with embedded double-quote (RFC 4180 escape)", () => {
    expect(splitCsvLine('"say ""hi""",end')).toEqual(['say "hi"', "end"]);
  });

  it("handles quoted field with newline inside", () => {
    expect(splitCsvLine('"line1\nline2",c')).toEqual(["line1\nline2", "c"]);
  });

  it("handles empty quoted field", () => {
    expect(splitCsvLine('"",b')).toEqual(["", "b"]);
  });

  it("handles quoted field at end of line", () => {
    expect(splitCsvLine('a,"b,c"')).toEqual(["a", "b,c"]);
  });
});

describe("parseRawCsv", () => {
  it("returns empty header and rows for blank input", () => {
    expect(parseRawCsv("")).toEqual({ header: [], rows: [] });
    expect(parseRawCsv("   ")).toEqual({ header: [], rows: [] });
    expect(parseRawCsv("\n")).toEqual({ header: [], rows: [] });
  });

  it("parses a header-only CSV (no data rows)", () => {
    const result = parseRawCsv("a,b,c");
    expect(result.header).toEqual(["a", "b", "c"]);
    expect(result.rows).toHaveLength(0);
  });

  it("parses header + one data row", () => {
    const result = parseRawCsv("name,value\nfoo,42");
    expect(result.header).toEqual(["name", "value"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ name: "foo", value: "42" });
  });

  it("handles CRLF line endings", () => {
    const result = parseRawCsv("a,b\r\n1,2\r\n3,4");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ a: "1", b: "2" });
    expect(result.rows[1]).toEqual({ a: "3", b: "4" });
  });

  it("ignores a trailing newline", () => {
    const result = parseRawCsv("a,b\n1,2\n");
    expect(result.rows).toHaveLength(1);
  });

  it("maps columns by header name, not position", () => {
    const result = parseRawCsv("z,y,x\n3,2,1");
    expect(result.rows[0]).toEqual({ z: "3", y: "2", x: "1" });
  });

  it("handles quoted fields with commas in data rows", () => {
    const csv = 'h1,h2\n"v,1","v,2"';
    const result = parseRawCsv(csv);
    expect(result.rows[0]).toEqual({ h1: "v,1", h2: "v,2" });
  });

  it("handles a real-world-style Arc export header", () => {
    const header =
      "portfolio_id,portfolio_name,asset_id,type,shares,price_per_share,currency,fee,trade_date,notes";
    const result = parseRawCsv(header);
    expect(result.header).toHaveLength(10);
    expect(result.header[2]).toBe("asset_id");
  });

  // FI.9 regression: a newline inside a quoted field must NOT split the record.
  it("keeps a quoted field with an embedded newline on one record", () => {
    const csv = 'a,notes\n1,"line1\nline2"';
    const result = parseRawCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ a: "1", notes: "line1\nline2" });
  });

  it("handles multiple multi-line records + a following normal row", () => {
    const csv = 'a,notes\n1,"x\ny"\n2,"p\nq\nr"\n3,plain';
    const result = parseRawCsv(csv);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toEqual({ a: "1", notes: "x\ny" });
    expect(result.rows[1]).toEqual({ a: "2", notes: "p\nq\nr" });
    expect(result.rows[2]).toEqual({ a: "3", notes: "plain" });
  });

  it("handles a quoted field with both embedded newline and escaped quote", () => {
    const csv = 'a,notes\n1,"he said ""hi""\nnext line"';
    const result = parseRawCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ a: "1", notes: 'he said "hi"\nnext line' });
  });

  // Round-trip with the export escaper: export → parse must recover notes exactly.
  it("round-trips a CRLF-joined export with a multi-line note", () => {
    // Mirrors transactions-to-csv: CRLF row separator, quoted multi-line notes.
    const csv = 'a,notes\r\n1,"first\nsecond"\r\n2,plain';
    const result = parseRawCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ a: "1", notes: "first\nsecond" });
    expect(result.rows[1]).toEqual({ a: "2", notes: "plain" });
  });
});
