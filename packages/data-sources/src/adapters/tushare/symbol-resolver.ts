/**
 * Arc symbol ↔ Tushare ts_code mapping (Stage 3 Block A).
 *
 * Arc asset ids are suffix-free: CN:600519, HK:00700, FUND:000001.
 * Tushare uses exchange suffixes: 600519.SH, 00700.HK, 000001.OF.
 */

import { ParseError } from "../../errors";

const CN_SOURCE = "tushare-cn";
const HK_SOURCE = "tushare-hk";
const FUND_SOURCE = "tushare-fund";

const SIX_DIGITS = /^\d{6}$/;

export const cnSymbolToTsCode = (symbol: string): string => {
  if (!SIX_DIGITS.test(symbol)) {
    throw new ParseError(CN_SOURCE, `unrecognized A-share symbol ${symbol}`);
  }

  if (symbol.startsWith("68")) {
    return `${symbol}.SH`;
  }

  const head = symbol[0];
  if (head === "6") return `${symbol}.SH`;
  if (head === "0" || head === "3") return `${symbol}.SZ`;
  if (head === "5") return `${symbol}.SH`;
  if (head === "1") return `${symbol}.SZ`;
  if (head === "8" || head === "4") return `${symbol}.BJ`;

  throw new ParseError(CN_SOURCE, `unrecognized A-share symbol ${symbol}`);
};

export const hkSymbolToTsCode = (symbol: string): string => {
  const digits = symbol.replace(/^0+/, "");
  if (!/^\d+$/.test(digits) || digits.length === 0) {
    throw new ParseError(HK_SOURCE, `unrecognized HK symbol ${symbol}`);
  }
  return `${digits.padStart(5, "0")}.HK`;
};

export type FundTsCodeHint = "OF" | "EXCHANGE";

export const fundSymbolToTsCode = (symbol: string, hint?: FundTsCodeHint): string => {
  if (hint === "OF") {
    if (!SIX_DIGITS.test(symbol)) {
      throw new ParseError(FUND_SOURCE, `unrecognized fund symbol ${symbol}`);
    }
    return `${symbol}.OF`;
  }

  if (hint === "EXCHANGE") {
    return cnSymbolToTsCode(symbol);
  }

  if (/^[15]\d{5}$/.test(symbol)) {
    return cnSymbolToTsCode(symbol);
  }

  if (!SIX_DIGITS.test(symbol)) {
    throw new ParseError(FUND_SOURCE, `unrecognized fund symbol ${symbol}`);
  }

  return `${symbol}.OF`;
};

/** Reverse: 600519.SH → 600519 */
export const tsCodeToSymbol = (tsCode: string): string => tsCode.split(".")[0] ?? tsCode;
