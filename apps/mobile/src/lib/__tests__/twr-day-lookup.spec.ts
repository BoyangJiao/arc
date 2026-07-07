import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import type { PriceQuote } from "@arc/core";

import {
  buildPriceAt,
  buildValueAt,
  collectBoundaryDayKeys,
  indexByUtcDay,
  lookupByUtcDayWithForwardFill,
  toUtcDayKey,
} from "../twr-day-lookup";

const quote = (asOf: string, price: string): PriceQuote => ({
  assetId: "US:AAPL",
  price: new Decimal(price),
  currency: "USD",
  asOf,
  source: "test",
});

describe("toUtcDayKey", () => {
  it("normalizes tx noon, snapshot 23:00, and midnight to the same day", () => {
    const day = "2024-06-15";
    expect(toUtcDayKey(new Date(`${day}T00:00:00.000Z`))).toBe(day);
    expect(toUtcDayKey(new Date(`${day}T12:00:00.000Z`))).toBe(day);
    expect(toUtcDayKey(new Date(`${day}T23:00:00.000Z`))).toBe(day);
  });
});

describe("lookupByUtcDayWithForwardFill", () => {
  it("returns exact day match when present", () => {
    const index = indexByUtcDay([quote("2024-06-15T23:00:00.000Z", "100")]);
    const hit = lookupByUtcDayWithForwardFill("2024-06-15", index);
    expect(hit?.price.toString()).toBe("100");
  });

  it("forward-fills from the most recent prior day", () => {
    const index = indexByUtcDay([
      quote("2024-06-10T23:00:00.000Z", "90"),
      quote("2024-06-12T23:00:00.000Z", "95"),
    ]);
    const hit = lookupByUtcDayWithForwardFill("2024-06-14", index);
    expect(hit?.price.toString()).toBe("95");
  });

  it("returns undefined when no prior day exists", () => {
    const index = indexByUtcDay([quote("2024-06-15T23:00:00.000Z", "100")]);
    expect(lookupByUtcDayWithForwardFill("2024-06-01", index)).toBeUndefined();
  });
});

describe("buildPriceAt", () => {
  const eodValue = new Decimal("123.45");
  const quotes = [quote("2024-06-15T23:00:00.000Z", eodValue.toString())];
  const priceAt = buildPriceAt(quotes, "US:AAPL");

  it("returns the same EOD price for T00 / T12 / T23 timestamps", () => {
    const day = "2024-06-15";
    const atMidnight = priceAt(new Date(`${day}T00:00:00.000Z`));
    const atNoon = priceAt(new Date(`${day}T12:00:00.000Z`));
    const atSnapshot = priceAt(new Date(`${day}T23:00:00.000Z`));

    expect(atMidnight.toString()).toBe(eodValue.toString());
    expect(atNoon.toString()).toBe(eodValue.toString());
    expect(atSnapshot.toString()).toBe(eodValue.toString());
  });

  it("throws when no quote exists for the day or any prior day", () => {
    expect(() => priceAt(new Date("2024-01-01T12:00:00.000Z"))).toThrow(
      /no historical price for US:AAPL/
    );
  });
});

describe("buildValueAt", () => {
  it("maps boundary timestamps to the same pre-resolved day value", () => {
    const day = "2024-06-15";
    const valueByDay = new Map([[day, new Decimal("9999.99")]]);
    const valueAt = buildValueAt(valueByDay);

    expect(valueAt(new Date(`${day}T12:00:00.000Z`)).toString()).toBe("9999.99");
    expect(valueAt(new Date(`${day}T23:00:00.000Z`)).toString()).toBe("9999.99");
  });
});

describe("collectBoundaryDayKeys", () => {
  it("deduplicates from/to and cash-flow days", () => {
    const from = new Date("2024-06-01T00:00:00.000Z");
    const to = new Date("2024-06-30T23:59:59.999Z");
    const keys = collectBoundaryDayKeys(from, to, [
      new Date("2024-06-15T12:00:00.000Z").getTime(),
      new Date("2024-06-15T23:00:00.000Z").getTime(),
    ]);

    expect(keys).toContain("2024-06-01");
    expect(keys).toContain("2024-06-15");
    expect(keys).toContain("2024-06-30");
    expect(keys.filter((k) => k === "2024-06-15")).toHaveLength(1);
  });
});
