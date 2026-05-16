/**
 * Adapter 错误层级 — 上层按类型分流（重试 / 降级 / 报错）
 *
 * 所有 adapter 都必须只抛 AdapterError 子类，不抛裸 Error / fetch Response。
 * 这样 mobile 业务层 / TanStack Query 可以根据错误类型决定 UX：
 *   - RateLimitError → 显示"配额用完，X 分钟后重试"；降级显示缓存
 *   - NetworkError → 显示离线 banner + 重试按钮
 *   - ParseError → 静默 fallback + Sentry 报警（schema 漂移）
 *   - NotFoundError → 显示"找不到该资产"
 *   - NotImplementedError → 路由 bug，开发期 throw
 */

/** 基础错误类型 */
export class AdapterError extends Error {
  readonly source: string;
  /** 原始 cause（如 fetch Response、解析异常）*/
  readonly cause?: unknown;

  constructor(message: string, source: string, cause?: unknown) {
    super(`[${source}] ${message}`);
    this.name = "AdapterError";
    this.source = source;
    this.cause = cause;
  }
}

/** 网络层失败（DNS、超时、TLS、CORS、无 internet） */
export class NetworkError extends AdapterError {
  constructor(source: string, cause?: unknown) {
    super("Network request failed", source, cause);
    this.name = "NetworkError";
  }
}

/** API 限流（HTTP 429 / 厂商自定义"调用过频"信号） */
export class RateLimitError extends AdapterError {
  /** 服务器建议的重试时间（毫秒），未提供则 null */
  readonly retryAfterMs: number | null;

  constructor(source: string, retryAfterMs: number | null = null, cause?: unknown) {
    super(
      retryAfterMs ? `Rate limited; retry in ${Math.ceil(retryAfterMs / 1000)}s` : "Rate limited",
      source,
      cause
    );
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** 响应 schema 解析失败（厂商改了 API） */
export class ParseError extends AdapterError {
  constructor(source: string, message: string, cause?: unknown) {
    super(`Parse failed: ${message}`, source, cause);
    this.name = "ParseError";
  }
}

/** 资产/symbol/货币对在该 source 不存在 */
export class NotFoundError extends AdapterError {
  constructor(source: string, target: string) {
    super(`Not found: ${target}`, source);
    this.name = "NotFoundError";
  }
}

/** 该 adapter 未实现该方法（Stage 1 不实现历史数据时用） */
export class NotImplementedError extends AdapterError {
  constructor(source: string, method: string) {
    super(`${method} not implemented`, source);
    this.name = "NotImplementedError";
  }
}
