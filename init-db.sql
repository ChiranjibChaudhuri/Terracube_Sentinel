-- TerraCube Sentinel — PostgreSQL Initialization
-- Runs automatically on first container start via docker-entrypoint-initdb.d

-- ─── Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;
CREATE EXTENSION IF NOT EXISTS age;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector (included in base image)

-- ─── Apache AGE Graph ───────────────────────────────────────────────────────
LOAD 'age';
SET search_path TO ag_catalog, "$user", public;
SELECT create_graph('sentinel');

-- ─── DGGS Schema ────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS dggs;

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

CREATE INDEX idx_dgg_parent     ON dggs.dgg_topology(parent_dggid);
CREATE INDEX idx_dgg_resolution ON dggs.dgg_topology(resolution);
CREATE INDEX idx_dgg_boundary   ON dggs.dgg_topology USING GIST(boundary);
CREATE INDEX idx_dgg_centroid   ON dggs.dgg_topology USING GIST(centroid);

-- ─── Ontology Schema (External Data Staging) ────────────────────────────────
CREATE SCHEMA IF NOT EXISTS ontology;

CREATE TABLE ontology.hazard_events_staging (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source          TEXT NOT NULL,
    raw_data        JSONB NOT NULL,
    normalized_data JSONB,
    ingested_at     TIMESTAMPTZ DEFAULT NOW(),
    status          TEXT DEFAULT 'pending'
);

CREATE INDEX idx_hazard_staging_status ON ontology.hazard_events_staging(status);
CREATE INDEX idx_hazard_staging_ingested ON ontology.hazard_events_staging(ingested_at DESC);
