/**
 * Property-based tests for Decimal arithmetic.
 *
 * Enforces .specify/data-model-invariants.md cross-cutting Decimal precision rule.
 * If any of these fails, money handling in Arc is broken at the foundation.
 *
 * NOTE: We use integer-based arbitrary values because JavaScript `number`
 * (IEEE 754 double) cannot exactly represent many decimal fractions.
 * Passing such imprecise `number` values into `new Decimal(n)` means the
 * Decimal constructor receives an already-corrupted value, causing false
 * failures on associativity / identity tests. Integers are exactly
 * representable, so they isolate Decimal's own precision behavior.
 */

import { describe, test, expect } from "vitest";
import * as fc from "fast-check";
import Decimal from "decimal.js";

/** Integer values in a safe range — exactly representable as JS number */
const safeInt = () => fc.integer({ min: -1e10, max: 1e10 });

/**
 * Decimal-string values — avoids IEEE 754 precision loss entirely.
 * Generates numbers with up to 6 decimal places as strings,
 * so `new Decimal(s)` parses the exact intended value.
 */
const safeDecimalString = () =>
  fc.integer({ min: -1e12, max: 1e12 }).map((n) => (n / 1e6).toFixed(6));

describe("Decimal arithmetic invariants", () => {
  test("addition is commutative: a + b = b + a", () => {
    fc.assert(
      fc.property(safeDecimalString(), safeDecimalString(), (a, b) => {
        const da = new Decimal(a);
        const db = new Decimal(b);
        return da.plus(db).equals(db.plus(da));
      })
    );
  });

  test("multiplication is commutative: a × b = b × a", () => {
    fc.assert(
      fc.property(safeInt(), safeInt(), (a, b) => {
        const da = new Decimal(a);
        const db = new Decimal(b);
        return da.times(db).equals(db.times(da));
      })
    );
  });

  test("addition is associative: (a + b) + c = a + (b + c)", () => {
    fc.assert(
      fc.property(safeDecimalString(), safeDecimalString(), safeDecimalString(), (a, b, c) => {
        const da = new Decimal(a);
        const db = new Decimal(b);
        const dc = new Decimal(c);
        return da
          .plus(db)
          .plus(dc)
          .equals(da.plus(db.plus(dc)));
      })
    );
  });

  test("identity: a + 0 = a, a × 1 = a", () => {
    fc.assert(
      fc.property(safeDecimalString(), (a) => {
        const da = new Decimal(a);
        return da.plus(0).equals(da) && da.times(1).equals(da);
      })
    );
  });

  test("inverse: a - a = 0, a / a = 1 (a ≠ 0)", () => {
    fc.assert(
      fc.property(
        safeDecimalString().filter((s) => new Decimal(s).isZero() === false),
        (a) => {
          const da = new Decimal(a);
          return da.minus(da).equals(0) && da.dividedBy(da).equals(1);
        }
      )
    );
  });

  test("the canonical floating-point bug 0.1 + 0.2 ≠ 0.3 is fixed", () => {
    // The reason we use Decimal in the first place
    expect(new Decimal(0.1).plus(0.2).equals(0.3)).toBe(true);
    // Same problem isn't fixed for `number`:
    expect(0.1 + 0.2 === 0.3).toBe(false);
  });
});
