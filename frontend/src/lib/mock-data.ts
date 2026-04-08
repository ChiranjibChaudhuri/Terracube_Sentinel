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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMockDataByType(typeName: string): any[] {
  return DATA_MAP[typeName] ?? []
}
