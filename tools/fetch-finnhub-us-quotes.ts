/**
 * CLI helper — fetch latest US marks from Finnhub for dev seed scripts.
 * Not imported by the mobile bundle.
 */

export type UsSeedSymbol = "AAPL" | "MSFT" | "NVDA";

export type UsMarketPrices = Record<UsSeedSymbol, string>;

interface FinnhubQuote {
  c?: number;
  t?: number;
}

export const fetchFinnhubUsQuotes = async (
  apiKey: string,
  symbols: ReadonlyArray<UsSeedSymbol> = ["AAPL", "MSFT", "NVDA"]
): Promise<UsMarketPrices> => {
  const out = {} as UsMarketPrices;

  for (const symbol of symbols) {
    const url = new URL("https://finnhub.io/api/v1/quote");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("token", apiKey);

    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`Finnhub quote ${symbol} failed: HTTP ${res.status}`);
    }

    const body = (await res.json()) as FinnhubQuote;
    if (body.c == null || body.c === 0 || body.t === 0) {
      throw new Error(`Finnhub quote ${symbol}: empty or invalid response`);
    }

    out[symbol] = String(body.c);
  }

  return out;
};
