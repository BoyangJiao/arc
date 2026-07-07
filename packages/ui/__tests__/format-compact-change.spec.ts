import { describe, expect, test } from "vitest";
import Decimal from "decimal.js";

import {
  formatCompactChangeLine,
  formatSignedPercent,
  formatUnsignedPercent,
} from "../src/finance/format-compact-change";

describe("format-compact-change", () => {
  test("formatCompactChangeLine — sign on amount only, not in parentheses", () => {
    expect(formatCompactChangeLine(new Decimal("1000"), new Decimal("13.17"), "¥")).toBe(
      "+¥1000.00 (13.17%)"
    );
    expect(formatCompactChangeLine(new Decimal("-500.5"), new Decimal("-2.5"), "$")).toBe(
      "-$500.50 (2.50%)"
    );
  });

  test("formatSignedPercent — standalone percent keeps sign", () => {
    expect(formatSignedPercent(new Decimal("13.17"))).toBe("+13.17%");
    expect(formatSignedPercent(new Decimal("-2.5"))).toBe("-2.50%");
  });

  test("formatUnsignedPercent — never includes sign", () => {
    expect(formatUnsignedPercent(new Decimal("-13.17"))).toBe("13.17%");
  });

  test("formatCompactChangeLine — redactAmount keeps percent only", () => {
    expect(
      formatCompactChangeLine(new Decimal("1000"), new Decimal("13.17"), "¥", {
        redactAmount: true,
      })
    ).toBe("•••• (13.17%)");
    expect(formatCompactChangeLine(new Decimal("1000"), null, "¥", { redactAmount: true })).toBe(
      "••••"
    );
  });
});
