# TerraCube Sentinel — Comprehensive Enhancement Plan

## Objective
Enhance Sentinel from an Earth Observation pipeline into a full-spectrum open-source intelligence platform that rivals World Monitor, OSINT-MONITOR, OSINT Geospatial Intel, ShadowBroker, and GeoFinance — but with ontology-native architecture that none of them have.

## Research: Top 6 Comparable Projects Analyzed

### 1. World Monitor (koala73/worldmonitor) — WIRED-featured, 65+ data sources
- 435+ news feeds across 15 categories, AI-synthesized briefs
- Dual map: 3D globe (globe.gl) + flat WebGL (deck.gl + MapLibre)
- Country Intelligence Index: composite risk across 12 signal categories
- Finance radar: 92 stock exchanges, commodities, crypto, 7-signal market composite
- Tauri desktop app, 21 languages, 5 site variants

### 2. OSINT-MONITOR (BreaGG) — Intelligence-grade event processing
- Global Stability Engine (GSE): Σ(Regional_Pressure × Category_Weight × Recency_Factor × Confidence_Score)
- 5-tier threat assessment: STABLE → ELEVATED → HEIGHTENED → CRITICAL
- Cross-domain operation detection, geographic clustering, temporal acceleration
- Automated PDF briefing generation
- Pattern recognition: domain spillover, historical comparison

### 3. OSINT Geospatial Intel (NickCarreiro) — Clean data fusion
- Unified GeoJSON API normalizing 10+ source types
- Redis caching with per-entity TTL (aircraft 120s, vessels 900s, fires 24h)
- OpenSky aircraft, AIS vessels, NASA FIRMS fires, CelesTrak satellites, power grids, oil rigs
- Graceful degradation when sources fail

### 4. ShadowBroker (GitLab) — 60+ feeds, dark-ops UI
- Aircraft, ships, satellites, conflict zones, CCTV, GPS jamming, mesh radio, police scanners
- WebSocket + REST aggregation

### 5. GeoFinance Intel Platform — Spatial DNA of finance
- H3 hexagonal grid + XGBoost for credit risk
- 50+ spatial features per location, sub-500ms scoring
- SHAP explainability

### 6. d.AP / OpenFoundry — Ontology-native knowledge graphs
- RDF/OWL semantic layer, Cytoscape.js graph exploration

## Enhancement Tasks

### TASK 1: Real-Time Data Fusion Layer (from OSINT-GEO + ShadowBroker)

Create a unified data fusion engine that ingests, normalizes, caches, and serves multiple real-time data streams through a single GeoJSON API.

**New files:**
- `dagster/sources/` directory with adapters for each source
- `dagster/sources/opensky_adapter.py` — ADS-B flight tracking (OpenSky Network REST API)
  - Fetch aircraft state vectors: lat, lng, altitude, heading, velocity, callsign, icao24
  - Normalize to standard Aircraft entity in the ontology
  - TTL: 120 seconds
- `dagster/sources/ais_adapter.py` — AIS vessel tracking (AISStream WebSocket or public AIS feeds)
  - Fetch vessel positions: lat, lng, speed, course, ship_type, MMSI, name
  - Normalize to Vessel entity (add to ontology schema)
  - TTL: 900 seconds
- `dagster/sources/firms_adapter.py` — NASA FIRMS fire detection (already partially exists, enhance)
  - Add confidence scoring, fire radiative power tracking
  - Historical fire perimeter comparison
- `dagster/sources/celes trak_adapter.py` — Satellite orbital tracking (CelesTrak TLE)
  - Parse TLE data, propagate orbits with skyfield
  - Track satellite passes over regions of interest
  - Normalize to SatellitePass entity (already in ontology)
- `dagster/sources/eq_adapter.py` — Enhanced earthquake monitoring (USGS)
  - Add ShakeMap intensity contours where available
  - Tsunami alert integration
  - Aftershock sequence tracking
- `dagster/sources/weather_adapter.py` — Multi-source weather fusion
  - Open-Meteo (already exists)
  - Add: National Weather Service alerts API
  - Add: Global tropical cyclone tracking (IBTrACS)
  - Normalize to HazardEvent entity

**Create:**
- `dagster/sources/__init__.py` — Source registry
- `dagster/sources/base_adapter.py` — Abstract base class with: fetch(), normalize(), get_ttl(), health_check(), graceful_degradation
- `dagster/sources/fusion_pipeline.py` — Dagster pipeline that runs all sources on their schedules and loads to ontology
- `dagster/sources/cache.py` — Redis-backed cache with per-entity-type TTL (from OSINT-GEO pattern)
  - Aircraft: 120s, Vessel: 900s, Fire: 24h, Earthquake: 300s, Satellite: 300s, Weather: 300s, Social: 3600s

**API endpoint:**
- `agents/tools/fusion_tools.py` — get_situational_awareness(bbox, entity_types) → unified GeoJSON FeatureCollection

### TASK 2: Global Stability Engine (from OSINT-MONITOR)

Replace the simple weighted risk formula with a proper multi-factor stability engine.

**New files:**
- `agents/gse/` directory
- `agents/gse/engine.py` — Core GSE computation:
  ```
  GSE = Σ(Regional_Pressure(category) × Category_Weight × Recency_Factor × Confidence_Score)
  ```
  - Regional_Pressure: weighted sum of event density and severity within geographic zones
  - Category_Weight: domain-specific criticality multipliers (conflict=1.0, terrorism=0.9, cyber=0.7, economic=0.5, natural_disaster=0.8, space=0.3, political=0.6, energy=0.5, migration=0.4, health=0.6, environmental=0.4, technology=0.2)
  - Recency_Factor: exponential time-decay (half-life configurable, default 24h)
  - Confidence_Score: 0-1 based on source diversity (multiple independent sources = higher confidence)

- `agents/gse/threat_levels.py` — 5-tier classification:
  - STABLE (0-30): Normal baseline
  - ELEVATED (30-60): Increased monitoring
  - HEIGHTENED (60-90): Multi-domain activity
  - CRITICAL (90+): Major crisis conditions
  - ESCALATION_ALERT: Special flag when GSE increased >20 points in last hour

- `agents/gse/patterns.py` — Pattern detection algorithms:
  - cross_domain_operations(): Detect activities spanning ≥5 active categories in same region
  - geographic_clustering(): DBSCAN clustering of events to identify hotspot formation
  - temporal_acceleration(): Compare event frequency to 7-day baseline, flag if >60% increase
  - domain_spillover(): Track cascade patterns (e.g., political → conflict → humanitarian)
  - network_correlation(): Correlate geographically dispersed but temporally correlated events

- `agents/gse/scoring.py` — Per-region composite scoring:
  - compute_gse(region_id, time_window) → float
  - get_threat_level(gse_score) → enum
  - get_contributing_factors(region_id) → list of {category, pressure, weight}
  - generate_gse_history(region_id, days=30) → time series for trending

**Integrate into existing ontology:**
- Add GSE-related fields to Region object type in ODL schema
- Add to dagster/pipelines/risk_scoring.py pipeline
- Wire to frontend dashboard

### TASK 3: AI Briefing Engine (from World Monitor + OSINT-MONITOR)

Create automated intelligence briefing generation.

**New files:**
- `agents/briefing/` directory
- `agents/briefing/generator.py` — Brief generation:
  - generate_sitrep(region_id, time_window="24h") → structured Situation Report
  - generate_daily_briefing() → Daily global intelligence summary
  - generate_threat_advisory(region_id) → Threat-specific advisory

- `agents/briefing/formatter.py` — Output formatting:
  - format_markdown(briefing) → MDPI-style report in Markdown
  - format_pdf(briefing) → PDF using reportlab or weasyprint
  - format_html(briefing) → HTML briefing page

- `agents/briefing/templates/` directory:
  - sitrep_template.md — Situation Report template
  - daily_briefing_template.md — Daily briefing template
  - threat_advisory_template.md — Threat advisory template

**Briefing structure (from OSINT-MONITOR):**
1. EXECUTIVE SUMMARY (3-5 bullet points)
2. GLOBAL STATE INDICATOR (current GSE level + trend arrow)
3. REGIONAL ANALYSIS (top 5 regions by GSE change)
4. ACTIVE THREATS (CRITICAL/HIGH items with details)
5. CROSS-DOMAIN OPERATIONS (multi-category events)
6. PATTERN DETECTION (escalations, spillovers, new hotspots)
7. ECONOMIC INDICATORS (market impact assessment)
8. INFRASTRUCTURE STATUS (affected systems)
9. FORECAST (next 24-48h predicted developments)
10. RECOMMENDED ACTIONS

**Wire to existing agents:**
- reporting_agent.py calls briefing generator
- Add /briefing endpoint to agents/api.py

### TASK 4: Socio-Economic & Financial Data Layer (from World Monitor + GeoFinance)

Add economic, financial, and demographic data streams.

**New files:**
- `dagster/sources/finance_adapter.py` — Financial market data:
  - Fetch from free APIs: Yahoo Finance, Alpha Vantage, or Twelve Data
  - Indices: S&P 500, FTSE, Nikkei, DAX, BSE Sensex (top 10 exchanges)
  - Commodities: crude oil, natural gas, gold, wheat, copper
  - Crypto: BTC, ETH (optional)
  - Normalize to new FinancialIndicator entity

- `dagster/sources/demographic_adapter.py` — Demographic/socio-economic data:
  - World Bank API: GDP per capita, population, unemployment, GINI
  - ACLED: Armed Conflict Location & Event Data
  - UNHCR: Refugee/displacement data
  - Normalize to Region entity (extend existing schema)

- `dagster/sources/infrastructure_adapter.py` — Infrastructure monitoring:
  - Power grids: enhanced OSM Overpass queries (substations, transmission lines, voltage)
  - Ports: World Port Index
  - Airports: OurAirports database
  - Telecommunications: ITU data
  - Normalize to InfrastructureAsset entity (already in ontology)

**New ontology objects (extend ODL schema):**
- Aircraft {icao24, callsign, altitude, heading, velocity, on_ground, source, timestamp}
- Vessel {mmsi, name, imo, ship_type, speed, course, destination, source, timestamp}
- FinancialIndicator {region, indicator_type, value, change_pct, timestamp, source}
- ArmedConflict {event_id, event_type, fatalities, actor1, actor2, location, date, source}
- Displacement {region, refugee_count, idp_count, timestamp, source}
- Port {name, country, lat, lng, unlocode, port_type}
- Airport {name, iata_code, icao_code, lat, lng, elevation, runway_count}

### TASK 5: Enhanced Map Visualization (from World Monitor + ShadowBroker)

Replace Leaflet-only map with a dual-engine visualization.

**Frontend changes:**
- `frontend/src/pages/MapView.tsx` — Complete rewrite:
  - Add a toggle: 2D (MapLibre/Leaflet) / 3D (globe.gl + deck.gl)
  - For 2D: Use MapLibre GL JS (replace Leaflet) for WebGL rendering with:
    - Heatmap layer for event density
    - Clustered point layers (supercluster) for high-density areas
    - Temporal animation controls (play/pause/scrub timeline)
    - Layer toggles for each entity type
    - Click-to-propagate across all dashboard panels
  - For 3D: Add globe.gl component with:
    - 3D globe with arcs between correlated events
    - Atmospheric glow effects
    - Region-level coloring by GSE threat level
    - Satellite orbit tracks
  - Unified layer panel showing all available data layers with on/off toggles

- `frontend/src/components/LayerPanel.tsx` — Data layer controls
- `frontend/src/components/TimelineControls.tsx` — Temporal scrubbing
- `frontend/src/components/EntityDetail.tsx` — Click-to-expand entity info panel

**Install new dependencies:**
- react-map-gl (MapLibre GL React wrapper)
- globe.gl / globe.gl-react
- deck.gl
- supercluster (for point clustering)
- d3-scale-chromatic (for consistent color scales)

### TASK 6: Country Intelligence Dashboard (from World Monitor)

Add country-level analysis with composite scoring.

**New frontend page:**
- `frontend/src/pages/CountryIntel.tsx` — Country Intelligence page:
  - Search/select country
  - Country profile: composite risk score across 12 categories (from World Monitor's CII)
  - Radar chart showing category breakdown
  - Time series of GSE trend (last 30 days)
  - Active events within country
  - Economic indicators overlay
  - Neighboring country comparison

**Backend:**
- `agents/tools/country_tools.py` — get_country_intelligence(country_code) → structured country profile
- Compute country-level GSE from aggregated regional data

### TASK 7: Enhanced Ontology Schema

Update the ODL schema files to include all new object types.

**Files to modify:**
- `open-foundry/domain-packs/geo-sentinel/schema/` — Add new ODL files:
  - Aircraft.odl, Vessel.odl, FinancialIndicator.odl
  - ArmedConflict.odl, Displacement.odl, Port.odl, Airport.odl
- Update Region.odl to include: gse_score, threat_level, gse_history
- Update existing link types and add new ones:
  - Aircraft → Region (located_in)
  - Vessel → Port (at_port), Vessel → Region (nearby)
  - ArmedConflict → Region (occurs_in)
  - FinancialIndicator → Region (measures)

### TASK 8: Notification & Alerting System

Create real-time alerting based on GSE thresholds.

**New files:**
- `agents/alerting/` directory
- `agents/alerting/rules.py` — Alert rules:
  - GSE escalation alert (region crosses threshold)
  - New event in quiet region
  - Multi-domain operation detected
  - Temporal acceleration detected (>60% event increase)
  - Custom threshold alerts per region/category

- `agents/alerting/channels.py` — Alert delivery channels:
  - WebSocket push (real-time frontend updates)
  - Webhook (Slack, Discord, Teams)
  - Email (SMTP)
  - SMS (Twilio or similar)

- `agents/alerting/engine.py` — Alert engine:
  - Runs continuously alongside Dagster
  - Deduplication (same alert within 1 hour = suppressed)
  - Escalation (if alert not acknowledged in X minutes, escalate)

**Wire to frontend:**
- Add WebSocket connection for real-time alert banners
- Add alerts panel to dashboard

### TASK 9: Dashboard Redesign

Update the existing dashboard to show all new data.

**Dashboard panels (from World Monitor + OSINT-MONITOR):**
1. Global State Indicator — current GSE with trend arrow and contributing factors
2. Live Situational Map — dual-engine map with all data layers
3. Priority Signals — new activity in quiet regions, escalations, multi-domain events
4. Temporal Timeline — event sequencing with activity pattern visualization
5. Country Risk Table — sortable table of countries by GSE with sparkline trends
6. Active Threats — CRITICAL/HIGH items requiring attention
7. Economic Indicators — market indices, commodity prices, impact assessment
8. Movement Tracking — real-time aircraft and vessel positions
9. Satellite Passes — upcoming satellite coverage for regions of interest
10. Pipeline Health — Dagster pipeline status (already exists, enhance)

### TASK 10: Finalize & Test

1. Update docker-compose.yml with any new services
2. Update README.md with new features, architecture diagram, data sources
3. Run npm run build — fix TypeScript errors
4. Run python -m py_compile on all new .py files
5. git add -A && git commit
6. Run openclaw system event --text "Done: Sentinel comprehensive enhancement - 10 tasks completed" --mode now

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)               │
│  Dashboard │ Map (2D+3D) │ Objects │ Briefing │ Country │
├─────────────────────────────────────────────────────────┤
│              AGENTS LAYER (FastAPI + AI)                 │
│  Orchestrator │ GSE Engine │ Briefing │ Alerting        │
│  6 Agents + 3 Tool Sets + Fusion Tools                  │
├─────────────────────────────────────────────────────────┤
│              DAGSTER (Pipeline Orchestration)            │
│  7 Existing + 1 Fusion Pipeline + 3 New Pipelines       │
│  Source Adapters with per-entity TTL caching            │
├─────────────────────────────────────────────────────────┤
│              DATA SOURCES (60+ feeds)                    │
│  EO: FIRMS, Sentinel, MODIS, ERA5, GPM                 │
│  Movement: OpenSky (ADS-B), AIS (vessels), CelesTrak   │
│  Events: USGS, EONET, GDELT, ACLED, NWS                │
│  Finance: Yahoo/AlphaVantage, World Bank                │
│  Infrastructure: OSM, World Ports, Airports             │
├─────────────────────────────────────────────────────────┤
│              OPEN FOUNDRY (Ontology + Knowledge Graph)   │
│  17 Object Types │ 15+ Enums │ 15+ Link Types          │
│  GraphQL API │ SPI │ Actions │ Subscriptions             │
├─────────────────────────────────────────────────────────┤
│              INFRASTRUCTURE                              │
│  PostgreSQL+pgvector │ TypeDB │ MinIO │ Valkey │ Redis  │
│  Keycloak │ Superset │ Prometheus │ Grafana              │
└─────────────────────────────────────────────────────────┘
```

## CRITICAL RULES

- Do NOT stop to ask questions. Make reasonable design decisions and keep going.
- Use EXACT field names from the existing ODL schema when extending it.
- All new code must compile (npm run build, python -m py_compile).
- Keep the dark navy theme consistent.
- Follow the same patterns as existing code (dataclasses for Dagster, httpx for API calls).
- Commit at the end with a comprehensive commit message.
- When done, run: openclaw system event --text "Done: Sentinel comprehensive enhancement complete" --mode now
