// Pure logic for the daily-snapshot Edge Function.
//
// Split from index.ts (same pattern as dev-seed/handler.ts) so holdings
// replay, snapshot math, pagination, and the auth gate can be unit-tested
// via `pnpm test:functions` without a real Deno.serve / Supabase client.
//
// Fixes applied in the 2026-07 code-review pass:
//   1. Transactions are sorted by trade_date before replay (was: DB row
//      order, which Postgres does not guarantee → random cost basis).
//   2. All bulk reads are PAGINATED — supabase-js silently caps unranged
//      selects at 1000 rows; price_snapshots/fx_rates grow daily and would
//      have silently truncated.
//   3. Cost basis is fee-INCLUSIVE (totalCostBasis), matching the client's
//      computeMarketValue (was: shares × averageCost, fee-free → snapshot
//      and live valuation disagreed).
//   4. SELL oversell is tolerated (shares may go negative), matching
//      @arc/core computeHoldings + period-pnl replay semantics.
//   5. Decimal precision pinned to 28 — same as @arc/core returns/index.ts
//      (esm.sh copy otherwise defaults to 20 → cross-env drift).
//   6. Upsert failures get status "error" and the run responds non-200 so
//      the GH Actions cron (curl -f) goes red instead of silently passing.
//   7. Shared-secret comparison is constant-time (SHA-256 digest compare).
//
// Keep holdings replay in sync with @arc/core computeHoldings
// (packages/core/src/domain/holdings.ts) — handler.test.ts pins the shared
// semantics (sort, oversell, fee-inclusive cost basis).

// @ts-expect-error — Deno npm specifier (resolved at deploy/test time;
// supported by the Supabase Edge runtime, and unlike esm.sh it resolves from
// the npm registry, which sandboxed CI environments typically allow)
import Decimal from "npm:decimal.js@10.5.0";

// Match @arc/core (packages/core/src/returns/index.ts) so snapshot math and
// client math agree to the last digit.
Decimal.set({ precision: 28 });

// ──────────────────────────────────────────────────────────────────────────
// Types (subset of @arc/core; duplicated because Edge Functions can't import
// from the monorepo at deploy time — Deno bundles each function alone)

export type Currency = "USD" | "CNY" | "HKD" | "JPY" | "BTC" | "ETH";

export interface DBHolding {
  portfolioId: string;
  assetId: string;
  shares: string;
  /** Fee-INCLUSIVE total cost basis (native currency) — aligned with @arc/core Holding.totalCostBasis. */
  totalCostBasis: string;
  currency: Currency;
}

export interface DBPriceSnapshot {
  asset_id: string;
  price: string;
  currency: Currency;
  as_of: string;
}

export interface DBFxRate {
  from_currency: Currency;
  to_currency: Currency;
  rate: string;
  as_of: string;
}

export interface DBPortfolio {
  id: string;
  user_id: string;
  reporting_currency: Currency;
}

export interface DBTransaction {
  portfolio_id: string;
  asset_id: string;
  type: string;
  shares: string;
  price_per_share: string;
  currency: Currency;
  fee: string;
  trade_date: string;
}

export interface SnapshotAssetRow {
  assetId: string;
  shares: string;
  valueNative: string;
  currency: Currency;
  valueReporting: string;
}

export interface SnapshotUpsertRow {
  portfolio_id: string;
  as_of: string;
  total_value: string;
  total_cost_basis: string;
  reporting_currency: Currency;
  per_asset: SnapshotAssetRow[];
  source: "edge-function";
}

// ──────────────────────────────────────────────────────────────────────────
// Dependency seam — index.ts wires these to the real Supabase client;
// handler.test.ts stubs them.

export interface PageRequest {
  table: string;
  columns: string;
  /** Total order incl. a unique tiebreaker — REQUIRED for gap-free pagination. */
  orderBy: ReadonlyArray<{ column: string; ascending: boolean }>;
  /** Inclusive range [from, to] (supabase .range semantics). */
  from: number;
  to: number;
}

export interface HandlerDeps {
  env: (key: string) => string | undefined;
  fetchPage: (
    req: PageRequest
  ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
  upsertSnapshot: (row: SnapshotUpsertRow) => Promise<{ error: { message: string } | null }>;
  now?: () => Date;
}

export const PAGE_SIZE = 1000;

/** Read ALL rows of a table, page by page (breaks the 1000-row silent cap). */
export const fetchAllRows = async <T>(
  deps: HandlerDeps,
  table: string,
  columns: string,
  orderBy: ReadonlyArray<{ column: string; ascending: boolean }>
): Promise<T[]> => {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await deps.fetchPage({
      table,
      columns,
      orderBy,
      from: offset,
      to: offset + PAGE_SIZE - 1,
    });
    if (error) {
      throw new Error(`Failed to load ${table}: ${error.message}`);
    }
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Holdings replay — mirrors @arc/core computeHoldings semantics
// (sorted by trade_date; oversell tolerated; fee-inclusive cost basis).

interface HoldingAccumulator {
  shares: Decimal;
  averageCost: Decimal;
  totalCostBasis: Decimal;
  portfolioId: string;
  assetId: string;
  currency: Currency;
}

export const computeHoldings = (txs: DBTransaction[]): DBHolding[] => {
  // Defensive sort — replay order defines average cost & realized P&L.
  const sorted = [...txs].sort(
    (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );

  const byKey = new Map<string, HoldingAccumulator>();

  for (const tx of sorted) {
    const key = `${tx.portfolio_id}|${tx.asset_id}`;
    let acc = byKey.get(key);
    if (!acc) {
      acc = {
        shares: new Decimal(0),
        averageCost: new Decimal(0),
        totalCostBasis: new Decimal(0),
        portfolioId: tx.portfolio_id,
        assetId: tx.asset_id,
        currency: tx.currency,
      };
      byKey.set(key, acc);
    }

    const txShares = new Decimal(tx.shares);
    const txPrice = new Decimal(tx.price_per_share);
    const txFee = new Decimal(tx.fee);

    switch (tx.type) {
      case "BUY": {
        const newShares = acc.shares.plus(txShares);
        if (newShares.isZero()) {
          acc.averageCost = new Decimal(0);
        } else {
          acc.averageCost = acc.shares
            .times(acc.averageCost)
            .plus(txShares.times(txPrice))
            .dividedBy(newShares);
        }
        acc.shares = newShares;
        acc.totalCostBasis = acc.totalCostBasis.plus(txShares.times(txPrice).plus(txFee));
        break;
      }
      case "SELL": {
        // Oversell tolerated (no skip/throw) — same as @arc/core computeHoldings.
        acc.shares = acc.shares.minus(txShares);
        acc.totalCostBasis = acc.totalCostBasis.minus(txShares.times(acc.averageCost));
        break;
      }
      case "DIVIDEND":
        // Cash dividend — does not change shares or cost basis.
        break;
      case "SPLIT": {
        const splitRatio = txPrice;
        acc.shares = acc.shares.times(splitRatio);
        if (!splitRatio.isZero()) {
          acc.averageCost = acc.averageCost.dividedBy(splitRatio);
        }
        break;
      }
      case "ADJUSTMENT": {
        acc.shares = acc.shares.plus(txShares);
        acc.totalCostBasis = acc.totalCostBasis.plus(txShares.times(txPrice));
        if (!acc.shares.isZero()) {
          acc.averageCost = acc.totalCostBasis.dividedBy(acc.shares);
        }
        break;
      }
      default:
        console.warn(`daily-snapshot: unknown transaction type ${tx.type}; skipping`);
    }
  }

  const out: DBHolding[] = [];
  for (const acc of byKey.values()) {
    if (acc.shares.isZero()) continue;
    out.push({
      portfolioId: acc.portfolioId,
      assetId: acc.assetId,
      shares: acc.shares.toString(),
      totalCostBasis: acc.totalCostBasis.toString(),
      currency: acc.currency,
    });
  }
  return out;
};

// ──────────────────────────────────────────────────────────────────────────
// Cached lookups — single pass building Maps (was: O(rows) scan per holding)

export const buildLatestPriceMap = (prices: DBPriceSnapshot[]): Map<string, DBPriceSnapshot> => {
  const map = new Map<string, DBPriceSnapshot>();
  for (const p of prices) {
    const existing = map.get(p.asset_id);
    if (!existing || p.as_of > existing.as_of) map.set(p.asset_id, p);
  }
  return map;
};

export const buildLatestFxMap = (rates: DBFxRate[]): Map<string, DBFxRate> => {
  const map = new Map<string, DBFxRate>();
  for (const r of rates) {
    const key = `${r.from_currency}->${r.to_currency}`;
    const existing = map.get(key);
    if (!existing || r.as_of > existing.as_of) map.set(key, r);
  }
  return map;
};

// ──────────────────────────────────────────────────────────────────────────
// Per-portfolio snapshot

export const computeSnapshot = (
  portfolio: DBPortfolio,
  holdings: DBHolding[],
  priceMap: Map<string, DBPriceSnapshot>,
  fxMap: Map<string, DBFxRate>
): {
  totalValue: string;
  totalCostBasis: string;
  perAsset: SnapshotAssetRow[];
} => {
  let totalValue = new Decimal(0);
  let totalCostBasis = new Decimal(0);
  const perAsset: SnapshotAssetRow[] = [];

  for (const h of holdings) {
    if (h.portfolioId !== portfolio.id) continue;

    const quote = priceMap.get(h.assetId);
    if (!quote) {
      // No cached price for this holding — skip it for this snapshot
      // (the row appears in next snapshot when a quote becomes available)
      continue;
    }

    const shares = new Decimal(h.shares);
    const valueNative = shares.times(quote.price);
    // Fee-inclusive cost basis, aligned with client computeMarketValue.
    const costBasisNative = new Decimal(h.totalCostBasis);

    // FX: native → reporting. Direct rate, then inverse reciprocal —
    // mirrors @arc/core fx.findRate. NEVER a silent 1:1.
    let fxRate: Decimal;
    if (quote.currency === portfolio.reporting_currency) {
      fxRate = new Decimal(1);
    } else {
      const direct = fxMap.get(`${quote.currency}->${portfolio.reporting_currency}`);
      if (direct) {
        fxRate = new Decimal(direct.rate);
      } else {
        const inverse = fxMap.get(`${portfolio.reporting_currency}->${quote.currency}`);
        if (inverse && !new Decimal(inverse.rate).isZero()) {
          fxRate = new Decimal(1).dividedBy(inverse.rate);
        } else {
          // No FX path — skip this holding (never value it at 1:1)
          continue;
        }
      }
    }

    const valueReporting = valueNative.times(fxRate);
    const costBasisReporting = costBasisNative.times(fxRate);

    totalValue = totalValue.plus(valueReporting);
    totalCostBasis = totalCostBasis.plus(costBasisReporting);

    perAsset.push({
      assetId: h.assetId,
      shares: h.shares,
      valueNative: valueNative.toString(),
      currency: quote.currency,
      valueReporting: valueReporting.toString(),
    });
  }

  return {
    totalValue: totalValue.toString(),
    totalCostBasis: totalCostBasis.toString(),
    perAsset,
  };
};

// ──────────────────────────────────────────────────────────────────────────
// Auth — constant-time shared-secret comparison

const timingSafeEqual = async (a: string, b: string): Promise<boolean> => {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i]! ^ vb[i]!;
  return diff === 0;
};

// ──────────────────────────────────────────────────────────────────────────
// HTTP handler

export interface SnapshotSummary {
  portfolio_id: string;
  status: "written" | "skipped-empty" | "error";
  perAssetCount?: number;
  totalValue?: string;
  error?: string;
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const makeHandler = (deps: HandlerDeps) => {
  return async (req: Request): Promise<Response> => {
    // 1) Auth: shared secret in Authorization header (constant-time compare)
    const expected = deps.env("DAILY_SNAPSHOT_SECRET");
    if (!expected) {
      return json({ error: "DAILY_SNAPSHOT_SECRET not configured on this Supabase project" }, 500);
    }
    const incoming = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!(await timingSafeEqual(incoming, expected))) {
      return json({ error: "Unauthorized" }, 401);
    }

    // 2) Snapshot timestamp — anchored at today's 23:00:00Z for idempotency.
    const now = (deps.now ?? (() => new Date()))();
    const asOf = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 0, 0, 0)
    ).toISOString();

    // 3) Read all data in paginated bulk queries. Each orderBy includes a
    //    unique tiebreaker so range pagination never skips/duplicates rows.
    let portfolios: DBPortfolio[];
    let txs: DBTransaction[];
    let prices: DBPriceSnapshot[];
    let fxRates: DBFxRate[];
    try {
      [portfolios, txs, prices, fxRates] = await Promise.all([
        fetchAllRows<DBPortfolio>(deps, "portfolios", "id, user_id, reporting_currency", [
          { column: "id", ascending: true },
        ]),
        fetchAllRows<DBTransaction>(
          deps,
          "transactions",
          "portfolio_id, asset_id, type, shares, price_per_share, currency, fee, trade_date",
          [
            { column: "trade_date", ascending: true },
            { column: "id", ascending: true },
          ]
        ),
        fetchAllRows<DBPriceSnapshot>(deps, "price_snapshots", "asset_id, price, currency, as_of", [
          { column: "as_of", ascending: true },
          { column: "asset_id", ascending: true },
        ]),
        fetchAllRows<DBFxRate>(deps, "fx_rates", "from_currency, to_currency, rate, as_of", [
          { column: "as_of", ascending: true },
          { column: "from_currency", ascending: true },
          { column: "to_currency", ascending: true },
        ]),
      ]);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }

    const allHoldings = computeHoldings(txs);
    const priceMap = buildLatestPriceMap(prices);
    const fxMap = buildLatestFxMap(fxRates);

    // 4) Per-portfolio compute + upsert
    const summary: SnapshotSummary[] = [];
    let errorCount = 0;
    for (const portfolio of portfolios) {
      const snap = computeSnapshot(portfolio, allHoldings, priceMap, fxMap);

      if (snap.perAsset.length === 0) {
        // No priceable holdings — skip writing (avoid noisy empty rows)
        summary.push({ portfolio_id: portfolio.id, status: "skipped-empty" });
        continue;
      }

      const { error: upsertError } = await deps.upsertSnapshot({
        portfolio_id: portfolio.id,
        as_of: asOf,
        total_value: snap.totalValue,
        total_cost_basis: snap.totalCostBasis,
        reporting_currency: portfolio.reporting_currency,
        per_asset: snap.perAsset,
        source: "edge-function",
      });
      if (upsertError) {
        errorCount++;
        summary.push({
          portfolio_id: portfolio.id,
          status: "error",
          perAssetCount: snap.perAsset.length,
          error: upsertError.message,
        });
        console.error(`upsert failed for ${portfolio.id}:`, upsertError.message);
        continue;
      }

      summary.push({
        portfolio_id: portfolio.id,
        status: "written",
        perAssetCount: snap.perAsset.length,
        totalValue: snap.totalValue,
      });
    }

    // 5) Non-200 when anything failed so the GH Actions cron (curl -f) goes
    //    red — partial failures must be visible, not buried in a 200 body.
    return json(
      {
        asOf,
        portfoliosProcessed: summary.length,
        errorCount,
        summary,
      },
      errorCount > 0 ? 500 : 200
    );
  };
};
