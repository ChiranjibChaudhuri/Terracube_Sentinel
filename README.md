# TerraCube Sentinel — Master Documentation Index

**Palantir Foundry/Ontology-equivalent system for Earth Observation, Hazard Monitoring, and Planetary Intelligence.**

**Built entirely with open-source software.**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Open Foundry — The Ontology Engine](#4-open-foundry--the-ontology-engine)
5. [Domain Pack — TerraCube Sentinel Schema](#5-domain-pack--terra-cube-sentinel-schema)
6. [Storage Layer — TypeDB + PostGIS + Iceberg](#6-storage-layer--typedb--postgis--iceberg)
7. [Data Pipelines — Dagster](#7-data-pipelines--dagster)
8. [AI Agent Layer](#8-ai-agent-layer)
9. [Frontend](#9-frontend)
10. [Infrastructure — Docker Compose](#10-infrastructure--docker-compose)
11. [Data Sources — 90+ Free APIs](#11-data-sources--90-free-apis)
12. [Palantir Feature Parity Map](#12-palantir-feature-parity-map)
13. [Implementation Roadmap](#13-implementation-roadmap)
14. [Getting Started](#14-getting-started)
15. [Development Guide](#15-development-guide)

---

## 1. Project Overview

### What Is TerraCube Sentinel?

An operational ontology platform that ingests data from **90+ free sources** (satellite feeds, weather models, social media, maritime, economic, energy, health, environmental, financial), normalizes it into a **living, queryable, actionable digital twin** of the planet, then uses **AI agents** to autonomously detect patterns, generate insights, and take actions.

### How It Compares to Palantir Foundry

| Palantir Foundry | TerraCube Sentinel | Status |
|---|---|---|
| Ontology (Objects, Links, Actions) | Open Foundry + TypeDB + Neo4j | ✅ Implemented |
| Pipeline Builder | Dagster + dbt + Airbyte | ✅ 4 pipelines built, 56+ to go |
| Object Explorer | React + GraphQL | 🔄 Scaffolded |
| Workshop (App Builder) | React + widget library | 🔄 Scaffolded |
| AIP (AI Platform) | Ollama + LangGraph + 6 agents | 📋 Designed, not yet coded |
| Apollo (Metadata) | OpenMetadata | ✅ In Docker Compose |
| Spatial Analytics | PostGIS + DGGAL (ISEA3H) | ✅ Schema ready |
| Temporal Versioning | Apache Iceberg | ✅ In Docker Compose |
| Security (ReBAC) | OpenFGA + Keycloak + OPA | ✅ From Open Foundry |

### Design Principles

1. **Fork, don't reinvent** — Built on Open Foundry (syzygyhack), not from scratch
2. **Best-of-breed OSS** — Every layer uses the #1 open-source tool for that job
3. **Rust for the hot path** — Custom code in Rust only where no package exists
4. **90+ data sources** — Satellites, weather, social, maritime, economic, energy, health, environment, financial
5. **AI agents act autonomously** — Not just query, but detect, predict, correlate, and execute actions
6. **Palantir parity** — Full feature equivalent using open source

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                              │
│  MapLibre GL (maps) │ React Dashboard │ Superset (BI)              │
└────────────────────────────┬────────────────────────────────────────┘
                             │ GraphQL / REST / WebSocket
┌────────────────────────────▼────────────────────────────────────────┐
│                 OPEN FOUNDRY (Fork — Apache 2.0)                    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ODL Compiler (GraphQL SDL → APIs, SDKs, Auth models)       │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  Query & API Layer (GraphQL, REST, WebSocket, FHIR R4)     │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  Action Framework (CEL preconditions, audit, events)        │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  Security (OpenFGA ReBAC, OIDC, field redaction, consent)  │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  Sync Engine (JDBC, Debezium CDC, conflict resolution)     │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  Ontology Engine (Schema registry, objects, links)          │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│              STORAGE PROVIDER INTERFACE (SPI)                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐        │
│  │ TypeDB SPI   │ │ PostGIS SPI  │ │ Iceberg SPI          │        │
│  │ ✅ Partially  │ │ 📋 Planned   │ │ 📋 Planned           │        │
│  │    built     │ │              │ │                      │        │
│  └──────┬───────┘ └──────┬───────┘ └──────────┬───────────┘        │
└─────────┼────────────────┼────────────────────┼─────────────────────┘
          │                │                    │
   ┌──────▼──────┐  ┌─────▼──────┐    ┌───────▼───────┐
   │  TypeDB CE  │  │ PostgreSQL │    │  MinIO +      │
   │  (ontology  │  │ 17+PostGIS │    │  Apache       │
   │  graph)     │  │ +DGGAL topo│    │  Iceberg      │
   └─────────────┘  └─────┬──────┘    └───────────────┘
                           │
                    ┌──────▼──────┐
                    │  Dagster    │
                    │  (pipelines)│
                    └──────┬──────┘
                           │
              ┌────────────▼────────────┐
              │  90+ External Sources    │
              │  See Section 11          │
              └─────────────────────────┘
```

### Data Flow

```
External Source → Dagster Ingest → dbt Transform → Open Foundry Sync → TypeDB + PostGIS
                                                                        │
                                                                    Ontology
                                                                        │
                                                         ┌─────────────┼─────────────┐
                                                         │             │             │
                                                    GraphQL API   AI Agents    Dashboards
                                                    (frontend)    (LangGraph)   (Superset)
```

---

## 3. Directory Structure

```
TerraCube_Sentinel/
├── ARCHITECTURE.md                          # High-level architecture overview
├── PALANTIR_PARITY.md                       # Palantir feature comparison
├── UNIVERSAL_INGESTION_ARCHITECTURE.md       # 90+ data sources + AI agent design
├── SPI_INTERFACE_SUMMARY.md                 # Open Foundry SPI documentation
├── docker-compose.yml                       # All infrastructure services
├── docker-compose.dagster.yml               # Dagster webserver + daemon
├── init-db.sql                              # PostgreSQL init (extensions + DGGAL)
├── .gitignore
│
├── open-foundry/                            # Git submodule (syzygyhack/open-foundry)
│   ├── packages/
│   │   ├── spi/                             # Storage Provider Interface (23 methods)
│   │   ├── engine/                          # Ontology Engine (core)
│   │   ├── odl/                             # ODL Compiler (schema → APIs)
│   │   ├── actions/                         # Action Framework
│   │   ├── api/                             # GraphQL + REST + WebSocket
│   │   ├── sdk-typescript/                  # Auto-generated TypeScript SDK
│   │   ├── security/                        # ReBAC, OIDC, consent
│   │   ├── sync/                            # CDC + JDBC sync
│   │   ├── observability/                   # OpenTelemetry
│   │   ├── storage-postgres/                # PostgreSQL+AGE SPI (reference)
│   │   ├── storage-typedb/                  # TypeDB SPI (partially built)
│   │   └── storage-memory/                  # In-memory SPI (for tests)
│   ├── domain-packs/
│   │   ├── core/                            # Base scalars and interfaces
│   │   ├── nhs-acute/                       # NHS healthcare domain (reference)
│   │   └── geo-sentinel/                    # ⭐ OUR domain pack
│   │       ├── pack.yaml
│   │       ├── schema/                      # 11 ODL schema files
│   │       │   ├── enums.odl
│   │       │   ├── region.odl
│   │       │   ├── hazard-event.odl
│   │       │   ├── sensor.odl
│   │       │   ├── infrastructure-asset.odl
│   │       │   ├── risk-assessment.odl
│   │       │   ├── alert.odl
│   │       │   ├── data-source.odl
│   │       │   ├── satellite-pass.odl
│   │       │   ├── data-product.odl
│   │       │   ├── pipeline-execution.odl
│   │       │   └── links.odl               # 9 link types
│   │       └── actions/                     # 4 action YAML manifests
│   │           ├── issue-alert.yaml
│   │           ├── create-risk-assessment.yaml
│   │           ├── ingest-satellite-data.yaml
│   │           └── run-hazard-pipeline.yaml
│   ├── tests/
│   │   ├── spi-conformance/                 # SPI conformance test suite
│   │   ├── integration/                     # End-to-end tests
│   │   └── pilot-scenarios/                 # NHS pilot test scenarios
│   ├── deploy/
│   │   ├── docker-compose.yaml              # Open Foundry's own Docker setup
│   │   ├── helm/                            # Kubernetes Helm chart
│   │   ├── openfga-model.json               # ReBAC authorization model
│   │   └── otel-collector-config.yaml       # OpenTelemetry config
│   └── docs/
│       ├── open-foundry-spec-v2.md          # 2,744-line engineering specification
│       └── mvp-nhs-pilot.md                 # MVP scope document
│
├── dagster/                                 # Data pipelines
│   ├── pyproject.toml                       # Python dependencies
│   ├── workspace.yaml                       # Dagster workspace config
│   ├── dagster_dev.py                       # Dev server entry point
│   └── pipelines/
│       ├── real_time_hazards.py             # USGS + FIRMS + EONET + Open-Meteo (5 min)
│       ├── satellite_ingestion.py           # STAC search + COG download (3h)
│       ├── climate_reanalysis.py            # ERA5 degree-days + anomalies (daily)
│       └── infrastructure_vulnerability.py   # OSM + hazard exposure (weekly)
│
├── frontend/                                # React + TypeScript + Vite
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx                          # Main app (scaffolded)
│       ├── main.tsx
│       └── assets/
│
├── monitoring/                              # Observability
│   ├── prometheus.yml                       # Prometheus scrape configs
│   ├── grafana-datasources.yml              # Data source provisioning
│   └── grafana-dashboards/
│       ├── dashboards.yml                   # Dashboard provisioning
│       └── system-health.json               # 9-panel system health dashboard
│
├── agents/                                  # 📋 AI Agent Layer (designed, not yet built)
│   ├── config.py                            # Ollama + model config
│   ├── orchestrator.py                      # LangGraph agent orchestrator
│   ├── api.py                               # FastAPI server for agents
│   ├── tools/                               # 15+ tools for agents
│   │   ├── ontology_tools.py
│   │   ├── satellite_tools.py
│   │   ├── social_tools.py
│   │   ├── weather_tools.py
│   │   ├── action_tools.py
│   │   └── research_tools.py
│   └── agents/                              # 6 specialized agents
│       ├── hazard_sentinel.py
│       ├── predictive_analyst.py
│       ├── pattern_discovery.py
│       ├── automated_action.py
│       ├── reporting_agent.py
│       └── research_agent.py
│
└── docs/                                    # 📋 Additional documentation (planned)
    ├── ARCHITECTURE.md
    ├── API.md
    ├── ONTOLOGY.md
    └── DEPLOYMENT.md
```

---

## 4. Open Foundry — The Ontology Engine

### What It Provides (Already Built)

Open Foundry is an open-source (Apache 2.0) Palantir Foundry replica built by syzygyhack. It provides:

| Layer | Component | Status |
|-------|-----------|--------|
| **Schema** | ODL Compiler (GraphQL SDL + directives) | ✅ Built |
| **API** | GraphQL + REST + WebSocket + FHIR R4 | ✅ Built |
| **Engine** | Schema Registry, Object Store, Link Index | ✅ Built |
| **Actions** | CEL preconditions, transactional pipeline, audit | ✅ Built |
| **Security** | OpenFGA ReBAC, OIDC, field redaction, consent | ✅ Built |
| **Sync** | JDBC connectors, Debezium CDC, conflict resolution | ✅ Built |
| **Observability** | OpenTelemetry traces + metrics | ✅ Built |
| **SDK** | Auto-generated TypeScript client | ✅ Built |
| **Tests** | 1,372 tests | ✅ Passing |

### SPI (Storage Provider Interface)

The SPI defines **23 methods** that every storage backend must implement. This is how Open Foundry connects to different databases without hardcoding:

```typescript
interface StorageProvider {
  // Schema (2 methods)
  applySchema(ctx, schema): Promise<MigrationResult>
  getSchema(ctx, version?): Promise<OntologySchema>

  // Objects (7 methods)
  createObject(ctx, type, properties): Promise<OntologyObject>
  getObject(ctx, type, id): Promise<OntologyObject | null>
  updateObject(ctx, type, id, properties): Promise<OntologyObject>
  deleteObject(ctx, type, id, mode): Promise<void>
  queryObjects(ctx, type, filter, options?): Promise<ObjectPage>
  bulkMutate(ctx, request): Promise<BulkMutationResult>

  // Links (6 methods)
  createLink(ctx, type, fromId, toId, properties?): Promise<OntologyLink>
  getLink(ctx, type, linkId): Promise<OntologyLink | null>
  updateLink(ctx, type, linkId, properties): Promise<OntologyLink>
  deleteLink(ctx, type, linkId): Promise<void>
  getLinks(ctx, objectId, linkType, direction, options?): Promise<LinkPage>
  traverse(ctx, startId, path, options?): Promise<TraversalResult>

  // Transactions (1 method)
  beginTransaction(ctx): Promise<Transaction>

  // Temporal (2 methods)
  getObjectAtVersion(ctx, type, id, version): Promise<OntologyObject | null>
  getObjectAtTime(ctx, type, id, timestamp): Promise<OntologyObject | null>

  // Indices (1 method)
  ensureIndex(ctx, type, field, indexType): Promise<void>

  // Health (2 methods)
  healthCheck(): Promise<HealthStatus>
  capabilities(): StorageCapabilities
}
```

Full documentation: see `SPI_INTERFACE_SUMMARY.md`

### ODL (Ontology Definition Language)

ODL is an extension of GraphQL SDL. Any valid ODL schema is parseable by standard GraphQL tooling.

**Directives:**

| Directive | Purpose |
|-----------|---------|
| `@objectType` | Declares a real-world entity |
| `@linkType(from, to, cardinality)` | Declares a typed relationship |
| `@actionType` | Declares a validated, auditable mutation |
| `@function` | Declares a sandboxed read-only computation |
| `@primary` | Marks the unique ID field |
| `@unique` | Unique constraint |
| `@indexed` | Database index |
| `@searchable` | Full-text search |
| `@readonly` | Immutable field (auto-set) |
| `@computed` | Derived field (LAZY evaluation) |
| `@link(type, direction)` | Traversal reference on an ObjectType |
| `@param` | Action parameter |
| `@sensitive` | Auto-redacted in audit logs |

### Action Framework

Actions are Palantir's "Kinetic Layer" — validated, auditable mutations. Defined in two parts:

1. **ODL schema** — declares parameters
2. **YAML manifest** — declares preconditions, effects, side-effects

Example (IssueAlert):
```yaml
action: IssueAlert
preconditions:
  - expr: "hazardEvent.alertLevel != 'GREEN'"
    error: "No alert needed"
  - expr: "actor.hasRole('operator') || actor.hasRole('admin')"
    error: "Insufficient role"

effects:
  - type: createObject
    objectType: "Alert"
    set:
      severity: "params.severity"
      message: "params.message"

  - type: createLink
    linkType: "Triggers"
    from: "hazardEvent"
    to: "alert"

sideEffects:
  - type: event
    config:
      type: "terracube.geo.alert.issued"
  - type: webhook
    config:
      url: "${NOTIFICATION_WEBHOOK_URL}/alerts"
```

Execution pipeline: `Validate → Authorize → Consent → Preconditions → Execute → Audit → Emit Event`

---

## 5. Domain Pack — TerraCube Sentinel Schema

Located at `open-foundry/domain-packs/geo-sentinel/`

### Object Types (10)

| Type | Description | Key Properties |
|------|-------------|----------------|
| `Region` | Geographic area | name, type, population, gdpPerCapita, infrastructureScore, riskScore (computed), geometry |
| `HazardEvent` | Natural hazard | type, severity, geometry, startTime, endTime, confidence, alertLevel |
| `Sensor` | Monitoring device | type, name, geometry, operator, dataFrequency, lastReading, status |
| `InfrastructureAsset` | Built infrastructure | type, name, geometry, vulnerabilityScore, exposureLevel, condition |
| `RiskAssessment` | Risk analysis result | hazardType, riskScore, methodology, confidence, timestamp |
| `Alert` | Warning notification | severity, message, actionTaken, issuedAt, expiresAt |
| `DataSource` | Data provenance | name, provider, type, temporalResolution, spatialResolution |
| `SatellitePass` | Satellite overpass | acquisitionTime, processingLevel, cloudCover, stacItemUrl |
| `DataProduct` | Processed EO product | name, type, format, storagePath, sizeBytes |
| `PipelineExecution` | Pipeline run record | pipelineName, status, triggeredBy, nodeResults |

### Enums (15)

`HazardType` (8: EARTHQUAKE, FLOOD, WILDFIRE, STORM, VOLCANIC, LANDSLIDE, TSUNAMI, DROUGHT), `AlertLevel` (4: GREEN/YELLOW/ORANGE/RED), `SeverityLevel` (4), `SensorType` (6), `SensorStatus` (4), `InfrastructureType` (8), `ExposureLevel` (5), `ConditionGrade` (5), `RegionType` (5), `DataSourceType` (5), `ProcessingLevel` (7), `PipelineStatus` (5), `DataProductType` (4), `DataProductFormat` (6), `RiskMethodology` (4)

### Link Types (9)

| Link | From → To | Cardinality | Properties |
|------|-----------|-------------|------------|
| `Affects` | HazardEvent → Region | MANY:MANY | impactLevel, estimatedPopulationAffected |
| `Monitors` | Sensor → Region | MANY:MANY | since, coveragePercent |
| `LocatedIn` | InfrastructureAsset → Region | MANY:ONE | — |
| `Produces` | Sensor → DataSource | MANY:MANY | since |
| `Triggers` | HazardEvent → Alert | ONE:MANY | triggeredAt |
| `DerivedFrom` | RiskAssessment → DataSource | MANY:MANY | weight |
| `CapturedBy` | SatellitePass → Sensor | MANY:ONE | — |
| `Contains` | SatellitePass → DataProduct | ONE:MANY | bandName |
| `AssessmentOf` | RiskAssessment → Region | MANY:ONE | — |

### Action Types (4)

| Action | Parameters | Preconditions | Side Effects |
|--------|-----------|---------------|--------------|
| `IssueAlert` | hazardEventId, regionId, severity, message | Event not GREEN, user has operator/admin role | CloudEvent + webhook |
| `CreateRiskAssessment` | regionId, hazardType | Region exists, user has analyst+ role | CloudEvent |
| `IngestSatelliteData` | stacItemUrl | Valid URL, STAC item exists | Pipeline trigger |
| `RunHazardPipeline` | pipelineType, regionId | Pipeline exists, user has operator+ role | Pipeline trigger |

### ODL Schema Example (Region)

```graphql
extend schema @namespace(name: "terracube.geo", version: "0.1.0")

type Region @objectType {
  id: ID! @primary
  name: String! @searchable(weight: 2.0)
  type: RegionType!
  population: Int @indexed
  gdpPerCapita: Float
  infrastructureScore: Float @constraint(expr: "value == null || (value >= 0.0 && value <= 100.0)")
  riskScore: Float @computed(fn: "avg", args: { source: "assessments.riskScore" }, cache: LAZY)
  geometry: JSON!

  hazardEvents: [HazardEvent!]! @link(type: "Affects", direction: INBOUND)
  sensors: [Sensor!]! @link(type: "Monitors", direction: INBOUND)
  infrastructure: [InfrastructureAsset!]! @link(type: "LocatedIn", direction: INBOUND)
  assessments: [RiskAssessment!]! @link(type: "AssessmentOf", direction: INBOUND)
}
```

---

## 6. Storage Layer

### TypeDB (Ontology Graph)

**What it stores:** Object types, link types, type constraints, schema enforcement

**Concept mapping:**
| ODL Concept | TypeDB Concept |
|---|---|
| `@objectType` | Entity type |
| `@linkType` | Relation type (with roles) |
| Scalar property | Attribute type |
| `@unique` | Attribute `@unique` |
| `@indexed` | Attribute `@index` |
| `@computed` | Application-layer (not in TypeDB) |

**SPI Provider:** `open-foundry/packages/storage-typedb/` — partially implemented with:
- Schema management (ODL → TypeQL schema generation)
- Object CRUD operations
- Link operations
- Transaction support (AutoCommit + Transactional queryable)
- Temporal queries (object versioning)

**Connection:** gRPC on port 1729

### PostgreSQL 17 + PostGIS (Spatial + Relational)

**What it stores:**
- DGGAL topology table (`dggs.dgg_topology`) — ISEA3H equal-area cell hierarchy
- Ontology staging tables (`ontology.hazard_events_staging`)
- External data staging (bronze/silver layers)

**Extensions loaded:**
- `postgis` — spatial types and queries
- `postgis_raster` — raster data support
- `age` — Apache AGE graph (Cypher queries on `sentinel` graph)
- `pg_trgm` — trigram text search
- `uuid-ossp` — UUID generation
- `pgcrypto` — cryptographic functions
- `vector` — pgvector (for future RAG/embeddings)

**DGGAL Topology Table:**
```sql
CREATE TABLE dggs.dgg_topology (
    dggid          BIGINT PRIMARY KEY,
    parent_dggid   BIGINT REFERENCES dggs.dgg_topology(dggid),
    resolution     INTEGER NOT NULL,
    centroid       GEOMETRY(Point, 4326),
    boundary       GEOMETRY(Polygon, 4326),
    neighbors      BIGINT[] NOT NULL DEFAULT '{}',
    area_sqkm      DOUBLE PRECISION,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

**Apache AGE Graph:**
```sql
-- Example: Find all regions affected by flood events
SELECT * FROM cypher('sentinel', $$
    MATCH (h:HazardEvent {type: 'Flood'})-[:AFFECTS]->(r:Region)
    WHERE h.start_time > datetime() - interval '7 days'
    RETURN h, r
$$) AS (h agtype, r agtype);
```

### Apache Iceberg + MinIO (Temporal Storage)

**What it stores:** Raw EO data (GeoTIFF, NetCDF, GRIB2), processed products, time-travel snapshots

**Why:** Iceberg provides:
- Time-travel (query any snapshot)
- Schema evolution
- Partition evolution
- Multi-engine support (DuckDB, Spark, Trino)

**MinIO:** S3-compatible object storage for all files. Console at port 9001.

---

## 7. Data Pipelines — Dagster

### Pipeline: real_time_hazards (every 5 minutes)

**Sources:** USGS Earthquake, NASA FIRMS, NASA EONET, Open-Meteo

**Flow:**
```
fetch_open_meteo_weather → normalize_weather → [HazardRecord]
fetch_usgs_earthquakes → normalize_earthquakes → [HazardRecord]
fetch_nasa_firms → normalize_fires → [HazardRecord]
fetch_nasa_eonet → normalize_events → [HazardRecord]
                                    ↓
                        load_hazards_to_foundry → Open Foundry REST API
```

**Data model:** All sources normalized to `HazardRecord` dataclass with fields: source, hazard_type, severity, alert_level, geometry (GeoJSON), start_time, end_time, confidence, raw

**Severity mapping (USGS example):**
- M7.0+ → CRITICAL
- M5.0-6.9 → HIGH
- M3.0-4.9 → MODERATE
- <M3.0 → LOW

### Pipeline: satellite_ingestion (every 3 hours)

**Sources:** Earth Search STAC, Copernicus Dataspace STAC

**Flow:**
```
search_stac_catalogs → filter_by_aoi_and_cloud_cover → download_cog_assets →
store_in_minio → register_data_products_in_foundry
```

### Pipeline: climate_reanalysis (daily at 06:00 UTC)

**Sources:** ERA5 CDS API

**Flow:**
```
download_era5_variables → compute_degree_days → detect_anomalies →
aggregate_to_regions → update_risk_assessments_in_foundry
```

### Pipeline: infrastructure_vulnerability (weekly)

**Sources:** OSM Overpass API

**Flow:**
```
download_osm_infrastructure → clip_to_regions → compute_hazard_exposure →
update_infrastructure_assets_in_foundry
```

### Pipeline Configuration

```yaml
# dagster/workspace.yaml
load_from:
  - python_module:pipelines.real_time_hazards
  - python_module:pipelines.satellite_ingestion
  - python_module:pipelines.climate_reanalysis
  - python_module:pipelines.infrastructure_vulnerability
```

---

## 8. AI Agent Layer

**Status:** Designed in `UNIVERSAL_INGESTION_ARCHITECTURE.md`. Not yet implemented.

### Architecture

```
LangGraph Orchestrator
├── routes user queries to appropriate agent
├── manages multi-agent workflows
├── human-in-the-loop for high-severity actions
└── state management across interactions

6 Specialized Agents:
├── Hazard Sentinel — monitors feeds, detects events, triggers alerts
├── Predictive Analyst — runs models, forecasts risk, scenario simulation
├── Pattern Discovery — cross-domain correlation, anomaly detection
├── Automated Action — executes Open Foundry actions with audit
├── Reporting — generates situation reports, briefings
└── Research — web search, fact-checking, data enrichment
```

### Tool Interface (15+ tools)

| Tool Category | Tools |
|---|---|
| Ontology | query_objects, get_object, traverse_graph, get_history, spatial_query, count_objects |
| Satellite | search_stac, get_coverage, compute_index |
| Social | search_gdelt, search_reddit, search_mastodon, sentiment_analysis |
| Weather | get_forecast, get_history, get_model |
| Actions | execute_action, generate_alert, trigger_pipeline |
| Research | web_search, get_news, get_historical_context |

### Example Agent Interaction

```
User: "What's the flood risk for Bangladesh next week?"

Hazard Sentinel → route to Predictive Analyst

Predictive Analyst:
  1. query_objects(type="Region", name="Bangladesh")
  2. get_weather_forecast(lat=23.68, lng=90.35, hours=168) → Open-Meteo
  3. get_history(type="RiskAssessment", region="Bangladesh", field="riskScore") → baseline
  4. spatial_query(geometry=Bangladesh, type="InfrastructureAsset") → exposure count
  5. run_model(model="flood_risk", inputs={precipitation, soil_moisture, exposure})
  
Response: "Flood risk: 78% (HIGH). GFS forecasts 150mm precipitation in 48h.
           Soil moisture at 92%. 2,340 infrastructure assets at moderate+ risk.
           Recommendation: Issue 48h advance warning for Dhaka division."
```

---

## 9. Frontend

**Status:** Scaffolded (Vite + React + TypeScript). Full pages not yet built.

### Planned Pages

| Page | Purpose | Status |
|------|---------|--------|
| Object Explorer | Browse/search ontology objects with graph traversal | 📋 Designed |
| Map View | MapLibre GL with hazard/sensor/infrastructure layers | 📋 Designed |
| Dashboard Builder | Drag-and-drop widget dashboard (Palantir Workshop) | 📋 Designed |
| AI Chat | Natural language interface to agents (Palantir AIP) | 📋 Designed |
| Pipeline Status | Dagster pipeline monitoring | 📋 Designed |
| Settings | User preferences, auth config | 📋 Designed |

### Tech Stack

- React 19 + TypeScript
- Vite (build tool)
- Tailwind CSS
- @apollo/client (GraphQL)
- @maplibre/maplibre-gl + react-map-gl (maps)
- @tanstack/react-query (data fetching)
- zustand (state management)
- recharts (charts)
- lucide-react (icons)
- date-fns (dates)

---

## 10. Infrastructure — Docker Compose

### Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | pgvector/pgvector:pg17 | 5432 | PostGIS + AGE + pgvector |
| `typedb` | typedb/typedb:latest | 1729 | Ontology graph storage |
| `minio` | minio/minio | 9000/9001 | S3-compatible object storage |
| `valkey` | valkey/valkey:8 | 6379 | Event bus + cache |
| `keycloak` | quay.io/keycloak/keycloak:26 | 8180 | OIDC/SSO |
| `openmetadata` | docker.open-metadata.org:latest | 8585 | Data catalog |
| `prometheus` | prom/prometheus | 9090 | Metrics collection |
| `grafana` | grafana/grafana | 3002 | Dashboards |
| `loki` | grafana/loki | 3100 | Log aggregation |

### Monitoring

- **Prometheus:** Scrapes all services
- **Grafana:** 9-panel system health dashboard (pre-built JSON)
- **Loki:** Aggregates logs from all services

### Environment Variables

See `.env.example` for all required variables (passwords, URLs, keys).

### Starting Everything

```bash
cp .env.example .env
docker compose up -d          # Infrastructure services
docker compose -f docker-compose.dagster.yml up -d  # Dagster
cd open-foundry && pnpm dev   # Open Foundry API
cd frontend && npm run dev    # Frontend dev server
cd dagster && dagster dev     # Pipeline dev server
```

---

## 11. Data Sources — 90+ Free APIs

Full details in `UNIVERSAL_INGESTION_ARCHITECTURE.md`

### By Domain

| Domain | Sources | Count | Key APIs |
|--------|---------|-------|----------|
| Satellite/EO | Sentinel 1/2/3/5P, Landsat, MODIS, VIIRS, GOES, Himawari, GPM, GRACE-FO, SMAP, ECOSTRESS | 17 | Copernicus Dataspace, USGS, NASA Earthdata |
| Weather/Climate | GFS, ECMWF, ERA5, CMIP6, NCEP, Open-Meteo, OpenWeather | 12 | NOMADS, CDS API, Open-Meteo API |
| Geophysical/Hazard | USGS Earthquake, NASA FIRMS, EONET, GDACS, PTWC, IBTrACS, EM-DAT | 12 | USGS API, FIRMS API, EONET REST |
| Social Media | GDELT, X/Twitter, Reddit, Mastodon, Bluesky, Telegram, ACLED | 8 | GDELT API, PRAW, Mastodon API |
| Transportation | AIS, OpenSky, ADS-B, GTFS, TomTom, HERE | 8 | MarineTraffic, OpenSky Network |
| Energy | ENTSO-E, EIA, IEA, World Bank, NREL, IRENA | 10 | ENTSO-E API, EIA API |
| Environment | OpenAQ, WAQI, CAMS, Copernicus Marine, GBIF, IUCN | 13 | OpenAQ API, CAMS API |
| Socioeconomic | WorldPop, OSM, World Bank, UN Data, OECD | 11 | OSM API, World Bank API |
| Health | WHO, CDC, ProMED, Johns Hopkins CSSE | 5 | WHO GHO API, CDC WONDER |
| Financial | Yahoo Finance, FRED, Alpha Vantage, CoinGecko | 5 | yfinance, FRED API |
| **Total** | | **101** | |

### STAC Catalogs (unified satellite search)

- Earth Search (Element84) — Sentinel + Landsat
- Microsoft Planetary Computer — 200+ datasets
- Copernicus Dataspace STAC — Full Copernicus program
- USGS STAC — Landsat collection
- NASA CMR STAC — NASA Earthdata

---

## 12. Palantir Feature Parity Map

Full details in `PALANTIR_PARITY.md`

| Palantir Product | Our Equivalent | Status |
|---|---|---|
| Ontology | Open Foundry + TypeDB | ✅ Working |
| Pipeline Builder | Dagster + dbt + Airbyte | ✅ 4 pipelines, 56+ to go |
| Quiver (Code Editor) | Monaco in Dagster UI | 📋 Planned |
| Contour (Data Quality) | Soda | ✅ In stack |
| Object Explorer | React + GraphQL | 📋 Designed |
| Workshop (App Builder) | React + widgets | 📋 Designed |
| AIP (AI Platform) | Ollama + LangGraph + 6 agents | 📋 Designed |
| Apollo (Metadata) | OpenMetadata | ✅ In Docker Compose |
| SDK | Open Foundry auto-generated SDK | ✅ Working |
| Gotham (Intelligence) | Neo4j + GDELT | 📋 Planned |

### User Flow (Palantir-equivalent)

1. **Connect data** → Pipeline Builder → source picker → field mapping → auto-ingest
2. **Explore ontology** → Object Explorer → search → traverse graph → view history → lineage
3. **Build dashboards** → Workshop → drag widgets → configure → share with team
4. **Ask AI** → AIP Chat → natural language → agents query ontology + run models → actionable answer
5. **AI acts** → Agent executes action → preconditions validated → audit trail → event published → all dashboards update

---

## 13. Implementation Roadmap

### Phase 1: Core Platform (Weeks 1-3) — IN PROGRESS

- [x] Open Foundry forked + analyzed
- [x] Docker Compose infra (9 services)
- [x] DGGAL topology table
- [x] Geo Domain Pack (10 object types, 9 link types, 4 actions)
- [x] Dagster pipelines (4 core)
- [x] Monitoring (Prometheus, Grafana, Loki)
- [x] TypeDB SPI provider (partially built — schema, CRUD, links, temporal, transactions)
- [ ] Complete TypeDB SPI (full SPI conformance)
- [ ] PostGIS SPI provider
- [ ] dbt models (bronze → silver → gold)
- [ ] 20 priority connectors
- [ ] End-to-end test: API → Dagster → dbt → Open Foundry → GraphQL

### Phase 2: AI Agents (Weeks 4-5)

- [ ] Ollama deployment
- [ ] LangGraph agent orchestrator
- [ ] 15+ tool implementations
- [ ] 6 specialized agents
- [ ] FastAPI agent server
- [ ] Chat interface (frontend)
- [ ] RAG pipeline

### Phase 3: Frontend (Weeks 6-7)

- [ ] Object Explorer page
- [ ] Map View with ontology layers
- [ ] Dashboard builder (simplified)
- [ ] AI Chat page
- [ ] Pipeline status page

### Phase 4: Pipeline Builder (Weeks 8-9)

- [ ] Visual pipeline editor
- [ ] Source connector picker
- [ ] Field mapping UI
- [ ] Transform editor (Monaco)
- [ ] Quality gate UI
- [ ] Pipeline templates

### Phase 5: Universal Ingestion (Weeks 10-12)

- [ ] 60+ additional connectors (all 10 domains)
- [ ] 14 analytics-ready data products
- [ ] Cross-domain correlation engine

### Phase 6: Hardening (Weeks 13-14)

- [ ] Performance testing
- [ ] Security audit
- [ ] Kubernetes Helm chart
- [ ] Documentation
- [ ] Onboarding guide

---

## 14. Getting Started

### Prerequisites

- Docker + Docker Compose v2
- Node.js 20+ with pnpm 9+
- Python 3.11+ with uv or pip
- Rust stable (for TypeDB SPI build if needed)
- Git

### Quick Start

```bash
# 1. Clone (with submodules)
git clone --recurse-submodules <repo-url> TerraCube_Sentinel
cd TerraCube_Sentinel

# 2. Configure environment
cp .env.example .env
# Edit .env with your passwords and API keys

# 3. Start infrastructure
docker compose up -d

# 4. Verify services
docker compose ps                          # All services healthy?
curl http://localhost:1729                  # TypeDB responding
psql -h localhost -U sentinel -d sentinel   # PostgreSQL connected

# 5. Start Open Foundry
cd open-foundry
pnpm install
pnpm run build
pnpm run dev                               # Starts on port 8080

# 6. Start Dagster
cd dagster
pip install -e ".[dev]"
dagster dev                                # Starts on port 3000

# 7. Start frontend
cd frontend
npm install
npm run dev                                 # Starts on port 5173

# 8. Open in browser
# Frontend: http://localhost:5173
# Dagster: http://localhost:3000
# Grafana: http://localhost:3002
# MinIO Console: http://localhost:9001
# Keycloak: http://localhost:8180
# OpenMetadata: http://localhost:8585
```

---

## 15. Development Guide

### Adding a New Object Type

1. Create ODL file: `open-foundry/domain-packs/geo-sentinel/schema/my-type.odl`
2. Define with `@objectType` directive and properties
3. Add to `pack.yaml`
4. Run `pnpm run build` — ODL compiler generates GraphQL API
5. TypeDB SPI auto-creates the schema on first use

### Adding a New Link Type

1. Create in `schema/links.odl` (or separate file)
2. Define with `@linkType(from, to, cardinality)` directive
3. Add `@link` references on both ObjectTypes
4. Run `pnpm run build`

### Adding a New Action

1. Add ODL definition with `@actionType` directive
2. Create YAML manifest in `actions/` with preconditions + effects
3. Run `pnpm run build` — Action appears in GraphQL mutations

### Adding a New Data Source Connector

1. Create Dagster `@asset` in `dagster/pipelines/`
2. Define fetch function (httpx/requests)
3. Define normalize function (→ domain dataclass)
4. Define load function (→ Open Foundry REST API)
5. Add to `workspace.yaml`
6. Set schedule via Dagster `ScheduleDefinition`

### Adding a New AI Agent

1. Create file in `agents/agents/`
2. Define system prompt + tools list
3. Register in `agents/orchestrator.py`
4. Agent automatically available via chat API

### Running Tests

```bash
# Open Foundry tests
cd open-foundry
pnpm run test                    # All 1,372 tests
pnpm run test:spi-conformance    # SPI conformance suite

# Dagster tests
cd dagster
pytest pipelines/ -v

# TypeDB SPI tests
cd open-foundry
pnpm --filter storage-typedb test
```

---

## File Reference

| File | Description |
|------|-------------|
| `ARCHITECTURE.md` | High-level system architecture |
| `PALANTIR_PARITY.md` | Palantir feature comparison + user flows |
| `UNIVERSAL_INGESTION_ARCHITECTURE.md` | 90+ data sources + AI agent design + analytics products |
| `SPI_INTERFACE_SUMMARY.md` | Open Foundry SPI (23 methods) + PostgreSQL provider analysis |
| `docker-compose.yml` | Infrastructure (9 services) |
| `init-db.sql` | PostgreSQL extensions + DGGAL topology + staging tables |
| `.env.example` | Environment variables template |
| `open-foundry/docs/open-foundry-spec-v2.md` | Open Foundry engineering spec (2,744 lines) |
| `open-foundry/domain-packs/geo-sentinel/` | Our domain pack (schemas + actions) |
| `dagster/pipelines/` | Data pipeline implementations |
| `monitoring/` | Prometheus + Grafana configs |

---

*Last updated: 2026-04-08*
*Built with Claude Code (4 parallel sessions) + manual research*
