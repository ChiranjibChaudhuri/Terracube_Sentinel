# Claude Task: Build AI-Powered Data Ingestion Pipeline for Sentinel

## Context
TerraCube Sentinel currently has a basic `dagster/ai_ingest/__init__.py` with only a weighted formula and LLM config stub. It needs a real AI-powered ingestion pipeline that uses LLMs to process, enrich, classify, and quality-check incoming data.

## Current State
- `dagster/ai_ingest/__init__.py` exists with AgentConfig dataclass and score_risk_for_region() weighted formula
- `dagster/sources/` has 11 adapters (opensky, ais, firms, celes trak, eq, weather, finance, demographic, infrastructure, base_adapter, fusion_pipeline)
- `agents/config.py` has OllamaConfig (OLLAMA_BASE_URL, model names)
- `agents/gse/` has scoring engine
- `agents/briefing/` has generator and formatter
- `agents/tools/ontology_tools.py` can query Open Foundry API

## What to Build

### Part 1: LLM Ingestion Engine (`dagster/ai_ingest/`)

Completely rewrite `dagster/ai_ingest/__init__.py` and create new modules:

**`dagster/ai_ingest/llm_client.py`** — LLM abstraction layer:
- `class LLMClient`: Unified interface for both Ollama (local) and remote APIs (OpenAI-compatible)
- Methods: `complete(prompt, system) -> str`, `extract_json(prompt, system) -> dict`, `batch_extract(items) -> list[dict]`
- Read OLLAMA_BASE_URL from env (default http://localhost:11434)
- Read model name from env (default llama3)
- Include retry logic with exponential backoff
- Include token counting and cost estimation
- Timeout handling (don't block pipeline on slow LLM)
- Fallback: if LLM is unavailable, return None gracefully (don't crash pipeline)

**`dagster/ai_ingest/event_classifier.py`** — AI event classification:
- `classify_event(raw_event: dict) -> dict` — Takes a raw event from any source adapter, uses LLM to:
  - Determine ontology object type (HazardEvent, ArmedConflict, etc.)
  - Extract structured fields matching the ODL schema
  - Assess severity (LOW/MODERATE/HIGH/CRITICAL) with confidence score
  - Identify actors/involved parties
  - Generate a brief natural-language summary
  - Assign confidence score (0-1) based on source reliability
- Include prompt engineering for each classification task
- Batch mode: `classify_events(events: list[dict], max_batch=10) -> list[dict]`
- The prompt should include the ODL schema definitions so the LLM knows valid object types and fields

**`dagster/ai_ingest/entity_extractor.py`** — Entity extraction from unstructured text:
- `extract_entities(text: str, region_context: dict) -> list[dict]` — From news articles, social media, reports:
  - Extract: people, organizations, locations (with coordinates if possible), dates, event types, casualties/damage numbers
  - Map to ontology: return list of {object_type, properties, links} ready for Open Foundry ingestion
- `extract_from_gdelt(article: dict) -> dict` — Specialized for GDELT article format
- `extract_from_news(text: str, source_url: str) -> dict` — General news article extraction
- Include geo-parsing: attempt to extract lat/lng from location names using a simple gazetteer approach (not a full geocoder — just common city/country names)

**`dagster/ai_ingest/quality_scorer.py`** — AI data quality assessment:
- `score_data_quality(item: dict, source: str) -> dict` returns:
  - completeness_score: % of required fields present
  - consistency_score: do values make sense (lat/lng in range, dates not future, etc.)
  - freshness_score: how recent is the data
  - source_reliability: known reliability of source (configured mapping)
  - overall_quality: weighted composite
  - issues: list of detected problems
  - recommendation: ACCEPT / ACCEPT_WITH_FLAGS / REJECT / MANUAL_REVIEW
- `detect_duplicates(items: list[dict], threshold=0.85) -> list[list[int]]` — Group similar items:
  - Use text similarity (simple TF-IDF + cosine similarity, no external ML library needed)
  - Compare title, description, location, time
  - Return groups of indices that likely refer to the same event
  - Used to merge duplicate events from multiple sources

**`dagster/ai_ingest/anomaly_detector.py`** — Anomaly detection in data streams:
- `detect_anomalies(items: list[dict], history: list[dict]) -> list[dict]`:
  - Statistical anomaly detection (z-score based on event frequency per region/category)
  - Flag: unusual increase in event count (>2 std dev from 7-day mean)
  - Flag: new category appearing in region that never had it before
  - Flag: severity spike (multiple HIGH/CRITICAL in short window)
  - Return list of {type, description, severity, affected_region, data_points}
- `detect_schema_drift(new_items: list[dict], expected_schema: dict) -> list[str]`:
  - Compare field names/types of incoming data against expected ODL schema
  - Flag new fields, missing fields, type changes

**`dagster/ai_ingest/auto_mapper.py`** — Auto-ontology mapping:
- `map_to_ontology(raw_data: dict, source: str) -> dict`:
  - Takes raw data from any source adapter
  - Uses LLM to map fields to the correct ODL object type and property names
  - Returns: {object_type, properties, links} ready for Open Foundry ingestion
  - Caches mappings per source for consistency (use Redis or in-memory dict)
- Include a simple rule-based fallback for common mappings (when LLM is unavailable):
  - USGS earthquake → HazardEvent with type=EARTHQUAKE
  - FIRMS fire → HazardEvent with type=WILDFIRE
  - OpenSky aircraft → Aircraft
  - AIS vessel → Vessel
  - etc.

**`dagster/ai_ingest/summarizer.py`** — AI summarization for ingested data:
- `summarize_events(events: list[dict], region: str, window: str) -> str`:
  - Generate a natural language summary of recent events in a region
  - Include: event types, severity distribution, trend direction, key developments
- `generate_ingest_report(stats: dict) -> str`:
  - Summary of what was ingested in the last pipeline run
  - Counts per source, counts per object type, quality scores, anomalies detected

### Part 2: AI-Powered Dagster Pipeline

**`dagster/pipelines/ai_ingestion.py`** — New Dagster pipeline:

- @asset: `fetch_raw_events()` — Collect raw events from all source adapters (reuse existing adapters)
- @asset: `classify_with_ai()` — Run event_classifier.classify_events() on raw events
  - Skip LLM call for events that already have structured data (e.g., USGS earthquakes are already well-structured)
  - Use LLM only for unstructured sources (GDELT, news, social signals)
- @asset: `extract_entities()` — Run entity_extractor on classified events
- @asset: `assess_quality()` — Run quality_scorer.score_data_quality() on all items
- @asset: `detect_anomalies_and_duplicates()` — Run anomaly_detector and quality_scorer.detect_duplicates()
- @asset: `merge_and_deduplicate()` — Merge duplicate events, keep highest quality version
- @asset: `map_to_ontology()` — Run auto_mapper.map_to_ontology() on all accepted items
- @asset: `load_to_foundry()` — POST mapped objects to Open Foundry API
- @asset: `generate_ingest_summary()` — Run summarizer.generate_ingest_report()
- Schedule: every 15 minutes

Add this pipeline to `dagster/pipelines/__init__.py` Definitions.

### Part 3: Configuration

**`dagster/ai_ingest/config.py`**:
- LLM settings: base_url, model, temperature, max_tokens, timeout
- Quality thresholds: min_completeness, min_overall_quality, duplicate_similarity_threshold
- Feature flags: enable_llm_classification, enable_anomaly_detection, enable_auto_mapping
- Source-specific settings: which sources get AI processing vs. rule-based only

### Part 4: Wire to Existing Systems

- Add `ai_ingestion` pipeline to dagster workspace and Definitions
- Add AI quality scores to ontology objects (extend ODL with qualityScore, aiConfidence, aiProcessedAt fields)
- Wire anomaly detection to alerting system (anomaly events should trigger GSE recalculation)
- Wire duplicate detection to deduplicate before loading to Foundry
- Add `/ai/status` endpoint to agents/api.py showing: LLM availability, last ingest stats, quality metrics

## Technical Constraints

- NO external ML libraries (no scikit-learn, no transformers). Use only: httpx, json, math, collections, re, statistics
- For text similarity in duplicate detection, implement simple TF-IDF + cosine similarity manually (it's ~30 lines of code)
- LLM calls must have timeouts (30s default) and fallback gracefully
- All new code must compile (python -m py_compile)
- Follow existing code patterns (dataclasses, async httpx, environment variables)
- Do NOT modify existing adapter files — only add new files and update __init__.py and pipelines/__init__.py

## File Structure
```
dagster/ai_ingest/
├── __init__.py (rewrite)
├── config.py (new)
├── llm_client.py (new)
├── event_classifier.py (new)
├── entity_extractor.py (new)
├── quality_scorer.py (new)
├── anomaly_detector.py (new)
├── auto_mapper.py (new)
├── summarizer.py (new)
dagster/pipelines/
├── ai_ingestion.py (new)
├── __init__.py (update: add ai_ingestion assets and schedule)
```

## CRITICAL RULES

- Do NOT stop to ask questions. Build everything.
- Implement all text similarity/statistical logic yourself (no sklearn, no numpy, no scipy needed — use Python stdlib only: math, collections, statistics, re)
- LLM calls must be optional — system works without LLM, just with reduced intelligence
- All new Python files must pass py_compile
- Commit at the end: git add -A && git commit -m "feat: AI-powered data ingestion pipeline — LLM classification, entity extraction, quality scoring, anomaly detection, auto-ontology mapping"
- When done, run: openclaw system event --text "Done: AI-powered data ingestion pipeline built" --mode now
