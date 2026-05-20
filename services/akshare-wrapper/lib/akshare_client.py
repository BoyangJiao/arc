"""AKShare fetch helpers — normalize to Arc PriceQuote JSON."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import akshare as ak
import pandas as pd


def _require_token(headers: dict[str, str]) -> None:
    expected = os.environ.get("AKSHARE_WRAPPER_TOKEN", "")
    if not expected:
        return
    token = headers.get("x-arc-token") or headers.get("X-Arc-Token")
    if token != expected:
        raise PermissionError("unauthorized")


def _cn_as_of(trade_date: str) -> str:
    y, m, d = int(trade_date[0:4]), int(trade_date[4:6]), int(trade_date[6:8])
    return datetime(y, m, d, 7, 0, 0, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def _hk_as_of(trade_date: str) -> str:
    y, m, d = int(trade_date[0:4]), int(trade_date[4:6]), int(trade_date[6:8])
    return datetime(y, m, d, 8, 0, 0, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def _fund_as_of(nav_date: str) -> str:
    y, m, d = int(nav_date[0:4]), int(nav_date[4:6]), int(nav_date[6:8])
    return datetime(y, m, d, 15, 0, 0, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def _quote(
    asset_id: str,
    price: float,
    currency: str,
    as_of: str,
    source: str,
    change_percent: float | None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "assetId": asset_id,
        "price": str(price),
        "currency": currency,
        "asOf": as_of,
        "source": source,
    }
    if change_percent is not None:
        out["changePercent"] = str(change_percent)
    else:
        out["changePercent"] = None
    return out


def fetch_cn_quote(symbol: str) -> dict[str, Any]:
    code = symbol.zfill(6)
    df = ak.stock_zh_a_hist(symbol=code, period="daily", adjust="")
    if df is None or df.empty:
        raise LookupError(f"CN symbol not found: {symbol}")
    row = df.iloc[-1]
    trade_date = str(row["日期"]).replace("-", "")
    pct = row.get("涨跌幅")
    change = float(pct) if pct is not None and pd.notna(pct) else None
    return _quote(
        f"CN:{code}",
        float(row["收盘"]),
        "CNY",
        _cn_as_of(trade_date),
        "akshare-cn",
        change,
    )


def fetch_hk_quote(symbol: str) -> dict[str, Any]:
    code = symbol.lstrip("0") or symbol
    df = ak.stock_hk_hist(symbol=code.zfill(5), period="daily", adjust="")
    if df is None or df.empty:
        raise LookupError(f"HK symbol not found: {symbol}")
    row = df.iloc[-1]
    trade_date = str(row["日期"]).replace("-", "")
    pct = row.get("涨跌幅")
    change = float(pct) if pct is not None and pd.notna(pct) else None
    padded = code.zfill(5)
    return _quote(
        f"HK:{padded}",
        float(row["收盘"]),
        "HKD",
        _hk_as_of(trade_date),
        "akshare-hk",
        change,
    )


def _is_exchange_traded_fund(code: str) -> bool:
    """场内 ETF/LOF（如 510300、159915）— 用 fund_etf_hist_em，勿走 stock_zh_a_hist。"""
    return code.startswith(("51", "56", "58", "159", "16"))


def fetch_etf_quote(symbol: str) -> dict[str, Any]:
    code = symbol.zfill(6)
    df = ak.fund_etf_hist_em(symbol=code, period="daily", adjust="")
    if df is None or df.empty:
        raise LookupError(f"ETF symbol not found: {symbol}")
    row = df.iloc[-1]
    trade_date = str(row["日期"]).replace("-", "")
    pct = row.get("涨跌幅")
    change = float(pct) if pct is not None and pd.notna(pct) else None
    return _quote(
        f"FUND:{code}",
        float(row["收盘"]),
        "CNY",
        _cn_as_of(trade_date),
        "akshare-etf",
        change,
    )


def fetch_fund_quote(symbol: str) -> dict[str, Any]:
    code = symbol.zfill(6)
    if _is_exchange_traded_fund(code):
        return fetch_etf_quote(code)
    df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
    if df is None or df.empty:
        raise LookupError(f"FUND symbol not found: {symbol}")
    row = df.iloc[-1]
    nav_date = str(row["净值日期"]).replace("-", "")
    nav = float(row["单位净值"])
    change = None
    if len(df) > 1:
        prev = float(df.iloc[-2]["单位净值"])
        if prev:
            change = (nav - prev) / prev * 100
    return _quote(
        f"FUND:{code}",
        nav,
        "CNY",
        _fund_as_of(nav_date),
        "akshare-fund",
        change,
    )


def fetch_quote(market: str, symbol: str) -> dict[str, Any]:
    m = market.upper()
    if m == "CN":
        return fetch_cn_quote(symbol)
    if m == "HK":
        return fetch_hk_quote(symbol)
    if m == "FUND":
        return fetch_fund_quote(symbol)
    raise ValueError(f"unsupported market: {market}")
