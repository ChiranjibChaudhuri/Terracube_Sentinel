# TerraCube Sentinel — Military-Grade Dataset Registry

> **Full-spectrum OSINT data source catalog mapped to the Sentinel ontology.**
> Register for the free API keys below, then provide them in `.env`.

---

## Current Ontology Object Types

```
Region, HazardEvent, Sensor, InfrastructureAsset, RiskAssessment,
Alert, DataSource, SatellitePass, DataProduct, PipelineExecution,
Aircraft, Vessel, FinancialIndicator
```

### Proposed New Ontology Types (from datasets below)

```
ArmedConflict, Displacement, SocialSignal, CyberThreat,
SanctionedEntity, DiseaseOutbreak, RadiationReading,
SpaceWeatherEvent, MaritimeIncident, AirQualityReading,
ClimateAnomaly, TradeFlow
```

---

## TIER 1 — Register Now (Free, Instant Keys)

These are the highest-impact gaps. Register and paste the key into `.env`.

| # | Source | Register Here | Key Env Var | Time | Data |
|---|--------|---------------|-------------|------|------|
| 1 | **NASA FIRMS** (active fires) | [firms.modaps.eosdis.nasa.gov/api/map_key](https://firms.modaps.eosdis.nasa.gov/api/map_key/) | `FIRMS_API_KEY` | Instant | Global fire detection from VIIRS/MODIS. 5,000 req/10min. |
| 2 | **WAQI** (air quality) | [aqicn.org/data-platform/token](https://aqicn.org/data-platform/token/) | `WAQI_API_TOKEN` | Instant | 11,000+ stations. PM2.5, PM10, NO2, CO, SO2, O3. |
| 3 | **aisstream.io** (vessel tracking) | [aisstream.io](https://aisstream.io/) → Sign Up → API Keys | `AISSTREAM_API_KEY` | Instant | Real-time global AIS via WebSocket. MMSI, position, speed, cargo. |
| 4 | **ACLED** (armed conflict) | [acleddata.com/user/register](https://acleddata.com/user/register) | `ACLED_API_KEY` | Email verify | Protests, riots, battles, fatalities by location. Near-real-time. |
| 5 | **Copernicus CDS** (climate) | [cds.climate.copernicus.eu](https://cds.climate.copernicus.eu/) | `CDS_API_KEY` | Email verify | ERA5 reanalysis: temperature, precipitation, wind, 1940–present. |

---

## TIER 2 — Free, No Key Required (Add New Adapters)

These APIs are completely open. Each one needs a new adapter in `dagster/sources/`.

### Geopolitical & Conflict Intelligence

| # | Source | API Endpoint | Ontology Type | Data | Refresh |
|---|--------|--------------|---------------|------|---------|
| 6 | **UNHCR Refugee Data** | `https://api.unhcr.org/population/v1/` | `Displacement` | Refugees, IDPs, asylum seekers by country. 70+ years of data. | Daily |
| 7 | **IOM DTM** (displacement tracking) | `https://dtm.iom.int/data-and-analysis/dtm-api` | `Displacement` | Migration flows, displacement events, mobility tracking. | Weekly |
| 8 | **WHO Disease Outbreaks** | `https://www.who.int/api/news/diseaseoutbreaknews` | `DiseaseOutbreak` | Global disease outbreak alerts. RESTful JSON. | Daily |
| 9 | **OpenSanctions** | `https://api.opensanctions.org/` | `SanctionedEntity` | 320+ sanctions lists (UN, OFAC, EU, HMT). PEPs. | Daily |

### Environmental & Hazard

| # | Source | API Endpoint | Ontology Type | Data | Refresh |
|---|--------|--------------|---------------|------|---------|
| 10 | **GloFAS** (flood forecasting) | `https://open-meteo.com/en/docs/flood-api` | `HazardEvent` | Global river discharge forecasts, flood alerts. Free via Open-Meteo. | 6-hourly |
| 11 | **Safecast** (radiation) | `https://api.safecast.org/` | `RadiationReading` | 150M+ radiation readings globally. CC0 license. | Real-time |
| 12 | **NOAA SWPC** (space weather) | `https://services.swpc.noaa.gov/json/` | `SpaceWeatherEvent` | Solar storms, geomagnetic indices, Kp index. JSON feeds. | 1-minute |

### Maritime & Trade

| # | Source | API Endpoint | Ontology Type | Data | Refresh |
|---|--------|--------------|---------------|------|---------|
| 13 | **IMO GISIS** (maritime incidents) | `https://gisis.imo.org/` (scrape/reports) | `MaritimeIncident` | Piracy, armed robbery at sea. Incident reports. | Weekly |

### Disaster & Humanitarian

| # | Source | API Endpoint | Ontology Type | Data | Refresh |
|---|--------|--------------|---------------|------|---------|
| 14 | **ReliefWeb** (OCHA) | `https://api.reliefweb.int/v1/` | `HazardEvent` / `Alert` | 800K+ humanitarian reports, disaster updates, situation reports. | Real-time |
| 15 | **OpenFEMA** | `https://www.fema.gov/api/open/v2/` | `HazardEvent` | US disaster declarations, grants, flood insurance data. | Daily |
| 16 | **EM-DAT** (disaster database) | [emdat.be](https://www.emdat.be/) (registration) | `HazardEvent` | 27,000+ mass disasters from 1900. Deaths, economic damage. | Monthly |
| 17 | **HDX** (Humanitarian Data Exchange) | `https://data.humdata.org/api/3/` | Multiple | 20,000+ humanitarian datasets. CKAN API. | Varies |
| 18 | **INFORM Risk** | `https://drmkc.jrc.ec.europa.eu/inform-index/` | `RiskAssessment` | Country-level risk scores: hazard, vulnerability, coping capacity. | Annual |

### Cyber Threat Intelligence

| # | Source | API Endpoint | Ontology Type | Data | Refresh |
|---|--------|--------------|---------------|------|---------|
| 19 | **AlienVault OTX** | `https://otx.alienvault.com/api/v1/` (free key) | `CyberThreat` | IoCs, threat pulses, malware, phishing. Global community. | Real-time |
| 20 | **Abuse.ch** (URLhaus, MalBazaar) | `https://urlhaus-api.abuse.ch/v1/` | `CyberThreat` | Malware URLs, botnet C2s, SSL blacklists. No key needed. | Real-time |
| 21 | **CISA Known Exploited Vulns** | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` | `CyberThreat` | US government list of actively exploited CVEs. | Daily |

---

## TIER 3 — Already Integrated (Working)

These are already in the system and operational with no keys needed.

| # | Source | API | Ontology Type | Status |
|---|--------|-----|---------------|--------|
| 22 | **OpenSky Network** | opensky-network.org | `Aircraft` | **Working** |
| 23 | **USGS Earthquake Feed** | earthquake.usgs.gov | `HazardEvent` | **Working** |
| 24 | **NWS Weather Alerts** | api.weather.gov | `HazardEvent` | **Working** |
| 25 | **NASA EONET** | eonet.gsfc.nasa.gov | `HazardEvent` | **Working** |
| 26 | **Open-Meteo** | api.open-meteo.com | `HazardEvent` | **Working** |
| 27 | **CelesTrak** | celestrak.org | `SatellitePass` | **Working** |
| 28 | **Yahoo Finance** | query1.finance.yahoo.com | `FinancialIndicator` | **Working** |
| 29 | **World Bank** | api.worldbank.org | `FinancialIndicator` | **Working** |
| 30 | **OpenAQ** | api.openaq.org | `AirQualityReading` | **Working** |
| 31 | **GDELT** | api.gdeltproject.org | `SocialSignal` | **Working** |
| 32 | **STAC Catalogs** (AWS/Copernicus) | earth-search.aws.element84.com | `SatellitePass` | **Working** |
| 33 | **OurAirports** | davidmegginson.github.io | `InfrastructureAsset` | **Working** |
| 34 | **Overpass/OSM** | overpass-api.de | `InfrastructureAsset` | **Working** |

---

## Intelligence Domain Coverage Matrix

| Domain | Sources | Coverage |
|--------|---------|----------|
| **GEOINT** (Geospatial) | STAC, CelesTrak, OpenSky, AIS, OSM, GloFAS | Satellite imagery, aircraft, vessels, flood forecasts |
| **SIGINT** (Signals) | NOAA SWPC, Safecast | Space weather, radiation monitoring |
| **OSINT** (Open Source) | GDELT, ACLED, ReliefWeb, HDX, WHO, UNHCR | News, conflict events, humanitarian reports |
| **FININT** (Financial) | Yahoo Finance, World Bank, OpenSanctions | Markets, demographics, sanctions/PEPs |
| **MASINT** (Measurement) | USGS, FIRMS, Open-Meteo, OpenAQ, WAQI, ERA5 | Seismic, thermal, meteorological, air quality, climate |
| **CYBINT** (Cyber) | AlienVault OTX, Abuse.ch, CISA KEV | Threat indicators, malware, exploited vulnerabilities |
| **HUMINT** (Humanitarian) | UNHCR, IOM DTM, EM-DAT, OpenFEMA, INFORM | Displacement, disaster impact, risk indices |

---

## Ontology Relationships (New Links for New Types)

```
ArmedConflict  --Affects-->       Region
ArmedConflict  --Triggers-->      Displacement
ArmedConflict  --Triggers-->      Alert
Displacement   --OriginatesFrom-->Region
Displacement   --FlowsTo-->      Region
DiseaseOutbreak--Affects-->       Region
DiseaseOutbreak--Triggers-->      Alert
CyberThreat    --Targets-->       InfrastructureAsset
CyberThreat    --Triggers-->      Alert
SanctionedEntity--LinkedTo-->     Region
SanctionedEntity--LinkedTo-->     FinancialIndicator
RadiationReading--MeasuredIn-->   Region
SpaceWeatherEvent--Affects-->     SatellitePass
SpaceWeatherEvent--Affects-->     InfrastructureAsset
MaritimeIncident--InvolvedVessel->Vessel
MaritimeIncident--OccursIn-->     Region
AirQualityReading--MeasuredIn-->  Region
ClimateAnomaly --Affects-->       Region
ClimateAnomaly --Precedes-->      HazardEvent
TradeFlow      --From-->          Region
TradeFlow      --To-->            Region
SocialSignal   --References-->    HazardEvent
SocialSignal   --References-->    ArmedConflict
```

---

## Quick Start: .env Keys to Register

Copy this into your `.env` and fill in after registering:

```bash
# ─── TIER 1: Register for free keys ─────────────────────────────────
FIRMS_API_KEY=              # https://firms.modaps.eosdis.nasa.gov/api/map_key/
WAQI_API_TOKEN=             # https://aqicn.org/data-platform/token/
AISSTREAM_API_KEY=          # https://aisstream.io/ → Sign Up → API Keys
ACLED_API_KEY=              # https://acleddata.com/user/register
ACLED_EMAIL=                # Same email used for registration
CDS_API_KEY=                # https://cds.climate.copernicus.eu/ → Profile

# ─── LLM Backend (pick one) ─────────────────────────────────────────
ZAI_API_KEY=                # https://open.bigmodel.cn/ (GLM-5 Turbo)
OPENAI_API_KEY=             # https://platform.openai.com/api-keys
# OR run local: OLLAMA_BASE_URL=http://localhost:11434, LLM_BACKEND=ollama

# ─── Optional: Cyber Threat Intel ────────────────────────────────────
OTX_API_KEY=                # https://otx.alienvault.com/ → Settings → API
```

---

## Registration Priority Order

1. **NASA FIRMS** — 30 seconds, email only, instant key
2. **WAQI** — 30 seconds, email only, instant token
3. **aisstream.io** — 1 minute, create account, generate key
4. **ACLED** — 2 minutes, email + verify + accept ToS
5. **Copernicus CDS** — 5 minutes, create ECMWF account + accept dataset ToS
6. **AlienVault OTX** — 2 minutes (optional, for cyber threat data)

**Total time to register all: ~15 minutes**

After you register, provide the keys and I will wire them into the adapters and `.env`.

---

Sources:
- [NASA FIRMS API](https://firms.modaps.eosdis.nasa.gov/api/)
- [aisstream.io](https://aisstream.io/)
- [WAQI API](https://aqicn.org/api/)
- [ACLED API](https://acleddata.com/acled-api-documentation)
- [Copernicus CDS](https://cds.climate.copernicus.eu/)
- [UNHCR API](https://www.unhcr.org/what-we-do/reports-and-publications/data-and-statistics/global-public-api)
- [IOM DTM API](https://dtm.iom.int/data-and-analysis/dtm-api)
- [WHO Disease Outbreak News](https://www.who.int/api/news/diseaseoutbreaknews/sfhelp)
- [OpenSanctions](https://www.opensanctions.org/)
- [GloFAS via Open-Meteo](https://open-meteo.com/en/docs/flood-api)
- [Safecast](https://safecast.org/)
- [NOAA SWPC](https://www.swpc.noaa.gov/content/data-access)
- [ReliefWeb API](https://api.reliefweb.int/v1/)
- [OpenFEMA](https://www.fema.gov/about/openfema/data-sets)
- [EM-DAT](https://www.emdat.be/)
- [HDX CKAN API](https://data.humdata.org/dataset/)
- [INFORM Risk](https://drmkc.jrc.ec.europa.eu/inform-index/)
- [AlienVault OTX](https://otx.alienvault.com/)
- [Abuse.ch URLhaus](https://urlhaus-api.abuse.ch/v1/)
- [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
