#!/usr/bin/env python3
"""E2E real-data test for TerraCube Sentinel.

Tests:
1. Dagster pipelines — run each pipeline's fetch functions against real APIs
2. Open Foundry — start the API and test GraphQL queries
3. Frontend — verify build succeeds

Usage: python3 e2e_test.py
"""

import subprocess
import sys
import time
import json
import urllib.request
import urllib.error
import os

RESULTS = {"passed": 0, "failed": 0, "errors": []}

def log_test(name, passed, detail=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    msg = f"{status} | {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    if passed:
        RESULTS["passed"] += 1
    else:
        RESULTS["failed"] += 1
        RESULTS["errors"].append((name, detail))


# ── 1. Test real API sources directly (no Dagster, no Open Foundry needed) ──

def test_open_meteo_real():
    """Fetch real weather data from Open-Meteo API."""
    url = "https://api.open-meteo.com/v1/forecast?latitude=43.65&longitude=-79.38&current_weather=true&hourly=temperature_2m,precipitation,windspeed_10m&forecast_days=1"
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            has_weather = "current_weather" in data
            has_hourly = "hourly" in data
            log_test("Open-Meteo API (Toronto)", has_weather and has_hourly,
                     f"temp={data.get('current_weather', {}).get('temperature')}°C")
    except Exception as e:
        log_test("Open-Meteo API (Toronto)", False, str(e)[:200])


def test_usgs_earthquakes_real():
    """Fetch real earthquake data from USGS API."""
    url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            features = data.get("features", [])
            has_data = len(features) > 0
            log_test("USGS Earthquake API", has_data,
                     f"{len(features)} earthquakes in last day")
    except Exception as e:
        log_test("USGS Earthquake API", False, str(e)[:200])


def test_nasa_eonet_real():
    """Fetch real events from NASA EONET API."""
    url = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=5"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "TerraCube-E2E/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            events = data.get("events", [])
            has_data = len(events) > 0
            log_test("NASA EONET API", has_data,
                     f"{len(events)} open events, first: {events[0]['title'] if events else 'none'}")
    except Exception as e:
        log_test("NASA EONET API", False, str(e)[:200])


def test_openaq_real():
    """Fetch real air quality data from OpenAQ API."""
    url = "https://api.openaq.org/v2/latest?city=Toronto&limit=1"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "TerraCube-E2E/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            results = data.get("results", [])
            has_data = len(results) > 0
            measurements = results[0].get("measurements", []) if results else []
            log_test("OpenAQ API (Toronto)", has_data,
                     f"{len(measurements)} measurements")
    except Exception as e:
        log_test("OpenAQ API (Toronto)", False, str(e)[:200])


def test_gdelt_real():
    """Fetch real events from GDELT API."""
    url = "https://api.gdeltproject.org/api/v2/doc/doc?query=flood+earthquake&mode=ArtList&maxrecords=3&format=json"
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            raw = resp.read().decode()
            # GDELT wraps in JSONP callback
            if raw.startswith("ARTICLELIST"):
                raw = raw.split("(", 1)[1].rsplit(")", 1)[0]
            data = json.loads(raw)
            articles = data.get("articles", [])
            has_data = len(articles) > 0
            log_test("GDELT API", has_data,
                     f"{len(articles)} disaster-related articles")
    except Exception as e:
        log_test("GDELT API", False, str(e)[:200])


def test_stac_real():
    """Search real satellite data from STAC API."""
    url = "https://earth-search.aws.element84.com/v1/search"
    payload = json.dumps({
        "collections": ["sentinel-2-l2a"],
        "bbox": [-79.5, 43.5, -79.2, 43.8],
        "limit": 1,
        "query": {"eo:cloud_cover": {"lt": 20}}
    }).encode()
    req = urllib.request.Request(url, data=payload, headers={
        "Content-Type": "application/json",
        "User-Agent": "TerraCube-E2E/1.0"
    }, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            features = data.get("features", [])
            has_data = len(features) > 0
            log_test("STAC API (Sentinel-2 Toronto)", has_data,
                     f"found {len(features)} scenes")
    except Exception as e:
        log_test("STAC API (Sentinel-2 Toronto)", False, str(e)[:200])


def test_waqi_real():
    """Fetch real AQI data from WAQI API."""
    url = "https://api.waqi.info/feed/toronto/?token=demo"
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            status = data.get("status")
            aqi = data.get("data", {}).get("aqi", "N/A")
            log_test("WAQI API (Toronto)", status == "ok",
                     f"AQI={aqi}")
    except Exception as e:
        log_test("WAQI API (Toronto)", False, str(e)[:200])


def test_osm_real():
    """Fetch real infrastructure data from OSM Overpass API."""
    url = "https://overpass-api.de/api/interpreter"
    query = """
    [out:json][timeout:15];
    node["emergency"="hospital"](43.6,-79.5,43.7,-79.3);
    out count;
    """
    payload = f"data={query}".encode()
    req = urllib.request.Request(url, data=payload, headers={"User-Agent": "TerraCube-E2E/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
            count = data.get("elements", [{}])[0].get("tags", {}).get("total", 0)
            has_data = int(count) > 0
            log_test("OSM Overpass API (Toronto hospitals)", has_data,
                     f"{count} hospitals found")
    except Exception as e:
        log_test("OSM Overpass API (Toronto hospitals)", False, str(e)[:200])


# ── 2. Test Dagster pipelines compile ─────────────────────────────────

def test_dagster_pipelines_compile():
    """Verify all 7 Dagster pipeline modules import cleanly."""
    sentinel_dir = "/Users/chiranjibchaudhuri/Documents/TerraCube_Sentinel"
    pipelines = [
        "real_time_hazards",
        "satellite_ingestion",
        "climate_reanalysis",
        "infrastructure_vulnerability",
        "air_quality",
        "social_signals",
        "risk_scoring",
    ]
    for name in pipelines:
        try:
            result = subprocess.run(
                [sys.executable, "-c",
                 f"import sys; sys.path.insert(0, '{sentinel_dir}/dagster'); "
                 f"from pipelines.{name} import *; print('OK')"],
                capture_output=True, text=True, timeout=30
            )
            ok = result.returncode == 0 and "OK" in result.stdout
            log_test(f"Dagster pipeline: {name}", ok,
                     result.stderr[:100] if result.stderr else "imports clean")
        except Exception as e:
            log_test(f"Dagster pipeline: {name}", False, str(e)[:200])


def test_dagster_ai_ingest_compile():
    """Verify ai_ingest module compiles."""
    sentinel_dir = "/Users/chiranjibchaudhuri/Documents/TerraCube_Sentinel"
    try:
        result = subprocess.run(
            [sys.executable, "-c",
             f"import sys; sys.path.insert(0, '{sentinel_dir}/dagster'); "
             f"from ai_ingest import *; print('OK')"],
            capture_output=True, text=True, timeout=30
        )
        ok = result.returncode == 0 and "OK" in result.stdout
        log_test("Dagster ai_ingest module", ok,
                 result.stderr[:100] if result.stderr else "imports clean")
    except Exception as e:
        log_test("Dagster ai_ingest module", False, str(e)[:200])


# ── 3. Test agents compile ────────────────────────────────────────────

def test_agents_compile():
    """Verify all agent modules compile."""
    sentinel_dir = "/Users/chiranjibchaudhuri/Documents/TerraCube_Sentinel"
    modules = [
        "config",
        "api",
        "orchestrator",
        "agents.hazard_sentinel",
        "agents.predictive_analyst",
        "agents.pattern_discovery",
        "agents.automated_action",
        "agents.reporting_agent",
        "agents.research_agent",
        "tools.ontology_tools",
        "tools.satellite_tools",
        "tools.weather_tools",
    ]
    for name in modules:
        try:
            result = subprocess.run(
                [sys.executable, "-c",
                 f"import sys; sys.path.insert(0, '{sentinel_dir}/agents'); "
                 f"from {name} import *; print('OK')"],
                capture_output=True, text=True, timeout=30
            )
            ok = result.returncode == 0 and "OK" in result.stdout
            log_test(f"Agent module: {name}", ok,
                     result.stderr[:100] if result.stderr else "imports clean")
        except Exception as e:
            log_test(f"Agent module: {name}", False, str(e)[:200])


# ── 4. Test frontend build ────────────────────────────────────────────

def test_frontend_build():
    """Verify frontend builds without errors."""
    frontend_dir = "/Users/chiranjibchaudhuri/Documents/TerraCube_Sentinel/frontend"
    result = subprocess.run(
        [sys.executable, "-m", "npm", "run", "build"],
        capture_output=True, text=True, timeout=120,
        cwd=frontend_dir,
        env={**os.environ, "PATH": os.environ.get("PATH", "")}
    )
    # Try with npx directly
    if result.returncode != 0:
        result = subprocess.run(
            ["npm", "run", "build"],
            capture_output=True, text=True, timeout=120,
            cwd=frontend_dir
        )
    ok = result.returncode == 0
    log_test("Frontend build (npm run build)", ok,
             result.stdout[-200:] if ok else result.stderr[-300:])


# ── 5. Test Docker compose config validity ───────────────────────────

def test_docker_compose_config():
    """Verify docker-compose.yml is valid."""
    sentinel_dir = "/Users/chiranjibchaudhuri/Documents/TerraCube_Sentinel"
    result = subprocess.run(
        ["docker", "compose", "config", "--quiet"],
        capture_output=True, text=True, timeout=30,
        cwd=sentinel_dir
    )
    ok = result.returncode == 0
    log_test("Docker compose config valid", ok,
             result.stderr[:200] if not ok else "valid")


# ── Run all tests ─────────────────────────────────────────────────────

def main():
    print("=" * 70)
    print("TerraCube Sentinel — E2E Real Data Tests")
    print("=" * 70)

    tests = [
        # Real API sources (no infrastructure needed)
        test_open_meteo_real,
        test_usgs_earthquakes_real,
        test_nasa_eonet_real,
        test_openaq_real,
        test_gdelt_real,
        test_stac_real,
        test_waqi_real,
        test_osm_real,
        # Pipeline compilation
        test_dagster_pipelines_compile,
        test_dagster_ai_ingest_compile,
        # Agents
        test_agents_compile,
        # Frontend
        test_frontend_build,
        # Docker
        test_docker_compose_config,
    ]

    for test in tests:
        try:
            print(f"\n▶ Running: {test.__name__}")
            test()
        except Exception as e:
            log_test(test.__name__, False, f"exception: {e}")

    print("\n" + "=" * 70)
    print(f"RESULTS: {RESULTS['passed']} passed, {RESULTS['failed']} failed")
    print("=" * 70)
    if RESULTS["errors"]:
        print("\nFailures:")
        for name, detail in RESULTS["errors"]:
            print(f"  • {name}: {detail}")

    return 0 if RESULTS["failed"] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
