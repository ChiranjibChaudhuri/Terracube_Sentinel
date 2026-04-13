/**
 * Shared hook for fetching and normalizing situational awareness data.
 * Used by Dashboard, Map, and any page that needs entity data.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getFusionAwareness, getGseRegions, type GseRegionSummaryResponse } from '../lib/api'
import {
  normalizeHazards,
  normalizeAircraftTracks,
  normalizeVesselTracks,
  normalizeSatellitePasses,
} from '../lib/awareness-normalizers'
import type { Aircraft, HazardEvent, SatellitePass, Vessel } from '../lib/types'

export type DataSource = 'live' | 'unavailable' | 'loading'

export interface AwarenessData {
  hazards: HazardEvent[]
  aircraft: Aircraft[]
  vessels: Vessel[]
  satellites: SatellitePass[]
  gseRegions: GseRegionSummaryResponse[]
  awarenessFeatureCount: number
  dataSource: DataSource
  gseSource: DataSource
  isLoading: boolean
  lastUpdated: Date | null
  refetch: () => void
}

const REFRESH_INTERVAL_MS = 30_000

export function useAwarenessData(): AwarenessData {
  const [hazards, setHazards] = useState<HazardEvent[]>([])
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [satellites, setSatellites] = useState<SatellitePass[]>([])
  const [awarenessFeatureCount, setAwarenessFeatureCount] = useState(0)
  const [gseRegions, setGseRegions] = useState<GseRegionSummaryResponse[]>([])
  const [dataSource, setDataSource] = useState<DataSource>('loading')
  const [gseSource, setGseSource] = useState<DataSource>('loading')
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<number | null>(null)

  const fetchData = useCallback(async () => {
    const controller = new AbortController()

    // Fetch awareness data
    try {
      const awareness = await getFusionAwareness(undefined, controller.signal)
      const featureCount = awareness.metadata?.totalFeatures ?? awareness.features?.length ?? 0
      setAwarenessFeatureCount(featureCount)

      if (Array.isArray(awareness.features) && awareness.features.length > 0) {
        const h = normalizeHazards(awareness.features)
        const a = normalizeAircraftTracks(awareness.features)
        const v = normalizeVesselTracks(awareness.features)
        const s = normalizeSatellitePasses(awareness.features)
        setHazards(h)
        setAircraft(a)
        setVessels(v)
        setSatellites(s)
        setDataSource('live')
      } else {
        setHazards([])
        setAircraft([])
        setVessels([])
        setSatellites([])
        setDataSource('unavailable')
      }
    } catch {
      setHazards([])
      setAircraft([])
      setVessels([])
      setSatellites([])
      setDataSource('unavailable')
    }

    // Fetch GSE regions separately
    try {
      const regions = await getGseRegions(controller.signal)
      if (Array.isArray(regions) && regions.length > 0) {
        setGseRegions(regions)
        setGseSource('live')
      } else {
        setGseRegions([])
        setGseSource('unavailable')
      }
    } catch {
      setGseRegions([])
      setGseSource('unavailable')
    }

    setIsLoading(false)
    setLastUpdated(new Date())
  }, [])

  useEffect(() => {
    window.setTimeout(() => { void fetchData() }, 0)
    intervalRef.current = window.setInterval(() => { void fetchData() }, REFRESH_INTERVAL_MS)
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
    }
  }, [fetchData])

  return {
    hazards,
    aircraft,
    vessels,
    satellites,
    gseRegions,
    awarenessFeatureCount,
    dataSource,
    gseSource,
    isLoading,
    lastUpdated,
    refetch: fetchData,
  }
}
