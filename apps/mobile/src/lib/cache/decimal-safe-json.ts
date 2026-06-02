/**
 * decimal-safe-json — JSON serialize/deserialize that round-trips decimal.js
 * `Decimal` instances without precision loss.
 *
 * Spec: .specify/feature-specs/stage-3/offline-cache-stage-3.md §决策 2
 *
 * Why this exists:
 *   TanStack Query cache data (PortfolioValuation / MarketValuation / holdings …)
 *   is full of `Decimal` instances. The persist-client's default JSON
 *   serializer turns a Decimal into `{}` (no own-enumerable props) — so after a
 *   cold-start rehydrate, `value.times(...)` throws "is not a function".
 *
 * Approach (superjson-lite, single concern):
 *   - Recursively walk the value. Replace each Decimal with a tagged marker
 *     `{ [DECIMAL_TAG]: "<toString>" }` (full precision via Decimal.toString()).
 *   - On parse, revive any object carrying that tag back into `new Decimal(...)`.
 *   - Everything else (string / number / boolean / null / array / plain object)
 *     passes through unchanged.
 *
 * Constraints honored:
 *   - Constitution: never lose Decimal precision — toString()/new Decimal() is
 *     the same lossless round-trip persistent-market-cache.ts already relies on.
 *   - No IO, no React, no MMKV here — pure functions, fully unit-testable. The
 *     storage adapter (MMKV) composes these.
 */

import Decimal from "decimal.js";

/** Marker key identifying a serialized Decimal. Unlikely to collide with real data. */
export const DECIMAL_TAG = "__arc_dec__";

interface DecimalMarker {
  readonly [DECIMAL_TAG]: string;
}

const isDecimalMarker = (value: unknown): value is DecimalMarker =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.prototype.hasOwnProperty.call(value, DECIMAL_TAG) &&
  typeof (value as Record<string, unknown>)[DECIMAL_TAG] === "string";

/**
 * Recursively replace Decimal instances with tagged markers so the result is
 * plain-JSON-safe. Does not mutate the input.
 */
export const encodeDecimals = (value: unknown): unknown => {
  if (Decimal.isDecimal(value)) {
    return { [DECIMAL_TAG]: (value as Decimal).toString() };
  }
  if (Array.isArray(value)) {
    return value.map(encodeDecimals);
  }
  if (value !== null && typeof value === "object") {
    // Only plain-object-like records are walked. Class instances other than
    // Decimal are not expected in Query cache data; if present, their own
    // enumerable keys are walked (same as JSON.stringify would see).
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = encodeDecimals(v);
    }
    return out;
  }
  return value;
};

/**
 * Recursively revive tagged markers back into Decimal instances. Does not
 * mutate the input.
 */
export const decodeDecimals = (value: unknown): unknown => {
  if (isDecimalMarker(value)) {
    return new Decimal(value[DECIMAL_TAG]);
  }
  if (Array.isArray(value)) {
    return value.map(decodeDecimals);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = decodeDecimals(v);
    }
    return out;
  }
  return value;
};

/** Decimal-safe replacement for JSON.stringify (used as the persister serializer). */
export const serialize = (value: unknown): string => JSON.stringify(encodeDecimals(value));

/** Decimal-safe replacement for JSON.parse (used as the persister deserializer). */
export const deserialize = (text: string): unknown => decodeDecimals(JSON.parse(text));
