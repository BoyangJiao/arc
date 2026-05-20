/**
 * Tushare symbol resolver — table-driven (S3-AC-A1.8)
 */

import { describe, expect, test } from "vitest";

import {
  cnSymbolToTsCode,
  fundSymbolToTsCode,
  hkSymbolToTsCode,
  tsCodeToSymbol,
} from "../src/adapters/tushare/symbol-resolver";
import { ParseError } from "../src/errors";

describe("cnSymbolToTsCode", () => {
  test.each([
    ["600519", "600519.SH"],
    ["000001", "000001.SZ"],
    ["300750", "300750.SZ"],
    ["688981", "688981.SH"],
    ["831010", "831010.BJ"],
  ])("%s → %s", (symbol, expected) => {
    expect(cnSymbolToTsCode(symbol)).toBe(expected);
  });

  test("invalid symbol → ParseError", () => {
    expect(() => cnSymbolToTsCode("abcd")).toThrow(ParseError);
  });
});

describe("hkSymbolToTsCode", () => {
  test.each([
    ["700", "00700.HK"],
    ["00700", "00700.HK"],
    ["5", "00005.HK"],
  ])("%s → %s", (symbol, expected) => {
    expect(hkSymbolToTsCode(symbol)).toBe(expected);
  });
});

describe("fundSymbolToTsCode", () => {
  test.each([
    ["000001", "000001.OF"],
    ["510300", "510300.SH"],
  ])("%s → %s", (symbol, expected) => {
    expect(fundSymbolToTsCode(symbol)).toBe(expected);
  });

  test('hint "OF" forces open-end suffix', () => {
    expect(fundSymbolToTsCode("510300", "OF")).toBe("510300.OF");
  });

  test('hint "EXCHANGE" uses cn rules', () => {
    expect(fundSymbolToTsCode("600519", "EXCHANGE")).toBe("600519.SH");
  });
});

describe("tsCodeToSymbol", () => {
  test("strips exchange suffix", () => {
    expect(tsCodeToSymbol("600519.SH")).toBe("600519");
    expect(tsCodeToSymbol("00700.HK")).toBe("00700");
  });
});
