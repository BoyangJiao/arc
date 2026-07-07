/**
 * Tushare CN A-share adapter — `daily` EOD quotes (Phase 1A).
 */

import Decimal from "decimal.js";

import type { PriceQuote } from "@arc/core";

import { NotImplementedError, ParseError } from "../../errors";
import type { PriceAdapter } from "../../interfaces";
import { assertTushareRowsNonEmpty, type TushareClient } from "./client";
import { cnTradeDateToAsOf, formatYmd, rowAtIndex } from "./parse-rows";
import { cnSymbolToTsCode } from "./symbol-resolver";

const SOURCE = "tushare-cn";
const DAILY_FIELDS = ["ts_code", "trade_date", "close", "pct_chg"] as const;

export interface TushareCnAdapterConfig {
  client: TushareClient;
}

const parseDailyRow = (row: Record<string, unknown>, symbol: string): PriceQuote => {
  const close = row.close;
  const tradeDate = row.trade_date;

  if (close == null || tradeDate == null) {
    throw new ParseError(SOURCE, `missing close/trade_date for ${symbol}`);
  }

  let price: Decimal;
  try {
    price = new Decimal(String(close));
  } catch (cause) {
    throw new ParseError(SOURCE, `invalid close "${close}"`, cause);
  }

  let changePercent: Decimal | null = null;
  if (row.pct_chg != null && row.pct_chg !== "") {
    try {
      changePercent = new Decimal(String(row.pct_chg));
    } catch {
      changePercent = null;
    }
  }

  return {
    assetId: `CN:${symbol}`,
    price,
    currency: "CNY",
    asOf: cnTradeDateToAsOf(String(tradeDate)),
    source: SOURCE,
    changePercent,
  };
};

const fetchDaily = async (
  client: TushareClient,
  symbol: string,
  params: Record<string, string | number>
): Promise<PriceQuote> => {
  const tsCode = cnSymbolToTsCode(symbol);
  const rows = await client.call("daily", { ts_code: tsCode, ...params }, [...DAILY_FIELDS], {
    source: SOURCE,
  });
  assertTushareRowsNonEmpty(rows, SOURCE, symbol);

  let latestIndex = 0;
  let latestDate = "";
  for (let i = 0; i < rows.items.length; i++) {
    const row = rowAtIndex(rows, i);
    const td = String(row.trade_date ?? "");
    if (td >= latestDate) {
      latestDate = td;
      latestIndex = i;
    }
  }

  return parseDailyRow(rowAtIndex(rows, latestIndex), symbol);
};

export const createTushareCnAdapter = (config: TushareCnAdapterConfig): PriceAdapter => {
  const { client } = config;

  return {
    market: "CN",
    source: SOURCE,

    async fetchLatest(symbol) {
      return fetchDaily(client, symbol, {});
    },

    async fetchHistorical(symbol, from, to) {
      const quotes: PriceQuote[] = [];
      const rows = await client.call(
        "daily",
        {
          ts_code: cnSymbolToTsCode(symbol),
          start_date: formatYmd(from),
          end_date: formatYmd(to),
        },
        [...DAILY_FIELDS],
        { source: SOURCE }
      );

      for (let i = 0; i < rows.items.length; i++) {
        quotes.push(parseDailyRow(rowAtIndex(rows, i), symbol));
      }

      return quotes.sort((a, b) => a.asOf.localeCompare(b.asOf));
    },

    async searchSymbols() {
      throw new NotImplementedError(SOURCE, "searchSymbols");
    },
  };
};
