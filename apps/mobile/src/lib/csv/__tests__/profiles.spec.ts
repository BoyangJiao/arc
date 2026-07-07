import { describe, it, expect } from "vitest";
import { arcNativeProfile, detectProfile, IMPORT_PROFILES } from "../profiles";

// Arc export header columns
const ARC_NATIVE_HEADER = [
  "portfolio_id",
  "portfolio_name",
  "asset_id",
  "type",
  "shares",
  "price_per_share",
  "currency",
  "fee",
  "trade_date",
  "notes",
];

describe("arcNativeProfile.matches", () => {
  it("matches the Arc export header", () => {
    expect(arcNativeProfile.matches(ARC_NATIVE_HEADER)).toBe(true);
  });

  it("matches a header with only the required 7 columns (no portfolio cols)", () => {
    const minimalHeader = [
      "asset_id",
      "type",
      "shares",
      "price_per_share",
      "currency",
      "fee",
      "trade_date",
    ];
    expect(arcNativeProfile.matches(minimalHeader)).toBe(true);
  });

  it("does not match a header missing asset_id", () => {
    const header = ARC_NATIVE_HEADER.filter((c) => c !== "asset_id");
    expect(arcNativeProfile.matches(header)).toBe(false);
  });

  it("does not match a header missing price_per_share", () => {
    const header = ARC_NATIVE_HEADER.filter((c) => c !== "price_per_share");
    expect(arcNativeProfile.matches(header)).toBe(false);
  });

  it("does not match an empty header", () => {
    expect(arcNativeProfile.matches([])).toBe(false);
  });

  it("does not match a completely unrelated header", () => {
    expect(arcNativeProfile.matches(["date", "amount", "ticker"])).toBe(false);
  });
});

describe("arcNativeProfile.columnMap", () => {
  it("maps all canonical fields to the same name (identity)", () => {
    const map = arcNativeProfile.columnMap;
    expect(map.asset_id).toBe("asset_id");
    expect(map.type).toBe("type");
    expect(map.shares).toBe("shares");
    expect(map.price_per_share).toBe("price_per_share");
    expect(map.currency).toBe("currency");
    expect(map.fee).toBe("fee");
    expect(map.trade_date).toBe("trade_date");
    expect(map.notes).toBe("notes");
  });

  it("has no normalize function (Arc export is already canonical)", () => {
    expect(arcNativeProfile.normalize).toBeUndefined();
  });
});

describe("detectProfile", () => {
  it("returns arcNativeProfile for Arc export header", () => {
    const result = detectProfile(ARC_NATIVE_HEADER);
    expect(result).toBeDefined();
    expect(result?.id).toBe("arc-native");
  });

  it("returns undefined for an unknown header", () => {
    expect(detectProfile(["date", "amount", "ticker"])).toBeUndefined();
  });

  it("returns undefined for an empty header", () => {
    expect(detectProfile([])).toBeUndefined();
  });

  it("returns undefined for a partial Arc header (missing required fields)", () => {
    const partial = ["portfolio_id", "asset_id", "type"]; // missing shares/price/etc.
    expect(detectProfile(partial)).toBeUndefined();
  });
});

describe("IMPORT_PROFILES", () => {
  it("contains at least one profile", () => {
    expect(IMPORT_PROFILES.length).toBeGreaterThan(0);
  });

  it("contains arc-native profile", () => {
    expect(IMPORT_PROFILES.some((p) => p.id === "arc-native")).toBe(true);
  });

  it("all profiles have non-empty id and labelKey", () => {
    for (const p of IMPORT_PROFILES) {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.labelKey.length).toBeGreaterThan(0);
    }
  });
});
