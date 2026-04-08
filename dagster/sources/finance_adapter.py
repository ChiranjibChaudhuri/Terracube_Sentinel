"""
Financial market data adapter.
Fetches stock indices, commodities, and crypto from Yahoo Finance API.
"""

from dagster.sources.base_adapter import BaseAdapter, GeoJSONFeature
import httpx
import logging

logger = logging.getLogger(__name__)

# Yahoo Finance API (free, no key needed)
YAHOO_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote"

# Top global indices and commodities
SYMBOLS = {
    # Stock Indices
    "^GSPC": {"name": "S&P 500", "type": "STOCK_INDEX", "region": "US", "coords": [-74.0, 40.7]},
    "^FTSE": {"name": "FTSE 100", "type": "STOCK_INDEX", "region": "UK", "coords": [-0.1, 51.5]},
    "^N225": {"name": "Nikkei 225", "type": "STOCK_INDEX", "region": "JP", "coords": [139.7, 35.7]},
    "^GDAXI": {"name": "DAX", "type": "STOCK_INDEX", "region": "DE", "coords": [8.7, 50.1]},
    "^BSESN": {"name": "BSE Sensex", "type": "STOCK_INDEX", "region": "IN", "coords": [72.9, 19.1]},
    "^HSI": {"name": "Hang Seng", "type": "STOCK_INDEX", "region": "HK", "coords": [114.2, 22.3]},
    "^AXJO": {"name": "ASX 200", "type": "STOCK_INDEX", "region": "AU", "coords": [151.2, -33.9]},
    "^BVSP": {"name": "Bovespa", "type": "STOCK_INDEX", "region": "BR", "coords": [-46.6, -23.5]},
    # Commodities
    "CL=F": {"name": "Crude Oil", "type": "COMMODITY", "region": "GLOBAL", "coords": [-95.4, 29.8]},
    "NG=F": {"name": "Natural Gas", "type": "COMMODITY", "region": "GLOBAL", "coords": [-95.4, 29.8]},
    "GC=F": {"name": "Gold", "type": "COMMODITY", "region": "GLOBAL", "coords": [-74.0, 40.7]},
    "ZW=F": {"name": "Wheat", "type": "COMMODITY", "region": "GLOBAL", "coords": [-87.6, 41.9]},
    "HG=F": {"name": "Copper", "type": "COMMODITY", "region": "GLOBAL", "coords": [-74.0, 40.7]},
    # Crypto
    "BTC-USD": {"name": "Bitcoin", "type": "CRYPTO", "region": "GLOBAL", "coords": [0, 0]},
    "ETH-USD": {"name": "Ethereum", "type": "CRYPTO", "region": "GLOBAL", "coords": [0, 0]},
}


class FinanceAdapter(BaseAdapter):
    source_name = "finance"
    entity_type = "FinancialIndicator"

    def get_ttl(self) -> int:
        return 600

    def _health_url(self) -> str:
        return "https://query1.finance.yahoo.com"

    def fetch(self, symbols: list[str] | None = None, **kwargs) -> list[dict]:
        """Fetch quotes from Yahoo Finance."""
        target_symbols = symbols or list(SYMBOLS.keys())
        client = self._get_client(timeout=30.0)
        try:
            resp = client.get(YAHOO_QUOTE_URL, params={
                "symbols": ",".join(target_symbols),
                "fields": "regularMarketPrice,regularMarketChange,regularMarketChangePercent,"
                          "regularMarketPreviousClose,currency,shortName",
            })
            resp.raise_for_status()
            data = resp.json()
            return data.get("quoteResponse", {}).get("result", [])
        except Exception as e:
            logger.warning("Yahoo Finance fetch failed: %s — using synthetic data", e)
            return self._synthetic_data(target_symbols)

    def _synthetic_data(self, symbols: list[str]) -> list[dict]:
        """Synthetic data for development/demo."""
        import random
        results = []
        prices = {
            "^GSPC": 5200, "^FTSE": 8100, "^N225": 38000, "^GDAXI": 18500,
            "^BSESN": 74000, "^HSI": 17500, "^AXJO": 7800, "^BVSP": 128000,
            "CL=F": 78, "NG=F": 2.3, "GC=F": 2350, "ZW=F": 580, "HG=F": 4.1,
            "BTC-USD": 67000, "ETH-USD": 3500,
        }
        for sym in symbols:
            base = prices.get(sym, 100)
            change_pct = random.uniform(-3, 3)
            results.append({
                "symbol": sym,
                "regularMarketPrice": base * (1 + change_pct / 100),
                "regularMarketChange": base * change_pct / 100,
                "regularMarketChangePercent": change_pct,
                "regularMarketPreviousClose": base,
                "currency": "USD",
                "shortName": SYMBOLS.get(sym, {}).get("name", sym),
            })
        return results

    def normalize(self, raw_records: list[dict]) -> list[GeoJSONFeature]:
        features = []
        for quote in raw_records:
            symbol = quote.get("symbol", "")
            meta = SYMBOLS.get(symbol, {"name": symbol, "type": "STOCK_INDEX", "region": "GLOBAL", "coords": [0, 0]})
            features.append(GeoJSONFeature(
                geometry={"type": "Point", "coordinates": meta["coords"]},
                properties={
                    "entityType": "FinancialIndicator",
                    "symbol": symbol,
                    "name": meta["name"],
                    "indicatorType": meta["type"],
                    "value": quote.get("regularMarketPrice"),
                    "changePct": quote.get("regularMarketChangePercent"),
                    "change": quote.get("regularMarketChange"),
                    "previousClose": quote.get("regularMarketPreviousClose"),
                    "currency": quote.get("currency", "USD"),
                    "region": meta["region"],
                    "source": "yahoo_finance",
                },
            ))
        return features
