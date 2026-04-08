# Open Foundry — SPI Interface & Architecture Summary

> Generated from analysis of [syzygyhack/open-foundry](https://github.com/syzygyhack/open-foundry)

---

## 1. The SPI (Storage Provider Interface)

The SPI is defined in `open-foundry/packages/spi/src/`. It is the contract every storage backend must implement.

### 1.1 StorageProvider Interface — All 23 Methods

Source: `packages/spi/src/storage-provider.ts`

```typescript
export interface StorageProvider {
  // ─── Schema ───
  applySchema(ctx: RequestContext, schema: OntologySchema): Promise<MigrationResult>;
  getSchema(ctx: RequestContext, version?: number): Promise<OntologySchema>;

  // ─── Objects (CRUD + Query + Bulk) ───
  createObject(ctx: RequestContext, type: string, properties: Record<string, unknown>): Promise<OntologyObject>;
  getObject(ctx: RequestContext, type: string, id: string): Promise<OntologyObject | null>;
  updateObject(ctx: RequestContext, type: string, id: string, properties: Record<string, unknown>): Promise<OntologyObject>;
  deleteObject(ctx: RequestContext, type: string, id: string, mode: 'soft' | 'hard'): Promise<void>;
  queryObjects(ctx: RequestContext, type: string, filter: FilterExpression, options?: QueryOptions): Promise<ObjectPage>;
  bulkMutate(ctx: RequestContext, request: BulkMutationRequest): Promise<BulkMutationResult>;

  // ─── Links (CRUD + Query + Traversal) ───
  createLink(ctx: RequestContext, type: string, fromId: string, toId: string, properties?: Record<string, unknown>): Promise<OntologyLink>;
  getLink(ctx: RequestContext, type: string, linkId: string): Promise<OntologyLink | null>;
  updateLink(ctx: RequestContext, type: string, linkId: string, properties: Record<string, unknown>): Promise<OntologyLink>;
  deleteLink(ctx: RequestContext, type: string, linkId: string): Promise<void>;
  getLinks(ctx: RequestContext, objectId: string, linkType: string, direction: 'inbound' | 'outbound', options?: QueryOptions): Promise<LinkPage>;
  traverse(ctx: RequestContext, startId: string, path: TraversalPath, options?: TraversalOptions): Promise<TraversalResult>;

  // ─── Transactions ───
  beginTransaction(ctx: RequestContext): Promise<Transaction>;

  // ─── Versioning / Temporal ───
  getObjectAtVersion(ctx: RequestContext, type: string, id: string, version: number): Promise<OntologyObject | null>;
  getObjectAtTime(ctx: RequestContext, type: string, id: string, timestamp: DateTime): Promise<OntologyObject | null>;

  // ─── Indices ───
  ensureIndex(ctx: RequestContext, type: string, field: string, indexType: IndexType): Promise<void>;

  // ─── Health ───
  healthCheck(): Promise<HealthStatus>;
  capabilities(): StorageCapabilities;
}
```

### 1.2 Transaction Interface — 8 Methods

Source: `packages/spi/src/transaction.ts`

```typescript
export interface Transaction {
  createObject(type: string, properties: Record<string, unknown>): Promise<OntologyObject>;
  updateObject(type: string, id: string, properties: Record<string, unknown>): Promise<OntologyObject>;
  deleteObject(type: string, id: string, mode: 'soft' | 'hard'): Promise<void>;
  createLink(type: string, fromId: string, toId: string, properties?: Record<string, unknown>): Promise<OntologyLink>;
  updateLink(type: string, linkId: string, properties: Record<string, unknown>): Promise<OntologyLink>;
  deleteLink(type: string, linkId: string): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
```

### 1.3 Key Supporting Types

| Type | Source File | Purpose |
|------|------------|---------|
| `RequestContext` | `ontology.ts` | `{ tenantId, actorId?, traceId? }` — passed to every operation for tenant isolation |
| `OntologyObject` | `ontology.ts` | Persisted entity with `id`, `type`, `version`, `tenantId`, `properties`, timestamps, `deletedAt?` |
| `OntologyLink` | `ontology.ts` | Directed relationship: `id`, `type`, `fromId`, `toId`, `properties`, `version`, timestamps |
| `OntologySchema` | `ontology.ts` | `{ version, objectTypes[], linkTypes[] }` |
| `ObjectTypeDefinition` | `ontology.ts` | `{ name, properties[], indexes[]? }` |
| `LinkTypeDefinition` | `ontology.ts` | `{ name, fromType, toType, cardinality, properties? }` — cardinality: ONE_TO_ONE / ONE_TO_MANY / MANY_TO_MANY |
| `PropertyDefinition` | `ontology.ts` | `{ name, type, required?, defaultValue?, description? }` |
| `FilterExpression` | `ontology.ts` | Union of `FieldPredicate` (eq, neq, gt, gte, lt, lte, in, contains, startsWith, exists) and `LogicalPredicate` (and, or, not) |
| `QueryOptions` | `ontology.ts` | `{ limit?, offset?, orderBy?, includeDeleted?, asOfVersion?, asOfTime? }` |
| `TraversalPath` | `ontology.ts` | Array of `TraversalStep { linkType, direction, filter?, maxDepth? }` |
| `ObjectPage` / `LinkPage` | `ontology.ts` | `{ items[], totalCount, hasNextPage, cursor? }` |
| `BulkMutationRequest` | `ontology.ts` | `{ idempotencyKey, operations[] }` — ops are createObject / updateObject / deleteObject |
| `StorageCapabilities` | `ontology.ts` | Feature flags: transactions, temporal queries, full-text search, geo, graph traversal, bulk mutations, max traversal depth, replication support |
| `IndexType` | `ontology.ts` | BTREE / HASH / GIN / GIST / FULLTEXT |
| `MigrationResult` | `ontology.ts` | `{ success, fromVersion, toVersion, appliedAt, details? }` |
| `HealthStatus` | `ontology.ts` | `{ healthy, provider, latencyMs, details? }` |
| `DateTime` / `Duration` | `scalars.ts` | ISO 8601 string aliases |
| `PlatformError` | `errors.ts` | `{ code, category, message, retryable, details?, traceId? }` — categories: validation, authorization, consent, conflict, rate_limit, not_found, system, timeout |
| `CloudEvent<T>` | `events.ts` | CloudEvents 1.0 envelope for object/link/action/schema events |
| `AuditRecord` | `audit.ts` | Full audit trail: actor, operation, before/after snapshots |
| `ConsentManager` | `consent.ts` | Interface for data purpose consent: `checkConsent`, `recordConsent`, `getConsentRecord` |
| `FieldProvenance` | `provenance.ts` | Tracks origin of field values: ACTION / SYNC / FUNCTION sources |

---

## 2. PostgreSQL + Apache AGE Provider Implementation

Source: `open-foundry/packages/storage-postgres/src/`

### 2.1 Architecture Overview

The `PostgresStorageProvider` class implements all 23 `StorageProvider` methods using:

- **PostgreSQL** for relational storage (objects, links, history, audit, lineage)
- **Apache AGE** for graph operations (vertices, edges, traversal)
- **Dual-write pattern**: every object/link mutation writes to both SQL tables and AGE graph

### 2.2 DDL Generation (Schema → Tables)

When `applySchema()` is called, the provider generates DDL for:

| Artifact | Source | What It Creates |
|----------|--------|-----------------|
| Object tables | `schema/ddl-objects.ts` | `{type}` table + `{type}_history` table per ObjectType |
| Link tables | `schema/ddl-links.ts` | `{linkType}` table per LinkType with cardinality indexes |
| Graph labels | `schema/ddl-graph.ts` | AGE vertex labels (per ObjectType) + edge labels (per LinkType) |
| Audit schema | `schema/ddl-audit.ts` | `audit.audit_records` table with indexes |
| Lineage schema | `schema/ddl-lineage.ts` | `lineage.field_provenance` table with indexes |

**System columns** on every object table:
`_tenant_id`, `_id`, `_type`, `_version`, `_created_at`, `_updated_at`, `_deleted_at`

**Type mapping** (ODL → PostgreSQL):
| ODL Type | PG Type |
|----------|---------|
| String, ID, NHSNumber, ODS, SNOMED, Email, Phone, URL, Markdown | TEXT |
| Int | INTEGER |
| Float | DOUBLE PRECISION |
| Boolean | BOOLEAN |
| DateTime | TIMESTAMPTZ |
| Date | DATE |
| Time | TIME |
| Duration | INTERVAL |
| JSON | JSONB |

### 2.3 Object Operations (`objects/object-crud.ts`)

- **Create**: INSERT into table → INSERT into history → CREATE AGE vertex `(:Type {tenant_id, id})`
- **Read**: SELECT with `WHERE _tenant_id = $1 AND _id = $2`
- **Update**: UPDATE with version increment → INSERT history → SET vertex property
- **Soft Delete**: SET `_deleted_at` + version increment → INSERT history (vertex kept)
- **Hard Delete**: DELETE history → DELETE main → `DETACH DELETE` AGE vertex (removes edges)
- **Query**: `FilterExpression` → parameterized SQL with `$N` binds. MAX 1000 rows.
- **Bulk**: Iterates operations within idempotency envelope

### 2.4 Link Operations (`links/link-crud.ts`)

- **Create**: Validates both endpoints exist and aren't deleted → enforces cardinality (ONE_TO_ONE: max 1 each direction; ONE_TO_MANY: max 1 to target; MANY_TO_MANY: no constraint) → INSERT row → CREATE AGE edge
- **Delete**: Soft delete (set `_deleted_at`) → DELETE AGE edge
- **Query**: Directional filtering (inbound/outbound). MAX 1000 rows.

### 2.5 Graph Traversal (`links/traversal.ts`)

SQL-based frontier expansion:
1. Start from a single node ID
2. For each `TraversalStep`: query link table for matching direction, collect target IDs
3. Fetch target objects grouped by type
4. Expand frontier to collected targets
5. **Limits**: max 10 steps depth, max 10,000 nodes

### 2.6 Temporal Queries (`temporal/temporal-queries.ts`)

- **By version**: Query `{type}_history WHERE _version = $3`
- **By timestamp**: Query `{type}_history WHERE _history_created_at <= $3 ORDER BY _version DESC LIMIT 1`

### 2.7 Transactions (`transactions/pg-transaction.ts`)

- `beginTransaction()` acquires a `PoolClient`, issues `BEGIN`
- All operations accept optional `tx` parameter — uses `tx.client` or pool
- `commit()` / `rollback()` release the client

### 2.8 Apache AGE Integration Details

- **Graph name**: `openfoundry` (single shared graph)
- **Cypher execution**: `SELECT * FROM cypher('openfoundry', $$...$$) AS (v agtype)`
- **Injection prevention**: AGE doesn't support parameterized Cypher, so all interpolated values are sanitized (reject `'"``\${}`)
- **Graceful degradation**: AGE failures are caught and logged — system continues with SQL-only operation

### 2.9 Capabilities Reported

```typescript
{
  supportsTransactions: true,
  supportsTemporalQueries: true,
  supportsFullTextSearch: true,
  supportsGeoQueries: false,
  supportsGraphTraversal: true,
  supportsBulkMutations: true,
  maxTraversalDepth: 10,
  replicationSupport: 'STREAMING_REPLICATION'
}
```

---

## 3. Domain Pack Structure

Source: `open-foundry/domain-packs/`

### 3.1 File Layout

```
domain-pack-name/
├── pack.yaml                 # Manifest (required)
├── package.json              # NPM metadata (required)
├── tsconfig.json             # TypeScript config (required)
├── schema/                   # ODL schema files (required, ≥1 file)
│   ├── enums.odl
│   ├── patient.odl
│   ├── ward.odl
│   └── links.odl
├── actions/                  # Action manifests (optional)
│   ├── admit-patient.yaml
│   ├── discharge-patient.yaml
│   └── transfer-ward.yaml
├── connectors/               # Data source connectors (optional)
│   └── pas-jdbc.yaml
├── permissions/              # OpenFGA authorization models (optional)
│   └── nhs-roles.fga
└── src/__tests__/            # Tests (optional)
    └── nhs-acute-pack.test.ts
```

### 3.2 pack.yaml — The Manifest

```yaml
name: nhs-acute
version: 0.1.0
description: "NHS acute healthcare domain pack — pilot slice"
namespace: nhs.acute

dependencies:
  openfoundry.core: ">=1.0.0"

provides:
  objectTypes: 5      # Patient, Ward, Bed, Consultant, DischargeRecord
  linkTypes: 4        # AdmittedTo, OccupiesBed, UnderCareOf, BedInWard
  actionTypes: 3      # AdmitPatient, DischargePatient, TransferWard
  functions: 0
  connectors: 1
  widgets: 0
  qualityRules: 0

schema:              # Ordered list of ODL files
  - schema/enums.odl
  - schema/patient.odl
  - schema/ward.odl
  - schema/bed.odl
  - schema/consultant.odl
  - schema/discharge-record.odl
  - schema/links.odl

actions:             # Action manifest files
  - actions/admit-patient.yaml
  - actions/discharge-patient.yaml
  - actions/transfer-ward.yaml

connectors:          # External data source configs
  - connectors/pas-jdbc.yaml

permissions:         # OpenFGA models
  - permissions/nhs-roles.fga
```

### 3.3 Core Domain Pack (Base Dependency)

Every installation ships with `openfoundry.core` which provides:

- **6 Custom Scalars**: Date, DateTime, Duration, GeoPoint, JSON, URI
- **5 Base Interfaces**:
  - `Identifiable` — `id: ID! @primary`
  - `Auditable` — `createdAt`, `createdBy`, `updatedAt`, `updatedBy` (all `@readonly`)
  - `Locatable` — `location: GeoPoint`, `address: String`
  - `Temporal` — `validFrom`, `validTo: DateTime`
  - `CodeableConcept` — `system: URI!`, `code: String!`, `display: String!`

### 3.4 Action Manifests (YAML)

Each action declares:
- **Preconditions**: Role checks, state validation, business rules (CEL expressions)
- **Effects**: Ordered mutations — `updateObject`, `createLink`, `deleteLink`, `createObject`
- **Side Effects**: Event emissions (CloudEvents)
- **Rollback**: `onSideEffectFailure: LOG_AND_CONTINUE` or `ROLLBACK_ALL`

### 3.5 Connectors (YAML)

Define external data source mappings:
- **Datasource**: Connection string (from environment variables)
- **Mapping**: Field transformations between source columns and ODL properties
- **Sync Mode**: `OVERLAY` (read-only cache) or `CDC` (change data capture)
- **Cache Strategy**: TTL-based (e.g., 5-minute TTL)
- **Writeback**: boolean (read-only or bidirectional)

### 3.6 Permissions (OpenFGA)

FGA v1.1 format files defining:
- Types: `user`, `ward`, `patient`, `bed`, `consultant`
- Relations: `assigned`, `viewer`, `editor`, `clinician`
- Derived permissions: `can_admit`, `can_discharge`, `can_transfer` via relation composition

---

## 4. ODL Schemas → Storage Operations Mapping

### 4.1 The ODL Compiler Pipeline

```
.odl files → Parser (GraphQL SDL) → Validator (12 rules) → Code Generators
                                                              ├── GraphQL schema (API)
                                                              ├── OpenFGA model (AuthZ)
                                                              └── TypeScript SDK (Client)
```

Source: `open-foundry/packages/odl/src/`

### 4.2 ODL Type → Storage Operation Mapping

| ODL Construct | Directive | Storage Operation |
|--------------|-----------|-------------------|
| `type Patient @objectType` | `@objectType` | Creates object table `patient` + `patient_history` + AGE vertex label |
| `id: ID! @primary` | `@primary` | PRIMARY KEY `(_tenant_id, _id)` |
| `nhsNumber: String! @unique @indexed` | `@unique @indexed` | UNIQUE partial index on `(_tenant_id, nhs_number)` |
| `name: String! @searchable(weight: 2.0)` | `@searchable` | GIN index on `to_tsvector(name)` |
| `type AdmittedTo @linkType(...)` | `@linkType` | Creates link table `admitted_to` + AGE edge label + cardinality indexes |
| `cardinality: MANY_TO_ONE` | (on linkType) | UNIQUE partial index on `(_tenant_id, _to_id) WHERE _deleted_at IS NULL` |
| `cardinality: ONE_TO_ONE` | (on linkType) | Two UNIQUE partial indexes (one per direction) |
| `ward: Ward @link(type: "AdmittedTo", direction: OUTBOUND)` | `@link` | Generates GraphQL field resolver via `getLinks(objectId, "AdmittedTo", "outbound")` |
| `type AdmitPatient @actionType` | `@actionType` | Generates GraphQL mutation + OpenFGA permission `can_admit` |
| `patient: String! @param` | `@param` | Action input parameter → engine resolves to object mutations |
| `@computed(fn: "countLinks", ...)` | `@computed` | Engine computes at read-time (not stored) |
| `@constraint(expr: "size(this) == 10")` | `@constraint` | CEL expression evaluated at write-time by action executor |
| `@sensitive` | `@sensitive` | Field redacted based on consent/access control at API layer |

### 4.3 Full Lifecycle: ODL Schema → Running System

1. **Author**: Write `.odl` files with types, links, actions, enums
2. **Validate**: `odl validate schema/` — runs 12 structural rules
3. **Generate**: `odl generate graphql` / `odl generate openfga` — produces API schema and auth model
4. **Apply**: `storageProvider.applySchema(ctx, schema)` — generates and executes DDL:
   - Object tables with system columns + property columns
   - History tables for temporal queries
   - Link tables with cardinality-enforcement indexes
   - AGE graph labels (vertex + edge)
   - Audit and lineage schemas
5. **Runtime**: Engine uses `StorageProvider` methods for all CRUD, queries, traversals
6. **Actions**: Action executor reads YAML manifests → evaluates preconditions (CEL) → executes ordered effects via StorageProvider → emits CloudEvents

### 4.4 Cardinality Enforcement

| ODL Cardinality | Database Enforcement | Runtime Check |
|----------------|---------------------|---------------|
| `ONE_TO_ONE` | Two UNIQUE partial indexes (from + to) where `_deleted_at IS NULL` | Check existing active links before insert |
| `ONE_TO_MANY` | UNIQUE partial index on `(_tenant_id, _to_id)` where `_deleted_at IS NULL` | Check target not already linked |
| `MANY_TO_ONE` | (reversed ONE_TO_MANY) | Check source not already linked |
| `MANY_TO_MANY` | No constraint indexes | No runtime check |

### 4.5 Tenant Isolation

Every `StorageProvider` method requires `RequestContext { tenantId }` as its first parameter. This is enforced at:
- **DDL level**: Primary keys are `(_tenant_id, _id)` — composite
- **Query level**: Every WHERE clause includes `_tenant_id = $1`
- **Graph level**: AGE vertices/edges carry `{tenant_id}` property
- **Unique indexes**: Scoped to `(_tenant_id, field)` — uniqueness is per-tenant

---

## 5. Test Results

```
Build:  15/15 packages successful
Tests:  1,329 passing, 91 skipped (Postgres integration tests requiring live DB)
```

All unit tests pass. Skipped tests are in `storage-postgres` (object-crud, link-crud, provider-lifecycle integration tests that require a running PostgreSQL+AGE instance).
