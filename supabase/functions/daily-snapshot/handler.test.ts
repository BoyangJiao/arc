// Deno unit tests for the daily-snapshot Edge Function handler.
//
// Run: `pnpm test:functions` (= `deno test --allow-env --no-check supabase/functions/`)
//
// Pins the 2026-07 code-review fixes:
//   - transactions replayed in trade_date order regardless of row order
//   - pagination past the 1000-row supabase-js cap
//   - fee-inclusive cost basis (matches @arc/core computeMarketValue)
//   - SELL oversell tolerated (matches @arc/core computeHoldings)
//   - inverse FX fallback; missing FX → holding skipped (never 1:1)
//   - upsert failure → status "error" + HTTP 500 (cron curl -f goes red)
//   - wrong shared secret → 401

// Zero-dependency assert — keeps this test runnable in sandboxed
// environments where deno.land / jsr.io are unreachable (esm.sh transitive
// imports still resolve through the module cache / proxy).
const assertEquals = <T>(actual: T, expected: T, msg?: string): void => {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(msg ?? `assertEquals failed:\n  actual:   ${a}\n  expected: ${b}`);
  }
};

import {
  buildLatestFxMap,
  buildLatestPriceMap,
  computeHoldings,
  computeSnapshot,
  makeHandler,
  PAGE_SIZE,
  type DBFxRate,
  type DBPortfolio,
  type DBPriceSnapshot,
  type DBTransaction,
  type HandlerDeps,
  type PageRequest,
  type SnapshotUpsertRow,
} from "./handler.ts";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures

const tx = (over: Partial<DBTransaction> = {}): DBTransaction => ({
  portfolio_id: "p-1",
  asset_id: "US:AAPL",
  type: "BUY",
  shares: "10",
  price_per_share: "100",
  currency: "USD",
  fee: "0",
  trade_date: "2026-01-01T10:00:00Z",
  ...over,
});

const price = (over: Partial<DBPriceSnapshot> = {}): DBPriceSnapshot => ({
  asset_id: "US:AAPL",
  price: "120",
  currency: "USD",
  as_of: "2026-07-01T00:00:00Z",
  ...over,
});

const portfolio = (over: Partial<DBPortfolio> = {}): DBPortfolio => ({
  id: "p-1",
  user_id: "u-1",
  reporting_currency: "USD",
  ...over,
});

// In-memory table store the fetchPage stub serves (with real pagination).
interface TableStore {
  portfolios: DBPortfolio[];
  transactions: DBTransaction[];
  price_snapshots: DBPriceSnapshot[];
  fx_rates: DBFxRate[];
}

const makeDeps = (
  store: TableStore,
  overrides: Partial<HandlerDeps> = {}
): { deps: HandlerDeps; upserts: SnapshotUpsertRow[] } => {
  const upserts: SnapshotUpsertRow[] = [];
  const deps: HandlerDeps = {
    env: (key) => (key === "DAILY_SNAPSHOT_SECRET" ? "test-secret" : undefined),
    fetchPage: (page: PageRequest) => {
      const rows = store[page.table as keyof TableStore] as unknown[];
      return Promise.resolve({ data: rows.slice(page.from, page.to + 1), error: null });
    },
    upsertSnapshot: (row) => {
      upserts.push(row);
      return Promise.resolve({ error: null });
    },
    now: () => new Date("2026-07-05T23:00:05Z"),
    ...overrides,
  };
  return { deps, upserts };
};

const post = (secret = "test-secret") =>
  new Request("https://x.supabase.co/functions/v1/daily-snapshot", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });

// ──────────────────────────────────────────────────────────────────────────
// computeHoldings — replay semantics pinned to @arc/core

Deno.test("computeHoldings sorts by trade_date before replay", () => {
  // SELL dated LAST but listed FIRST — result must match chronological replay
  const rows = [
    tx({ type: "SELL", shares: "5", price_per_share: "120", trade_date: "2026-03-01T00:00:00Z" }),
    tx({ shares: "10", price_per_share: "200", trade_date: "2026-02-01T00:00:00Z" }),
    tx({ shares: "10", price_per_share: "100", trade_date: "2026-01-01T00:00:00Z" }),
  ];
  const holdings = computeHoldings(rows);
  assertEquals(holdings.length, 1);
  assertEquals(holdings[0].shares, "15");
  // avgCost = 150 after both buys; SELL removes 5×150=750 of basis: 3000−750=2250
  assertEquals(holdings[0].totalCostBasis, "2250");
});

Deno.test("computeHoldings: BUY fee is included in cost basis (matches client)", () => {
  const holdings = computeHoldings([tx({ shares: "10", price_per_share: "100", fee: "9.99" })]);
  assertEquals(holdings[0].totalCostBasis, "1009.99");
});

Deno.test("computeHoldings: SELL oversell tolerated, shares go negative", () => {
  const holdings = computeHoldings([
    tx({ shares: "10", price_per_share: "100" }),
    tx({ type: "SELL", shares: "20", price_per_share: "120", trade_date: "2026-02-01T00:00:00Z" }),
  ]);
  assertEquals(holdings.length, 1);
  assertEquals(holdings[0].shares, "-10");
});

// ──────────────────────────────────────────────────────────────────────────
// computeSnapshot — FX + cost basis

Deno.test("computeSnapshot: inverse FX fallback (reciprocal), never 1:1", () => {
  const holdings = computeHoldings([
    tx({ asset_id: "CN:600519", currency: "CNY", shares: "10", price_per_share: "1000" }),
  ]);
  const priceMap = buildLatestPriceMap([
    price({ asset_id: "CN:600519", currency: "CNY", price: "1600" }),
  ]);

  // Only USD→CNY = 8 available; CNY→USD must use the reciprocal
  const withInverse = buildLatestFxMap([
    { from_currency: "USD", to_currency: "CNY", rate: "8", as_of: "2026-07-01T00:00:00Z" },
  ]);
  const snap = computeSnapshot(portfolio(), holdings, priceMap, withInverse);
  assertEquals(snap.perAsset.length, 1);
  assertEquals(snap.totalValue, "2000"); // 16000 CNY ÷ 8

  // No FX at all → holding skipped, NOT valued at 1:1
  const snapNoFx = computeSnapshot(portfolio(), holdings, priceMap, buildLatestFxMap([]));
  assertEquals(snapNoFx.perAsset.length, 0);
  assertEquals(snapNoFx.totalValue, "0");
});

Deno.test("buildLatestPriceMap keeps the newest as_of per asset", () => {
  const map = buildLatestPriceMap([
    price({ price: "100", as_of: "2026-06-01T00:00:00Z" }),
    price({ price: "130", as_of: "2026-07-02T00:00:00Z" }),
    price({ price: "110", as_of: "2026-06-15T00:00:00Z" }),
  ]);
  assertEquals(map.get("US:AAPL")?.price, "130");
});

// ──────────────────────────────────────────────────────────────────────────
// HTTP handler — auth, pagination, error propagation

Deno.test("handler: wrong secret → 401; missing env → 500", async () => {
  const { deps } = makeDeps({
    portfolios: [],
    transactions: [],
    price_snapshots: [],
    fx_rates: [],
  });
  const res = await makeHandler(deps)(post("wrong-secret"));
  assertEquals(res.status, 401);

  const { deps: noEnv } = makeDeps(
    { portfolios: [], transactions: [], price_snapshots: [], fx_rates: [] },
    { env: () => undefined }
  );
  const res2 = await makeHandler(noEnv)(post());
  assertEquals(res2.status, 500);
});

Deno.test("handler: paginates past the 1000-row cap (transactions)", async () => {
  // PAGE_SIZE buys of 1 share + 1 more on a second page → 1001 shares total.
  // The old un-ranged select would have seen only the first 1000 rows.
  const manyTxs: DBTransaction[] = [];
  for (let i = 0; i < PAGE_SIZE + 1; i++) {
    manyTxs.push(
      tx({
        shares: "1",
        trade_date: `2026-01-01T00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z`,
      })
    );
  }
  const { deps, upserts } = makeDeps({
    portfolios: [portfolio()],
    transactions: manyTxs,
    price_snapshots: [price()],
    fx_rates: [],
  });

  const res = await makeHandler(deps)(post());
  assertEquals(res.status, 200);
  assertEquals(upserts.length, 1);
  assertEquals(upserts[0].per_asset[0].shares, "1001");
});

Deno.test("handler: upsert failure → status error + HTTP 500", async () => {
  const { deps } = makeDeps(
    {
      portfolios: [portfolio()],
      transactions: [tx()],
      price_snapshots: [price()],
      fx_rates: [],
    },
    { upsertSnapshot: () => Promise.resolve({ error: { message: "boom" } }) }
  );

  const res = await makeHandler(deps)(post());
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.errorCount, 1);
  assertEquals(body.summary[0].status, "error");
});

Deno.test("handler: empty portfolio → skipped-empty, 200", async () => {
  const { deps, upserts } = makeDeps({
    portfolios: [portfolio()],
    transactions: [],
    price_snapshots: [],
    fx_rates: [],
  });

  const res = await makeHandler(deps)(post());
  assertEquals(res.status, 200);
  assertEquals(upserts.length, 0);
  const body = await res.json();
  assertEquals(body.summary[0].status, "skipped-empty");
});

Deno.test("handler: as_of anchored to 23:00:00Z of the run date", async () => {
  const { deps, upserts } = makeDeps({
    portfolios: [portfolio()],
    transactions: [tx()],
    price_snapshots: [price()],
    fx_rates: [],
  });
  await makeHandler(deps)(post());
  assertEquals(upserts[0].as_of, "2026-07-05T23:00:00.000Z");
});
