# WorldMonitor → TerraCube Sentinel — Smart Ingestion Plan

**Date:** 2026-04-12
**Source:** https://github.com/koala73/worldmonitor (AGPL-3.0, non-commercial OK)
**Reference:** `_worldmonitor-reference/` cloned locally

---

## 1. What We're Absorbing

WorldMonitor is a real-time global intelligence dashboard with:
- **435+ curated RSS/news feeds** across 15+ categories (geopolitics, finance, military, tech, energy, crisis, etc.)
- **65+ live data sources** (flight tracking via Wingbits/ADS-B, commodity prices, stock exchanges, crypto, weather, seismic, maritime)
- **GDELT integration** — 6 intelligence topics + 5 positive topics with tone/volume timeline analysis
- **Cross-stream correlation engine** — 14 signal types detecting convergence across news, prediction markets, and financial markets
- **News clustering** — Jaccard similarity + inverted index for real-time event deduplication
- **Velocity analysis** — sources-per-hour tracking with sentiment (ML-enhanced or keyword-based)
- **Military surge detection** — theater-based flight tracking with foreign presence alerts in 17 sensitive regions
- **Country Intelligence Index** — composite risk scoring (12 signal categories)
- **ML pipeline** — browser-side ONNX (all-MiniLM-L6-v2 embeddings, DistilBERT sentiment, Flan-T5 summarization, BERT NER) + Ollama/Groq server-side
- **Source credibility system** — tiered (wire/gov/intel/mainstream/market/tech), propaganda risk scoring
- **21 languages** with native-language feeds and RTL support

---

## 2. Ontology Alignment — New Object Types for Sentinel

### New Object Types

| Object Type | Maps From WorldMonitor | Key Properties |
|---|---|---|
| `NewsEvent` | `ClusteredEvent` | title, sourceCount, topSources[], allItems[], firstSeen, lastUpdated, threat, velocity, lat/lon, lang |
| `NewsSource` | Feed entries | name, url, sourceType (wire/gov/intel/mainstream/market/tech), tier, propagandaRisk, region, category |
| `CorrelationSignal` | `CorrelationSignalCore` | type (14 types), title, description, confidence, timestamp, data{newsVelocity, marketChange, predictionShift, relatedTopics, correlatedEntities} |
| `MarketDataPoint` | `MarketData` | symbol, name, display, price, change, timestamp |
| `PredictionMarket` | `PredictionMarketCore` | title, yesPrice, volume |
| `FlightTrack` | Wingbits ADS-B | callsign, lat, lon, altitude, speed, heading, aircraftType, operator, military(bool) |
| `MilitarySurgeAlert` | `SurgeAlert` | theater, type (airlift/fighter/recon), currentCount, baselineCount, surgeMultiple, aircraftTypes, nearbyBases |
| `ForeignPresenceAlert` | `ForeignPresenceAlert` | operator, operatorCountry, region, aircraftCount, flights[], firstDetected |
| `GdeltIntelTopic` | `INTEL_TOPICS` | id, name, query, icon, description, articles[], timeline{tone[], vol[]} |
| `PipelineFlowEvent` | Pipeline flow detection | title, description, confidence, newsVelocity, relatedTopics |

### New Link Types

| Link Type | From → To | Description |
|---|---|---|
| `has_signals` | `CountryIntel` → `CorrelationSignal` | Country has active correlation signals |
| `has_news_events` | `CountryIntel` → `NewsEvent` | Country mentioned in news cluster |
| `has_surge_alert` | `MilitaryTheater` → `MilitarySurgeAlert` | Theater has active surge |
| `has_foreign_presence` | `GeoRegion` → `ForeignPresenceAlert` | Sensitive region has foreign military presence |
| `has_market_data` | `Country` → `MarketDataPoint` | Country's market indicators |
| `has_intel_topic` | `Region` → `GdeltIntelTopic` | Region has GDELT intelligence context |
| `reported_by` | `NewsEvent` → `NewsSource` | Which sources reported this event |
| `correlates_with` | `CorrelationSignal` → `MarketDataPoint` | Signal correlated with market move |
| `correlates_with_news` | `CorrelationSignal` → `NewsEvent` | Signal correlated with news cluster |

### Extended Properties on Existing Objects

`CountryIntel` gains:
- `countryIntelligenceIndex`: composite score across 12 categories (from WorldMonitor's scoring model)
- `signalCategories`: Map of category → signal count/strength
- `threatLevel`: aggregated from news events (critical/high/medium/low/info)
- `velocityMetrics`: news velocity for this country
- `sentimentTrend`: rolling sentiment from news coverage

---

## 3. Ingestion Pipeline Architecture

### Phase 1: RSS/News Ingestion (highest value, implement first)

```
[RSS Feeds (435+)] → [Rust Fetch Workers] → [Parse + Dedupe]
  → [Jaccard Clustering] → [Ontology Write: NewsEvent]
  → [Entity Extraction] → [Link: CountryIntel.has_news_events]
  → [Velocity Calculation] → [Update CountryIntel.velocityMetrics]
```

**Key algorithm to port from WorldMonitor:**
- `clusterNewsCore()` — inverted index + Jaccard similarity (threshold 0.3)
- Source tiering — wire > gov > intel > mainstream > market > tech
- Threat aggregation — max level + top category + weighted confidence
- Geo extraction — most common lat/lon across cluster items

### Phase 2: Correlation Engine

```
[NewsEvents] + [MarketData] + [PredictionMarkets]
  → [analyzeCorrelationsCore()]
  → [14 Signal Detectors]
  → [Ontology Write: CorrelationSignal]
  → [Link: CountryIntel.has_signals]
  → [Event Bus: correlation.detected]
```

**14 Signal Types to port:**
1. `prediction_leads_news` — prediction market moves before news picks up
2. `news_leads_markets` — news breaks before market reacts
3. `silent_divergence` — market moves without news explanation
4. `velocity_spike` — topic coverage velocity > 3x baseline
5. `keyword_spike` — trending keyword detection
6. `convergence` — 3+ source types report same event in 1hr
7. `triangulation` — wire + gov + intel aligned (highest confidence: 0.9)
8. `flow_drop` — pipeline flow disruption keywords
9. `flow_price_divergence` — energy commodity rises without pipeline news
10. `geo_convergence` — geographic clustering of events
11. `explained_market_move` — market move correlates with news
12. `hotspot_escalation` — escalating event coverage
13. `sector_cascade` — sector-wide market signals
14. `military_surge` — theater-level flight activity spike

**Deduplication system:**
- Per-type TTLs (30min default, 6hr for divergence/flow signals, 2hr for prediction leads)
- Max 500 dedupe keys, auto-prune after 24h
- Confidence threshold filter (≥0.6)

### Phase 3: GDELT Intelligence

```
[GDELT API] → [6 Intel Topics + 5 Positive Topics]
  → [fetchGdeltArticles()] → [Ontology: GdeltIntelTopic]
  → [Link: Region.has_intel_topic]
  → [Timeline Analysis: tone[] + vol[]]
```

**Topics to ingest:**
- Military Activity, Cyber Threats, Nuclear, Sanctions, Intelligence, Maritime Security
- Positive: Science Breakthroughs, Climate Progress, Conservation Wins, Humanitarian Progress, Innovation

### Phase 4: ML Enhancement (Ollama/Groq)

```
[NewsEvent.text] → [LLM Classification]
  → [Named Entity Recognition] → link to Country/Person/Org
  → [Sentiment Analysis] → update NewsEvent.sentiment
  → [Summarization] → generate briefing text
  → [Embedding] → vector store for semantic search
```

**WorldMonitor ML models (reference, we use server-side):**
- `all-MiniLM-L6-v2` (embeddings, 23MB)
- `DistilBERT-SST2` (sentiment, 65MB)
- `Flan-T5-base` (summarization, 250MB)
- `BERT-NER` (entity extraction, 65MB)

Sentinel approach: Use Ollama (local) or Groq (fast cloud) for the same tasks with larger models.

### Phase 5: Flight Tracking + Military Surge

```
[Wingbits ADS-B] → [Flight Filtering (military callsigns)]
  → [Theater Matching (5 theaters, 15 sensitive regions)]
  → [Baseline Calculation (48hr window, 6 sample minimum)]
  → [Surge Detection (>2x baseline)]
  → [Foreign Presence Detection (non-home operators)]
  → [Ontology: MilitarySurgeAlert / ForeignPresenceAlert]
```

**5 Theaters:** Middle East, Eastern Europe, Western Europe, Western Pacific, Horn of Africa
**17 Sensitive Regions:** Persian Gulf, Strait of Hormuz, Taiwan Strait, Baltic Region, Black Sea, Korean DMZ, etc.

---

## 4. Feed Catalog — What to Ingest

### Geopolitical (Full Variant) — 15 Categories, ~180 feeds
- politics (5), us (11), europe (36), middleeast (14), africa (12), latam (17), asia (22)
- tech (4), ai (5), finance (5), gov (11), layoffs (3), thinktanks (8), crisis (4), energy (4)

### Intelligence Sources — 37 feeds
- Defense (11), International Relations (6), Think Tanks (13), Nuclear/Arms Control (2), OSINT/Cyber (3), Economic/Food Security (3)

### Finance Variant — 14 Categories, ~100 feeds
- markets, forex, bonds, commodities, crypto (17), central banks, economic, ipo, derivatives, fintech, regulation, institutional, analysis, GCC

### All feeds go through RSS proxy → parse → dedupe → cluster → ontology

**Source credibility data to absorb:**
- `SOURCE_TYPES` — 130+ sources classified as wire/gov/intel/mainstream/market/tech
- `SOURCE_PROPAGANDA_RISK` — state-affiliation tracking (high/medium/low)
- Source tiering from `server/_shared/source-tiers.ts`

---

## 5. Scoring Algorithms to Port

### Country Intelligence Index (12 categories)
Port the composite scoring methodology — normalize signals across categories, weight by source tier, aggregate with temporal decay.

### Velocity Metrics
```
sourcesPerHour = items.length / max(timeSpanHours, 0.25)
level = spike(≥6) | elevated(≥3) | normal
trend = rising | stable | falling (compare recent half vs older half)
sentiment = ML-enhanced or keyword-based (-1 to +1 scale)
```

### Threat Classification
```
Level: critical(5) > high(4) > medium(3) > low(2) > info(1)
Category: general, conflict, military, cyber, economic, disaster, political, nuclear
Confidence: weighted average by source tier (6 - min(tier, 5))
```

### Correlation Confidence Scoring
- Convergence: `min(0.95, 0.6 + sourceTypeCount * 0.1)`
- Triangulation (wire+gov+intel): fixed 0.9
- Velocity spike: `min(0.9, 0.45 + (multiplier > 0 ? multiplier/8 : velocity/18))`
- Silent divergence: `min(0.8, 0.4 + change/10)`
- Flow price divergence: `min(0.85, 0.4 + change/8)`

---

## 6. Implementation Order

### Sprint 1: Foundation (Days 1-3)
1. Create Rust crate `geo-ingest` with RSS fetch + parse workers
2. Port feed catalog (JSON config file with all 435+ feeds)
3. Port source credibility system (types, tiers, propaganda risk)
4. Basic NewsEvent ontology type + write path

### Sprint 2: Clustering + Entity Linking (Days 4-6)
1. Port Jaccard clustering algorithm (`clusterNewsCore`)
2. Port entity extraction (country matching from geo data)
3. Link NewsEvents → CountryIntel objects
4. Velocity calculation + threat aggregation

### Sprint 3: Correlation Engine (Days 7-10)
1. Port all 14 signal detectors
2. Port snapshot-based diffing (previous vs current state)
3. Deduplication system with per-type TTLs
4. Write CorrelationSignal objects + links

### Sprint 4: GDELT + ML Enhancement (Days 11-14)
1. GDELT API integration (6 + 5 topics)
2. LLM classification pipeline (Ollama/Groq)
3. Sentiment + summarization + NER
4. Vector store for semantic search

### Sprint 5: Military Intelligence (Days 15-18)
1. Flight tracking data ingestion (Wingbits)
2. Theater + sensitive region matching
3. Surge detection algorithm
4. Foreign presence alerts

### Sprint 6: Dashboard + API (Days 19-22)
1. GraphQL queries for all new object types
2. WebSocket feeds for real-time signals
3. Frontend panels: Intelligence Feed, Correlation Signals, Country Risk Dashboard
4. Country Intelligence Index composite view

---

## 7. Files to Reference in WorldMonitor Codebase

| File | What It Contains |
|---|---|
| `src/config/feeds.ts` | Complete feed catalog (435+ feeds), source types, propaganda risk, alert keywords |
| `src/services/analysis-core.ts` | Clustering algorithm, all 14 correlation detectors, signal types |
| `src/utils/analysis-constants.ts` | Thresholds, keywords, dedupe logic |
| `src/services/correlation.ts` | Main-thread correlation wrapper with snapshot management |
| `src/services/velocity.ts` | Velocity calculation, sentiment analysis, trend detection |
| `src/services/military-surge.ts` | Theater definitions, surge detection, foreign presence alerts |
| `src/services/gdelt-intel.ts` | GDELT topics, article fetching, timeline analysis |
| `src/services/ml-worker.ts` | ML pipeline architecture (models, tasks, vector store) |
| `src/config/ml-config.ts` | Model configs, thresholds, feature flags |
| `src/config/entities.ts` | Entity index for market-symbol-to-news matching |
| `src/config/panels.ts` | Dashboard panel definitions |
| `src/config/pipelines.ts` | Data pipeline configurations |
| `api/enrichment/signals.js` | Signal enrichment API |
| `server/_shared/source-tiers.ts` | Source tier definitions |
| `shared/rss-allowed-domains.json` | RSS proxy allowlist |

---

## 8. Architecture Decisions

1. **RSS via Rust async** — `reqwest` with `rss` crate, not browser fetch
2. **Clustering in Rust** — port Jaccard + inverted index, much faster than TS
3. **Correlation as a dedicated pipeline** — runs on a tokio-cron schedule (every 5 min)
4. **GDELT as external API** — same API, called from Rust, results stored in ontology
5. **ML via Ollama/Groq** — not browser-side ONNX; use `ai-gateway` crate
6. **Flight data via Wingbits** — WebSocket ingest into Rust, theater matching in-memory
7. **Source credibility as first-class data** — stored in ontology, queryable
8. **Temporal versioning** — all NewsEvent, CorrelationSignal objects historized via Iceberg

---

## 9. Non-Commercial Compliance

WorldMonitor is AGPL-3.0 for non-commercial use. Our Sentinel integration:
- ✅ Personal/research use — no issue
- ✅ We're not copying their frontend or UI
- ✅ We're extracting algorithms, feed catalogs, and scoring methodologies — reimplemented in Rust
- ✅ Feed URLs are public RSS — not copyrightable
- ✅ GDELT queries are our own
- ⚠️ If Sentinel ever goes commercial, need to either get a WorldMonitor commercial license or reimplement independently (which we'd be doing in Rust anyway)
