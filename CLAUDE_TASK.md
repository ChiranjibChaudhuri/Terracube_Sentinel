# Claude Task: Complete TerraCube Sentinel

## Context

You are completing the TerraCube Sentinel project — an open-source Palantir Foundry alternative for Earth Observation and planetary intelligence.

## Files to Read First

1. README.md (master documentation)
2. ARCHITECTURE.md
3. PALANTIR_PARITY.md
4. UNIVERSAL_INGESTION_ARCHITECTURE.md
5. docker-compose.yml
6. docker-compose.dagster.yml
7. dagster/pipelines/real_time_hazards.py (reference for how pipelines are structured)
8. dagster/pipelines/satellite_ingestion.py
9. dagster/pipelines/climate_reanalysis.py
10. dagster/pipelines/infrastructure_vulnerability.py
11. open-foundry/domain-packs/geo-sentinel/schema/ (all .odl files — this is your ontology schema)
12. open-foundry/domain-packs/geo-sentinel/actions/ (all .yaml files)
13. frontend/src/App.tsx (current state: bare Vite template)
14. frontend/package.json

## Current State

- 4 Dagster pipelines exist (real_time_hazards, satellite_ingestion, climate_reanalysis, infrastructure_vulnerability) — ~1260 lines total, well-structured with dataclasses and normalized records
- Frontend is a bare Vite+React template (counter app). No pages, no routing, no API client, no styling. Only dependencies: react, react-dom.
- Docker compose has 11 infra services (postgres, typedb, minio, valkey, keycloak, openmetadata+mysql+es, prometheus, grafana, loki)
- Docker compose.dagster.yml has 3 services (dagster-postgres, webserver, daemon)
- NO agents/ directory exists yet
- ai_ingest/ inside dagster/ is empty
- Open Foundry is a git submodule with full ontology engine, GraphQL API, SPI, actions framework — already built
- The geo-sentinel domain pack defines: 10 object types (Region, HazardEvent, Sensor, InfrastructureAsset, RiskAssessment, Alert, DataSource, SatellitePass, DataProduct, PipelineExecution), 15 enums, 9 link types, 4 actions

## YOUR TASKS — DO ALL OF THEM, IN ORDER. DO NOT STOP TO ASK QUESTIONS. JUST BUILD.

### TASK 1: FRONTEND — Full Ontology Explorer UI

Replace the Vite counter template with a complete, professional React SPA.

Install these additional dependencies:
```
npm install react-router-dom @tanstack/react-query recharts lucide-react date-fns zustand tailwindcss @tailwindcss/vite leaflet react-leaflet @types/leaflet
```

Build these pages/routes with Tailwind CSS styling (dark theme, sidebar layout):

1. **Layout** — Sidebar navigation (collapsible) + top bar with breadcrumb + main content area. Dark navy theme (#0f172a background, lighter cards #1e293b). Use lucide-react icons throughout.

2. **/ (Dashboard)** — Overview page with:
   - 4 stat cards: Total Hazard Events (last 24h), Active Alerts, Active Sensors, Pipeline Health
   - Recent hazard events table (type, severity, location, time — use mock data matching HazardEvent schema)
   - Active alerts list with severity color coding (GREEN/YELLOW/ORANGE/RED)
   - Pipeline execution status (show last 5 runs from mock PipelineExecution data)

3. **/objects (Object Explorer)** — Palantir-style object browser:
   - Search bar (full-text across name, type)
   - Filter by object type (dropdown: Region, HazardEvent, Sensor, InfrastructureAsset, RiskAssessment, Alert, DataSource, SatellitePass, DataProduct, PipelineExecution)
   - Paginated table showing objects with their properties
   - Click a row to expand and show all properties + links (using the 9 link types)
   - Show link targets as clickable items that navigate to that object

4. **/map (Map View)** — Interactive map page:
   - Use Leaflet + react-leaflet with OpenStreetMap tiles
   - Show mock hazard events as colored circles (severity-colored: RED/CRITICAL, ORANGE/HIGH, YELLOW/MODERATE, GREEN/LOW)
   - Show mock sensors as blue markers
   - Show mock infrastructure as gray markers
   - Legend overlay
   - Click marker → popup with object details

5. **/pipelines (Pipeline Status)** — Dagster monitoring:
   - List all 4 pipelines with their schedule info (5min, 3h, daily, weekly)
   - Show mock recent runs (SUCCESS/FAILED/IN_PROGRESS)
   - Asset dependency graph (simple visual showing fetch → normalize → load)
   - Pipeline health indicators

6. **/ontology (Ontology Visualization)** — Graph view:
   - SVG canvas showing the 10 object types as nodes
   - 9 link types as directed edges (labeled)
   - Color-coded by domain (hazard=red, spatial=blue, monitoring=green, data=purple)
   - Click node → sidebar panel shows the ODL schema for that type
   - Position nodes in a circle with SVG lines (simple, no external graph library)

7. **/settings (Settings)** — Simple config page:
   - API endpoint configuration
   - Theme toggle placeholder
   - About section with project description

Create these files:
- `src/lib/api-client.ts` — fetch wrapper pointing to Open Foundry GraphQL API (http://localhost:8080/graphql). Include: query(), mutate(), types for all 10 object types matching the ODL schema.
- `src/lib/mock-data.ts` — Realistic mock data for ALL 10 object types (at least 5-10 records each), using actual field names from the ODL schema.
- `src/lib/types.ts` — TypeScript interfaces matching all 10 ODL object types + enums + link types
- `src/hooks/` — useObjects(), useObject(), useHazardEvents(), useAlerts(), usePipelines() (all using @tanstack/react-query, falling back to mock data)
- Configure Tailwind in vite.config.ts and create a global styles file

Update vite.config.ts to proxy /graphql to http://localhost:8080/graphql and /api to http://localhost:8080/api

**Make sure `npm run build` passes with zero TypeScript errors.**

### TASK 2: DAGSTER — Add 3 New Pipelines

Create these following the exact same pattern as the existing 4 pipelines (dataclass normalization, httpx for API calls, load to foundry):

1. **dagster/pipelines/air_quality.py** — "air_quality" group
   - @asset: fetch_openaq_measurements() — OpenAQ API v2 (https://api.openaq.org/v2/latest), fetch PM2.5, PM10, O3, NO2 for major cities
   - @asset: fetch_waqi_status() — World Air Quality Index (https://api.waqi.info/feed/), fetch AQI by city
   - @asset: normalize_air_quality() — combine OpenAQ + WAQI into AirQualityRecord dataclass
   - @asset: load_air_quality_to_foundry() — POST to FOUNDRY_API_URL
   - Schedule: every 30 minutes

2. **dagster/pipelines/social_signals.py** — "social_signals" group
   - @asset: fetch_gdelt_events() — GDELT Global Knowledge Graph API, recent events filtered by natural disaster keywords
   - @asset: fetch_gdelt_tone() — Analyze tone/sentiment of recent event articles
   - @asset: normalize_social_signals() — into SocialSignalRecord dataclass
   - Schedule: every 15 minutes

3. **dagster/pipelines/risk_scoring.py** — "risk_scoring" group
   - @asset: aggregate_hazard_data() — query existing hazard data from foundry, aggregate by region
   - @asset: compute_composite_risk() — combine hazard frequency, severity, infrastructure exposure, sensor coverage into composite risk score
   - @asset: update_region_risk_scores() — update Region.riskScore in foundry via PATCH
   - Schedule: hourly

Add all 3 to dagster/workspace.yaml.

Create dagster/ai_ingest/__init__.py with a basic risk scoring agent stub:
- AgentConfig dataclass with model, temperature, tools list
- async def score_risk_for_region(region_id, region_geometry, hazard_history) -> float
- Use weighted formula: 0.4 * hazard_frequency + 0.3 * avg_severity + 0.2 * infrastructure_exposure + 0.1 * (1 - sensor_coverage)

### TASK 3: DOCKER COMPOSE — Add Frontend + Superset + Merge Dagster

1. Create frontend/Dockerfile:
   - Multi-stage: node:20-alpine (deps, build) → nginx:alpine (serve)
   - nginx.conf with SPA fallback (try_files $uri /index.html) and /graphql proxy to http://host.docker.internal:8080

2. Add to docker-compose.yml:
   - `frontend` service: build ./frontend, ports 5173:80
   - `superset` service: image apache/superset, ports 8088:8088, env vars (SUPERSET_SECRET_KEY, SUPERSET_LOAD_EXAMPLES=no)
   - Merge the 3 dagster services from docker-compose.dagster.yml into main docker-compose.yml (dagster-postgres on 5433, dagster-webserver on 3000, dagster-daemon)
   - Fix port conflicts: Grafana must be on 3002, Dagster webserver on 3000

### TASK 4: AGENTS — Create the AI Agent Layer

Create agents/ directory with:

1. `agents/config.py` — AgentConfig dataclass, Ollama config
2. `agents/api.py` — FastAPI app with POST /chat endpoint
3. `agents/orchestrator.py` — Keyword-based intent router delegating to agents
4. `agents/agents/hazard_sentinel.py` — Summarizes active threats
5. `agents/agents/predictive_analyst.py` — Risk scores + weather forecasts
6. `agents/agents/pattern_discovery.py` — Cross-domain correlation
7. `agents/agents/automated_action.py` — Executes Open Foundry actions
8. `agents/agents/reporting_agent.py` — Generates situation reports
9. `agents/agents/research_agent.py` — Web search enrichment
10. `agents/tools/__init__.py`
11. `agents/tools/ontology_tools.py` — query_objects, get_object, traverse_graph
12. `agents/tools/satellite_tools.py` — search_stac, get_coverage
13. `agents/tools/weather_tools.py` — get_forecast from open-meteo

Each agent: system prompt, tool list, async run(message, context) -> str. Use httpx to call Open Foundry API.

Add agents service to docker-compose.yml: build ./agents, ports 8001:8001.

### TASK 5: FINALIZE

1. Run `npm run build` in frontend/ — fix any TypeScript errors until it passes
2. Run `python -m py_compile` on all new .py files
3. `git add -A && git commit -m "feat: complete frontend UI, 3 new pipelines, AI agent layer, unified docker-compose"`
4. Update README.md Getting Started section if ports changed

## CRITICAL RULES

- **Do NOT stop to ask questions.** If something is ambiguous, make a reasonable choice and keep going.
- Use the **EXACT field names from the ODL schema files** (read them first!)
- All mock data must use real field names from the ontology
- Keep the dark navy theme consistent across all frontend pages
- npm run build MUST pass with zero TypeScript errors
- All Python files MUST compile
- Commit everything at the end
- When completely finished, run: `openclaw system event --text "Done: Sentinel frontend UI + 3 pipelines + AI agents + unified docker-compose" --mode now`
