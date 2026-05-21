"""AKShare fetch helpers — normalize to Arc PriceQuote JSON."""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any

import akshare as ak
import pandas as pd

# Module-level spot/name tables — 24h TTL to avoid re-downloading on every search.
_DF_CACHE: dict[str, tuple[Any, float]] = {}
_DF_CACHE_TTL_SEC = 24 * 60 * 60


def _require_token(headers: dict[str, str]) -> None:
    # Fail-closed: refuse to serve when AKSHARE_WRAPPER_TOKEN env not configured.
    # 任何缺 env 的部署 (local dev / Vercel preview missing env / 配置错误) 都拒绝服务,
    # 避免对全 internet 开放 (Block A code review P1-3).
    expected = os.environ.get("AKSHARE_WRAPPER_TOKEN", "")
    if not expected:
        raise PermissionError("AKSHARE_WRAPPER_TOKEN must be configured")
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


# ---- Historical window fetch (Block A P1-1) -------------------------------

def _iso_to_ymd(iso: str) -> str:
    # Accept ISO 8601 with or without timezone — slice the date portion (YYYY-MM-DD).
    date_part = iso.split("T")[0]
    return date_part.replace("-", "")


def fetch_cn_window(symbol: str, start_ymd: str, end_ymd: str) -> list[dict[str, Any]]:
    code = symbol.zfill(6)
    df = ak.stock_zh_a_hist(
        symbol=code, period="daily", start_date=start_ymd, end_date=end_ymd, adjust=""
    )
    if df is None or df.empty:
        return []
    out: list[dict[str, Any]] = []
    for i in range(len(df)):
        row = df.iloc[i]
        trade_date = str(row["日期"]).replace("-", "")
        pct = row.get("涨跌幅")
        change = float(pct) if pct is not None and pd.notna(pct) else None
        out.append(
            _quote(f"CN:{code}", float(row["收盘"]), "CNY", _cn_as_of(trade_date), "akshare-cn", change)
        )
    return out


def fetch_hk_window(symbol: str, start_ymd: str, end_ymd: str) -> list[dict[str, Any]]:
    code = (symbol.lstrip("0") or symbol).zfill(5)
    df = ak.stock_hk_hist(
        symbol=code, period="daily", start_date=start_ymd, end_date=end_ymd, adjust=""
    )
    if df is None or df.empty:
        return []
    out: list[dict[str, Any]] = []
    for i in range(len(df)):
        row = df.iloc[i]
        trade_date = str(row["日期"]).replace("-", "")
        pct = row.get("涨跌幅")
        change = float(pct) if pct is not None and pd.notna(pct) else None
        out.append(
            _quote(f"HK:{code}", float(row["收盘"]), "HKD", _hk_as_of(trade_date), "akshare-hk", change)
        )
    return out


def fetch_etf_window(symbol: str, start_ymd: str, end_ymd: str) -> list[dict[str, Any]]:
    code = symbol.zfill(6)
    df = ak.fund_etf_hist_em(
        symbol=code, period="daily", start_date=start_ymd, end_date=end_ymd, adjust=""
    )
    if df is None or df.empty:
        return []
    out: list[dict[str, Any]] = []
    for i in range(len(df)):
        row = df.iloc[i]
        trade_date = str(row["日期"]).replace("-", "")
        pct = row.get("涨跌幅")
        change = float(pct) if pct is not None and pd.notna(pct) else None
        out.append(
            _quote(f"FUND:{code}", float(row["收盘"]), "CNY", _cn_as_of(trade_date), "akshare-etf", change)
        )
    return out


def fetch_open_fund_window(symbol: str, start_ymd: str, end_ymd: str) -> list[dict[str, Any]]:
    # fund_open_fund_info_em 不接受 date 参数 — 拉全量后按日期窗口过滤
    code = symbol.zfill(6)
    df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
    if df is None or df.empty:
        return []
    out: list[dict[str, Any]] = []
    prev_nav: float | None = None
    for i in range(len(df)):
        row = df.iloc[i]
        nav_date = str(row["净值日期"]).replace("-", "")
        if nav_date < start_ymd or nav_date > end_ymd:
            prev_nav = float(row["单位净值"])
            continue
        nav = float(row["单位净值"])
        change = (nav - prev_nav) / prev_nav * 100 if prev_nav else None
        out.append(_quote(f"FUND:{code}", nav, "CNY", _fund_as_of(nav_date), "akshare-fund", change))
        prev_nav = nav
    return out


def fetch_fund_window(symbol: str, start_ymd: str, end_ymd: str) -> list[dict[str, Any]]:
    code = symbol.zfill(6)
    if _is_exchange_traded_fund(code):
        return fetch_etf_window(code, start_ymd, end_ymd)
    return fetch_open_fund_window(code, start_ymd, end_ymd)


def _cached_df(key: str, loader) -> Any:
    now = time.time()
    entry = _DF_CACHE.get(key)
    if entry is not None:
        df, ts = entry
        if now - ts < _DF_CACHE_TTL_SEC:
            return df
    df = loader()
    _DF_CACHE[key] = (df, now)
    return df


def _search_rows(
    df: pd.DataFrame,
    code_col: str,
    name_col: str,
    market: str,
    currency: str,
    q: str,
    limit: int = 8,
) -> list[dict[str, Any]]:
    q_stripped = q.strip()
    if not q_stripped:
        return []
    q_lower = q_stripped.lower()
    mask = df[code_col].astype(str).str.contains(q_stripped, case=False, na=False) | df[
        name_col
    ].astype(str).str.contains(q_stripped, case=False, na=False)
    if q_lower != q_stripped:
        mask = mask | df[name_col].astype(str).str.contains(q_lower, case=False, na=False)
    rows = df[mask].head(limit)
    out: list[dict[str, Any]] = []
    for _, row in rows.iterrows():
        code = str(row[code_col]).strip()
        name = str(row[name_col]).strip()
        if market == "HK":
            code = code.zfill(5)
        elif market in ("CN", "FUND"):
            code = code.zfill(6)
        out.append(
            {
                "assetId": f"{market}:{code}",
                "symbol": code,
                "name": name,
                "market": market,
                "currency": currency,
            }
        )
    return out


def fetch_search(market: str, q: str) -> list[dict[str, Any]]:
    m = market.upper()
    if m == "CN":
        df = _cached_df("cn_spot", ak.stock_zh_a_spot_em)
        return _search_rows(df, "代码", "名称", "CN", "CNY", q)
    if m == "HK":
        df = _cached_df("hk_spot", ak.stock_hk_spot_em)
        return _search_rows(df, "代码", "名称", "HK", "HKD", q)
    if m == "FUND":
        df = _cached_df("fund_names", ak.fund_name_em)
        return _search_rows(df, "基金代码", "基金简称", "FUND", "CNY", q)
    raise ValueError(f"unsupported market: {market}")


def fetch_quotes_window(
    market: str, symbol: str, from_iso: str, to_iso: str
) -> list[dict[str, Any]]:
    m = market.upper()
    start = _iso_to_ymd(from_iso)
    end = _iso_to_ymd(to_iso)
    if m == "CN":
        return fetch_cn_window(symbol, start, end)
    if m == "HK":
        return fetch_hk_window(symbol, start, end)
    if m == "FUND":
        return fetch_fund_window(symbol, start, end)
    raise ValueError(f"unsupported market: {market}")
