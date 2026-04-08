"""
Demographic/socio-economic data adapter.
World Bank API, ACLED armed conflict, UNHCR displacement data.
"""

from dagster.sources.base_adapter import BaseAdapter, GeoJSONFeature
import httpx
import logging

logger = logging.getLogger(__name__)

WORLD_BANK_URL = "https://api.worldbank.org/v2"
ACLED_API_URL = "https://api.acleddata.com/acled/read"

# World Bank indicator codes
WB_INDICATORS = {
    "NY.GDP.PCAP.CD": "GDP",
    "SP.POP.TOTL": "POPULATION",
    "SL.UEM.TOTL.ZS": "UNEMPLOYMENT",
    "SI.POV.GINI": "GINI",
}

# Country centroids for geolocation
COUNTRY_COORDS: dict[str, list[float]] = {
    "US": [-98.6, 39.8], "GB": [-1.2, 52.2], "JP": [138.3, 36.2],
    "DE": [10.4, 51.2], "FR": [2.2, 46.2], "IN": [78.9, 20.6],
    "CN": [104.2, 35.9], "BR": [-51.9, -14.2], "AU": [133.8, -25.3],
    "RU": [105.3, 61.5], "ZA": [22.9, -30.6], "NG": [8.7, 9.1],
    "EG": [30.8, 26.8], "MX": [-102.6, 23.6], "ID": [113.9, -0.8],
    "TR": [35.2, 38.9], "SA": [45.1, 23.9], "KR": [127.8, 35.9],
    "PK": [69.3, 30.4], "BD": [90.4, 23.7], "ET": [40.5, 9.1],
    "CD": [21.8, -4.0], "UA": [31.2, 48.4], "SY": [38.0, 34.8],
    "YE": [48.5, 15.6], "AF": [67.7, 33.9], "MM": [96.0, 21.9],
    "SD": [30.2, 12.9], "SO": [46.2, 5.2], "IQ": [43.7, 33.2],
    "LY": [17.2, 26.3],
}


class DemographicAdapter(BaseAdapter):
    source_name = "demographic"
    entity_type = "Region"

    def get_ttl(self) -> int:
        return 86400  # Daily refresh

    def _health_url(self) -> str:
        return f"{WORLD_BANK_URL}/country/US/indicator/NY.GDP.PCAP.CD?format=json&per_page=1"

    def fetch(self, countries: list[str] | None = None, **kwargs) -> list[dict]:
        """Fetch socio-economic indicators from World Bank API."""
        client = self._get_client(timeout=30.0)
        target = ";".join(countries) if countries else "US;GB;JP;DE;FR;IN;CN;BR;AU;RU;ZA;NG;EG;MX;ID"
        records = []
        for indicator_code, indicator_name in WB_INDICATORS.items():
            try:
                resp = client.get(
                    f"{WORLD_BANK_URL}/country/{target}/indicator/{indicator_code}",
                    params={"format": "json", "per_page": 100, "mrv": 1},
                )
                resp.raise_for_status()
                data = resp.json()
                if len(data) > 1 and data[1]:
                    for entry in data[1]:
                        if entry.get("value") is not None:
                            records.append({
                                "country_code": entry.get("country", {}).get("id", ""),
                                "country_name": entry.get("country", {}).get("value", ""),
                                "indicator": indicator_name,
                                "indicator_code": indicator_code,
                                "value": entry["value"],
                                "year": entry.get("date", ""),
                            })
            except Exception as e:
                logger.warning("World Bank fetch for %s failed: %s", indicator_code, e)
        return records

    def normalize(self, raw_records: list[dict]) -> list[GeoJSONFeature]:
        features = []
        for rec in raw_records:
            cc = rec.get("country_code", "")
            coords = COUNTRY_COORDS.get(cc, [0, 0])
            features.append(GeoJSONFeature(
                geometry={"type": "Point", "coordinates": coords},
                properties={
                    "entityType": "FinancialIndicator",
                    "indicatorType": rec.get("indicator", ""),
                    "value": rec.get("value"),
                    "countryCode": cc,
                    "countryName": rec.get("country_name", ""),
                    "year": rec.get("year", ""),
                    "indicatorCode": rec.get("indicator_code", ""),
                    "source": "world_bank",
                },
            ))
        return features
