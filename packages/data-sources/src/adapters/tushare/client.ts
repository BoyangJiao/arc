/**
 * Tushare Pro shared client — POST JSON-RPC to api.tushare.pro
 *
 * Column-oriented responses: { code, msg, data: { fields, items } }.
 * Per-market adapters (cn / hk / fund) share one client; pass `source` on
 * each call so AdapterError.source matches tushare-cn | tushare-hk | tushare-fund.
 */

import { NetworkError, NotFoundError, ParseError, QuotaError, RateLimitError } from "../../errors";

const TUSHARE_ENDPOINT = "https://api.tushare.pro";
const DEFAULT_SOURCE = "tushare";
const DEFAULT_RATE_LIMIT_MS = 60_000;

export interface TushareRows<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly fields: ReadonlyArray<keyof T & string>;
  readonly items: ReadonlyArray<ReadonlyArray<unknown>>;
}

export interface TushareClient {
  call<T extends Record<string, unknown>>(
    apiName: string,
    params: Record<string, string | number>,
    fields: ReadonlyArray<string>,
    options?: { source?: string }
  ): Promise<TushareRows<T>>;
}

export interface TushareClientConfig {
  token: string;
  /** Override fetch — for tests. Defaults to global fetch. */
  fetcher?: typeof fetch;
  /** Default AdapterError.source when call() omits options.source */
  source?: string;
}

interface TushareApiData {
  fields: string[];
  items: unknown[][];
}

interface TushareApiResponse {
  code: number;
  msg: string;
  data: TushareApiData | null;
}

const mapTushareCode = (code: number, msg: string, source: string): void => {
  if (code === 0) return;

  // 40001 token 无效 / 配置错误 → NetworkError，withFallback 会 bubble（secondary 也救不了）
  if (code === 40001) {
    throw new NetworkError(source, `40001: ${msg}`);
  }

  // 40002 积分不足 / 权限不足 → QuotaError，ADR 011 §决策三 用 instanceof 切 secondary
  if (code === 40002) {
    throw new QuotaError(source, code, msg);
  }

  if (code === 40203) {
    throw new RateLimitError(source, DEFAULT_RATE_LIMIT_MS);
  }

  throw new NetworkError(source, `${code}: ${msg}`);
};

/** Used by adapters on fetchLatest when Tushare returns zero rows (S3-AC-A1.7). */
export const assertTushareRowsNonEmpty = (
  rows: TushareRows,
  source: string,
  target: string
): void => {
  if (rows.items.length === 0) {
    throw new NotFoundError(source, target);
  }
};

export const createTushareClient = (config: TushareClientConfig): TushareClient => {
  const { token, fetcher = fetch, source: defaultSource = DEFAULT_SOURCE } = config;

  if (!token) {
    throw new Error("Tushare client requires token");
  }

  return {
    async call(apiName, params, fields, options) {
      const source = options?.source ?? defaultSource;

      let res: Response;
      try {
        res = await fetcher(TUSHARE_ENDPOINT, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api_name: apiName,
            token,
            params,
            fields: fields.join(","),
          }),
        });
      } catch (cause) {
        throw new NetworkError(source, cause);
      }

      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = res.headers.get("retry-after");
          const retryAfterMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : null;
          throw new RateLimitError(source, retryAfterMs);
        }
        if (res.status === 401 || res.status === 403) {
          throw new NetworkError(source, `HTTP ${res.status} unauthorized`);
        }
        throw new NetworkError(source, `HTTP ${res.status}`);
      }

      let body: TushareApiResponse;
      try {
        body = (await res.json()) as TushareApiResponse;
      } catch (cause) {
        throw new ParseError(source, "invalid JSON", cause);
      }

      mapTushareCode(body.code, body.msg ?? "", source);

      const data = body.data;
      if (!data?.fields || !data.items) {
        throw new ParseError(source, "missing data.fields or data.items");
      }

      return {
        fields: data.fields,
        items: data.items,
      };
    },
  };
};
