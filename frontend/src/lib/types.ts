// ── Enums (as const objects for erasableSyntaxOnly) ──────────────────

export const HazardType = {
  EARTHQUAKE: 'EARTHQUAKE',
  FLOOD: 'FLOOD',
  WILDFIRE: 'WILDFIRE',
  STORM: 'STORM',
  VOLCANIC: 'VOLCANIC',
  LANDSLIDE: 'LANDSLIDE',
  TSUNAMI: 'TSUNAMI',
  DROUGHT: 'DROUGHT',
} as const
export type HazardType = (typeof HazardType)[keyof typeof HazardType]

export const AlertLevel = {
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  ORANGE: 'ORANGE',
  RED: 'RED',
} as const
export type AlertLevel = (typeof AlertLevel)[keyof typeof AlertLevel]

export const SeverityLevel = {
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const
export type SeverityLevel = (typeof SeverityLevel)[keyof typeof SeverityLevel]

export const SensorStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  MAINTENANCE: 'MAINTENANCE',
  DECOMMISSIONED: 'DECOMMISSIONED',
} as const
export type SensorStatus = (typeof SensorStatus)[keyof typeof SensorStatus]

export const SensorType = {
  WEATHER_STATION: 'WEATHER_STATION',
  SEISMOGRAPH: 'SEISMOGRAPH',
  SATELLITE: 'SATELLITE',
  TIDE_GAUGE: 'TIDE_GAUGE',
  AIR_QUALITY: 'AIR_QUALITY',
  SMOKE_DETECTOR: 'SMOKE_DETECTOR',
} as const
export type SensorType = (typeof SensorType)[keyof typeof SensorType]

export const InfrastructureType = {
  ROAD: 'ROAD',
  BRIDGE: 'BRIDGE',
  BUILDING: 'BUILDING',
  POWER_PLANT: 'POWER_PLANT',
  HOSPITAL: 'HOSPITAL',
  SCHOOL: 'SCHOOL',
  DAM: 'DAM',
  AIRPORT: 'AIRPORT',
} as const
export type InfrastructureType = (typeof InfrastructureType)[keyof typeof InfrastructureType]

export const ExposureLevel = {
  NONE: 'NONE',
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  EXTREME: 'EXTREME',
} as const
export type ExposureLevel = (typeof ExposureLevel)[keyof typeof ExposureLevel]

export const ConditionGrade = {
  EXCELLENT: 'EXCELLENT',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  POOR: 'POOR',
  CRITICAL: 'CRITICAL',
} as const
export type ConditionGrade = (typeof ConditionGrade)[keyof typeof ConditionGrade]

export const RegionType = {
  COUNTRY: 'COUNTRY',
  STATE: 'STATE',
  DISTRICT: 'DISTRICT',
  MUNICIPALITY: 'MUNICIPALITY',
  CUSTOM: 'CUSTOM',
} as const
export type RegionType = (typeof RegionType)[keyof typeof RegionType]

export const DataSourceType = {
  API: 'API',
  SATELLITE: 'SATELLITE',
  GROUND_STATION: 'GROUND_STATION',
  MODEL: 'MODEL',
  CROWDSOURCE: 'CROWDSOURCE',
} as const
export type DataSourceType = (typeof DataSourceType)[keyof typeof DataSourceType]

export const ProcessingLevel = {
  RAW: 'RAW',
  L1A: 'L1A',
  L1B: 'L1B',
  L2A: 'L2A',
  L2B: 'L2B',
  L3: 'L3',
} as const
export type ProcessingLevel = (typeof ProcessingLevel)[keyof typeof ProcessingLevel]

export const PipelineStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const
export type PipelineStatus = (typeof PipelineStatus)[keyof typeof PipelineStatus]

export const DataProductType = {
  RASTER: 'RASTER',
  VECTOR: 'VECTOR',
  TABULAR: 'TABULAR',
  TIME_SERIES: 'TIME_SERIES',
} as const
export type DataProductType = (typeof DataProductType)[keyof typeof DataProductType]

export const DataProductFormat = {
  GEOTIFF: 'GEOTIFF',
  COG: 'COG',
  ZARR: 'ZARR',
  PARQUET: 'PARQUET',
  GEOJSON: 'GEOJSON',
  NETCDF: 'NETCDF',
} as const
export type DataProductFormat = (typeof DataProductFormat)[keyof typeof DataProductFormat]

export const RiskMethodology = {
  STATISTICAL: 'STATISTICAL',
  ML_BASED: 'ML_BASED',
  PHYSICS_BASED: 'PHYSICS_BASED',
  COMPOSITE: 'COMPOSITE',
} as const
export type RiskMethodology = (typeof RiskMethodology)[keyof typeof RiskMethodology]

export const ThreatLevel = {
  STABLE: 'STABLE',
  ELEVATED: 'ELEVATED',
  HEIGHTENED: 'HEIGHTENED',
  CRITICAL: 'CRITICAL',
} as const
export type ThreatLevel = (typeof ThreatLevel)[keyof typeof ThreatLevel]

export const ShipType = {
  CARGO: 'CARGO',
  TANKER: 'TANKER',
  PASSENGER: 'PASSENGER',
  FISHING: 'FISHING',
  MILITARY: 'MILITARY',
  PLEASURE: 'PLEASURE',
  TUG: 'TUG',
  OTHER: 'OTHER',
} as const
export type ShipType = (typeof ShipType)[keyof typeof ShipType]

export const FinancialIndicatorType = {
  STOCK_INDEX: 'STOCK_INDEX',
  COMMODITY: 'COMMODITY',
  CURRENCY: 'CURRENCY',
  CRYPTO: 'CRYPTO',
  GDP: 'GDP',
  UNEMPLOYMENT: 'UNEMPLOYMENT',
} as const
export type FinancialIndicatorType = (typeof FinancialIndicatorType)[keyof typeof FinancialIndicatorType]

// ── GeoJSON ──────────────────────────────────────────────────────────

export interface GeoJSONPoint {
  type: 'Point'
  coordinates: [number, number]
}

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

export type GeoJSON = GeoJSONPoint | GeoJSONPolygon

// ── Object Types ─────────────────────────────────────────────────────

export interface Region {
  id: string
  name: string
  type: RegionType
  population: number | null
  gdpPerCapita: number | null
  infrastructureScore: number | null
  riskScore: number | null
  geometry: GeoJSON
}

export interface HazardEvent {
  id: string
  type: HazardType
  severity: SeverityLevel
  geometry: GeoJSON
  startTime: string
  endTime: string | null
  confidence: number | null
  alertLevel: AlertLevel
}

export interface Sensor {
  id: string
  type: SensorType
  name: string
  geometry: GeoJSON
  operator: string | null
  dataFrequency: string | null
  lastReading: string | null
  status: SensorStatus
}

export interface InfrastructureAsset {
  id: string
  type: InfrastructureType
  name: string
  geometry: GeoJSON
  vulnerabilityScore: number | null
  exposureLevel: ExposureLevel
  condition: ConditionGrade
}

export interface RiskAssessment {
  id: string
  hazardType: HazardType
  riskScore: number
  methodology: RiskMethodology
  confidence: number | null
  timestamp: string
}

export interface Alert {
  id: string
  severity: SeverityLevel
  message: string
  actionTaken: string | null
  issuedAt: string
  expiresAt: string | null
}

export interface DataSource {
  id: string
  name: string
  provider: string
  type: DataSourceType
  temporalResolution: string | null
  spatialResolution: number | null
}

export interface SatellitePass {
  id: string
  acquisitionTime: string
  processingLevel: ProcessingLevel
  cloudCover: number | null
  stacItemUrl: string | null
}

export interface DataProduct {
  id: string
  name: string
  type: DataProductType
  format: DataProductFormat
  storagePath: string
  sizeBytes: number | null
}

export interface PipelineExecution {
  id: string
  pipelineName: string
  status: PipelineStatus
  triggeredBy: string
  startedAt: string
  completedAt: string | null
  nodeResults: Record<string, unknown> | null
}

export interface Aircraft {
  id: string
  icao24: string
  callsign: string | null
  altitude: number | null
  heading: number | null
  velocity: number | null
  onGround: boolean
  source: string
  timestamp: string
  geometry: GeoJSON
}

export interface Vessel {
  id: string
  mmsi: string
  name: string | null
  imo: string | null
  shipType: ShipType
  speed: number | null
  course: number | null
  destination: string | null
  source: string
  timestamp: string
  geometry: GeoJSON
}

export interface FinancialIndicator {
  id: string
  symbol: string
  name: string
  indicatorType: FinancialIndicatorType
  value: number
  changePct: number | null
  region: string
  source: string
}

export interface CountryIntelProfile {
  countryCode: string
  countryName: string
  regionId: string
  gseScore: number
  threatLevel: ThreatLevel
  escalationAlert: boolean
  eventCount: number
  categories: Record<string, { pressure: number; weight: number; eventCount: number; score: number }>
  gseHistory: Array<{ timestamp: string; gse_score: number }>
  patterns: Array<{ type: string; description: string; severity: string; confidence: number }>
  financialIndicators: FinancialIndicator[]
  activeEvents: HazardEvent[]
}

export interface GSERegionSummary {
  regionId: string
  regionName: string
  gseScore: number
  threatLevel: ThreatLevel
  eventCount: number
  trend: 'up' | 'down' | 'stable'
  topCategory: string
}

// ── Link Types ───────────────────────────────────────────────────────

export interface Affects {
  id: string
  impactLevel: SeverityLevel | null
  estimatedPopulationAffected: number | null
}

export interface Monitors {
  id: string
  since: string
  coveragePercent: number | null
}

export interface Triggers {
  id: string
  triggeredAt: string
}

export interface DerivedFrom {
  id: string
  weight: number | null
}

export interface Contains {
  id: string
  bandName: string | null
}

// ── Union for object explorer ────────────────────────────────────────

export const OBJECT_TYPES = [
  'Region',
  'HazardEvent',
  'Sensor',
  'InfrastructureAsset',
  'RiskAssessment',
  'Alert',
  'DataSource',
  'SatellitePass',
  'DataProduct',
  'PipelineExecution',
  'Aircraft',
  'Vessel',
  'FinancialIndicator',
] as const
export type ObjectTypeName = (typeof OBJECT_TYPES)[number]

export const LINK_TYPES = [
  { name: 'Affects', from: 'HazardEvent', to: 'Region' },
  { name: 'Monitors', from: 'Sensor', to: 'Region' },
  { name: 'LocatedIn', from: 'InfrastructureAsset', to: 'Region' },
  { name: 'Produces', from: 'Sensor', to: 'DataSource' },
  { name: 'Triggers', from: 'HazardEvent', to: 'Alert' },
  { name: 'DerivedFrom', from: 'RiskAssessment', to: 'DataSource' },
  { name: 'CapturedBy', from: 'SatellitePass', to: 'Sensor' },
  { name: 'Contains', from: 'SatellitePass', to: 'DataProduct' },
  { name: 'AssessmentOf', from: 'RiskAssessment', to: 'Region' },
  { name: 'AircraftLocatedIn', from: 'Aircraft', to: 'Region' },
  { name: 'VesselNearby', from: 'Vessel', to: 'Region' },
  { name: 'Measures', from: 'FinancialIndicator', to: 'Region' },
] as const
