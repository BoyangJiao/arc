// Supabase Edge Function: daily-snapshot
//
// Deno runtime. Invoked daily at 23:00 UTC by .github/workflows/daily-snapshot.yml.
// For each portfolio in the system, computes today's valuation using cached
// price_snapshots + fx_rates only (never calls Alpha Vantage / Frankfurter),
// then upserts one row into portfolio_value_snapshots.
//
// Per ADR 008 §决策五 and .specify/feature-specs/stage-2/daily-snapshot-stage-2.md
// §"Snapshot timing":
// - Idempotent: same (portfolio_id, as_of) primary key + ON CONFLICT DO UPDATE.
//   Retrying the workflow on the same UTC day overwrites the row.
// - Zero external API calls. We snapshot what we already know. Stale cache is
//   a tradeoff knowingly accepted (the user pulling-to-refresh during the day
//   warms the cache; weekend / inactive periods will show stale prices but
//   the snapshot is still meaningful as "what we last knew").
//
// Auth model:
// - Inbound: Authorization header must match DAILY_SNAPSHOT_SECRET env var
//   (set in Supabase project secrets). The GH Actions workflow holds the
//   matching secret in repo secrets.
// - Outbound (to Supabase): uses SUPABASE_SERVICE_ROLE_KEY (DB writes
//   bypass RLS). Never exposed to clients.
//
// Local test: `supabase functions serve daily-snapshot --env-file ./supabase/functions/.env`
// then `curl -X POST http://localhost:54321/functions/v1/daily-snapshot -H "Authorization: Bearer <secret>"`

// @ts-expect-error — Deno-only ESM URL import (resolved at deploy time)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// @ts-expect-error — Deno-only ESM URL import
import Decimal from "https://esm.sh/decimal.js@10.5.0";

// ──────────────────────────────────────────────────────────────────────────
// Types (subset of @arc/core; duplicated here because Edge Functions can't
// import from the monorepo at deploy time — Deno bundles each function alone)

type Currency = "USD" | "CNY" | "HKD" | "JPY" | "BTC" | "ETH";

interface DBHolding {
  portfolioId: string;
  assetId: string;
  shares: string;
  averageCost: string;
  currency: Currency;
}

interface DBPriceSnapshot {
  asset_id: string;
  price: string;
  currency: Currency;
  as_of: string;
}

interface DBFxRate {
  from_currency: Currency;
  to_currency: Currency;
  rate: string;
  as_of: string;
}

interface DBPortfolio {
  id: string;
  user_id: string;
  reporting_currency: Currency;
}

interface DBTransaction {
  portfolio_id: string;
  asset_id: string;
  type: string;
  shares: string;
  price_per_share: string;
  currency: Currency;
  fee: string;
}

interface SnapshotAssetRow {
  assetId: string;
  shares: string;
  valueNative: string;
  currency: Currency;
  valueReporting: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Holding computation — mirrors @arc/core computeHoldings (packages/core/src/domain/holdings.ts).
// Keep in sync when transaction types or cost-basis rules change (@arc/core computeHoldings).

interface HoldingAccumulator {
  shares: Decimal;
  averageCost: Decimal;
  totalCostBasis: Decimal;
  portfolioId: string;
  assetId: string;
  currency: Currency;
}

const computeHoldings = (txs: DBTransaction[]): DBHolding[] => {
  const byKey = new Map<string, HoldingAccumulator>();

  for (const tx of txs) {
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
        if (txShares.greaterThan(acc.shares)) {
          console.warn(
            `daily-snapshot: SELL ${txShares.toString()} exceeds holding ${acc.shares.toString()} for ${tx.asset_id}; skipping tx`
          );
          break;
        }
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
      averageCost: acc.averageCost.toString(),
      currency: acc.currency,
    });
  }
  return out;
};

// ──────────────────────────────────────────────────────────────────────────
// Cached lookup helpers — read-only, no adapter call

const latestPriceFor = (prices: DBPriceSnapshot[], assetId: string): DBPriceSnapshot | null => {
  let latest: DBPriceSnapshot | null = null;
  for (const p of prices) {
    if (p.asset_id !== assetId) continue;
    if (!latest || p.as_of > latest.as_of) latest = p;
  }
  return latest;
};

const latestFxFor = (rates: DBFxRate[], from: Currency, to: Currency): DBFxRate | null => {
  let latest: DBFxRate | null = null;
  for (const r of rates) {
    if (r.from_currency !== from || r.to_currency !== to) continue;
    if (!latest || r.as_of > latest.as_of) latest = r;
  }
  return latest;
};

// ──────────────────────────────────────────────────────────────────────────
// Per-portfolio snapshot

const computeSnapshot = (
  portfolio: DBPortfolio,
  holdings: DBHolding[],
  prices: DBPriceSnapshot[],
  fxRates: DBFxRate[]
): {
  totalValue: string;
  totalCostBasis: string;
  perAsset: SnapshotAssetRow[];
} => {
  let totalValue = new Decimal(0);
  let totalCostBasis = new Decimal(0);
  const perAsset: SnapshotAssetRow[] = [];

  for (const h of holdings.filter((x) => x.portfolioId === portfolio.id)) {
    const quote = latestPriceFor(prices, h.assetId);
    if (!quote) {
      // No cached price for this holding — skip it for this snapshot
      // (the row appears in next snapshot when a quote becomes available)
      continue;
    }

    const shares = new Decimal(h.shares);
    const valueNative = shares.times(quote.price);
    const costBasisNative = shares.times(h.averageCost);

    // FX: native → reporting
    let fxRate: Decimal;
    if (quote.currency === portfolio.reporting_currency) {
      fxRate = new Decimal(1);
    } else {
      const direct = latestFxFor(fxRates, quote.currency, portfolio.reporting_currency);
      if (direct) {
        fxRate = new Decimal(direct.rate);
      } else {
        // Try inverse
        const inverse = latestFxFor(fxRates, portfolio.reporting_currency, quote.currency);
        if (inverse) {
          fxRate = new Decimal(1).dividedBy(inverse.rate);
        } else {
          // No FX path — skip this holding (Stage 2; Stage 3 might persist with a warning)
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
// Handler

interface SnapshotSummary {
  portfolio_id: string;
  status: "written" | "skipped-empty";
  perAssetCount?: number;
  totalValue?: string;
}

Deno.serve(async (req: Request) => {
  // 1) Auth: shared secret in Authorization header
  const expected = Deno.env.get("DAILY_SNAPSHOT_SECRET");
  if (!expected) {
    return new Response(
      JSON.stringify({ error: "DAILY_SNAPSHOT_SECRET not configured on this Supabase project" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const incoming = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (incoming !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2) Connect with service_role (bypasses RLS)
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3) Snapshot timestamp — anchored at today's 23:00:00Z for idempotency.
  // We use the CURRENT UTC date's 23:00 — so a workflow run at e.g. 23:00:05Z
  // writes a row dated 23:00:00Z. Multiple runs same day → same primary key
  // → ON CONFLICT DO UPDATE (idempotent).
  const now = new Date();
  const asOf = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 0, 0, 0)
  ).toISOString();

  // 4) Read all data we need in a few bulk queries
  const [{ data: portfolios }, { data: txs }, { data: prices }, { data: fxRates }] =
    await Promise.all([
      supabase.from("portfolios").select("id, user_id, reporting_currency"),
      supabase
        .from("transactions")
        .select("portfolio_id, asset_id, type, shares, price_per_share, currency, fee"),
      supabase.from("price_snapshots").select("asset_id, price, currency, as_of"),
      supabase.from("fx_rates").select("from_currency, to_currency, rate, as_of"),
    ]);

  if (!portfolios) {
    return new Response(JSON.stringify({ error: "Failed to load portfolios" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const allHoldings = computeHoldings(txs ?? []);

  // 5) Per-portfolio compute + upsert
  const summary: SnapshotSummary[] = [];
  for (const portfolio of portfolios as DBPortfolio[]) {
    const snap = computeSnapshot(
      portfolio,
      allHoldings,
      (prices ?? []) as DBPriceSnapshot[],
      (fxRates ?? []) as DBFxRate[]
    );

    if (snap.perAsset.length === 0) {
      // No priceable holdings — skip writing (avoid noisy empty rows)
      summary.push({ portfolio_id: portfolio.id, status: "skipped-empty" });
      continue;
    }

    const { error: upsertError } = await supabase.from("portfolio_value_snapshots").upsert(
      {
        portfolio_id: portfolio.id,
        as_of: asOf,
        total_value: snap.totalValue,
        total_cost_basis: snap.totalCostBasis,
        reporting_currency: portfolio.reporting_currency,
        per_asset: snap.perAsset,
        source: "edge-function",
      },
      { onConflict: "portfolio_id,as_of" }
    );
    if (upsertError) {
      summary.push({
        portfolio_id: portfolio.id,
        status: "skipped-empty",
        perAssetCount: snap.perAsset.length,
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

  return new Response(
    JSON.stringify({
      asOf,
      portfoliosProcessed: summary.length,
      summary,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
