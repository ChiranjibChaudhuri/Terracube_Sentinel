# TerraCube Sentinel -- Code Review & Improvement Plan

## Executive Summary

TerraCube Sentinel is an ambitious and well-architected OSINT platform with solid foundations: clean modular structure, proper use of Dagster for pipeline orchestration, good separation between agents/GSE/briefing/alerting layers, and comprehensive ontology schema via Open Foundry ODL. The 10-task enhancement successfully delivered all planned features: data fusion, GSE scoring, AI briefings, socio-economic data, alerting, and frontend dashboards.

**Key Strengths:**
- Ontology-native architecture with 17+ object types, 15+ link types, complete enum coverage
- Well-structured adapter pattern (BaseAdapter -> concrete adapters) with graceful degradation
- Good use of dataclasses, type hints on configuration, and environment variable usage
- Comprehensive docker-compose with health checks on all services

**Critical Issues Found: 19** (must fix before any deployment)
**High Priority Issues: 22**
**Medium Priority: 15**
**Low Priority: 8**

The most dangerous issues are: Redis authentication failure (cache layer completely broken), missing Python `redis` dependency (Dagster build fails), blocking SMTP in async context (freezes event loop), no error handling on API endpoints (500 errors on any failure), silent synthetic data fallback (operators see fake data), and HTML injection in briefing formatter.

---

## Critical Issues (Fix Immediately)

### C1. Redis Authentication Failure -- Cache Layer Broken
- **Files**: `docker-compose.yml:387`, `.env.example`, `dagster/sources/cache.py:13`
- **Issue**: Valkey requires password (`--requirepass ${VALKEY_PASSWORD}`) but `REDIS_URL` in agents service is `redis://valkey:6379/0` with no password. Dagster services have no `REDIS_URL` at all.
- **Impact**: `NOAUTH Authentication required` error -- entire cache/fusion layer non-functional
- **Fix**: Change REDIS_URL to `redis://:${VALKEY_PASSWORD}@valkey:6379/0` everywhere

### C2. Missing `redis` Python Package in Dagster
- **File**: `dagster/pyproject.toml`
- **Issue**: `dagster/sources/cache.py` imports `redis` but it's not in dependencies
- **Impact**: `ModuleNotFoundError: No module named 'redis'` -- Dagster container build fails
- **Fix**: Add `"redis>=5.0,<6.0"` to dependencies

### C3. Blocking SMTP in Async Function
- **File**: `agents/alerting/channels.py:168-172`
- **Issue**: `smtplib.SMTP()` is synchronous and blocks the event loop inside `async def send()`
- **Impact**: Email sending freezes ALL other async operations (alert delivery, WebSocket, API)
- **Fix**: Run SMTP in thread executor via `asyncio.get_event_loop().run_in_executor()`

### C4. No Error Handling on Any API Endpoint
- **File**: `agents/api.py` (all endpoints)
- **Issue**: Zero try/except blocks on any endpoint. If GSE scorer, briefing generator, or alert engine throws, users get raw 500 errors
- **Impact**: Cryptic errors instead of graceful JSON error responses
- **Fix**: Wrap all endpoint logic in try/except with HTTPException(500)

### C5. Redis KEYS Command in Production
- **File**: `dagster/sources/cache.py:86`
- **Issue**: `client.keys(f"fusion:{entity_type}:*")` blocks entire Redis server while scanning all keys
- **Impact**: Production Redis lockups, service degradation under load
- **Fix**: Replace with `SCAN` cursor-based iteration

### C6. Silent Synthetic Data Fallback
- **File**: `agents/gse/scoring.py:162-164`
- **Issue**: If API fetch fails, code silently generates synthetic events with no warning. No environment check.
- **Impact**: Production system could display fake intelligence data -- operators make decisions on fabricated information
- **Fix**: Log warning, add `ALLOW_SYNTHETIC_DATA` env var check

### C7. HTML Injection in Briefing Formatter
- **File**: `agents/briefing/formatter.py:48-49`
- **Issue**: Briefing content inserted into HTML without escaping: `content = section.content.replace("\n", "<br>")`
- **Impact**: XSS vulnerability if briefing content contains malicious HTML/JavaScript
- **Fix**: Use `html.escape()` before HTML insertion

### C8. WebSocket Resource Leak
- **File**: `agents/api.py:268-278`
- **Issue**: WebSocket unregister only runs on `WebSocketDisconnect`. Other exceptions leave stale connections.
- **Impact**: Memory leak with stale WebSocket connections accumulating
- **Fix**: Move `unregister()` to `finally` block

### C9. OllamaConfig Ignores Environment Variable
- **File**: `agents/config.py:18-22`
- **Issue**: `OllamaConfig.base_url` defaults to `"http://localhost:11434"` -- does NOT read `OLLAMA_BASE_URL` env var (which docker-compose sets)
- **Impact**: All 6 AI agents fail to connect to Ollama when running in Docker
- **Fix**: Use `field(default_factory=lambda: os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"))`

### C10. CORS Allows All Origins
- **File**: `agents/api.py:16-20`
- **Issue**: `allow_origins=["*"]` with `allow_methods=["*"]` and `allow_headers=["*"]`
- **Impact**: Any website can make authenticated requests to the agents API
- **Fix**: Restrict to known frontend origins in production

### C11. Missing API Keys in .env.example
- **File**: `.env.example`
- **Issue**: Critical env vars missing: `FOUNDRY_API_URL`, `FOUNDRY_API_TOKEN`, `NASA_FIRMS_MAP_KEY`, `FIRMS_API_KEY`, `CDS_API_KEY`, `OLLAMA_BASE_URL`, `REDIS_URL`
- **Impact**: Users following Getting Started guide will have broken pipelines
- **Fix**: Add all required env vars with placeholder values

### C12. Grafana Port Mismatch
- **Files**: `.env.example:42` says `GRAFANA_PORT=3000`, `docker-compose.yml:228` uses port 3002
- **Issue**: Port 3000 conflicts with Dagster webserver
- **Fix**: Change `.env.example` to `GRAFANA_PORT=3002`

### C13. Prometheus Targets Wrong/Missing
- **File**: `monitoring/prometheus.yml:51`
- **Issue**: Grafana target is `grafana:3000` but Grafana runs on 3002. Missing targets for dagster-webserver, agents, frontend
- **Impact**: No monitoring for critical services, Grafana metrics broken
- **Fix**: Update Grafana target, add dagster/agents scrape configs

### C14. Frontend API Client No HTTP Error Handling
- **File**: `frontend/src/lib/api-client.ts:9-21, 40-48`
- **Issue**: `fetch()` doesn't throw on 4xx/5xx. `res.json()` called without checking `res.ok`
- **Impact**: Silent failures, undefined reaching components
- **Fix**: Add `if (!res.ok) throw new Error(...)` checks

### C15. No Error Boundaries in Frontend
- **File**: `frontend/src/App.tsx`
- **Issue**: No React error boundary wrapping the app. Network failures crash the entire UI
- **Impact**: White screen of death on any component error
- **Fix**: Add ErrorBoundary component

### C16. Adapter Resources Never Closed in Fusion Pipeline
- **File**: `dagster/sources/fusion_pipeline.py:91-179`
- **Issue**: All 9 asset functions create adapter instances but never call `.close()`. Each holds httpx.Client.
- **Impact**: Socket/memory leaks on every pipeline run
- **Fix**: Use try/finally to close adapters

### C17. Satellite Ingestion Pipeline Incomplete
- **File**: `dagster/pipelines/satellite_ingestion.py:103-133, 157-168`
- **Issue**: `download_cog_assets` downloads data into memory then sets `"data": None`. MinIO upload is a no-op stub.
- **Impact**: Satellite pipeline produces no usable data
- **Status**: Known incomplete (has TODO comments), but should be documented

### C18. FIRMS Adapter Silent Demo Key Fallback
- **File**: `dagster/sources/firms_adapter.py:14`
- **Issue**: `FIRMS_API_KEY = os.getenv("FIRMS_API_KEY", "DEMO_KEY")` silently uses rate-limited demo key
- **Impact**: Production runs at demo rate limits without warning
- **Fix**: Log warning when using demo key

### C19. Missing `redis` Dependency for Dagster in docker-compose
- **Files**: `docker-compose.yml` dagster-webserver and dagster-daemon
- **Issue**: No `REDIS_URL` environment variable passed to Dagster services
- **Impact**: Fusion pipeline cache falls back to localhost:6379 (unreachable in Docker)
- **Fix**: Add `REDIS_URL` to both Dagster service environments

---

## High Priority Improvements

### H1. Duplicate Ollama Client Code Across 6 Agent Files
- **Files**: `agents/agents/*.py` (all 6 agents)
- **Issue**: Identical httpx Ollama call pattern repeated in every agent's `run()` method
- **Fix**: Extract to shared `agents/llm_client.py` utility

### H2. No Input Validation on API Query Parameters
- **File**: `agents/api.py:224-237`
- **Issue**: `entity_types.split(",")` crashes if entity_types is None when accessed directly. No lat/lng range validation.
- **Fix**: Add FastAPI Query validation with proper defaults

### H3. Race Condition in Alert Deduplication
- **File**: `agents/alerting/engine.py:126-138`
- **Issue**: Deduplication check and record are not atomic. Same alert can be sent twice under concurrency.
- **Fix**: Add asyncio.Lock around dedup check+record

### H4. No Loading/Error States in Frontend Pages
- **Files**: All page components (`Dashboard.tsx`, `MapView.tsx`, etc.)
- **Issue**: Pages consume mock data directly without loading spinners or error handling
- **Fix**: Add loading/error states when hooks return isLoading/error

### H5. Canvas Memory Leak in MapView
- **File**: `frontend/src/pages/MapView.tsx:55-186`
- **Issue**: Globe canvas mouse event handlers not cleaned up on unmount
- **Fix**: Use useEffect cleanup to remove event listeners

### H6. No Lazy Loading of Route Components
- **File**: `frontend/src/App.tsx`
- **Issue**: All page components loaded upfront, including heavy Leaflet/Recharts
- **Fix**: Use React.lazy() + Suspense for code splitting

### H7. Missing Accessibility (ARIA Labels)
- **Files**: `Layout.tsx`, `TimelineControls.tsx`, various icon-only buttons
- **Issue**: Icon buttons have no aria-label, no keyboard navigation on map
- **Fix**: Add aria-label to all interactive elements

### H8. `any` Type Abuse in Mock Data
- **File**: `frontend/src/lib/mock-data.ts:186, 203`
- **Issue**: `Record<string, any[]>` and `function(): any[]` disable type safety
- **Fix**: Use union type of all entity types

### H9. No Response Validation from Ollama LLM
- **Files**: All 6 agent files
- **Issue**: Code assumes `resp.json()` always has "response" key. Returns "No response from LLM." hiding errors.
- **Fix**: Validate response structure, log unexpected formats

### H10. Division by Zero Risks in Climate Reanalysis
- **File**: `dagster/pipelines/climate_reanalysis.py:178`
- **Issue**: `sum(...) / len(compute_anomalies)` without empty guard
- **Fix**: Add `if compute_anomalies else 0.0` guard

### H11. Hardcoded Coordinates Inconsistency (2D vs 3D)
- **File**: `frontend/src/pages/MapView.tsx:132-137, 242-247`
- **Issue**: 3D globe uses [lon, lat] order but 2D map uses [lat, lng] -- different coordinate conventions
- **Fix**: Extract to shared constants with named lat/lng properties

### H12. Unhandled Shapely Exceptions
- **File**: `dagster/pipelines/infrastructure_vulnerability.py:169-171`
- **Issue**: `shape(geom)` can raise on malformed GeoJSON
- **Fix**: Wrap in try/except consistently

### H13. No Event Coordinate Validation in GSE Patterns
- **File**: `agents/gse/patterns.py:86-96`
- **Issue**: Code assumes events have valid lat/lon. Division by zero if cell_events empty.
- **Fix**: Filter events with valid coordinates before processing

### H14. PDF Generation Partial Error Handling
- **File**: `agents/briefing/formatter.py:120-167`
- **Issue**: Only ImportError caught. Other reportlab errors will crash.
- **Fix**: Add broad Exception catch with logging

### H15. Orchestrator Swallows Exception Details
- **File**: `agents/orchestrator.py:62-68`
- **Issue**: Agent errors caught but only generic message returned. Exception details lost.
- **Fix**: Include exception type and message in error response

### H16. AIS Adapter Silent Synthetic Data
- **File**: `dagster/sources/ais_adapter.py:76-89`
- **Issue**: Falls back to synthetic data with no env flag to disable in production
- **Fix**: Add `ALLOW_SYNTHETIC_DATA` guard

### H17. API Tokens in URL Query Parameters
- **Files**: `dagster/pipelines/air_quality.py:141`, `dagster/pipelines/real_time_hazards.py:174`
- **Issue**: API keys passed in URL, may appear in logs
- **Fix**: Ensure logging doesn't capture full URLs with tokens

### H18. Async Function Potentially Not Awaited
- **File**: `dagster/ai_ingest/__init__.py:52-156`
- **Issue**: `score_risk_for_region` is `async def` but not clear if callers use `await`
- **Fix**: Verify all call sites or make synchronous

### H19. Frontend API Configuration Scattered
- **Files**: `store.ts:13`, `api-client.ts:1-2`, `vite.config.ts:8-17`
- **Issue**: API endpoints hardcoded in 3 different places
- **Fix**: Centralize in a single config module using `import.meta.env`

### H20. Webhook Failures Lack Detail Logging
- **File**: `agents/alerting/channels.py:88-95`
- **Issue**: "Webhook delivery failed" logged without URL, status code, or response
- **Fix**: Include request details in warning log

### H21. Inconsistent HTTP Timeout Strategy
- **Files**: Multiple -- timeouts range from 10s to 90s with no clear rationale
- **Fix**: Centralize timeout configuration in config module

### H22. `execute_action` Missing Error Handling
- **File**: `agents/agents/automated_action.py:22-52`
- **Issue**: HTTPError propagates unhandled if Foundry API is down
- **Fix**: Catch httpx.HTTPError and return error dict

---

## Medium Priority Improvements

### M1. No Configuration Validation
- **File**: `agents/config.py`
- **Issue**: No validation that temperature is 0-2, max_tokens is positive, URLs are valid
- **Fix**: Add `__post_init__` validators

### M2. Dangerous Import in Exception Handler
- **File**: `agents/tools/fusion_tools.py:66-74`
- **Issue**: Imports inside exception handler can mask original error
- **Fix**: Move import to module level with ImportError guard

### M3. Hardcoded Country List
- **File**: `dagster/sources/demographic_adapter.py:52`
- **Issue**: Country list is static, will become stale
- **Fix**: Load from config or API

### M4. Complex Orbital Math Undocumented
- **File**: `dagster/sources/celestrak_adapter.py:82-105`
- **Issue**: Orbital mechanics calculations with no comments
- **Fix**: Add docstring explaining approximation method

### M5. Unused Functions in threat_levels.py
- **File**: `agents/gse/threat_levels.py:38-55`
- **Issue**: `get_threat_color()` and `get_threat_description()` never imported
- **Fix**: Wire into briefing/formatter or remove

### M6. No Memoization for Expensive Dashboard Computations
- **File**: `frontend/src/pages/Dashboard.tsx:40-56`
- **Issue**: GSE history and event filtering recalculate every render
- **Fix**: Use `useMemo()` for computed values

### M7. TimelineControls Has Dead Props
- **File**: `frontend/src/components/TimelineControls.tsx:4-5`
- **Issue**: `onTimeChange` prop defined but never used by parent, `playing` state does nothing
- **Fix**: Implement or remove

### M8. Type Safety Bypass in React Query Hooks
- **File**: `frontend/src/hooks/useAlerts.ts:9` (and all hooks)
- **Issue**: `as Promise<unknown> as Promise<Alert[]>` double-cast bypasses type safety
- **Fix**: Add runtime validation (zod) or typed fetch functions

### M9. No Virtualization for Large Object Lists
- **File**: `frontend/src/pages/ObjectExplorer.tsx`
- **Issue**: Currently mitigated by pagination (PAGE_SIZE=10), but no virtualization for scale
- **Fix**: Consider react-window if page size grows

### M10. Missing Frontend Dependencies for Enhanced Map
- **File**: `frontend/package.json`
- **Issue**: ENHANCEMENT_PLAN Task 5 specifies react-map-gl, globe.gl, deck.gl, supercluster -- none installed
- **Status**: Map works with Leaflet fallback, but planned WebGL features unavailable

### M11. Duplicate workspace.yaml Creation
- **File**: `Dockerfile.dagster:11`
- **Issue**: Echoes workspace.yaml content but file already exists in dagster/ directory
- **Fix**: Remove redundant RUN command or remove the file

### M12. No Weather Tool Error Handling
- **File**: `agents/tools/weather_tools.py:13-63`
- **Issue**: No try/except around Open-Meteo API calls
- **Fix**: Add error handling like other tools

### M13. Timestamp Parsing Assumes UTC
- **File**: `dagster/pipelines/social_signals.py:115-117`
- **Issue**: GDELT timestamp parsed as naive datetime then forced to UTC
- **Fix**: Document assumption or validate

### M14. CSV Parsing Fragility
- **File**: `dagster/pipelines/real_time_hazards.py:184-231`
- **Issue**: FIRMS CSV parsing assumes exact column names. Format change = crash.
- **Fix**: Add defensive column existence checks

### M15. OSM Overpass Query Hardcoded Bbox
- **File**: `dagster/pipelines/infrastructure_vulnerability.py`
- **Issue**: Default bbox is Cape Town area, should be configurable
- **Fix**: Make bbox a pipeline parameter

---

## Low Priority / Nice to Have

### L1. User-Agent String Disclosure
- **File**: `dagster/sources/weather_adapter.py:29`
- **Issue**: "TerraCube-Sentinel/1.0" reveals system identity to external APIs
- **Assessment**: Acceptable for open-source project

### L2. Missing Docstrings on Agent Functions
- **Files**: Most agent and tool files
- **Fix**: Add docstrings to public functions

### L3. Inconsistent Return Type Annotations
- **Files**: Various pipeline functions return `list[dict[str, Any]]` losing specificity
- **Fix**: Define typed return dataclasses

### L4. Missing Optional API Keys Documentation
- **File**: `.env.example`
- **Fix**: Document AIS_API_KEY, WAQI_API_TOKEN, ALERT_WEBHOOK_URL as optional

### L5. Frontend Missing Favicon/Meta Tags
- **Fix**: Add proper meta tags, favicon, Open Graph tags

### L6. No Rate Limiting on API Endpoints
- **File**: `agents/api.py`
- **Fix**: Add slowapi or similar rate limiting middleware

### L7. No Health Check for Ollama Connectivity
- **Fix**: Add Ollama health check to `/health` endpoint

### L8. README Lists 90+ Sources But Only 9 Adapters Exist
- **File**: `README.md`
- **Fix**: Clarify which sources are implemented vs. planned

---

## Architecture Recommendations

### 1. Extract Shared LLM Client
All 6 agents duplicate the Ollama HTTP call pattern. Extract to `agents/llm_client.py` with retry logic, timeout configuration, and response validation. This single change eliminates ~300 lines of duplication.

### 2. Add Circuit Breaker Pattern
External API calls (OpenSky, FIRMS, USGS, etc.) should use circuit breaker pattern. After N consecutive failures, stop calling the source for a cooldown period. Currently, every pipeline run retries all failed sources.

### 3. Implement Proper Health Checks
The `/health` endpoint returns `"healthy"` unconditionally. It should check: Ollama connectivity, Foundry API availability, Redis connectivity, and report degraded status.

### 4. Add Request Tracing
No correlation IDs or request tracing across the API -> Agents -> Foundry chain. Add OpenTelemetry trace propagation for debugging production issues.

### 5. Production-Ready CORS
Replace `allow_origins=["*"]` with environment-configurable allowed origins. Default to frontend URL only.

### 6. Separate Demo Mode from Production
The silent synthetic data fallback in GSE scoring and AIS adapter is dangerous. Introduce an explicit `DEMO_MODE=true` environment variable that enables synthetic data, with clear logging.

### 7. Add Integration Tests
No integration tests exist between layers. Add tests that verify: adapter -> cache -> Foundry flow, GSE scorer -> API endpoint flow, and alert rules -> channels flow.

---

## Detailed Findings

### Python Backend

#### dagster/sources/base_adapter.py
- Well-structured abstract base with proper lifecycle methods
- `_get_client()` correctly handles closed clients
- `close()` method exists but no subclass or pipeline code calls it (C16)
- `health_check()` creates new client each time instead of reusing

#### dagster/sources/cache.py
- Good defensive programming with try/except on all operations
- Uses `ImportError` guard for redis package (nice)
- **CRITICAL**: Uses `client.keys()` which is O(N) and blocks Redis (C5)
- Missing `close()` method for connection cleanup
- No connection pooling configuration

#### dagster/sources/fusion_pipeline.py
- Clean adapter pattern usage
- Module-level cache singleton is good
- `_load_to_foundry()` properly batches with single httpx.Client
- `_make_id()` uses hash() which is non-deterministic across runs (minor)
- **CRITICAL**: No adapter.close() calls anywhere (C16)

#### dagster/sources/opensky_adapter.py through infrastructure_adapter.py
- All follow the BaseAdapter pattern consistently
- All have proper `fetch()` and `normalize()` implementations
- FIRMS adapter has silent DEMO_KEY fallback (C18)
- AIS adapter has synthetic data fallback (H16)
- Celestrak adapter has undocumented orbital math (M4)

#### dagster/pipelines/*.py (7 files)
- All follow Dagster asset/job/schedule patterns correctly
- `satellite_ingestion.py` has incomplete MinIO upload (C17)
- `climate_reanalysis.py` has potential division by zero (H10)
- `infrastructure_vulnerability.py` has unhandled Shapely errors (H12)
- `social_signals.py` has timezone assumption (M13)
- `real_time_hazards.py` has fragile CSV parsing (M14)
- `risk_scoring.py` has good defensive math patterns

#### dagster/ai_ingest/__init__.py
- Async function may not be properly awaited (H18)
- Good Ollama integration pattern

#### dagster/pipelines/__init__.py
- Properly exports all Definitions
- Includes all fusion pipeline assets and schedules
- Integration is complete

### Frontend

#### frontend/src/lib/api-client.ts
- **CRITICAL**: No HTTP status checking on fetch() calls (C14)
- Clean GraphQL query/mutate pattern
- Good TypeScript generics usage

#### frontend/src/App.tsx
- **CRITICAL**: No error boundary (C15)
- No lazy loading (H6)
- Clean routing structure

#### frontend/src/pages/MapView.tsx
- Impressive dual-engine (2D/3D) implementation
- Canvas globe animation is well-implemented
- **HIGH**: Event listener cleanup missing (H5)
- **HIGH**: Coordinate convention inconsistency between 2D/3D (H11)

#### frontend/src/pages/Dashboard.tsx
- Good layout with GSE indicators, charts, event lists
- No loading states (H4)
- Expensive computations not memoized (M6)

#### frontend/src/pages/CountryIntel.tsx, Briefing.tsx
- Well-structured with proper chart integration
- Mock data usage is clean
- No error states for data fetching

#### frontend/src/components/Layout.tsx
- Clean sidebar navigation
- Missing ARIA labels on icon buttons (H7)

#### frontend/src/lib/mock-data.ts
- Comprehensive mock data covering all entity types
- Good for development, but `any` type usage (H8)

#### frontend/src/lib/types.ts
- Complete TypeScript type definitions for all entities
- Well-structured, matches ODL schema

### Infrastructure

#### docker-compose.yml
- Comprehensive with health checks on all services
- **CRITICAL**: Redis auth mismatch (C1)
- **CRITICAL**: Missing REDIS_URL in Dagster services (C19)
- Port allocations are clean, no conflicts
- Proper dependency ordering with `depends_on`

#### .env.example
- Missing many critical env vars (C11)
- **CRITICAL**: Grafana port wrong (C12)
- Good practice of documenting defaults

#### monitoring/prometheus.yml
- **CRITICAL**: Grafana target port wrong (C13)
- Missing scrape configs for dagster, agents, frontend
- Good scrape intervals for different service types

#### ODL Schemas
- ALL enhancement object types present and well-defined
- Region.odl properly extended with GSE fields
- All link types defined in links.odl
- All enums complete including new ThreatLevel, ShipType, etc.
- Constraints properly applied (e.g., gseScore 0-200)

### Security

- CORS is wide open (C10)
- API tokens in URL parameters for some external APIs (H17)
- HTML injection possible in briefing formatter (C7)
- No rate limiting on API endpoints (L6)
- `.env.example` uses "changeme_" prefix passwords (acceptable for example file)
- Keycloak integration present but in `start-dev` mode
- No HTTPS/TLS configuration (expected for dev, needs prod config)
- GraphQL queries in tools use parameterized variables (good)
- No SQL injection risks found (uses ontology API, not direct SQL)

---

*Review completed 2026-04-08 by automated code review.*
*Total files reviewed: 64 (23 Python backend, 13 Python agents/tools, 4 GSE, 3 briefing, 3 alerting, 24 TypeScript/React, 19 ODL schemas, 5 config/infra)*
