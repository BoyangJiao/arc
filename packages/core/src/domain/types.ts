/**
 * Arc 领域类型定义
 *
 * 本文件是所有金融数据的"形状真相"，业务代码必须 import 自 `@arc/core`。
 * 见 CLAUDE.md §3.2 数据模型不变性 5 条原则。
 *
 * 关键铁律：
 * - 任何金额 / 份额 / 价格 / 汇率字段必须用 `Decimal`，禁用 `number`
 * - 资产 ID `market:symbol` 一经写入永不修改
 * - 历史值用历史汇率/价格；当前值用最新值；混用是 P0 bug
 */

import Decimal from "decimal.js";

// ─── 基础枚举 ──────────────────────────────────────────────────────────────

/** 市场代码 — 与资产 ID 前缀严格对应 */
export type Market = "CN" | "HK" | "US" | "CRYPTO" | "FUND" | "CASH";

/** 货币代码 — Stage 1 仅使用 CNY/USD；Stage 2 扩展 HKD/BTC/ETH 等 */
export type Currency = "CNY" | "HKD" | "USD" | "JPY" | "BTC" | "ETH";

/** 交易类型 — Stage 1 仅 BUY；Stage 2+ 扩展其余 */
export type TransactionType =
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "SPLIT"
  | "ADJUSTMENT"
  | "OPENING_SNAPSHOT";

/** 涨跌色偏好 — 见 ADR 003 §决策五 */
export type FinanceColorMode = "redUpGreenDown" | "greenUpRedDown";

/** 语言偏好 */
export type Locale = "zh" | "en";

// ─── 资产 (Asset) ────────────────────────────────────────────────────────

/**
 * Asset — 不可变的金融资产标识
 * - id 格式：`{market}:{symbol}`（如 `CN:600519`、`US:AAPL`、`CRYPTO:btc`）
 * - 一经写入永不修改；任何"修正"通过新增 ADJUSTMENT 交易实现（CLAUDE.md §3.2.1）
 */
export interface Asset {
  /** 不可变 ID，格式 `{market}:{symbol}` */
  readonly id: string;
  readonly market: Market;
  readonly symbol: string;
  /** 显示名（如 "Apple Inc."、"贵州茅台"） */
  readonly name: string;
  /** 资产原始计价货币 — 永不丢失（CLAUDE.md §3.2.4） */
  readonly currency: Currency;
}

/** 构造 Asset ID（便于业务代码统一） */
export const composeAssetId = (market: Market, symbol: string): string => `${market}:${symbol}`;

/** 解析 Asset ID 回 market + symbol。
 *  Throws on missing market, missing symbol, or empty/whitespace symbol. */
export const parseAssetId = (id: string): { market: Market; symbol: string } => {
  const [market, ...rest] = id.split(":");
  if (!market || rest.length === 0) {
    throw new Error(`Invalid asset id: ${id}`);
  }
  const symbol = rest.join(":");
  if (symbol.length === 0) {
    throw new Error(`Invalid asset id (empty symbol): ${id}`);
  }
  return { market: market as Market, symbol };
};

// ─── 交易 (Transaction) ──────────────────────────────────────────────────

/**
 * Transaction — 用户录入的不可变交易记录
 *
 * 不变性原则：
 * - 一经创建不修改；如需修正，新增一笔 ADJUSTMENT 交易抵消（CLAUDE.md §3.2.1）
 * - 持仓 = Σ(交易) + Σ(快照修正)，不允许直接编辑（CLAUDE.md §3.2.2）
 */
export interface Transaction {
  readonly id: string;
  readonly portfolioId: string;
  readonly assetId: string;
  readonly type: TransactionType;
  /** 份额（Decimal，严禁 number） */
  readonly shares: Decimal;
  /** 单价（资产原始币种） */
  readonly pricePerShare: Decimal;
  /** 交易时使用的币种 — 通常 = asset.currency，跨币种交易时可不同 */
  readonly currency: Currency;
  /** 手续费（与 currency 同币种） */
  readonly fee: Decimal;
  /** ISO 8601 日期时间，含时区（多市场场景必须） */
  readonly tradeDate: string;
  /** 备注 — 仅展示用，不参与计算 */
  readonly notes?: string;
}

// ─── 持仓 (Holding) ──────────────────────────────────────────────────────

/**
 * Holding — 由 transactions 计算得出的派生数据
 *
 * 关键：Holding 永远不直接持久化为权威数据，它是 `computeHoldings(transactions)` 的输出。
 * 历史 Holding 用历史价格+汇率重算；当前 Holding 用最新价（CLAUDE.md §3.2.5）
 */
export interface Holding {
  readonly assetId: string;
  /** 当前持有份额 */
  readonly shares: Decimal;
  /** 平均成本（asset.currency 原始币种） */
  readonly averageCost: Decimal;
  /** 累计已投入成本（含手续费，原始币种） */
  readonly totalCostBasis: Decimal;
  /** 累计已实现盈亏（原始币种） */
  readonly realizedPnL: Decimal;
  /** 累计分红收入（原始币种） */
  readonly totalDividends: Decimal;
  /** 持仓所属 portfolio（便于多组合时分组） */
  readonly portfolioId: string;
  /** 与资产同币种，便于直接做计算时引用 */
  readonly currency: Currency;
}

// ─── 行情快照 (Pricing) ──────────────────────────────────────────────────

/**
 * PriceQuote — 来自数据源 adapter 的实时或历史行情
 *
 * 历史价用 `asOf` 字段标识；当前价 `asOf` 接近 now()。
 * 价格永远以资产 native 币种返回，不预先换算（CLAUDE.md §3.2.4）
 */
export interface PriceQuote {
  readonly assetId: string;
  readonly price: Decimal;
  readonly currency: Currency;
  /** 报价时点（ISO 8601） */
  readonly asOf: string;
  /** 数据源标识，如 "alphavantage" / "tushare" */
  readonly source: string;
  /**
   * 相对前收的涨跌幅（部分 adapter / 缓存提供）。
   * 未设置或 `null` 表示未知（UI 可显示占位符）。
   */
  readonly changePercent?: Decimal | null;
}

/**
 * FxRate — 来自汇率 adapter 的换算率
 *
 * `rate` 表示 1 单位 from 等于多少 to。如 USD→CNY rate=7.20。
 */
export interface FxRate {
  readonly from: Currency;
  readonly to: Currency;
  readonly rate: Decimal;
  readonly asOf: string;
  readonly source: string;
}

// ─── 组合 (Portfolio) ────────────────────────────────────────────────────

/**
 * TargetAllocation — 目标配置（Stage 2）
 * - 单个 portfolio 内所有 targetPercent 之和应 = 100
 * - 校验在 packages/core/rebalance/ 内进行
 */
export interface TargetAllocation {
  readonly assetId: string;
  /** 目标百分比，0–100 */
  readonly targetPercent: Decimal;
}

/**
 * Portfolio — 用户的资产组合
 *
 * Stage 1 通常每个用户只有 1 个默认 portfolio；Stage 2 支持多组合。
 * holdings 是派生字段（由 transactions 计算），存储模型中可不持久化此字段。
 */
export interface Portfolio {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  /** 该 portfolio 的报告货币（用户偏好可覆盖到全局或个组合）*/
  readonly reportingCurrency: Currency;
  readonly createdAt: string;
  /** 软归档时间（ISO）；NULL = 活跃 */
  readonly archivedAt: string | null;
  /** 派生：当前持仓 */
  readonly holdings?: Holding[];
  /** Stage 2 字段：目标配置 */
  readonly targetAllocations?: TargetAllocation[];
}

// ─── 用户与偏好 (User) ───────────────────────────────────────────────────

export interface User {
  readonly id: string;
  readonly email: string;
  readonly createdAt: string;
}

/**
 * UserPreferences — Settings 页可调整的字段
 * 一一对应 user_journeys §J3/J4/J5
 */
export interface UserPreferences {
  readonly userId: string;
  readonly reportingCurrency: Currency;
  readonly locale: Locale;
  readonly financeColorMode: FinanceColorMode;
  /** 一键脱敏开关（Stage 2 J12） */
  readonly redacted: boolean;
}

// ─── 派生 / 视图模型 (View Models) ───────────────────────────────────────

/**
 * MarketValuation — 单个 holding 在某时点 + 某报告货币下的估值
 * 是 `computeMarketValue` 的单元输出，不持久化
 */
export interface MarketValuation {
  readonly assetId: string;
  /** 该 holding 的份额（与 source Holding 相同；冗余字段方便 UI 渲染） */
  readonly shares: Decimal;
  /** 原始币种价 */
  readonly priceNative: Decimal;
  /** 原始币种市值 = price × shares */
  readonly valueNative: Decimal;
  readonly nativeCurrency: Currency;
  /** 报告币种市值（已经过 FX 换算） */
  readonly valueReporting: Decimal;
  /** 报告币种成本 = shares × averageCost × fxRate */
  readonly costBasisReporting: Decimal;
  /** 未实现盈亏（报告币种） = valueReporting - costBasisReporting */
  readonly unrealizedPnL: Decimal;
  /** 未实现盈亏百分比 = unrealizedPnL / costBasisReporting × 100 */
  readonly unrealizedPnLPercent: Decimal;
  /** 相对前收 / 24h 涨跌幅（来自最新 quote；与 unrealizedPnLPercent 不同） */
  readonly dailyChangePercent: Decimal | null;
  readonly reportingCurrency: Currency;
  /** 计算所用汇率快照（便于审计） */
  readonly fxRateUsed: Decimal;
  readonly priceAsOf: string;
  readonly fxAsOf: string;
}

/** 整个 portfolio 的汇总估值 */
export interface PortfolioValuation {
  readonly portfolioId: string;
  readonly reportingCurrency: Currency;
  readonly totalValue: Decimal;
  /** 报告币种总成本 */
  readonly totalCostBasis: Decimal;
  /** 总未实现盈亏（报告币种） */
  readonly totalUnrealizedPnL: Decimal;
  /** 总未实现盈亏百分比 */
  readonly totalUnrealizedPnLPercent: Decimal;
  readonly perAsset: ReadonlyArray<MarketValuation>;
  readonly computedAt: string;
}

// ─── 每日快照 (Daily Snapshot — Stage 2 J7) ───────────────────────────────

/**
 * SnapshotAsset — 快照时点某个持仓的明细
 * 见 .specify/feature-specs/stage-2/daily-snapshot-stage-2.md
 */
export interface SnapshotAsset {
  readonly assetId: string;
  readonly shares: Decimal;
  readonly valueNative: Decimal;
  readonly currency: Currency;
  readonly valueReporting: Decimal;
}

/**
 * PortfolioDailySnapshot — 单日 portfolio 估值快照
 *
 * 由 Edge Function `daily-snapshot` 在 23:00 UTC 写入；用户开 app 时只读，
 * 不主动写。Top-3 movers 通过比较 (today valuation - 昨日 snapshot) 计算。
 *
 * `reportingCurrency` 冗余存储：避免用户切换报告货币后历史快照失效。
 */
export interface PortfolioDailySnapshot {
  readonly portfolioId: string;
  /** Snapshot 时点（ISO 8601）。Cron 固定 23:00:00Z，但同一字段也接受 manual 任意时点。*/
  readonly asOf: string;
  readonly reportingCurrency: Currency;
  readonly totalValue: Decimal;
  readonly totalCostBasis: Decimal;
  readonly perAsset: ReadonlyArray<SnapshotAsset>;
  readonly source: "edge-function" | "manual";
  /** 写入时间（DB 自动 default now）*/
  readonly createdAt: string;
}

/**
 * AssetDelta — 单个资产的日变动（mover 排序用）
 * deltaPercent 在 baseline value 为 0 时（新买入）返回 0（不是 Infinity / NaN）
 */
export interface AssetDelta {
  readonly assetId: string;
  readonly deltaReporting: Decimal;
  readonly deltaPercent: Decimal;
  readonly currentValueReporting: Decimal;
}

/**
 * DailyDelta — 整个 portfolio 的日变动汇总
 *
 * `status` 区分三种 UI 状态（feature spec §UI Contract）：
 *   - 'ok'              → 正常渲染卡片
 *   - 'no-baseline'     → 渲染 placeholder（"首次启动，明日开始追踪"）
 *   - 'empty-portfolio' → 卡片不渲染
 */
export interface DailyDelta {
  readonly status: "ok" | "no-baseline" | "empty-portfolio";
  readonly totalDeltaReporting: Decimal;
  readonly totalDeltaPercent: Decimal;
  /** 已按 abs(deltaPercent) 降序排序 */
  readonly movers: ReadonlyArray<AssetDelta>;
  /** 比较的 baseline snapshot 日期（ISO 8601）。status='no-baseline' 时为 null. */
  readonly baselineAsOf: string | null;
  readonly currentReportingCurrency: Currency;
}
