# Feature: 收益报告「已实现」列（Realized P&L in reporting currency, historical FX）— Stage 3 Block D

- **Status**: Draft — ready for a focused build session
- **Author**: Claude Opus 4.8 (draft)
- **Created**: 2026-06-16
- **Stage**: 3 — Block D
- **Implements**: `insights-enrichment-stage-3.md` §卡片 #6 (completes 收益报告 — 未实现 already shipped)
- **Depends on**: FX adapter / fx cache (historical lookups), transactions, holdings
- **Conforms to**: 宪法 §3.1 (Decimal), **data-model-invariants §4 (币种永不丢失) + §5 (历史≠当下)**

## Goal

Complete 收益报告 by adding the **已实现盈亏** column in **reporting currency**. Currently 收益报告 shows 未实现 only, because realized P&L (`Holding.realizedPnL`) is in each asset's **native** currency and converting at _today's_ FX would violate §5 (realized gains happened at historical rates).

## The problem to solve

Realized P&L is a native-currency quantity realized **at each sell**. Correct reporting-currency realized P&L must use the **FX rate at the sale date**, not the current rate. So we need a per-sell-transaction historical-FX pass.

## Data contract

- **Inputs:** sell transactions (assetId, date, native realized amount derivable via cost-basis replay), historical FX rate `fxAt(nativeCurrency → reportingCurrency, saleDate)`.
- **Core (pure):** `realizedPnLReporting(transactions, fxAt): { perAsset: Map<assetId, Decimal>; total: Decimal }` — replay sells (reuse `computeHoldings` accumulator semantics), convert each realized chunk at its sale-date FX, sum. Decimal throughout.
- **Approximation note (document in code):** realized P&L native = proceeds_native − costBasis_native (both native); convert the _native realized amount_ at the **sale-date** FX → reporting. This is the standard treatment; do NOT separately FX cost basis at acquisition date (that's a different — capital-vs-FX-attribution — feature, out of scope).

## Constraints / open questions

- **Historical FX availability** — OPEN/RISK: does the FX layer expose date-keyed historical rates? If only latest, this needs an `FxAdapter` historical extension (Tushare `fx_daily` / exchangerate.host historical) + cache. **Confirm before building.**
- Out of scope: FX/capital attribution split; multi-currency realized breakdown UI beyond per-asset total.

## Test plan

- `realizedPnLReporting` property tests: same-currency (fx=1) → equals native realized; known multi-sell fixture; zero sells → 0.
- Manual: 收益报告 已实现 column matches a hand-checked sell in reporting currency.

## Build order

1. Confirm/Build historical FX lookup (`fxAt(date)`).
2. `realizedPnLReporting` in `packages/core` + property tests.
3. Add 已实现 column to the 收益报告 list (per-asset + total).
