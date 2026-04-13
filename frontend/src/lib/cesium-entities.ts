import {
  ArcType,
  Cartesian2,
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  ExtrapolationType,
  HeightReference,
  HorizontalOrigin,
  JulianDate,
  LabelStyle,
  NearFarScalar,
  PolylineDashMaterialProperty,
  PolylineGlowMaterialProperty,
  SampledPositionProperty,
  VelocityOrientationProperty,
  VerticalOrigin,
} from 'cesium'
import type {
  EllipseGraphics,
  Entity,
  LabelGraphics,
  PathGraphics,
  PointGraphics,
  PolylineGraphics,
} from 'cesium'
import type { GseRegionSummaryResponse } from './api'
import type {
  Aircraft,
  GeoJSON,
  GeoJSONPoint,
  HazardEvent,
  SatellitePass,
  SeverityLevel,
  ShipType,
  Vessel,
} from './types'
import { formatRegionName } from './awareness-normalizers'

export type CesiumEntityKind = 'aircraft' | 'vessel' | 'satellite' | 'hazard' | 'gse'

export interface CesiumEntityDescriptor {
  id: string
  kind: CesiumEntityKind
  name: string
  detail: Record<string, unknown>
  position: Entity.ConstructorOptions['position']
  orientation?: Entity.ConstructorOptions['orientation']
  point?: PointGraphics.ConstructorOptions
  path?: PathGraphics.ConstructorOptions
  ellipse?: EllipseGraphics.ConstructorOptions
  polyline?: PolylineGraphics.ConstructorOptions
  label: LabelGraphics.ConstructorOptions
  description: string
}

export const AIRCRAFT_COLOR = Color.fromCssColorString('#38bdf8')
export const SATELLITE_COLOR = Color.fromCssColorString('#4ade80')
export const SATELLITE_SECONDARY_COLOR = Color.fromCssColorString('#f8fafc')

export const SHIP_TYPE_COLORS: Record<ShipType, Color> = {
  CARGO: Color.fromCssColorString('#3b82f6'),
  TANKER: Color.fromCssColorString('#f97316'),
  PASSENGER: Color.fromCssColorString('#14b8a6'),
  FISHING: Color.fromCssColorString('#22c55e'),
  MILITARY: Color.fromCssColorString('#ef4444'),
  PLEASURE: Color.fromCssColorString('#a78bfa'),
  TUG: Color.fromCssColorString('#f59e0b'),
  OTHER: Color.fromCssColorString('#60a5fa'),
}

export const HAZARD_SEVERITY_COLORS: Record<SeverityLevel, Color> = {
  LOW: Color.fromCssColorString('#22c55e'),
  MODERATE: Color.fromCssColorString('#eab308'),
  HIGH: Color.fromCssColorString('#f97316'),
  CRITICAL: Color.fromCssColorString('#ef4444'),
}

export const GSE_THREAT_COLORS: Record<string, Color> = {
  STABLE: Color.fromCssColorString('#22c55e'),
  ELEVATED: Color.fromCssColorString('#eab308'),
  HEIGHTENED: Color.fromCssColorString('#f97316'),
  CRITICAL: Color.fromCssColorString('#ef4444'),
}

const GSE_REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  'middle-east': { lat: 30, lng: 43 },
  'south-asia': { lat: 22, lng: 78 },
  europe: { lat: 50, lng: 15 },
  'east-asia': { lat: 38, lng: 120 },
  'north-america': { lat: 40, lng: -95 },
  africa: { lat: 5, lng: 20 },
  'south-america': { lat: -15, lng: -60 },
  oceania: { lat: -25, lng: 140 },
}

const EARTH_RADIUS_METERS = 6_371_000
const EARTH_GRAVITATIONAL_PARAMETER = 3.986_004_418e14
const DEFAULT_AIRCRAFT_ALTITUDE_METERS = 10_000
const DEFAULT_SATELLITE_ALTITUDE_METERS = 550_000
const DEFAULT_SATELLITE_PERIOD_MINUTES = 96

function isPointGeometry(geometry: GeoJSON | null | undefined): geometry is GeoJSONPoint {
  return geometry?.type === 'Point'
}

function coordinatesFromGeometry(geometry: GeoJSON | null | undefined) {
  if (!isPointGeometry(geometry)) return null
  const [lng, lat] = geometry.coordinates
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lng, lat }
}

function parseDate(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(timestamp) ? new Date(timestamp) : new Date()
}

function toRadians(value: number) {
  return value * Math.PI / 180
}

function toDegrees(value: number) {
  return value * 180 / Math.PI
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeLongitude(lng: number) {
  return ((((lng + 180) % 360) + 360) % 360) - 180
}

function normalizeHeading(heading: number | null | undefined) {
  if (heading === null || heading === undefined || !Number.isFinite(heading)) return 0
  return ((heading % 360) + 360) % 360
}

function offsetCoordinate(lat: number, lng: number, bearingDegrees: number, distanceMeters: number) {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS
  const bearing = toRadians(bearingDegrees)
  const lat1 = toRadians(lat)
  const lng1 = toRadians(lng)

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  )
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
  )

  return {
    lat: clamp(toDegrees(lat2), -90, 90),
    lng: normalizeLongitude(toDegrees(lng2)),
  }
}

function makeSampledTrack(options: {
  lng: number
  lat: number
  altitudeMeters: number
  headingDegrees: number
  speedMetersPerSecond: number
  timestamp: string | null | undefined
  sampleCount: number
  sampleIntervalSeconds: number
}) {
  const sampled = new SampledPositionProperty()
  const baseTime = JulianDate.fromDate(parseDate(options.timestamp))

  sampled.forwardExtrapolationType = ExtrapolationType.HOLD
  sampled.forwardExtrapolationDuration = 3_600
  sampled.backwardExtrapolationType = ExtrapolationType.HOLD
  sampled.backwardExtrapolationDuration = options.sampleCount * options.sampleIntervalSeconds

  for (let index = options.sampleCount - 1; index >= 0; index -= 1) {
    const secondsBack = index * options.sampleIntervalSeconds
    const distanceBack = options.speedMetersPerSecond * secondsBack
    const coordinate = offsetCoordinate(
      options.lat,
      options.lng,
      normalizeHeading(options.headingDegrees + 180),
      distanceBack,
    )
    sampled.addSample(
      JulianDate.addSeconds(baseTime, -secondsBack, new JulianDate()),
      Cartesian3.fromDegrees(coordinate.lng, coordinate.lat, options.altitudeMeters),
    )
  }

  return sampled
}

function makeLabel(text: string, groundClamped = false): LabelGraphics.ConstructorOptions {
  return {
    text,
    show: false,
    font: '12px Inter, sans-serif',
    style: LabelStyle.FILL_AND_OUTLINE,
    fillColor: Color.fromCssColorString('#f8fafc'),
    outlineColor: Color.fromCssColorString('#020617'),
    outlineWidth: 3,
    showBackground: true,
    backgroundColor: Color.fromCssColorString('#0f172a').withAlpha(0.86),
    backgroundPadding: new Cartesian2(8, 5),
    pixelOffset: new Cartesian2(0, -18),
    horizontalOrigin: HorizontalOrigin.CENTER,
    verticalOrigin: VerticalOrigin.BOTTOM,
    heightReference: groundClamped ? HeightReference.CLAMP_TO_GROUND : HeightReference.NONE,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    distanceDisplayCondition: new DistanceDisplayCondition(0, 18_000_000),
  }
}

function makeDetail(entityType: string, values: object) {
  const detail: Record<string, unknown> = { entityType }
  for (const [key, value] of Object.entries(values)) {
    detail[key] = value
  }
  delete detail.geometry
  return detail
}

function escapeHtml(value: unknown) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function makeDescription(title: string, rows: Record<string, unknown>) {
  const body = Object.entries(rows)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(value)}</td></tr>`)
    .join('')
  return `<table class="cesium-infoBox-defaultTable"><tbody><tr><th colspan="2">${escapeHtml(title)}</th></tr>${body}</tbody></table>`
}

function hazardRadiusMeters(severity: SeverityLevel) {
  switch (severity) {
    case 'CRITICAL': return 220_000
    case 'HIGH': return 140_000
    case 'MODERATE': return 80_000
    case 'LOW': return 40_000
  }
}

function gseRadiusMeters(region: GseRegionSummaryResponse) {
  return 420_000 + clamp(region.gseScore, 0, 100) * 7_000
}

function makeEllipseOutline(lng: number, lat: number, radiusMeters: number, segments = 96) {
  const positions: Cartesian3[] = []
  for (let index = 0; index <= segments; index += 1) {
    const bearing = index / segments * 360
    const point = offsetCoordinate(lat, lng, bearing, radiusMeters)
    positions.push(Cartesian3.fromDegrees(point.lng, point.lat, 0))
  }
  return positions
}

function estimateSatelliteAltitude(periodMinutes: number | null | undefined) {
  if (!periodMinutes || !Number.isFinite(periodMinutes) || periodMinutes <= 0) {
    return DEFAULT_SATELLITE_ALTITUDE_METERS
  }
  const periodSeconds = periodMinutes * 60
  const semiMajorAxis = Math.cbrt(
    EARTH_GRAVITATIONAL_PARAMETER * (periodSeconds / (2 * Math.PI)) ** 2,
  )
  return clamp(semiMajorAxis - EARTH_RADIUS_METERS, 400_000, 35_786_000)
}

function fallbackSatelliteCoordinate(id: string) {
  let hash = 0
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return {
    lng: (hash % 360) - 180,
    lat: ((Math.floor(hash / 360) % 120) - 60),
  }
}

function makeSatelliteOrbit(options: {
  lng: number
  lat: number
  inclination: number | null | undefined
  periodMinutes: number
  altitudeMeters: number
  timestamp: string | null | undefined
}) {
  const sampled = new SampledPositionProperty()
  const baseTime = JulianDate.fromDate(parseDate(options.timestamp))
  const inclination = clamp(Math.abs(options.inclination ?? 53), 1, 89)
  const inclinationRadians = toRadians(inclination)
  const latRatio = clamp(Math.sin(toRadians(options.lat)) / Math.sin(inclinationRadians), -1, 1)
  const currentPhase = Math.asin(latRatio)
  const sampleCount = 72
  const halfPeriodSeconds = options.periodMinutes * 30

  for (let index = 0; index <= sampleCount; index += 1) {
    const fraction = index / sampleCount
    const seconds = -halfPeriodSeconds + fraction * options.periodMinutes * 60
    const phase = currentPhase + fraction * Math.PI * 2 - Math.PI
    const lat = toDegrees(Math.asin(Math.sin(inclinationRadians) * Math.sin(phase)))
    const lng = normalizeLongitude(options.lng + toDegrees(phase - currentPhase))
    sampled.addSample(
      JulianDate.addSeconds(baseTime, seconds, new JulianDate()),
      Cartesian3.fromDegrees(lng, lat, options.altitudeMeters),
    )
  }

  return sampled
}

export function aircraftToCesiumEntity(aircraft: Aircraft): CesiumEntityDescriptor | null {
  const coordinate = coordinatesFromGeometry(aircraft.geometry)
  if (!coordinate) return null

  const altitudeMeters = aircraft.onGround ? 0 : aircraft.altitude ?? DEFAULT_AIRCRAFT_ALTITUDE_METERS
  const position = makeSampledTrack({
    ...coordinate,
    altitudeMeters,
    headingDegrees: normalizeHeading(aircraft.heading),
    speedMetersPerSecond: aircraft.velocity ?? 220,
    timestamp: aircraft.timestamp,
    sampleCount: 10,
    sampleIntervalSeconds: 60,
  })
  const name = aircraft.callsign?.trim() || aircraft.icao24
  const detail = makeDetail('Aircraft', { ...aircraft })

  return {
    id: `aircraft-${aircraft.id}`,
    kind: 'aircraft',
    name,
    detail,
    position,
    orientation: new VelocityOrientationProperty(position),
    point: {
      pixelSize: aircraft.onGround ? 7 : 9,
      color: AIRCRAFT_COLOR.withAlpha(0.95),
      outlineColor: Color.fromCssColorString('#e0f2fe'),
      outlineWidth: 1.5,
      scaleByDistance: new NearFarScalar(500_000, 1.15, 14_000_000, 0.45),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    path: {
      show: true,
      leadTime: 0,
      trailTime: 10 * 60,
      resolution: 45,
      width: 2,
      material: new PolylineGlowMaterialProperty({
        color: AIRCRAFT_COLOR.withAlpha(0.45),
        glowPower: 0.18,
      }),
    },
    label: makeLabel(name),
    description: makeDescription('Aircraft', {
      callsign: name,
      icao24: aircraft.icao24,
      altitude: altitudeMeters,
      velocity: aircraft.velocity,
      heading: aircraft.heading,
      source: aircraft.source,
      timestamp: aircraft.timestamp,
    }),
  }
}

export function vesselToCesiumEntity(vessel: Vessel): CesiumEntityDescriptor | null {
  const coordinate = coordinatesFromGeometry(vessel.geometry)
  if (!coordinate) return null

  const course = normalizeHeading(vessel.course ?? vessel.heading)
  const speedMetersPerSecond = (vessel.speed ?? 12) * 0.514_444
  const color = SHIP_TYPE_COLORS[vessel.shipType] ?? SHIP_TYPE_COLORS.OTHER
  const position = makeSampledTrack({
    ...coordinate,
    altitudeMeters: 0,
    headingDegrees: course,
    speedMetersPerSecond,
    timestamp: vessel.timestamp,
    sampleCount: 5,
    sampleIntervalSeconds: 120,
  })
  const name = vessel.name?.trim() || vessel.mmsi
  const detail = makeDetail('Vessel', { ...vessel })

  return {
    id: `vessel-${vessel.id}`,
    kind: 'vessel',
    name,
    detail,
    position,
    orientation: new VelocityOrientationProperty(position),
    point: {
      pixelSize: vessel.isFishing ? 8 : 7,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      color: color.withAlpha(0.92),
      outlineColor: Color.fromCssColorString('#dbeafe'),
      outlineWidth: 1.25,
      scaleByDistance: new NearFarScalar(500_000, 1.05, 14_000_000, 0.42),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    path: {
      show: true,
      leadTime: 0,
      trailTime: 8 * 60,
      resolution: 60,
      width: 2,
      material: new PolylineGlowMaterialProperty({
        color: color.withAlpha(0.4),
        glowPower: 0.16,
      }),
    },
    label: makeLabel(name, true),
    description: makeDescription('Vessel', {
      name,
      mmsi: vessel.mmsi,
      shipType: vessel.shipType,
      speed: vessel.speed,
      course: vessel.course,
      destination: vessel.destination,
      flag: vessel.flag,
      source: vessel.source,
      timestamp: vessel.timestamp,
    }),
  }
}

export function satelliteToCesiumEntity(satellite: SatellitePass): CesiumEntityDescriptor | null {
  const coordinate = coordinatesFromGeometry(satellite.geometry) ?? fallbackSatelliteCoordinate(satellite.id)
  const periodMinutes = satellite.period ?? (
    satellite.meanMotion && satellite.meanMotion > 0
      ? 1_440 / satellite.meanMotion
      : DEFAULT_SATELLITE_PERIOD_MINUTES
  )
  const altitudeMeters = estimateSatelliteAltitude(periodMinutes)
  const timestamp = satellite.timestamp ?? satellite.acquisitionTime
  const position = makeSatelliteOrbit({
    ...coordinate,
    inclination: satellite.inclination,
    periodMinutes,
    altitudeMeters,
    timestamp,
  })
  const name = satellite.name?.trim() || satellite.noradId || satellite.id
  const detail = makeDetail('SatellitePass', { ...satellite })

  return {
    id: `satellite-${satellite.id}`,
    kind: 'satellite',
    name,
    detail,
    position,
    orientation: new VelocityOrientationProperty(position),
    point: {
      pixelSize: 8,
      color: SATELLITE_SECONDARY_COLOR.withAlpha(0.96),
      outlineColor: SATELLITE_COLOR,
      outlineWidth: 2,
      scaleByDistance: new NearFarScalar(600_000, 1.35, 40_000_000, 0.55),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    path: {
      show: true,
      leadTime: periodMinutes * 30,
      trailTime: periodMinutes * 30,
      resolution: 90,
      width: 2,
      material: new PolylineGlowMaterialProperty({
        color: SATELLITE_COLOR.withAlpha(0.48),
        glowPower: 0.22,
      }),
    },
    label: makeLabel(name),
    description: makeDescription('Satellite Pass', {
      name,
      noradId: satellite.noradId,
      acquisitionTime: satellite.acquisitionTime,
      processingLevel: satellite.processingLevel,
      cloudCover: satellite.cloudCover,
      inclination: satellite.inclination,
      periodMinutes,
      source: satellite.source,
    }),
  }
}

export function hazardToCesiumEntity(hazard: HazardEvent): CesiumEntityDescriptor | null {
  const coordinate = coordinatesFromGeometry(hazard.geometry)
  if (!coordinate) return null

  const color = HAZARD_SEVERITY_COLORS[hazard.severity] ?? HAZARD_SEVERITY_COLORS.MODERATE
  const radius = hazardRadiusMeters(hazard.severity)
  const name = `${hazard.type} ${hazard.severity}`
  const detail = makeDetail('HazardEvent', { ...hazard })

  return {
    id: `hazard-${hazard.id}`,
    kind: 'hazard',
    name,
    detail,
    position: Cartesian3.fromDegrees(coordinate.lng, coordinate.lat, 0),
    ellipse: {
      semiMajorAxis: radius,
      semiMinorAxis: radius,
      height: 0,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      material: color.withAlpha(0.28),
      outline: true,
      outlineColor: color.withAlpha(0.92),
      outlineWidth: 2,
      zIndex: 2,
    },
    label: makeLabel(name, true),
    description: makeDescription('Hazard Event', {
      type: hazard.type,
      severity: hazard.severity,
      alertLevel: hazard.alertLevel,
      confidence: hazard.confidence,
      startTime: hazard.startTime,
      endTime: hazard.endTime,
    }),
  }
}

export function gseRegionToCesiumEntity(region: GseRegionSummaryResponse): CesiumEntityDescriptor | null {
  const center = GSE_REGION_CENTERS[region.regionId]
  if (!center) return null

  const color = GSE_THREAT_COLORS[region.threatLevel] ?? Color.fromCssColorString('#94a3b8')
  const radius = gseRadiusMeters(region)
  const name = formatRegionName(region.regionId)
  const detail = makeDetail('GSE Zone', {
    regionName: name,
    ...region,
  })

  return {
    id: `gse-${region.regionId}`,
    kind: 'gse',
    name,
    detail,
    position: Cartesian3.fromDegrees(center.lng, center.lat, 0),
    ellipse: {
      semiMajorAxis: radius,
      semiMinorAxis: radius,
      height: 0,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      material: color.withAlpha(0.12),
      outline: false,
      zIndex: 1,
    },
    polyline: {
      positions: makeEllipseOutline(center.lng, center.lat, radius),
      clampToGround: true,
      arcType: ArcType.GEODESIC,
      width: 2,
      material: new PolylineDashMaterialProperty({
        color: color.withAlpha(0.95),
        dashLength: 18,
      }),
      zIndex: 3,
    },
    label: makeLabel(`${name} ${region.threatLevel}`, true),
    description: makeDescription('GSE Threat Zone', {
      region: name,
      gseScore: region.gseScore,
      threatLevel: region.threatLevel,
      eventCount: region.eventCount,
      escalationAlert: region.escalationAlert,
    }),
  }
}
