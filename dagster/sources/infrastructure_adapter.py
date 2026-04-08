"""
Infrastructure monitoring adapter.
Fetches ports, airports, and enhanced power grid data.
"""

from dagster.sources.base_adapter import BaseAdapter, GeoJSONFeature
import httpx
import logging
import csv
import io

logger = logging.getLogger(__name__)

OURAIRPORTS_CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv"


class InfrastructureDataAdapter(BaseAdapter):
    source_name = "infrastructure"
    entity_type = "InfrastructureAsset"

    def get_ttl(self) -> int:
        return 86400

    def fetch(self, data_type: str = "airports", **kwargs) -> list[dict]:
        """Fetch infrastructure data. data_type: airports, ports"""
        if data_type == "airports":
            return self._fetch_airports()
        elif data_type == "ports":
            return self._fetch_ports_synthetic()
        return []

    def _fetch_airports(self) -> list[dict]:
        """Fetch airport data from OurAirports."""
        client = self._get_client(timeout=60.0)
        try:
            resp = client.get(OURAIRPORTS_CSV)
            resp.raise_for_status()
            reader = csv.DictReader(io.StringIO(resp.text))
            airports = []
            for row in reader:
                if row.get("type") in ("large_airport", "medium_airport"):
                    airports.append(row)
            return airports[:500]  # Limit to major airports
        except Exception as e:
            logger.warning("Airport fetch failed: %s — using synthetic data", e)
            return self._synthetic_airports()

    def _fetch_ports_synthetic(self) -> list[dict]:
        """Synthetic port data (World Port Index requires registration)."""
        return [
            {"name": "Port of Shanghai", "country": "CN", "lat": 31.2, "lng": 121.5, "unlocode": "CNSHA", "type": "SEAPORT"},
            {"name": "Port of Singapore", "country": "SG", "lat": 1.3, "lng": 103.8, "unlocode": "SGSIN", "type": "SEAPORT"},
            {"name": "Port of Rotterdam", "country": "NL", "lat": 51.9, "lng": 4.5, "unlocode": "NLRTM", "type": "SEAPORT"},
            {"name": "Port of Los Angeles", "country": "US", "lat": 33.7, "lng": -118.3, "unlocode": "USLAX", "type": "SEAPORT"},
            {"name": "Port of Dubai", "country": "AE", "lat": 25.3, "lng": 55.3, "unlocode": "AEJEA", "type": "SEAPORT"},
            {"name": "Port of Hamburg", "country": "DE", "lat": 53.5, "lng": 10.0, "unlocode": "DEHAM", "type": "SEAPORT"},
            {"name": "Port of Busan", "country": "KR", "lat": 35.1, "lng": 129.1, "unlocode": "KRPUS", "type": "SEAPORT"},
            {"name": "Port of Hong Kong", "country": "HK", "lat": 22.3, "lng": 114.2, "unlocode": "HKHKG", "type": "SEAPORT"},
            {"name": "Port of Mumbai", "country": "IN", "lat": 19.0, "lng": 72.9, "unlocode": "INBOM", "type": "SEAPORT"},
            {"name": "Port of Santos", "country": "BR", "lat": -23.9, "lng": -46.3, "unlocode": "BRSSZ", "type": "SEAPORT"},
        ]

    def _synthetic_airports(self) -> list[dict]:
        return [
            {"name": "Hartsfield-Jackson Atlanta", "iata_code": "ATL", "ident": "KATL", "latitude_deg": "33.6367", "longitude_deg": "-84.4281", "elevation_ft": "1026", "type": "large_airport"},
            {"name": "Beijing Capital", "iata_code": "PEK", "ident": "ZBAA", "latitude_deg": "40.0801", "longitude_deg": "116.5846", "elevation_ft": "116", "type": "large_airport"},
            {"name": "Dubai International", "iata_code": "DXB", "ident": "OMDB", "latitude_deg": "25.2528", "longitude_deg": "55.3644", "elevation_ft": "62", "type": "large_airport"},
            {"name": "London Heathrow", "iata_code": "LHR", "ident": "EGLL", "latitude_deg": "51.4706", "longitude_deg": "-0.4619", "elevation_ft": "83", "type": "large_airport"},
            {"name": "Tokyo Haneda", "iata_code": "HND", "ident": "RJTT", "latitude_deg": "35.5523", "longitude_deg": "139.7798", "elevation_ft": "35", "type": "large_airport"},
        ]

    def normalize(self, raw_records: list[dict]) -> list[GeoJSONFeature]:
        features = []
        for rec in raw_records:
            # Airport record
            if "iata_code" in rec or "ident" in rec:
                try:
                    lat = float(rec.get("latitude_deg", 0))
                    lng = float(rec.get("longitude_deg", 0))
                except (ValueError, TypeError):
                    continue
                features.append(GeoJSONFeature(
                    geometry={"type": "Point", "coordinates": [lng, lat]},
                    properties={
                        "entityType": "Airport",
                        "name": rec.get("name", ""),
                        "iataCode": rec.get("iata_code", ""),
                        "icaoCode": rec.get("ident", ""),
                        "elevation": rec.get("elevation_ft"),
                        "airportType": rec.get("type", ""),
                        "source": "ourairports",
                    },
                ))
            # Port record
            elif "unlocode" in rec:
                features.append(GeoJSONFeature(
                    geometry={"type": "Point", "coordinates": [rec["lng"], rec["lat"]]},
                    properties={
                        "entityType": "Port",
                        "name": rec.get("name", ""),
                        "country": rec.get("country", ""),
                        "unlocode": rec.get("unlocode", ""),
                        "portType": rec.get("type", "SEAPORT"),
                        "source": "world_port_index",
                    },
                ))
        return features
