# TerraCube Sentinel — Palantir Foundry Parity Map

**What Palantir does → What we build (open source)**

---

## Palantir Foundry Product Map → Open Source Equivalent

| Palantir Product | What It Does | Our Equivalent |
|---|---|---|
| **Ontology** | Objects, Links, Actions, Types | Open Foundry (fork) + TypeDB + Neo4j |
| **Pipeline Builder** | No-code data integration (ingest, transform, sync) | Dagster + dbt + Airbyte (with custom UI) |
| **Quiver** | Code editor for pipeline logic | Monaco Editor embedded in Dagster UI |
| **Contour** | Data quality rules and monitoring | Soda + Custom Quality Gates |
| **Object Explorer** | Browse/search/visualize ontology objects | Custom React app (GraphiQL + MapLibre) |
| **Workshop** | Build operational apps on ontology (no-code) | React component library + Appsmith |
| **AIP** (AI Platform) | LLM agents with ontology context + tool use | Ollama + LangGraph + custom agents |
| **Apollo** | Operational metadata, lineage, dataset catalog | OpenMetadata + Dagster lineage |
| **Impact** | (discontinued) Event-driven analytics | Valkey streams + WebSocket subscriptions |
| **Gotham** | Intelligence analysis | Graph analytics via Neo4j + GDELT ingestion |
| **Meta** | Metadata management | OpenMetadata |
| **SDK** | TypeScript/Python client libraries | Open Foundry auto-generated SDK |

---

## The Complete Palantir Experience — What Users See

### 1. Data Integration (Pipeline Builder)
User opens a web UI → connects a data source (API, database, file, STAC catalog) → maps fields to ontology objects → pipeline runs → data flows into the ontology.

### 2. Ontology Browser (Object Explorer)
User searches "earthquake near Tokyo" → sees all HazardEvent objects with links to affected Regions, InfrastructureAssets, RiskAssessments → can traverse the graph → can see historical versions.

### 3. Transform Editor (Quiver)
User writes SQL/Python/TypeQL transforms in an embedded code editor → transforms run as Dagster assets → results feed back into ontology objects.

### 4. Application Builder (Workshop)
User drags-and-drops ontology objects onto a canvas → configures charts, maps, tables → builds a dashboard without writing code → shares with team.

### 5. AI Assistant (AIP)
User types natural language: "What's the flood risk for Bangladesh next week?" → AI agent queries ontology → runs predictive model → returns actionable answer with confidence + source links.

### 6. Action Execution (Kinetic Layer)
User (or AI agent) clicks "Issue Alert" → preconditions checked → action executed → audit trail recorded → downstream systems notified via events.

---

## What We Need to Build vs. What We Get Free

### GET FREE (Open Foundry Already Does This)
✅ Ontology Engine (schema registry, object store, link index)
✅ ODL Compiler (schema → APIs, SDKs, auth)
✅ Action Framework (preconditions, audit, events, execution pipeline)
✅ Security Layer (OpenFGA ReBAC, OIDC, field redaction)
✅ Sync Engine (JDBC, Debezium CDC)
✅ GraphQL + REST + WebSocket APIs
✅ TypeScript SDK (auto-generated from ODL)
✅ OpenTelemetry observability
✅ SPI (pluggable storage backends)
✅ Audit trail (immutable, signed)
✅ Consent management

### GET FREE (Best-in-Class OSS Packages)
✅ Dagster — Pipeline orchestration
✅ dbt — SQL transforms
✅ Airbyte — 300+ data source connectors
✅ TypeDB — Type-safe graph storage
✅ PostGIS — Spatial operations
✅ OpenMetadata — Data catalog + lineage
✅ Keycloak — Auth/SSO
✅ OPA — Policy engine
✅ Superset — BI dashboards
✅ MapLibre GL — Interactive maps
✅ MinIO — Object storage
✅ Apache Iceberg — Time-travel
✅ Valkey — Events + cache
✅ Ollama — Local LLM
✅ LangGraph — Agent orchestration
✅ Soda — Data quality

### WE BUILD (The Glue + Differentiation)

| Component | Description | Effort |
|---|---|---|
| **TypeDB SPI** | Storage provider for Open Foundry (partially done) | 2-3 days |
| **PostGIS SPI** | Spatial storage provider for Open Foundry | 2-3 days |
| **Geo Domain Pack** | ODL schemas for all object/link/action types (done) | 1 day (extend) |
| **Pipeline UI** | Embedded pipeline builder (Dagster + custom React) | 1-2 weeks |
| **Object Explorer** | Ontology browser with graph visualization | 1-2 weeks |
| **App Builder** | Low-code dashboard builder on ontology | 2-3 weeks |
| **AI Agent Layer** | 6 agents + orchestrator + tool interface | 2-3 weeks |
| **60+ Connectors** | Dagster ingestion assets for all data sources | 2-3 weeks |
| **Frontend Shell** | React SPA integrating all of the above | 1-2 weeks |

---

## Phase Plan (Palantir Parity)

### Phase 1: Core Platform (Weeks 1-3)
**Goal: Working ontology with data flowing in**

- [x] Open Foundry forked + analyzed
- [x] Docker Compose infra (Postgres, TypeDB, MinIO, Valkey, Keycloak)
- [x] DGGAL topology table
- [x] Geo Domain Pack (ODL schemas)
- [x] Dagster pipelines (4 core)
- [x] Monitoring (Prometheus, Grafana, Loki)
- [ ] TypeDB SPI provider (complete it)
- [ ] PostGIS SPI provider
- [ ] dbt models (bronze → silver → gold)
- [ ] 20 priority connectors (Airbyte + custom)
- [ ] Verify end-to-end: External API → Dagster → dbt → Open Foundry → GraphQL query

### Phase 2: Palantir AIP (AI Agents) (Weeks 4-5)
**Goal: Natural language interaction with ontology**

- [ ] Ollama deployment + model selection
- [ ] LangGraph agent orchestrator
- [ ] Ontology tool interface (query, spatial, temporal, traverse)
- [ ] Hazard Sentinel Agent
- [ ] Predictive Analysis Agent
- [ ] Pattern Discovery Agent
- [ ] Automated Action Agent
- [ ] Reporting Agent
- [ ] Research Agent
- [ ] Chat interface (web UI)
- [ ] RAG pipeline (ontology objects → embeddings → context)

### Phase 3: Palantir Workshop (App Builder) (Weeks 6-7)
**Goal: No-code dashboard builder on ontology**

- [ ] React frontend shell (with sidebar navigation)
- [ ] Object Explorer page (search, filter, traverse graph)
- [ ] Map view (MapLibre + DGGAL WASM + ontology objects)
- [ ] Pipeline status page (Dagster integration)
- [ ] Dashboard builder (drag-and-drop widgets)
- [ ] Widget library (charts, maps, tables, gauges)
- [ ] Dashboard persistence (save/load from ontology)

### Phase 4: Palantir Pipeline Builder (Weeks 8-9)
**Goal: Visual pipeline builder**

- [ ] Pipeline editor UI (Dagster DAG visualization)
- [ ] Source connector picker (Airbyte integration)
- [ ] Field mapping UI (source → ontology object)
- [ ] Transform editor (embedded Monaco + SQL)
- [ ] Quality gate UI (Soda rules editor)
- [ ] Pipeline templates (hazard, satellite, social, etc.)

### Phase 5: Universal Ingestion (Weeks 10-12)
**Goal: 60+ connectors, 14 analytics products, all 10 domains**

- [ ] Weather connectors (GFS, ECMWF, ERA5, Open-Meteo)
- [ ] Satellite connectors (STAC, Copernicus, USGS)
- [ ] Social connectors (GDELT, Reddit, Mastodon)
- [ ] Transport connectors (AIS, OpenSky, GTFS)
- [ ] Energy connectors (ENTSO-E, EIA, commodity prices)
- [ ] Environment connectors (OpenAQ, CAMS, ocean data)
- [ ] Socioeconomic connectors (WorldPop, World Bank, OSM)
- [ ] Health connectors (WHO, CDC, ProMED)
- [ ] Financial connectors (Yahoo Finance, FRED)
- [ ] 14 analytics-ready data products (continuous computation)
- [ ] Cross-domain correlation engine

### Phase 6: Hardening (Weeks 13-14)
**Goal: Production-ready**

- [ ] Performance testing (1000 req/s)
- [ ] Security audit (ReBAC, ABAC, field redaction)
- [ ] Backup/restore procedures
- [ ] Kubernetes Helm chart
- [ ] Documentation
- [ ] Onboarding guide

---

## The "Just Like Palantir" User Flow

### Step 1: Connect Data Sources
```
User → Pipeline Builder → "Add Source" → "USGS Earthquake" → Configure → Save
Pipeline Builder → Dagster creates @dagster asset → Starts polling every 5 min
```

### Step 2: Data Flows into Ontology
```
USGS API → Dagster fetch → dbt normalize → Open Foundry Sync Engine → TypeDB + PostGIS
Ontology now contains: HazardEvent objects with links to Regions, seismic data as properties
```

### Step 3: Explore in Object Explorer
```
User → Object Explorer → Search "earthquake" → See all HazardEvent objects
Click one → See linked Regions, RiskAssessments, Alerts
Click "History" → See all versions of this object over time
Click "Lineage" → See exactly which pipeline created/updated this object
```

### Step 4: Build a Dashboard
```
User → Workshop → "New Dashboard" → Drag HazardEvent map widget → Drag risk score chart
Configure: "Show active hazards in Japan" → Dashboard renders with live data
Share dashboard → Team sees it with their permission scope
```

### Step 5: Ask AI
```
User → AI Chat → "What's the combined flood and wind risk for Tokyo this week?"
AI Agent → Queries ontology (weather, historical, infrastructure) → Runs predictive model
AI Agent → "Flood risk: 62% (moderate). Wind risk: 45% (low). Combined compound risk: 78% (high).
            Triggered by: GFS forecast showing 80mm precipitation + ERA5 soil moisture at 92%.
            Infrastructure exposure: 2,340 assets at moderate+ risk.
            Recommendation: Issue advance warning for Kanto region."
```

### Step 6: AI Takes Action
```
User → "Yes, issue the alert"
AI Agent → execute_action("IssueAlert", {severity: "HIGH", region: "Kanto", message: "..."})
Open Foundry Action Framework → Validate → Authorize → Execute → Audit → Emit Event
Valkey publishes event → WebSocket pushes to all connected dashboards
Notification sent via configured channels
Audit trail recorded permanently
```

### Step 7: Autonomous Monitoring
```
Hazard Sentinel Agent (runs 24/7):
  → Polls USGS, FIRMS, EONET every 5 min
  → Detects: "M5.8 earthquake near Osaka"
  → Cross-references: "3 active fires detected by VIIRS in same region"
  → Queries: "Infrastructure exposure: 450 assets"
  → Executes: IssueAlert(severity: MODERATE, region: Osaka)
  → Notifies: Predictive Agent to run aftershock model
  → Reports: "Multi-hazard event detected near Osaka. Earthquake + fires. 450 assets exposed."
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Data sources connected | 60+ (all 10 domains) |
| Ingestion latency | <5 min for real-time, <1h for batch |
| Ontology objects | 100K+ (with historical versions) |
| GraphQL query latency | <100ms p95 |
| Spatial query latency | <500ms for regional queries |
| AI agent response time | <10s for complex queries |
| Analytics products | 14 continuously updated |
| Uptime target | 99.5% |
| Concurrent users | 50+ |
