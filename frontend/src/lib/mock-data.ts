import type {
  Region,
  HazardEvent,
  Sensor,
  InfrastructureAsset,
  RiskAssessment,
  Alert,
  DataSource,
  SatellitePass,
  DataProduct,
  PipelineExecution,
  Aircraft,
  Vessel,
  FinancialIndicator,
  GSERegionSummary,
} from './types'

// ── Regions ──────────────────────────────────────────────────────────

export const mockRegions: Region[] = [
  { id: 'reg-001', name: 'Kanto Region', type: 'COUNTRY', population: 43000000, gdpPerCapita: 48000, infrastructureScore: 82, riskScore: 65, geometry: { type: 'Point', coordinates: [139.69, 35.68] } },
  { id: 'reg-002', name: 'San Francisco Bay Area', type: 'STATE', population: 7700000, gdpPerCapita: 92000, infrastructureScore: 75, riskScore: 58, geometry: { type: 'Point', coordinates: [-122.42, 37.77] } },
  { id: 'reg-003', name: 'Bangladesh Delta', type: 'COUNTRY', population: 170000000, gdpPerCapita: 2500, infrastructureScore: 35, riskScore: 88, geometry: { type: 'Point', coordinates: [90.39, 23.81] } },
  { id: 'reg-004', name: 'Greater Sydney', type: 'STATE', population: 5300000, gdpPerCapita: 55000, infrastructureScore: 78, riskScore: 42, geometry: { type: 'Point', coordinates: [151.21, -33.87] } },
  { id: 'reg-005', name: 'Mediterranean Coast', type: 'CUSTOM', population: 150000000, gdpPerCapita: 32000, infrastructureScore: 68, riskScore: 55, geometry: { type: 'Point', coordinates: [14.42, 40.85] } },
  { id: 'reg-006', name: 'Central Chile', type: 'STATE', population: 8000000, gdpPerCapita: 15000, infrastructureScore: 62, riskScore: 71, geometry: { type: 'Point', coordinates: [-70.65, -33.45] } },
  { id: 'reg-007', name: 'Greater London', type: 'MUNICIPALITY', population: 9000000, gdpPerCapita: 65000, infrastructureScore: 80, riskScore: 30, geometry: { type: 'Point', coordinates: [-0.13, 51.51] } },
]

// ── Hazard Events ────────────────────────────────────────────────────

export const mockHazardEvents: HazardEvent[] = [
  { id: 'haz-001', type: 'EARTHQUAKE', severity: 'HIGH', geometry: { type: 'Point', coordinates: [139.75, 35.70] }, startTime: '2026-04-08T02:15:00Z', endTime: null, confidence: 0.95, alertLevel: 'ORANGE' },
  { id: 'haz-002', type: 'WILDFIRE', severity: 'CRITICAL', geometry: { type: 'Point', coordinates: [-122.20, 37.85] }, startTime: '2026-04-07T18:30:00Z', endTime: null, confidence: 0.88, alertLevel: 'RED' },
  { id: 'haz-003', type: 'FLOOD', severity: 'HIGH', geometry: { type: 'Point', coordinates: [90.41, 23.73] }, startTime: '2026-04-07T06:00:00Z', endTime: null, confidence: 0.92, alertLevel: 'ORANGE' },
  { id: 'haz-004', type: 'STORM', severity: 'MODERATE', geometry: { type: 'Point', coordinates: [151.10, -33.92] }, startTime: '2026-04-08T08:45:00Z', endTime: null, confidence: 0.78, alertLevel: 'YELLOW' },
  { id: 'haz-005', type: 'VOLCANIC', severity: 'LOW', geometry: { type: 'Point', coordinates: [14.43, 40.82] }, startTime: '2026-04-06T12:00:00Z', endTime: '2026-04-07T18:00:00Z', confidence: 0.65, alertLevel: 'GREEN' },
  { id: 'haz-006', type: 'TSUNAMI', severity: 'CRITICAL', geometry: { type: 'Point', coordinates: [-70.60, -33.50] }, startTime: '2026-04-08T01:20:00Z', endTime: null, confidence: 0.97, alertLevel: 'RED' },
  { id: 'haz-007', type: 'LANDSLIDE', severity: 'MODERATE', geometry: { type: 'Point', coordinates: [77.21, 28.61] }, startTime: '2026-04-07T14:30:00Z', endTime: null, confidence: 0.72, alertLevel: 'YELLOW' },
  { id: 'haz-008', type: 'DROUGHT', severity: 'HIGH', geometry: { type: 'Point', coordinates: [36.82, -1.29] }, startTime: '2026-03-15T00:00:00Z', endTime: null, confidence: 0.85, alertLevel: 'ORANGE' },
  { id: 'haz-009', type: 'WILDFIRE', severity: 'MODERATE', geometry: { type: 'Point', coordinates: [149.13, -35.28] }, startTime: '2026-04-08T05:00:00Z', endTime: null, confidence: 0.80, alertLevel: 'YELLOW' },
  { id: 'haz-010', type: 'EARTHQUAKE', severity: 'LOW', geometry: { type: 'Point', coordinates: [-118.24, 34.05] }, startTime: '2026-04-08T10:15:00Z', endTime: '2026-04-08T10:16:00Z', confidence: 1.0, alertLevel: 'GREEN' },
]

// ── Sensors ──────────────────────────────────────────────────────────

export const mockSensors: Sensor[] = [
  { id: 'sen-001', type: 'SEISMOGRAPH', name: 'Tokyo Seismic Array', geometry: { type: 'Point', coordinates: [139.69, 35.68] }, operator: 'JMA', dataFrequency: 'PT1S', lastReading: '2026-04-08T11:59:00Z', status: 'ACTIVE' },
  { id: 'sen-002', type: 'WEATHER_STATION', name: 'SF Bay Weather Hub', geometry: { type: 'Point', coordinates: [-122.42, 37.77] }, operator: 'NOAA', dataFrequency: 'PT5M', lastReading: '2026-04-08T11:55:00Z', status: 'ACTIVE' },
  { id: 'sen-003', type: 'TIDE_GAUGE', name: 'Dhaka Flood Gauge', geometry: { type: 'Point', coordinates: [90.39, 23.81] }, operator: 'BWDB', dataFrequency: 'PT15M', lastReading: '2026-04-08T11:45:00Z', status: 'ACTIVE' },
  { id: 'sen-004', type: 'SATELLITE', name: 'Sentinel-2A', geometry: { type: 'Point', coordinates: [0, 0] }, operator: 'ESA', dataFrequency: 'P5D', lastReading: '2026-04-07T10:30:00Z', status: 'ACTIVE' },
  { id: 'sen-005', type: 'SMOKE_DETECTOR', name: 'California Fire Watch', geometry: { type: 'Point', coordinates: [-121.50, 38.58] }, operator: 'CAL FIRE', dataFrequency: 'PT1M', lastReading: '2026-04-08T11:58:00Z', status: 'ACTIVE' },
  { id: 'sen-006', type: 'AIR_QUALITY', name: 'London AQ Monitor', geometry: { type: 'Point', coordinates: [-0.13, 51.51] }, operator: 'DEFRA', dataFrequency: 'PT1H', lastReading: '2026-04-08T11:00:00Z', status: 'ACTIVE' },
  { id: 'sen-007', type: 'WEATHER_STATION', name: 'Sydney Harbour AWS', geometry: { type: 'Point', coordinates: [151.21, -33.87] }, operator: 'BoM', dataFrequency: 'PT10M', lastReading: '2026-04-08T11:50:00Z', status: 'MAINTENANCE' },
]

// ── Infrastructure Assets ────────────────────────────────────────────

export const mockInfrastructure: InfrastructureAsset[] = [
  { id: 'inf-001', type: 'HOSPITAL', name: 'Tokyo Medical Center', geometry: { type: 'Point', coordinates: [139.76, 35.69] }, vulnerabilityScore: 25, exposureLevel: 'MODERATE', condition: 'GOOD' },
  { id: 'inf-002', type: 'BRIDGE', name: 'Golden Gate Bridge', geometry: { type: 'Point', coordinates: [-122.48, 37.82] }, vulnerabilityScore: 40, exposureLevel: 'HIGH', condition: 'FAIR' },
  { id: 'inf-003', type: 'POWER_PLANT', name: 'Dhaka Grid Station', geometry: { type: 'Point', coordinates: [90.42, 23.78] }, vulnerabilityScore: 72, exposureLevel: 'EXTREME', condition: 'POOR' },
  { id: 'inf-004', type: 'AIRPORT', name: 'Sydney Kingsford Smith', geometry: { type: 'Point', coordinates: [151.18, -33.95] }, vulnerabilityScore: 18, exposureLevel: 'LOW', condition: 'EXCELLENT' },
  { id: 'inf-005', type: 'DAM', name: 'Hetch Hetchy Reservoir', geometry: { type: 'Point', coordinates: [-119.79, 37.95] }, vulnerabilityScore: 55, exposureLevel: 'HIGH', condition: 'GOOD' },
  { id: 'inf-006', type: 'SCHOOL', name: 'Naples International School', geometry: { type: 'Point', coordinates: [14.25, 40.84] }, vulnerabilityScore: 30, exposureLevel: 'MODERATE', condition: 'GOOD' },
  { id: 'inf-007', type: 'ROAD', name: 'Ruta 5 Pan-American Hwy', geometry: { type: 'Point', coordinates: [-70.65, -33.45] }, vulnerabilityScore: 60, exposureLevel: 'HIGH', condition: 'FAIR' },
  { id: 'inf-008', type: 'BUILDING', name: 'London Canary Wharf', geometry: { type: 'Point', coordinates: [-0.02, 51.50] }, vulnerabilityScore: 12, exposureLevel: 'NONE', condition: 'EXCELLENT' },
]

// ── Risk Assessments ─────────────────────────────────────────────────

export const mockRiskAssessments: RiskAssessment[] = [
  { id: 'risk-001', hazardType: 'EARTHQUAKE', riskScore: 72.5, methodology: 'COMPOSITE', confidence: 0.88, timestamp: '2026-04-08T06:00:00Z' },
  { id: 'risk-002', hazardType: 'FLOOD', riskScore: 85.0, methodology: 'ML_BASED', confidence: 0.92, timestamp: '2026-04-08T06:00:00Z' },
  { id: 'risk-003', hazardType: 'WILDFIRE', riskScore: 68.3, methodology: 'STATISTICAL', confidence: 0.78, timestamp: '2026-04-08T06:00:00Z' },
  { id: 'risk-004', hazardType: 'STORM', riskScore: 45.0, methodology: 'PHYSICS_BASED', confidence: 0.82, timestamp: '2026-04-08T06:00:00Z' },
  { id: 'risk-005', hazardType: 'DROUGHT', riskScore: 61.2, methodology: 'STATISTICAL', confidence: 0.75, timestamp: '2026-04-07T12:00:00Z' },
  { id: 'risk-006', hazardType: 'TSUNAMI', riskScore: 91.0, methodology: 'COMPOSITE', confidence: 0.95, timestamp: '2026-04-08T02:00:00Z' },
]

// ── Alerts ────────────────────────────────────────────────────────────

export const mockAlerts: Alert[] = [
  { id: 'alt-001', severity: 'CRITICAL', message: 'Tsunami warning issued for Central Chile coastline. Evacuate low-lying areas immediately.', actionTaken: 'Emergency broadcast activated', issuedAt: '2026-04-08T01:25:00Z', expiresAt: '2026-04-08T13:00:00Z' },
  { id: 'alt-002', severity: 'HIGH', message: 'Major wildfire expanding near Oakland Hills. Air quality hazardous in SF Bay Area.', actionTaken: 'Evacuation order Zone 3', issuedAt: '2026-04-07T19:00:00Z', expiresAt: null },
  { id: 'alt-003', severity: 'HIGH', message: 'Flood waters rising in Dhaka metropolitan area. Multiple infrastructure assets at risk.', actionTaken: 'Sandbagging operations initiated', issuedAt: '2026-04-07T08:00:00Z', expiresAt: null },
  { id: 'alt-004', severity: 'MODERATE', message: 'M5.2 earthquake detected near Tokyo Bay. No tsunami threat.', actionTaken: null, issuedAt: '2026-04-08T02:20:00Z', expiresAt: '2026-04-08T14:20:00Z' },
  { id: 'alt-005', severity: 'LOW', message: 'Volcanic activity at Vesuvius returned to normal background levels.', actionTaken: null, issuedAt: '2026-04-07T18:30:00Z', expiresAt: '2026-04-08T18:30:00Z' },
  { id: 'alt-006', severity: 'MODERATE', message: 'Severe thunderstorm warning for Greater Sydney region. Damaging winds expected.', actionTaken: 'Weather advisory issued', issuedAt: '2026-04-08T08:50:00Z', expiresAt: '2026-04-08T20:00:00Z' },
]

// ── Data Sources ─────────────────────────────────────────────────────

export const mockDataSources: DataSource[] = [
  { id: 'ds-001', name: 'USGS Earthquake Feed', provider: 'USGS', type: 'API', temporalResolution: 'PT5M', spatialResolution: null },
  { id: 'ds-002', name: 'NASA FIRMS Active Fires', provider: 'NASA', type: 'SATELLITE', temporalResolution: 'PT3H', spatialResolution: 375 },
  { id: 'ds-003', name: 'Open-Meteo Weather', provider: 'Open-Meteo', type: 'MODEL', temporalResolution: 'PT1H', spatialResolution: 25000 },
  { id: 'ds-004', name: 'Copernicus Sentinel-2', provider: 'ESA', type: 'SATELLITE', temporalResolution: 'P5D', spatialResolution: 10 },
  { id: 'ds-005', name: 'ERA5 Reanalysis', provider: 'ECMWF', type: 'MODEL', temporalResolution: 'PT1H', spatialResolution: 25000 },
  { id: 'ds-006', name: 'OpenAQ Air Quality', provider: 'OpenAQ', type: 'GROUND_STATION', temporalResolution: 'PT1H', spatialResolution: null },
  { id: 'ds-007', name: 'GDELT Global Events', provider: 'GDELT Project', type: 'CROWDSOURCE', temporalResolution: 'PT15M', spatialResolution: null },
]

// ── Satellite Passes ─────────────────────────────────────────────────

export const mockSatellitePasses: SatellitePass[] = [
  { id: 'sp-001', acquisitionTime: '2026-04-08T10:30:00Z', processingLevel: 'L2A', cloudCover: 12.5, stacItemUrl: 'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/S2A_T54SUE' },
  { id: 'sp-002', acquisitionTime: '2026-04-07T22:15:00Z', processingLevel: 'L1B', cloudCover: 45.0, stacItemUrl: null },
  { id: 'sp-003', acquisitionTime: '2026-04-07T14:00:00Z', processingLevel: 'L2A', cloudCover: 5.2, stacItemUrl: 'https://earth-search.aws.element84.com/v1/collections/landsat-c2-l2/items/LC09_L2SP' },
  { id: 'sp-004', acquisitionTime: '2026-04-06T08:45:00Z', processingLevel: 'RAW', cloudCover: 88.0, stacItemUrl: null },
  { id: 'sp-005', acquisitionTime: '2026-04-08T06:20:00Z', processingLevel: 'L2A', cloudCover: 8.0, stacItemUrl: 'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/S2B_T36RUU' },
]

// ── Data Products ────────────────────────────────────────────────────

export const mockDataProducts: DataProduct[] = [
  { id: 'dp-001', name: 'tokyo_ndvi_20260408.tif', type: 'RASTER', format: 'COG', storagePath: 's3://terracube-satellite/cog/tokyo_ndvi.tif', sizeBytes: 245000000 },
  { id: 'dp-002', name: 'sf_burn_scar_20260407.tif', type: 'RASTER', format: 'GEOTIFF', storagePath: 's3://terracube-satellite/cog/sf_burn_scar.tif', sizeBytes: 180000000 },
  { id: 'dp-003', name: 'bangladesh_flood_extent.geojson', type: 'VECTOR', format: 'GEOJSON', storagePath: 's3://terracube-satellite/vector/bd_flood.geojson', sizeBytes: 12000000 },
  { id: 'dp-004', name: 'global_precip_20260408.zarr', type: 'RASTER', format: 'ZARR', storagePath: 's3://terracube-satellite/zarr/precip.zarr', sizeBytes: 850000000 },
  { id: 'dp-005', name: 'era5_temp_anomaly.nc', type: 'TIME_SERIES', format: 'NETCDF', storagePath: 's3://terracube-satellite/netcdf/era5_temp.nc', sizeBytes: 420000000 },
  { id: 'dp-006', name: 'air_quality_stations.parquet', type: 'TABULAR', format: 'PARQUET', storagePath: 's3://terracube-satellite/parquet/aq_stations.parquet', sizeBytes: 35000000 },
]

// ── Pipeline Executions ──────────────────────────────────────────────

export const mockPipelineExecutions: PipelineExecution[] = [
  { id: 'pe-001', pipelineName: 'real_time_hazards', status: 'SUCCEEDED', triggeredBy: 'schedule', startedAt: '2026-04-08T11:55:00Z', completedAt: '2026-04-08T11:56:12Z', nodeResults: { fetched: 47, loaded: 45 } },
  { id: 'pe-002', pipelineName: 'real_time_hazards', status: 'SUCCEEDED', triggeredBy: 'schedule', startedAt: '2026-04-08T11:50:00Z', completedAt: '2026-04-08T11:51:08Z', nodeResults: { fetched: 32, loaded: 32 } },
  { id: 'pe-003', pipelineName: 'satellite_ingestion', status: 'RUNNING', triggeredBy: 'schedule', startedAt: '2026-04-08T12:00:00Z', completedAt: null, nodeResults: null },
  { id: 'pe-004', pipelineName: 'climate_reanalysis', status: 'SUCCEEDED', triggeredBy: 'schedule', startedAt: '2026-04-08T00:00:00Z', completedAt: '2026-04-08T00:12:45Z', nodeResults: { gridPoints: 1300, regions: 7 } },
  { id: 'pe-005', pipelineName: 'infrastructure_vulnerability', status: 'FAILED', triggeredBy: 'manual', startedAt: '2026-04-07T18:00:00Z', completedAt: '2026-04-07T18:03:22Z', nodeResults: { error: 'Overpass API timeout' } },
  { id: 'pe-006', pipelineName: 'air_quality', status: 'SUCCEEDED', triggeredBy: 'schedule', startedAt: '2026-04-08T11:30:00Z', completedAt: '2026-04-08T11:31:05Z', nodeResults: { stations: 120, loaded: 118 } },
  { id: 'pe-007', pipelineName: 'social_signals', status: 'SUCCEEDED', triggeredBy: 'schedule', startedAt: '2026-04-08T11:45:00Z', completedAt: '2026-04-08T11:45:32Z', nodeResults: { events: 85, signals: 23 } },
  { id: 'pe-008', pipelineName: 'risk_scoring', status: 'SUCCEEDED', triggeredBy: 'schedule', startedAt: '2026-04-08T11:00:00Z', completedAt: '2026-04-08T11:02:15Z', nodeResults: { regions: 7, updated: 7 } },
]

// ── Aircraft ────────────────────────────────────────────────────────

export const mockAircraft: Aircraft[] = [
  { id: 'ac-001', icao24: '3c6752', callsign: 'DLH1234', altitude: 11582, heading: 245, velocity: 230, onGround: false, source: 'opensky', timestamp: '2026-04-08T12:00:00Z', geometry: { type: 'Point', coordinates: [10.4, 51.2] } },
  { id: 'ac-002', icao24: 'a12345', callsign: 'UAL789', altitude: 10668, heading: 90, velocity: 245, onGround: false, source: 'opensky', timestamp: '2026-04-08T12:00:00Z', geometry: { type: 'Point', coordinates: [-87.6, 41.9] } },
  { id: 'ac-003', icao24: '780a21', callsign: 'CCA102', altitude: 12192, heading: 180, velocity: 260, onGround: false, source: 'opensky', timestamp: '2026-04-08T12:00:00Z', geometry: { type: 'Point', coordinates: [116.6, 40.1] } },
  { id: 'ac-004', icao24: 'c07e3a', callsign: 'ACA455', altitude: 9144, heading: 320, velocity: 210, onGround: false, source: 'opensky', timestamp: '2026-04-08T12:00:00Z', geometry: { type: 'Point', coordinates: [-79.4, 43.7] } },
  { id: 'ac-005', icao24: '4ca87d', callsign: 'RYR221', altitude: 11278, heading: 160, velocity: 235, onGround: false, source: 'opensky', timestamp: '2026-04-08T12:00:00Z', geometry: { type: 'Point', coordinates: [-6.3, 53.3] } },
]

// ── Vessels ──────────────────────────────────────────────────────────

export const mockVessels: Vessel[] = [
  { id: 'vs-001', mmsi: '211331640', name: 'ATLANTIC GUARDIAN', imo: '9434765', shipType: 'CARGO', speed: 12.4, course: 270, destination: 'ROTTERDAM', source: 'ais', timestamp: '2026-04-08T12:00:00Z', geometry: { type: 'Point', coordinates: [-5.3, 36.1] } },
  { id: 'vs-002', mmsi: '244630590', name: 'PACIFIC TRADER', imo: '9567123', shipType: 'TANKER', speed: 8.2, course: 45, destination: 'SINGAPORE', source: 'ais', timestamp: '2026-04-08T12:00:00Z', geometry: { type: 'Point', coordinates: [103.8, 1.3] } },
  { id: 'vs-003', mmsi: '366998310', name: 'COASTAL RUNNER', imo: '9012345', shipType: 'PASSENGER', speed: 15.1, course: 180, destination: 'MIAMI', source: 'ais', timestamp: '2026-04-08T12:00:00Z', geometry: { type: 'Point', coordinates: [-74.0, 40.7] } },
  { id: 'vs-004', mmsi: '538005890', name: 'NORTHERN STAR', imo: '9876543', shipType: 'FISHING', speed: 5.0, course: 90, destination: 'BERGEN', source: 'ais', timestamp: '2026-04-08T12:00:00Z', geometry: { type: 'Point', coordinates: [5.3, 60.4] } },
]

// ── Financial Indicators ────────────────────────────────────────────

export const mockFinancialIndicators: FinancialIndicator[] = [
  { id: 'fin-001', symbol: '^GSPC', name: 'S&P 500', indicatorType: 'STOCK_INDEX', value: 5234.18, changePct: 0.82, region: 'US', source: 'yahoo_finance' },
  { id: 'fin-002', symbol: '^FTSE', name: 'FTSE 100', indicatorType: 'STOCK_INDEX', value: 8102.55, changePct: -0.34, region: 'UK', source: 'yahoo_finance' },
  { id: 'fin-003', symbol: '^N225', name: 'Nikkei 225', indicatorType: 'STOCK_INDEX', value: 38456.20, changePct: 1.15, region: 'JP', source: 'yahoo_finance' },
  { id: 'fin-004', symbol: 'CL=F', name: 'Crude Oil', indicatorType: 'COMMODITY', value: 78.42, changePct: -1.23, region: 'GLOBAL', source: 'yahoo_finance' },
  { id: 'fin-005', symbol: 'GC=F', name: 'Gold', indicatorType: 'COMMODITY', value: 2358.90, changePct: 0.45, region: 'GLOBAL', source: 'yahoo_finance' },
  { id: 'fin-006', symbol: 'BTC-USD', name: 'Bitcoin', indicatorType: 'CRYPTO', value: 67234.00, changePct: 2.18, region: 'GLOBAL', source: 'yahoo_finance' },
  { id: 'fin-007', symbol: '^GDAXI', name: 'DAX', indicatorType: 'STOCK_INDEX', value: 18523.10, changePct: 0.56, region: 'DE', source: 'yahoo_finance' },
  { id: 'fin-008', symbol: '^BSESN', name: 'BSE Sensex', indicatorType: 'STOCK_INDEX', value: 74012.30, changePct: -0.78, region: 'IN', source: 'yahoo_finance' },
]

// ── GSE Region Summaries ────────────────────────────────────────────

export const mockGSERegions: GSERegionSummary[] = [
  { regionId: 'middle-east', regionName: 'Middle East', gseScore: 87.4, threatLevel: 'HEIGHTENED', eventCount: 24, trend: 'up', topCategory: 'conflict' },
  { regionId: 'south-asia', regionName: 'South Asia', gseScore: 72.1, threatLevel: 'HEIGHTENED', eventCount: 18, trend: 'up', topCategory: 'natural_disaster' },
  { regionId: 'europe', regionName: 'Europe', gseScore: 45.2, threatLevel: 'ELEVATED', eventCount: 12, trend: 'stable', topCategory: 'political' },
  { regionId: 'east-asia', regionName: 'East Asia', gseScore: 38.7, threatLevel: 'ELEVATED', eventCount: 9, trend: 'down', topCategory: 'natural_disaster' },
  { regionId: 'north-america', regionName: 'North America', gseScore: 31.5, threatLevel: 'ELEVATED', eventCount: 7, trend: 'stable', topCategory: 'economic' },
  { regionId: 'africa', regionName: 'Africa', gseScore: 56.8, threatLevel: 'ELEVATED', eventCount: 15, trend: 'up', topCategory: 'health' },
  { regionId: 'south-america', regionName: 'South America', gseScore: 28.3, threatLevel: 'STABLE', eventCount: 5, trend: 'stable', topCategory: 'natural_disaster' },
  { regionId: 'oceania', regionName: 'Oceania', gseScore: 15.2, threatLevel: 'STABLE', eventCount: 3, trend: 'down', topCategory: 'natural_disaster' },
]

// ── Helper to get all objects by type ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DATA_MAP: Record<string, any[]> = {
  Region: mockRegions,
  HazardEvent: mockHazardEvents,
  Sensor: mockSensors,
  InfrastructureAsset: mockInfrastructure,
  RiskAssessment: mockRiskAssessments,
  Alert: mockAlerts,
  DataSource: mockDataSources,
  SatellitePass: mockSatellitePasses,
  DataProduct: mockDataProducts,
  PipelineExecution: mockPipelineExecutions,
  Aircraft: mockAircraft,
  Vessel: mockVessels,
  FinancialIndicator: mockFinancialIndicators,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMockDataByType(typeName: string): any[] {
  return DATA_MAP[typeName] ?? []
}
