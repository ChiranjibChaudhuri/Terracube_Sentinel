/**
 * Shared normalization functions for converting AwarenessFeature[] (from the
 * /fusion/awareness API) into typed domain objects used by Dashboard, Map, etc.
 */

import type {
  AwarenessFeature,
} from './api'
import type {
  Aircraft,
  GeoJSONPoint,
  HazardEvent,
  SatellitePass,
  Vessel,
} from './types'

// ── Helpers ─────────────────────────────────────────────────────────

const REFERENCE_NOW = new Date()

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

export function asString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

export function asNullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function asBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true
    if (['false', '0', 'no', 'n', ''].includes(normalized)) return false
  }
  return Boolean(value)
}

export function normalizeEntityType(value: unknown) {
  return String(value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase()
}

export function asPointGeometry(value: unknown): GeoJSONPoint | null {
  const geometry = asRecord(value)
  if (geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) {
    return null
  }
  const [lng, lat] = geometry.coordinates
  if (typeof lng !== 'number' || typeof lat !== 'number') {
    return null
  }
  return { type: 'Point', coordinates: [lng, lat] }
}

export function formatRegionName(regionId: string) {
  return regionId.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function normalizeSeverity(value: unknown): HazardEvent['severity'] {
  switch (String(value ?? '').toUpperCase()) {
    case 'LOW':
    case 'MODERATE':
    case 'HIGH':
    case 'CRITICAL':
      return String(value).toUpperCase() as HazardEvent['severity']
    default:
      return 'MODERATE'
  }
}

export function severityToAlertLevel(severity: HazardEvent['severity']): HazardEvent['alertLevel'] {
  switch (severity) {
    case 'CRITICAL': return 'RED'
    case 'HIGH': return 'ORANGE'
    case 'MODERATE': return 'YELLOW'
    default: return 'GREEN'
  }
}

export function normalizeProcessingLevel(value: unknown): SatellitePass['processingLevel'] {
  switch (String(value ?? '').toUpperCase()) {
    case 'RAW': case 'L1A': case 'L1B': case 'L2A': case 'L2B': case 'L3':
      return String(value).toUpperCase() as SatellitePass['processingLevel']
    default:
      return 'L2A'
  }
}

// ── Entity normalizers ──────────────────────────────────────────────

export function normalizeHazards(features: AwarenessFeature[]): HazardEvent[] {
  return features
    .filter((feature) => normalizeEntityType(feature.properties.entityType) === 'hazardevent')
    .map((feature, index) => {
      const properties = asRecord(feature.properties)
      const geometry = asPointGeometry(feature.geometry)
      if (!geometry) return null

      const severity = normalizeSeverity(properties.severity)
      const confidenceValue = asNumber(properties.confidence)

      return {
        id: asString(properties.id, `hazard-${index}`),
        type: asString(properties.type ?? properties.name, 'WILDFIRE').toUpperCase() as HazardEvent['type'],
        severity,
        geometry,
        startTime: asString(properties.startTime ?? properties.timestamp, REFERENCE_NOW.toISOString()),
        endTime: asNullableString(properties.endTime ?? properties.expiresAt),
        confidence: confidenceValue === null
          ? 0.85
          : confidenceValue > 1
            ? clamp(confidenceValue / 100, 0, 1)
            : clamp(confidenceValue, 0, 1),
        alertLevel: severityToAlertLevel(severity),
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null) as HazardEvent[]
}

export function normalizeSatellitePasses(features: AwarenessFeature[]): SatellitePass[] {
  return features
    .filter((feature) => normalizeEntityType(feature.properties.entityType) === 'satellitepass')
    .map((feature, index) => {
      const properties = asRecord(feature.properties)
      return {
        id: asString(properties.id, `satellite-pass-${index}`),
        acquisitionTime: asString(properties.acquisitionTime ?? properties.timestamp, REFERENCE_NOW.toISOString()),
        processingLevel: normalizeProcessingLevel(properties.processingLevel),
        cloudCover: asNumber(properties.cloudCover),
        stacItemUrl: asNullableString(properties.stacItemUrl),
      }
    })
}

export function normalizeAircraftTracks(features: AwarenessFeature[]): Aircraft[] {
  return features
    .filter((feature) => normalizeEntityType(feature.properties.entityType) === 'aircraft')
    .map((feature, index) => {
      const properties = asRecord(feature.properties)
      const geometry = asPointGeometry(feature.geometry)
      if (!geometry) return null
      return {
        id: asString(properties.id, `aircraft-${index}`),
        icao24: asString(properties.icao24, `icao-${index}`),
        callsign: asNullableString(properties.callsign),
        altitude: asNumber(properties.altitude),
        heading: asNumber(properties.heading),
        velocity: asNumber(properties.velocity),
        onGround: Boolean(properties.onGround),
        source: asString(properties.source, 'awareness'),
        timestamp: asString(properties.timestamp, REFERENCE_NOW.toISOString()),
        geometry,
      }
    })
    .filter(Boolean) as Aircraft[]
}

export function normalizeVesselTracks(features: AwarenessFeature[]): Vessel[] {
  return features
    .filter((feature) => normalizeEntityType(feature.properties.entityType) === 'vessel')
    .map((feature, index) => {
      const properties = asRecord(feature.properties)
      const geometry = asPointGeometry(feature.geometry)
      if (!geometry) return null
      return {
        id: asString(properties.id, `vessel-${index}`),
        mmsi: asString(properties.mmsi, `mmsi-${index}`),
        name: asNullableString(properties.name),
        imo: asNullableString(properties.imo),
        shipType: asString(properties.shipType, 'OTHER').toUpperCase() as Vessel['shipType'],
        speed: asNumber(properties.speed),
        course: asNumber(properties.course),
        heading: asNumber(properties.heading),
        destination: asNullableString(properties.destination),
        flag: asNullableString(properties.flag),
        navStatus: asNullableString(properties.navStatus),
        isFishing: asBoolean(properties.isFishing),
        source: asString(properties.source, 'awareness'),
        timestamp: asString(properties.timestamp, REFERENCE_NOW.toISOString()),
        geometry,
      }
    })
    .filter(Boolean) as Vessel[]
}
