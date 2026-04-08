# TerraCube Sentinel — Universal Data Ingestion & AI Agent Architecture

**Vision:** Ingest EVERYTHING — satellite feeds, weather models, social media, traffic, maritime, economic, energy, health, commodity prices, air quality — normalize into the ontology, then use AI agents to autonomously detect patterns, generate insights, and take actions.

---

## Architecture: The Data→Ontology→Agent Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    UNIVERSAL INGESTION LAYER                         │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ Satellite│ │ Weather  │ │ Social   │ │ Transport│ │ Economic ││
│  │ Feeds    │ │ Models   │ │ Media    │ │ & Mob.   │ │ & Energy ││
│  │ 15+ src  │ │ 8+ src   │ │ 6+ src   │ │ 8+ src   │ │ 10+ src  ││
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘│
│       │            │            │            │            │       │
│  ┌────▼────────────▼────────────▼────────────▼────────────▼─────┐ │
│  │         NORMALIZATION ENGINE (Dagster + dbt)                  │ │
│  │  Raw → Cleaned → Typed → Linked → Analytics-Ready            │ │
│  └────────────────────────┬─────────────────────────────────────┘ │
└───────────────────────────┼───────────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────────┐
│                    ONTOLOGY (Open Foundry)                         │
│  TypeDB (types + constraints) + PostGIS (spatial) + Neo4j (graph) │
│  All data linked → queryable → traversable → temporal             │
└───────────────────────────┬───────────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────────┐
│                    AI AGENT LAYER                                  │
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐  │
│  │ Hazard     │ │ Predictive │ │ Pattern    │ │ Automated      │  │
│  │ Sentinel   │ │ Analyst    │ │ Discovery  │ │ Action Engine  │  │
│  │ Agent      │ │ Agent      │ │ Agent      │ │                │  │
│  └──────┬─────┘ └──────┬─────┘ └──────┬─────┘ └───────┬────────┘  │
│         │              │              │                 │           │
│  ┌──────▼──────────────▼──────────────▼─────────────────▼────────┐ │
│  │              Agent Orchestrator (LangGraph / CrewAI)          │ │
│  │  Task routing │ Tool calling │ Human-in-loop │ Audit         │ │
│  └────────────────────────┬──────────────────────────────────────┘ │
└───────────────────────────┼───────────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │  Actions      │
                    │  Alerts       │
                    │  Reports      │
                    │  Workflows    │
                    │  Dashboard    │
                    └───────────────┘
```

---

## PART 1: DATA SOURCES (Everything Ingestible)

### 1.1 Satellite & Earth Observation (15+ sources)

| Source | Data | Format | Latency | Access |
|--------|------|--------|---------|--------|
| **Sentinel-1 SAR** | Flood extent, land deformation, sea ice | COG/GRD | 12h | Copernicus Dataspace / STAC |
| **Sentinel-2 MSI** | NDVI, land cover, burn scars, snow | COG/L2A | 5 days | Copernicus Dataspace / STAC |
| **Sentinel-3 OLCI** | Ocean color, chlorophyll, water quality | NetCDF | 2 days | Copernicus Dataspace |
| **Sentinel-3 SLSTR** | Sea surface temp, fire detection, thermal | NetCDF | 2 days | Copernicus Dataspace |
| **Sentinel-5P TROPOMI** | Air quality (NO2, SO2, O3, CO, CH4, aerosol) | NetCDF | 3h | Copernicus Dataspace |
| **Landsat 8/9** | Land cover, surface temp, vegetation | COG | 16 days | USGS EarthExplorer / STAC |
| **MODIS Terra/Aqua** | Active fires, NDVI, snow, aerosol, SST | HDF | Daily | NASA Earthdata |
| **VIIRS Day/Night** | Nightlights, power outages, economic activity | HDF | Daily | NASA Earthdata |
| **VIIRS Fires** | Active fire detection (375m resolution) | NetCDF | 3h | NASA FIRMS |
| **GOES-16/17** | Weather, wildfire, atmospheric rivers | GeoTIFF | 5-15 min | NOAA/NESDIS |
| **Himawari-8/9** | Asia-Pacific weather, typhoons | GeoTIFF | 10 min | JMA |
| **METEOSAT** | Europe/Africa weather | GeoTIFF | 15 min | EUMETSAT |
| **SMAP** | Soil moisture (global) | HDF5 | 3 days | NASA NSIDC |
| **GRACE-FO** | Groundwater changes, ice mass | NetCDF | Monthly | NASA JPL |
| **GPM IMERG** | Global precipitation (30min) | HDF5 | 30 min | NASA GES DISC |
| **ECOSTRESS** | Evapotranspiration, water stress | GeoTIFF | 3-5 days | NASA LP DAAC |
| **AVHRR** | Long-term climate record (1981+) | HDF | Daily | NOAA |

**STAC Catalogs for unified search:**
- Earth Search (Element84) — Sentinel + Landsat
- Microsoft Planetary Computer — 200+ datasets
- Copernicus Dataspace STAC — Full Copernicus program
- USGS STAC — Landsat
- NASA CMR STAC — All NASA EOSDIS

### 1.2 Weather & Climate Models (10+ sources)

| Source | Data | Resolution | Latency | Access |
|--------|------|-----------|---------|--------|
| **GFS** (NOAA) | Wind, precip, temp, humidity, pressure, jet stream | 0.25° / 13km | 3h forecast | NOMADS API |
| **ECMWF HRES** | Best global weather model | 0.1° / 9km | 6h | CDS API (free tier) |
| **ERA5** (reanalysis) | Historical weather 1940-present | 0.25° | Updated monthly | CDS API |
| **ERA5-Land** | High-res land-only reanalysis | 0.1° / 9km | Updated monthly | CDS API |
| **CMIP6** (IPCC) | Future climate projections (SSP scenarios) | 100km | Static | ESGF |
| **NCEP/NCAR** | Long-term reanalysis (1948+) | 2.5° | Updated monthly | NOAA PSD |
| **ICON** (DWD) | Global + regional models | 13km / 6km | 6h | DWD Open Data |
| **AROME** (Météo-France) | High-res Europe | 1.3km | 1h | Open Data |
| **UKMO UKV** | UK high-res | 1.5km | 1h | CEDA |
| **Open-Meteo** | Aggregated historical + forecast | 0.25° | Real-time | Free API |
| **OpenWeather** | Current weather + 16-day forecast | City-level | Real-time | Free API |
| **Pirate Weather** | Open-source forecast (Dark Sky successor) | 0.02° | Real-time | Free API |

### 1.3 Geophysical & Hazard (10+ sources)

| Source | Data | Latency | Access |
|--------|------|---------|--------|
| **USGS Earthquake** | Global seismic events M1.0+ | Real-time | GeoJSON API |
| **EMSC** | European seismic events | Real-time | GeoJSON API |
| **NASA FIRMS** | Active fires (VIIRS + MODIS) | 3h | API + WMS |
| **NASA EONET** | All natural events (volcanoes, storms, icebergs) | Real-time | REST API |
| **GDACS** | Global disaster alerts + impact models | Real-time | API |
| **PTWC** | Tsunami warnings | Real-time | RSS/API |
| **WCSSP** | Severe weather warnings (global) | Real-time | API |
| **Global Volcanism Program** | Eruption data + alerts | Weekly | API |
| **UNAVCO/GPS** | Ground deformation (GPS time series) | Daily | API |
| **Pacific Tsunami Museum** | Historical tsunami data | Static | CSV |
| **IBTrACS** | Global tropical cyclone tracks | Updated annually | CSV |
| **EM-DAT** | International disaster database | Updated monthly | Academic reg |

### 1.4 Social Media & Signals (6+ sources)

| Source | Data | Access | Notes |
|--------|------|--------|-------|
| **X/Twitter API** | Posts, hashtags, geotagged | Free tier (limited) | Disaster reports, sentiment |
| **Reddit API** | Posts, comments, subreddit activity | Free (PRAW) | r/weather, r/disasters |
| **Mastodon** | Federated social posts | Free API | Decentralized |
| **Bluesky** | Social posts, geotagged | Free API | Growing |
| **YouTube Data API** | Video metadata, live streams | Free | Disaster footage detection |
| **GDELT Project** | Global news, events, protests, conflicts | Free API | 300M+ records, real-time |
| **ACLED** | Armed conflict data | Free API | Political violence |
| **Telegram** | Channel messages | Bot API | Crisis channels |

**Special: Crisis Informatics**
| Source | Data |
|--------|------|
| **Aidr (UN OCHA)** | AI-filtered social media during disasters |
| **Humanitarian Data Exchange (HDX)** | Crisis datasets from responders |
| **ReliefWeb** | Disaster reports + situation reports |
| **3W (Who What Where)** | Humanitarian response tracking |

### 1.5 Transportation & Maritime (8+ sources)

| Source | Data | Access |
|--------|------|--------|
| **AIS (MarineTraffic)** | Ship positions, routes, port calls | Free tier |
| **OpenSky Network** | Real-time flight ADS-B data | Free API |
| **ADS-B Exchange** | Unfiltered flight data | Free API |
| **GTFS feeds** (global) | Public transit schedules + real-time | Various (TransitLand) |
| **TomTom Traffic** | Traffic flow data | Free tier |
| **Waze API** (via closure data) | Road incidents, closures | Partner API |
| **HERE Traffic** | Traffic incidents, flow | Free tier |
| **OpenRailwayMap** | Global railway network | OSM-based |

### 1.6 Energy & Commodities (10+ sources)

| Source | Data | Access |
|--------|------|--------|
| **ENTSO-E Transparency** | European electricity generation, consumption, prices | Free API |
| **EIA (US)** | US energy production, consumption, prices | Free API |
| **IEA** | Global energy statistics | Free API |
| **World Bank Commodity Prices** | Price indices for 60+ commodities | Free API |
| **Federal Reserve FRED** | 800K+ economic indicators | Free API |
| **ECB SDMX** | Euro area economic data | Free API |
| **NREL Solar** | Solar radiation, PV potential | Free API |
| **Global Power Plant Database** | 35K+ power plants worldwide | WRI Open Data |
| **IRENA Renewable Energy** | Global renewable energy stats | Open Data |
| **BP Statistical Review** | World energy statistics | PDF/CSV |

### 1.7 Environment & Ecology (10+ sources)

| Source | Data | Access |
|--------|------|--------|
| **OpenAQ** | Air quality stations worldwide (PM2.5, O3, NO2, SO2) | Free API |
| **WAQI** | World Air Quality Index | Free API |
| **EEA Air Quality** | European air quality data | Free API |
| **US EPA AirNow** | US air quality | Free API |
| **WHO Ambient Air Pollution** | Global annual exposure | Download |
| **Copernicus Atmosphere (CAMS)** | Atmospheric composition forecasts | Free API |
| **Ocean Color (NASA)** | Chlorophyll, SST, ocean productivity | Free API |
| **Copernicus Marine** | Ocean currents, waves, salinity, temperature | Free API |
| **GEBCO** | Global bathymetry (ocean depth) | Download |
| **Sea Level (CSIRO)** | Global sea level trends | Download |
| **Biodiversity (GBIF)** | 2B+ species occurrence records | Free API |
| **eBird** | 800M+ bird observations | Free API |
| **IUCN Red List** | Species conservation status | Free API |

### 1.8 Socioeconomic & Demographics (10+ sources)

| Source | Data | Access |
|--------|------|--------|
| **WorldPop** | Population grids (100m resolution) | Free download |
| **GPWv4 (NASA SEDAC)** | Gridded population of the world | Free |
| **GHS (EU JRC)** | Global Human Settlement Layer | Free |
| **OpenStreetMap** | Roads, buildings, POIs, infrastructure | OSM API |
| **Wikidata** | Structured knowledge graph of everything | Free API |
| **DBpedia** | Wikipedia as structured data | Free API |
| **UN Data** | Country-level statistics | Free API |
| **CIA World Factbook** | Country profiles | Free |
| **World Bank Open Data** | 17K+ indicators for 217 countries | Free API |
| **OECD Data** | Economic, social, environmental indicators | Free API |
| **INEGI / StatsCan** | National census microdata | Free |

### 1.9 Health & Epidemiology (5+ sources)

| Source | Data | Access |
|--------|------|--------|
| **WHO GHO** | Global Health Observatory data | Free API |
| **CDC WONDER** | US mortality, disease data | Free API |
| **Johns Hopkins CSSE** | Disease outbreak data (COVID-era) | GitHub |
| **ProMED** | Emerging disease reports | Free (RSS) |
| **HealthData.gov** | US health datasets | Free |

### 1.10 Financial Markets & Crypto (5+ sources)

| Source | Data | Access |
|--------|------|--------|
| **Yahoo Finance** | Stock prices, crypto, forex | Free API (yfinance) |
| **Alpha Vantage** | Stocks, forex, crypto | Free API |
| **CoinGecko** | Cryptocurrency data | Free API |
| **FRED** | 800K+ economic time series | Free API |
| **World Bank FX** | Exchange rates | Free API |

---

## PART 2: NORMALIZATION ENGINE

### Pipeline Architecture

Every data source flows through the same normalization pipeline:

```
RAW (Bronze) → CLEANED (Silver) → ENRICHED (Gold) → ONTOLOGY (Platinum)
```

#### Bronze Layer — Raw Ingestion
- Store exactly as received from source
- Format: whatever the source provides (JSON, GeoJSON, NetCDF, GRIB2, CSV, HDF)
- Storage: MinIO (S3-compatible), partitioned by source/date
- Metadata: source, fetch_timestamp, raw_size, checksum, status

#### Silver Layer — Cleaning & Standardization
- Parse, validate, deduplicate
- Standardize temporal: all timestamps → ISO 8601 UTC
- Standardize spatial: all geometries → EPSG:4326
- Standardize units: metric system (°C, m, hPa, µg/m³)
- Handle missing data, outliers, format inconsistencies
- Quality checks: range validation, completeness, freshness

#### Gold Layer — Analytics-Ready
- Spatial join with administrative boundaries
- Temporal aggregation (hourly → daily → weekly → monthly)
- Computed indices (NDVI, flood extent, heat index, drought index)
- Anomaly detection (vs. historical baseline)
- Cross-source fusion (e.g., satellite + ground sensors + social media)

#### Platinum Layer — Ontology Objects
- Normalized data → Open Foundry Ontology objects via SPI
- Typed, linked, validated, historized
- Ready for AI agent queries

### Dagster Pipeline Categories

| Pipeline Category | Sources | Schedule | Priority |
|---|---|---|---|
| **real-time-hazards** | USGS, FIRMS, EONET, PTWC | Every 5 min | CRITICAL |
| **weather-monitoring** | GFS, Open-Meteo, OpenWeather | Every 15 min | HIGH |
| **satellite-pass** | STAC catalogs, Copernicus Dataspace | Every 6h | HIGH |
| **air-quality** | OpenAQ, WAQI, CAMS, EPA | Every 30 min | HIGH |
| **social-signals** | GDELT, Reddit, X/Twitter, Mastodon | Every 15 min | MEDIUM |
| **maritime-tracking** | AIS, vessel positions | Every 5 min | MEDIUM |
| **aviation-tracking** | OpenSky, ADS-B Exchange | Every 30 sec | LOW |
| **energy-markets** | ENTSO-E, EIA, IEA, commodity prices | Every 1h | MEDIUM |
| **climate-reanalysis** | ERA5, CMIP6 | Daily | LOW |
| **socioeconomic** | WorldPop, World Bank, OSM | Weekly | LOW |
| **health-epidemiology** | WHO, CDC, ProMED | Daily | MEDIUM |
| **financial-markets** | Yahoo Finance, Alpha Vantage | Every 1h | LOW |

---

## PART 3: AI AGENT LAYER

### Agent Architecture

```
┌───────────────────────────────────────────────────────────┐
│                  AGENT ORCHESTRATOR                        │
│  LangGraph / CrewAI — routes tasks, manages state, audit  │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────┐  ┌─────────────────┐                │
│  │ HAZARD SENTINEL │  │ PATTERN         │                │
│  │ AGENT           │  │ DISCOVERY AGENT │                │
│  │                 │  │                 │                │
│  │ Monitors all    │  │ Finds cross-    │                │
│  │ hazard feeds.   │  │ domain patterns │                │
│  │ Detects events. │  │ and anomalies.  │                │
│  │ Triggers alerts │  │ Generates       │                │
│  │ and responses.  │  │ hypotheses.     │                │
│  └────────┬────────┘  └────────┬────────┘                │
│           │                    │                          │
│  ┌────────▼────────┐  ┌───────▼──────────┐               │
│  │ PREDICTIVE      │  │ AUTOMATED        │               │
│  │ ANALYSIS AGENT  │  │ ACTION AGENT     │               │
│  │                 │  │                  │               │
│  │ Runs ML models. │  │ Executes actions │               │
│  │ Forecasts risk. │  │ via Open Foundry │               │
│  │ Scenario sim.   │  │ Action Framework │               │
│  └────────┬────────┘  └───────┬──────────┘               │
│           │                    │                          │
│  ┌────────▼────────┐  ┌───────▼──────────┐               │
│  │ REPORTING       │  │ RESEARCH AGENT   │               │
│  │ AGENT           │  │                  │               │
│  │                 │  │ Web search.      │               │
│  │ Generates       │  │ Summarizes news. │               │
│  │ summaries and   │  │ Enriches data.   │               │
│  │ briefings.      │  │ Fact-checks.     │               │
│  └─────────────────┘  └──────────────────┘               │
│                                                           │
├───────────────────────────────────────────────────────────┤
│  TOOLS (Available to all agents):                          │
│  • query_ontology() — natural language → TypeDB/Neo4j      │
│  • spatial_query() — PostGIS spatial operations            │
│  • time_series() — historical data retrieval               │
│  • satellite_search() — STAC catalog search                │
│  • social_listen() — social media monitoring               │
│  • execute_action() — Open Foundry action framework        │
│  • generate_alert() — send alerts via Action Engine        │
│  • generate_report() — create PDF/HTML reports             │
│  • web_search() — external research                       │
│  • run_model() — execute ML models                        │
└───────────────────────────────────────────────────────────┘
```

### Agent Definitions

#### 1. Hazard Sentinel Agent
**Triggers:** Real-time hazard data updates, social media disaster signals
**Capabilities:**
- Detects new hazard events from USGS, FIRMS, EONET, GDELT
- Cross-references social media reports with sensor data
- Generates composite severity scores (multi-source)
- Triggers region-specific alerts
- Coordinates with other agents for response

**Example actions:**
- "Earthquake M6.2 detected near Tokyo. Crossing with FIRMS fire data → 3 fires reported. Triggering Alert for Kanto region. Notifying Automated Action Agent to check infrastructure exposure."

#### 2. Predictive Analysis Agent
**Triggers:** Scheduled (every 6h), or on-demand
**Capabilities:**
- Runs weather model ensembles (GFS + ECMWF → probabilistic forecasts)
- Flood risk modeling (precipitation forecast + soil moisture + river levels)
- Wildfire spread prediction (wind + fuel moisture + terrain + temperature)
- Heat wave early warning (temperature + humidity forecast)
- Tropical cyclone trajectory prediction
- Compound event detection (e.g., drought + heatwave + wildfire risk)

**Example actions:**
- "GFS + ERA5-Land show 150mm precipitation expected in 48h for Bangladesh. Soil moisture at 95%. Flood risk probability: 78%. Issuing 48h advance warning. Updating RiskAssessment objects for all affected DGGS cells."

#### 3. Pattern Discovery Agent
**Triggers:** New data ingested, scheduled (daily), or on-demand
**Capabilities:**
- Cross-domain correlation: "Are commodity price spikes correlated with conflict zones?"
- Spatial-temporal clustering: "Is there an unusual pattern of seismic activity?"
- Anomaly detection: "Air quality in this region dropped 40% vs. seasonal norm"
- Lead-lag analysis: "Does nightlights reduction precede economic downturn?"
- Causal hypothesis generation (for human review)

**Example actions:**
- "Detected: NO2 levels in industrial region dropped 60% in 7 days. Cross-referencing with GDELT → 3 news articles about factory closures. Cross-referencing with AIS → ship traffic at nearby port down 45%. Hypothesis: Economic slowdown. Suggesting analyst review."

#### 4. Automated Action Agent
**Triggers:** Other agents, human requests, scheduled
**Capabilities:**
- Executes Open Foundry Actions (CreateRiskAssessment, IssueAlert, etc.)
- Triggers pipeline runs (RunHazardPipeline)
- Sends notifications (email, webhook, Slack/WhatsApp)
- Creates/updates dashboard configurations
- Manages workflow sequences

**Example actions:**
- "Executing: IssueAlert(severity: CRITICAL, region: Tokyo_Bay, message: 'Typhoon approach expected landfall 18h. Wind >120km/h.')"

#### 5. Reporting Agent
**Triggers:** Scheduled (daily/weekly), on-demand, after significant events
**Capabilities:**
- Daily situation reports (all active hazards, risk levels)
- Weekly trend analysis (what changed, why)
- Post-event damage assessment reports
- Region-specific briefing packs
- Executive summaries

#### 6. Research Agent
**Triggers:** Other agents, on-demand
**Capabilities:**
- Web search for context on events
- Fact-checking social media reports
- Historical precedent lookup
- Scientific literature search
- Data enrichment from external sources

### Agent → Ontology Interaction

All agents interact with the ontology through a unified tool interface:

```python
class OntologyTools:
    """Tools available to all AI agents."""
    
    def query_objects(self, query: str, filters: dict) -> list[Object]:
        """Natural language query → ontology objects.
        'Show me all regions with flood risk > 7.0'
        """
    
    def spatial_query(self, geometry: dict, radius_km: float, 
                       object_types: list[str]) -> list[Object]:
        """Find objects within a spatial area."""
    
    def time_series(self, object_id: str, field: str,
                    start: datetime, end: datetime, 
                    aggregation: str) -> list[DataPoint]:
        """Get historical values for an object field."""
    
    def traverse(self, object_id: str, link_path: list[str],
                 depth: int) -> list[Object]:
        """Follow links in the ontology graph."""
    
    def satellite_search(self, bbox: list[float], date_range: tuple,
                         cloud_cover_max: float,
                         collections: list[str]) -> list[STACItem]:
        """Search STAC catalogs for satellite imagery."""
    
    def execute_action(self, action_name: str, params: dict) -> ActionResult:
        """Execute an Open Foundry action."""
    
    def generate_alert(self, severity: str, region_id: str,
                       message: str, channels: list[str]) -> Alert:
        """Send alert through Action Framework."""
```

---

## PART 4: ANALYTICS-READY DATA PRODUCTS

### Standard Output Datasets (always available for querying)

| Product | Sources Used | Update Freq | Spatial Resolution |
|--------|-------------|-------------|-------------------|
| **Global Hazard Map** | USGS + FIRMS + EONET + GDELT | 5 min | Point |
| **Composite Risk Index** | All hazard + weather + socioeconomic | 1h | DGGS cell (res 6-10) |
| **Flood Risk Forecast** | GFS + ERA5-Land + GPM + SMAP | 6h | DGGS cell |
| **Wildfire Risk Index** | MODIS + VIIRS + GFS + ERA5-Land | 12h | 1km grid |
| **Air Quality Index** | OpenAQ + WAQI + CAMS + Sentinel-5P | 30 min | Station + 5km grid |
| **Maritime Activity Map** | AIS + weather + port data | 5 min | Point |
| **Energy Production Tracker** | ENTSO-E + EIA + satellite nightlights | 1h | Country/region |
| **Commodity Impact Monitor** | World Bank prices + conflict data + weather | 1h | Country |
| **Social Unrest Index** | GDELT + ACLED + Twitter sentiment | 15 min | Country/region |
| **Infrastructure Exposure** | OSM + hazard + weather | Daily | DGGS cell |
| **Climate Anomaly Dashboard** | ERA5 + CMIP6 + historical | Monthly | 0.25° grid |
| **Drought Monitor** | GPM + SMAP + GRACE-FO + ERA5 | Weekly | 10km grid |
| **Epidemiological Dashboard** | WHO + CDC + ProMED + mobility data | Daily | Country/region |
| **Economic Pulse** | Nightlights + shipping + traffic + energy | Weekly | 1km grid |

---

## PART 5: IMPLEMENTATION PRIORITY

### Phase 1 (Weeks 1-2): Foundation
- Open Foundry fork + TypeDB SPI (Claude Code running now)
- Docker Compose infra (Claude Code running now)
- Domain Pack ODL schemas (Claude Code running now)
- Dagster pipeline framework + first 3 pipelines (hazards, weather, satellite)

### Phase 2 (Weeks 3-4): Core Data Ingestion
- Implement 20 highest-priority connectors
- Bronze/Silver/Gold normalization pipeline
- PostGIS spatial operations + DGGAL indexing
- Quality checks (Soda)

### Phase 3 (Weeks 5-6): Extended Data Sources
- Social media connectors (GDELT, Reddit, Mastodon)
- Maritime (AIS), aviation (OpenSky), energy (ENTSO-E)
- Air quality (OpenAQ, CAMS)
- Economic/financial data feeds

### Phase 4 (Weeks 7-8): AI Agent Layer
- Ollama + LangGraph agent framework
- Hazard Sentinel Agent (highest priority)
- Predictive Analysis Agent
- Agent → Ontology tool interface
- Alert/Action integration

### Phase 5 (Weeks 9-10): Advanced Agents + Analytics
- Pattern Discovery Agent
- Automated Action Agent
- Reporting Agent
- 14 analytics-ready data products
- Frontend dashboard

### Phase 6 (Weeks 11-12): Hardening
- All 60+ connectors implemented
- Agent orchestration refinement
- Performance optimization
- Security hardening
- Documentation

---

**Total data sources: 90+ free APIs/datasets across 10 domains**
**Total analytics products: 14 continuously updated**
**Total AI agents: 6 specialized + 1 orchestrator**
**Total connectors needed: ~60 Dagster ingestion assets**

This is a full planetary intelligence platform. Want me to spawn new Claude Code sessions for the expanded domain pack and AI agent layer?
