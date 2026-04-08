# TerraCube Sentinel — Architecture & Implementation Plan

**Build a Palantir Foundry/Ontology-like system for Earth Observation and Hazard Monitoring using Open Foundry + TypeDB + PostGIS + Dagster + DGGAL**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                          │
│  MapLibre GL (maps) │ React Dashboard │ Superset (BI)          │
└────────────────────────────┬────────────────────────────────────┘
                             │ GraphQL / REST / WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                 OPEN FOUNDRY (Fork)                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ODL Compiler (GraphQL SDL → APIs, SDKs, Auth)          │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  Query & API Layer (GraphQL, REST, WebSocket, FHIR)     │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  Action Framework (CEL, Preconditions, Audit, Events)   │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  Security (OpenFGA ReBAC, OIDC, Field Redaction)       │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  Sync Engine (JDBC, Debezium CDC, Conflict Resolution) │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  Ontology Engine (Schema Registry, Objects, Links)      │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│              STORAGE PROVIDER INTERFACE (SPI)                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐    │
│  │ TypeDB SPI   │ │ PostGIS SPI  │ │ Iceberg SPI          │    │
│  │ (NEW)        │ │ (NEW)        │ │ (NEW)                │    │
│  └──────┬───────┘ └──────┬───────┘ └──────────┬───────────┘    │
└─────────┼────────────────┼────────────────────┼─────────────────┘
          │                │                    │
   ┌──────▼──────┐  ┌─────▼──────┐    ┌───────▼───────┐
   │  TypeDB CE  │  │ PostgreSQL │    │  MinIO +      │
   │  (ontology  │  │ 17+PostGIS │    │  Apache       │
   │  graph)     │  │ +DGGAL topo│    │  Iceberg      │
   └─────────────┘  └────────────┘    └───────────────┘
                           │
                    ┌──────▼──────┐
                    │  Dagster    │
                    │  (pipelines)│
                    └──────┬──────┘
                           │
              ┌────────────▼────────────┐
              │  External Data Sources  │
              │  Open-Meteo, USGS,     │
              │  NASA FIRMS, STAC,     │
              │  ERA5, OSM, etc.       │
              └─────────────────────────┘
```

## Stack Summary

| Layer | Tool | Status |
|-------|------|--------|
| Ontology Platform | Open Foundry (syzygyhack fork) | Fork + extend |
| Type-Safe Graph | TypeDB Community Edition | New dependency |
| Spatial + DGGS | PostgreSQL 17 + PostGIS + DGGAL topology | From IDEAS project |
| Temporal Storage | Apache Iceberg + MinIO | New |
| Pipeline Orchestrator | Dagster | New |
| SQL Transforms | dbt | New |
| Data Catalog | OpenMetadata | New |
| Event Bus | Valkey (Redis-compatible) | New |
| Auth | Keycloak + OpenFGA + OPA | From Open Foundry |
| BI | Apache Superset | New |
| Maps | MapLibre GL + DGGAL WASM | From IDEAS project |
| Monitoring | Prometheus + Grafana + Loki | New |
| Frontend | React + TypeScript + Vite | New (port from IDEAS) |

## Data Sources (All Free)

- Sentinel-1/2/3 (Copernicus) — SAR, multispectral, ocean
- Landsat 8/9 (NASA/USGS) — land cover, surface temp
- GFS (NOAA) — weather forecasts
- ERA5 (ECMWF) — climate reanalysis
- USGS Earthquake — seismic events (real-time GeoJSON)
- NASA FIRMS — active fires
- NASA EONET — natural events
- Open-Meteo — weather API (historical + forecast)
- OSM — infrastructure (roads, buildings)
- WorldPop — population grids

## Domain Model (ODL Schema)

### Object Types
- Region, HazardEvent, Sensor, InfrastructureAsset
- RiskAssessment, Alert, DataSource
- SatellitePass, DataProduct, PipelineExecution

### Link Types
- AFFECTS (HazardEvent → Region)
- MONITORS (Sensor → Region)
- LOCATED_IN (InfrastructureAsset → Region)
- PRODUCES (Sensor → DataSource)
- TRIGGERS (HazardEvent → Alert)
- DERIVED_FROM (RiskAssessment → DataSource)
- CAPTURED_BY (SatellitePass → Sensor)
- CONTAINS (SatellitePass → DataProduct)
- ASSESSMENT_OF (RiskAssessment → Region)

### Action Types
- CreateRiskAssessment, IssueAlert, IngestSatelliteData, RunHazardPipeline
