#!/usr/bin/env python3
"""Corrected E2E real-data test for TerraCube Sentinel."""

import subprocess, sys, json, urllib.request, urllib.error, os

RESULTS = {"passed": 0, "failed": 0, "errors": []}

def log(name, passed, detail=""):
    s = "✅" if passed else "❌"
    print(f"{s} {name}" + (f" — {detail}" if detail else ""))
    if passed: RESULTS["passed"] += 1
    else: RESULTS["failed"] += 1
    if not passed: RESULTS["errors"].append((name, detail))

SENTINEL = "/Users/chiranjibchaudhuri/Documents/TerraCube_Sentinel"

print("=" * 60)
print("TerraCube Sentinel — E2E Real Data Tests (Corrected)")
print("=" * 60)

# ── 1. Real API sources ──

def test_api(name, url, validator, headers=None, timeout=30, method="GET", body=None):
    try:
        hdrs = headers or {"User-Agent": "TerraCube-E2E/1.0"}
        data = json.dumps(body).encode() if body else None
        if data: hdrs["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            resp = json.loads(r.read())
            ok = validator(resp)
            log(name, ok, detail=ok.__doc__ if callable(validator) and ok.__doc__ else str(resp)[:150])
    except Exception as e:
        log(name, False, str(e)[:150])

test_api("Open-Meteo (Toronto)", "https://api.open-meteo.com/v1/forecast?latitude=43.65&longitude=-79.38&current_weather=true",
    lambda d: "current_weather" in d)

test_api("USGS Earthquakes", "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
    lambda d: len(d.get("features", [])) > 0)

test_api("NASA EONET", "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=5",
    lambda d: len(d.get("events", [])) > 0)

# OpenAQ v3 (v2 is deprecated)
test_api("OpenAQ v3 (Toronto)", "https://api.openaq.org/v3/locations?coordinates=43.65,-79.38&limit=1",
    lambda d: len(d.get("results", [])) > 0)

test_api("STAC (Sentinel-2 Toronto)", "https://earth-search.aws.element84.com/v1/search",
    lambda d: len(d.get("features", [])) > 0,
    body={"collections": ["sentinel-2-l2a"], "bbox": [-79.5, 43.5, -79.2, 43.8], "limit": 1, "query": {"eo:cloud_cover": {"lt": 20}}},
    method="POST")

test_api("WAQI (Toronto)", "https://api.waqi.info/feed/toronto/?token=demo",
    lambda d: d.get("status") == "ok")

# GDELT with retry-proof smaller query
test_api("GDELT Events", "https://api.gdeltproject.org/api/v2/doc/doc?query=earthquake&mode=ArtList&maxrecords=2&format=json",
    lambda d: True,  # just verify it responds
    timeout=20)

test_api("OSM Overpass (Toronto hospitals)", "https://overpass-api.de/api/interpreter",
    lambda d: True,  # just verify it responds
    body=None, method="GET")  # using GET with query string instead
# Actually let's use a proper POST
def test_osm():
    url = "https://overpass-api.de/api/interpreter"
    query = '[out:json][timeout:15];node["emergency"="hospital"](43.55,-79.6,43.75,-79.25);out count;'
    try:
        data = f"data={query}".encode()
        req = urllib.request.Request(url, data=data, headers={"User-Agent": "TerraCube-E2E/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            d = json.loads(r.read())
            total = d.get("elements", [{}])[0].get("tags", {}).get("total", 0)
            log("OSM Overpass (Toronto hospitals)", int(total) > 0, f"{total} hospitals")
    except Exception as e:
        log("OSM Overpass (Toronto hospitals)", False, str(e)[:150])
test_osm()

# ── 2. Dagster pipelines — compile with dagster package check ──
for name in ["real_time_hazards", "satellite_ingestion", "climate_reanalysis", "infrastructure_vulnerability", "air_quality", "social_signals", "risk_scoring"]:
    try:
        r = subprocess.run([sys.executable, "-c",
            f"import sys; sys.path.insert(0, '{SENTINEL}/dagster', '{SENTINEL}/dagster/pipelines'); "
            f"from {name} import *; print('OK')"],
            capture_output=True, text=True, timeout=30)
        ok = r.returncode == 0 and "OK" in r.stdout
        log(f"Dagster: {name}", ok, r.stderr[:100] if r.stderr else "clean")
    except Exception as e:
        log(f"Dagster: {name}", False, str(e)[:150])

# ai_ingest
try:
    r = subprocess.run([sys.executable, "-c",
        f"import sys; sys.path.insert(0, '{SENTINEL}/dagster'); from ai_ingest import *; print('OK')"],
        capture_output=True, text=True, timeout=30)
    log("Dagster: ai_ingest", r.returncode == 0 and "OK" in r.stdout, r.stderr[:100] if r.stderr else "clean")
except Exception as e:
    log("Dagster: ai_ingest", False, str(e)[:150])

# ── 3. Agents ──
for mod in ["config", "api", "orchestrator", "agents.hazard_sentinel", "agents.predictive_analyst",
            "agents.pattern_discovery", "agents.automated_action", "agents.reporting_agent",
            "agents.research_agent", "tools.ontology_tools", "tools.satellite_tools", "tools.weather_tools"]:
    try:
        r = subprocess.run([sys.executable, "-c",
            f"import sys; sys.path.insert(0, '{SENTINEL}/agents'); from {mod} import *; print('OK')"],
            capture_output=True, text=True, timeout=30)
        ok = r.returncode == 0 and "OK" in r.stdout
        log(f"Agent: {mod}", ok, r.stderr[:100] if r.stderr else "clean")
    except Exception as e:
        log(f"Agent: {mod}", False, str(e)[:150])

# ── 4. Frontend build ──
r = subprocess.run(["npm", "run", "build"], capture_output=True, text=True, timeout=120, cwd=f"{SENTINEL}/frontend")
log("Frontend build", r.returncode == 0, r.stdout[-200:].strip() if r.returncode == 0 else r.stderr[-200:].strip())

# ── 5. Docker compose config ──
r = subprocess.run(["docker", "compose", "config", "--quiet"], capture_output=True, text=True, timeout=30, cwd=SENTINEL)
log("Docker compose config", r.returncode == 0, r.stderr[:150] if r.stderr else "valid")

print(f"\n{'=' * 60}")
print(f"RESULTS: {RESULTS['passed']} passed, {RESULTS['failed']} failed")
print("=" * 60)
if RESULTS["errors"]:
    print("\nFailures:")
    for n, d in RESULTS["errors"]: print(f"  • {n}: {d[:200]}")
sys.exit(0 if RESULTS["failed"] == 0 else 1)
