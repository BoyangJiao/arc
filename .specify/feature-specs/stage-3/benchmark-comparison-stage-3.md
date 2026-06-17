# Feature: 组合 vs 基准 + Beta（Benchmark Comparison）— Stage 3 Block D

- **Status**: Draft — benchmark-choice decision locked (BoyangJiao 2026-06-16: **user-selectable**); ready for a focused build session
- **Author**: Claude Opus 4.8 (draft)
- **Created**: 2026-06-16
- **Stage**: 3 — Block D
- **Implements**: `insights-enrichment-stage-3.md` §卡片 #9
- **Depends on**: `twr-stage-3.md` (portfolio period returns), `BarChart` wrapper (built), Tushare client (Block A)
- **Conforms to**: 宪法 §3.1 (Decimal), §二 (no advice copy), ADR 006 (`@arc/ui` charts), **ADR 007** (real benchmark data — no mocks), data-model-invariants §4/§5 (currency / 历史≠当下)

## Goal

Let the user compare a portfolio's TWR against a **user-selected benchmark index** over standard periods (1M/3M/YTD/1Y), and surface **beta** (sensitivity to the benchmark). Differentiator: China-relevant benchmarks (沪深300 etc.), not just SPX.

## Locked decision

**User-selectable benchmark, per portfolio.** Picker offers 沪深300 (`000300.SH`), 中证500 (`000905.SH`), 标普500, 恒生 (HSI), + custom index code. **Initial default by reporting currency** (CNY→沪深300, USD→标普500, HKD→恒生).

## Data contract

- **Benchmark series (NEW adapter work):** historical index EOD closes. Tushare covers both CN (`index_daily`) and global (`index_global`, e.g. SPX/HSI) — extend the data-sources layer with an index-series fetch behind a typed interface (do **not** fetch in app/core; ADR 006 §3.4). Cache like price series.
- **Returns alignment:** benchmark period return = `(close_end − close_start)/close_start` over the same window as the portfolio TWR sub-periods; align by trading date (skip non-overlapping dates).
- **Beta (core, pure):** `beta(portfolioReturns, benchmarkReturns): Decimal | null` = `cov(p,b) / var(b)`; aligned, equal-length daily-return arrays; `null` when `var(b)=0` or `< 2` points.

## User-facing behavior (Given/When/Then)

- **Given** a portfolio with TWR data **When** opening the 组合 vs 基准 view **Then** a benchmark picker (default per reporting currency) + a **grouped BarChart** (per period: 组合 vs 基准 return) + a **beta** number render.
- Copy is strictly neutral: 仅供参考；**禁止**「跑输就该换成基准 / 应调整」类引导 (宪法 §二).

## Constraints / open questions

- **Persist the benchmark choice** — OPEN: `portfolios.benchmark_symbol` column (migration) vs local MMKV pref keyed by portfolioId. **Recommend local pref first** (no migration), promote to a column later.
- **Benchmark return basis** — OPEN: price return vs total return (index dividends). Default: price return (index_daily close).
- **Out of scope:** blended/multi-index benchmark, intraday, benchmark for crypto-only portfolios (show "无合适基准").

## Test plan

- `beta` property tests (core): identical series → β≈1; zero-variance benchmark → null; scaling; known fixture.
- Index adapter: parse + cache tests (mirror Tushare price adapter tests).
- Manual: picker switch re-fetches; neutral copy; iOS/Web.

## Build order (suggested)

1. Index-series adapter (Tushare `index_daily` + `index_global`) + cache + tests.
2. `beta` + return-alignment in `packages/core/insights/risk.ts` + tests.
3. Benchmark picker (persist via local pref) + grouped `BarChart` card + beta readout + i18n.
