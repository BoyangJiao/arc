/**
 * Tushare US adapter — `us_daily` EOD quotes (unadjusted).
 *
 * Same-口径 replacement for Alpha Vantage `TIME_SERIES_DAILY` (both unadjusted):
 * our historical asset value = shares-from-transactions × raw close, so we use
 * unadjusted `us_daily` (NOT `us_daily_adj`). EOD only — live US quotes stay on
 * Finnhub (Tushare US has no intraday). ts_code = raw ticker (e.g. AAPL, SPY).
 */

import Decimal from "decimal.js";

import type { PriceQuote } from "@arc/core";

import { NotImplementedError, ParseError } from "../../errors";
import type { PriceAdapter } from "../../interfaces";
import { assertTushareRowsNonEmpty, type TushareClient } from "./client";
import { formatYmd, rowAtIndex, usTradeDateToAsOf } from "./parse-rows";

const SOURCE = "tushare-us";
const DAILY_FIELDS = ["ts_code", "trade_date", "close", "pct_change"] as const;

export interface TushareUsAdapterConfig {
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
  if (row.pct_change != null && row.pct_change !== "") {
    try {
      changePercent = new Decimal(String(row.pct_change));
    } catch {
      changePercent = null;
    }
  }

  return {
    assetId: `US:${symbol}`,
    price,
    currency: "USD",
    asOf: usTradeDateToAsOf(String(tradeDate)),
    source: SOURCE,
    changePercent,
  };
};

export const createTushareUsAdapter = (config: TushareUsAdapterConfig): PriceAdapter => {
  const { client } = config;

  return {
    market: "US",
    source: SOURCE,

    async fetchLatest(symbol) {
      const rows = await client.call("us_daily", { ts_code: symbol }, [...DAILY_FIELDS], {
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
    },

    async fetchHistorical(symbol, from, to) {
      const rows = await client.call(
        "us_daily",
        { ts_code: symbol, start_date: formatYmd(from), end_date: formatYmd(to) },
        [...DAILY_FIELDS],
        { source: SOURCE }
      );

      const quotes: PriceQuote[] = [];
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
