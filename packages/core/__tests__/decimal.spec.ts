/**
 * Property-based tests for Decimal arithmetic.
 *
 * Enforces .specify/data-model-invariants.md cross-cutting Decimal precision rule.
 * If any of these fails, money handling in Arc is broken at the foundation.
 */

import { describe, test, expect } from "vitest";
import * as fc from "fast-check";
import Decimal from "decimal.js";

const safeFloat = () =>
  fc.double({
    noNaN: true,
    noDefaultInfinity: true,
    min: -1e10,
    max: 1e10,
  });

describe("Decimal arithmetic invariants", () => {
  test("addition is commutative: a + b = b + a", () => {
    fc.assert(
      fc.property(safeFloat(), safeFloat(), (a, b) => {
        const da = new Decimal(a);
        const db = new Decimal(b);
        return da.plus(db).equals(db.plus(da));
      })
    );
  });

  test("multiplication is commutative: a × b = b × a", () => {
    fc.assert(
      fc.property(safeFloat(), safeFloat(), (a, b) => {
        const da = new Decimal(a);
        const db = new Decimal(b);
        return da.times(db).equals(db.times(da));
      })
    );
  });

  test("addition is associative: (a + b) + c = a + (b + c)", () => {
    fc.assert(
      fc.property(safeFloat(), safeFloat(), safeFloat(), (a, b, c) => {
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
      fc.property(safeFloat(), (a) => {
        const da = new Decimal(a);
        return da.plus(0).equals(da) && da.times(1).equals(da);
      })
    );
  });

  test("inverse: a - a = 0, a / a = 1 (a ≠ 0)", () => {
    fc.assert(
      fc.property(
        safeFloat().filter((n) => n !== 0),
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
