import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { formatMoney, formatShares } from "../format-money";

const MASK = "••••";

describe("formatMoney redaction", () => {
  it("renders symbol + 2 decimals when not redacted", () => {
    expect(formatMoney(new Decimal("1234.5"), "CNY")).toBe("¥1234.50");
    expect(formatMoney(new Decimal("1234.5"), "USD")).toBe("$1234.50");
  });

  it("masks to dots when redacted", () => {
    expect(formatMoney(new Decimal("1234.5"), "CNY", { redact: true })).toBe(MASK);
  });
});

describe("formatShares", () => {
  it("trims trailing zeros to max 4 dp by default", () => {
    expect(formatShares(new Decimal("5"))).toBe("5");
    expect(formatShares(new Decimal("0.01"))).toBe("0.01");
    expect(formatShares(new Decimal("1.23456"))).toBe("1.2346");
  });

  it("honors a fixed decimals option", () => {
    expect(formatShares(new Decimal("5"), { decimals: 2 })).toBe("5.00");
    expect(formatShares(new Decimal("1.2"), { decimals: 4 })).toBe("1.2000");
  });

  it("masks to dots when redacted, regardless of decimals", () => {
    expect(formatShares(new Decimal("5"), { redact: true })).toBe(MASK);
    expect(formatShares(new Decimal("5"), { redact: true, decimals: 2 })).toBe(MASK);
    expect(formatShares(new Decimal("0.01"), { redact: true })).toBe(MASK);
  });

  it("does not mask when redact is false", () => {
    expect(formatShares(new Decimal("5"), { redact: false, decimals: 2 })).toBe("5.00");
  });
});
