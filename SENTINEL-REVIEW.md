# TerraCube Sentinel - Code Review

**Date:** 2026-04-09  
**Scope:** All `.py` and `.tsx` files  
**Overall Grade:** B+ (strong architecture, needs hardening)

---

## Architecture

Well-structured geo-intelligence platform with clean separation: Dagster pipelines, AI ingestion layer, multi-agent system, and React frontend.

**Strengths:** Adapter pattern for data sources (`base_adapter.py`), LLM abstraction with fallback to rule-based classifiers, feature flags in AI ingest config, Zustand + TanStack Query for frontend state, reusable `AsyncState` loading components.

**Weaknesses:** No dependency injection (httpx clients instantiated directly), mixed async/sync with no convention, global state in `fusion_pipeline.py` cache singleton, monolithic `Dashboard.tsx` (800+ lines).

---

## Critical Issues

### Security

| Issue | Location |
|-------|----------|
| Thread-unsafe singleton init in FastAPI | `agents/api.py:38-59` |
| No input sanitization on search fields | `ObjectExplorer.tsx`, `CountryIntel.tsx` |
| CORS allows all methods | `agents/api.py:23` |
| User input passed unsanitized to LLM prompts | `dagster/ai_ingest/entity_extractor.py:209` |
| API endpoint field accepts any string, no URL validation | `SettingsPage.tsx:34` |
| Hardcoded vessel MMSIs in synthetic fallback data | `dagster/sources/ais_adapter.py:62-89` |

### Reliability

| Issue | Location |
|-------|----------|
| No timeouts on Redis operations | `dagster/sources/cache.py:62-80` |
| No circuit breakers on external API calls | All adapters |
| Silent partial failures in batch operations | `real_time_hazards.py:346-365`, `climate_reanalysis.py` |
| LLM retry blocks Dagster worker thread (sync sleep) | `dagster/ai_ingest/llm_client.py:206-213` |
| No dead letter queue for failed Foundry writes | `fusion_pipeline.py` |
| WebSocket accepts connections but has no message handling | `agents/api.py:386` |

### Data Quality

| Issue | Location |
|-------|----------|
| Non-deterministic ID generation via `hash(str(props))` | `fusion_pipeline.py:76` |
| Default coords `[0, 0]` for invalid geometry pollutes dataset | `real_time_hazards.py:274` |
| Geographic buffer uses degrees (non-uniform distance) | `infrastructure_vulnerability.py:168` |
| O(n^2) duplicate detection won't scale past ~1k items | `quality_scorer.py:240-275` |
| No schema validation on any external API responses | All adapters |

---

## Frontend Issues

| Issue | Location |
|-------|----------|
| Dashboard.tsx is 800+ lines -- needs decomposition | `Dashboard.tsx` |
| 130-line GlobeCanvas embedded inline | `MapView.tsx:55-186` |
| No keyboard navigation or ARIA labels | `LayerPanel`, `EntityDetail`, `Ontology` |
| No error boundaries around page components | All pages |
| Duplicate utility functions across files | `CountryIntel.tsx`, `ObjectExplorer.tsx` |
| Timeline "playing" state set but never used | `TimelineControls.tsx:9` |
| No debouncing on search inputs | `CountryIntel.tsx`, `ObjectExplorer.tsx` |
| Severity color constants duplicated across files | Multiple |

---

## Good Practices Observed

- Dataclasses and TypeScript types used consistently
- Graceful degradation: adapters fall back to synthetic data when APIs unavailable
- LLM fallbacks to rule-based classifiers when model unavailable
- Skeleton loaders and error banners for async states
- Feature flags for AI ingest pipeline toggling
- Proper TanStack Query config with retry and refetch intervals
- Clean routing with framer-motion page transitions

---

## Priority Fixes

### P0 -- Fix Immediately
1. Add Redis operation timeouts (`cache.py`)
2. Fix thread-unsafe singleton init (`api.py`)
3. Validate bbox parameters on all adapters
4. Sanitize user inputs in frontend search fields
5. Replace `hash(str(props))` with deterministic IDs (`fusion_pipeline.py`)

### P1 -- Fix This Sprint
6. Add schema validation (Pydantic) to external API responses
7. Fix geographic buffer to use projected CRS (`infrastructure_vulnerability.py`)
8. Decompose `Dashboard.tsx` into sub-components
9. Add circuit breakers to external API calls
10. Add error boundaries to React page components

### P2 -- Fix Next Sprint
11. Replace O(n^2) duplicate detection with MinHash/LSH
12. Extract shared frontend utilities and color constants
13. Add keyboard navigation and ARIA labels
14. Add unit tests (none found in repo)
15. Implement structured logging with correlation IDs
