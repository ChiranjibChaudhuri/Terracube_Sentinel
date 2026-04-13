import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from 'react-leaflet'
import { Icon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Map as MapIcon, Globe } from 'lucide-react'
import type { GeoJSONPoint } from '../lib/types'
import { useAwarenessData } from '../hooks/useAwarenessData'
import { DataSourceBadge } from '../components/DataSourceBadge'
import { formatRegionName } from '../lib/awareness-normalizers'
import LayerPanel, { type LayerConfig } from '../components/LayerPanel'
import TimelineControls from '../components/TimelineControls'
import EntityDetail from '../components/EntityDetail'

const CesiumGlobe = lazy(() => import('../components/CesiumGlobe'))

const SEVERITY_COLORS: Record<string, string> = {
  RED: '#ef4444', ORANGE: '#f97316', YELLOW: '#eab308', GREEN: '#22c55e',
}

const THREAT_COLORS: Record<string, string> = {
  STABLE: '#22c55e', ELEVATED: '#eab308', HEIGHTENED: '#f97316', CRITICAL: '#ef4444',
}

const GSE_REGION_COORDS: Record<string, [number, number]> = {
  'middle-east': [30, 43], 'south-asia': [22, 78], 'europe': [50, 15],
  'east-asia': [38, 120], 'north-america': [40, -95], 'africa': [5, 20],
  'south-america': [-15, -60], 'oceania': [-25, 140],
}

const aircraftIcon = new Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="%2338bdf8" stroke-width="2"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>'
  ),
  iconSize: [20, 20], iconAnchor: [10, 10],
})

const vesselIcon = new Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="%233b82f6" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg>'
  ),
  iconSize: [20, 20], iconAnchor: [10, 10],
})

export default function MapView() {
  const [timelineHoursAgo, setTimelineHoursAgo] = useState(0)
  const [timelineTime, setTimelineTime] = useState(() => new Date())
  const [timelinePlaying, setTimelinePlaying] = useState(false)
  const [timelineSpeed, setTimelineSpeed] = useState(60)
  const { hazards, aircraft, vessels, satellites, gseRegions, dataSource, isLoading } = useAwarenessData({ hoursAgo: timelineHoursAgo })

  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const [selectedEntity, setSelectedEntity] = useState<Record<string, unknown> | null>(null)
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    hazards: true,
    aircraft: true,
    vessels: true,
    satellites: true,
    gse: true,
  })

  const layers: LayerConfig[] = useMemo(() => [
    { id: 'hazards', label: 'Hazard Events', color: '#ef4444', visible: layerVisibility.hazards, count: hazards.length },
    { id: 'aircraft', label: 'Aircraft', color: '#38bdf8', visible: layerVisibility.aircraft, count: aircraft.length },
    { id: 'vessels', label: 'Vessels', color: '#3b82f6', visible: layerVisibility.vessels, count: vessels.length },
    { id: 'satellites', label: 'Satellites', color: '#4ade80', visible: layerVisibility.satellites, count: satellites.length },
    { id: 'gse', label: 'GSE Threat Zones', color: '#f97316', visible: layerVisibility.gse, count: gseRegions.length },
  ], [aircraft.length, gseRegions.length, hazards.length, layerVisibility, satellites.length, vessels.length])

  const toggleLayer = useCallback((id: string) => {
    setLayerVisibility((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }))
  }, [])

  const isVisible = (id: string) => layers.find((l) => l.id === id)?.visible ?? false

  const handleTimelineChange = useCallback((hoursAgo: number) => {
    setTimelineHoursAgo(hoursAgo)
    setTimelineTime(new Date(Date.now() - hoursAgo * 60 * 60 * 1000))
  }, [])

  const handleTimelinePlayingChange = useCallback((playing: boolean) => {
    setTimelinePlaying(playing)
    if (playing && timelineHoursAgo === 0) {
      setTimelineTime(new Date())
    }
  }, [timelineHoursAgo])

  const handleCesiumTimeChange = useCallback((time: Date) => {
    if (!timelinePlaying) {
      setTimelineTime(time)
    }
  }, [timelinePlaying])

  const handleEntityClick = useCallback((entity: Record<string, unknown>) => {
    setSelectedEntity(entity)
  }, [])

  return (
    <div className="h-[calc(100vh-8rem)] relative rounded-lg overflow-hidden border border-slate-700/50">
      {/* Mode toggle */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex bg-[#1e293b]/95 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setMode('2d')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${mode === '2d' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'}`}
        >
          <MapIcon className="w-3.5 h-3.5" /> 2D Map
        </button>
        <button
          onClick={() => setMode('3d')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${mode === '3d' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'}`}
        >
          <Globe className="w-3.5 h-3.5" /> 3D Globe
        </button>
      </div>

      {/* Data source badge */}
      <div className="absolute top-4 left-4 z-[1000]">
        <DataSourceBadge source={dataSource} />
      </div>

      {/* Entity detail panel */}
      <EntityDetail entity={selectedEntity} onClose={() => setSelectedEntity(null)} />

      {/* Layer panel */}
      <LayerPanel layers={layers} onToggle={toggleLayer} />

      {/* Timeline */}
      <TimelineControls
        hoursAgo={timelineHoursAgo}
        playing={timelinePlaying}
        speed={timelineSpeed}
        onTimeChange={handleTimelineChange}
        onPlayingChange={handleTimelinePlayingChange}
        onSpeedChange={setTimelineSpeed}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center bg-[#0f172a]/60 backdrop-blur-sm">
          <div className="text-sm text-slate-400 animate-pulse">Loading awareness data...</div>
        </div>
      )}

      {mode === '2d' ? (
        <MapContainer center={[20, 0]} zoom={2} className="h-full w-full" style={{ background: '#0f172a' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* GSE threat zones */}
          {isVisible('gse') && gseRegions.map((region) => {
            const [lat, lng] = GSE_REGION_COORDS[region.regionId] ?? [0, 0]
            const color = THREAT_COLORS[region.threatLevel] ?? '#6b7280'
            return (
              <CircleMarker
                key={region.regionId}
                center={[lat, lng]}
                radius={20 + region.gseScore / 5}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.1, weight: 1, dashArray: '4 4' }}
                eventHandlers={{ click: () => setSelectedEntity({ entityType: 'GSE Zone', regionName: formatRegionName(region.regionId), ...region }) }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <strong>{formatRegionName(region.regionId)}</strong>
                    <div>GSE: {region.gseScore} ({region.threatLevel})</div>
                    <div>Events: {region.eventCount}</div>
                    {region.escalationAlert && <div className="text-red-500 font-semibold">ESCALATION ALERT</div>}
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}

          {/* Hazard events */}
          {isVisible('hazards') && hazards.map((e) => {
            const geom = e.geometry as GeoJSONPoint
            const [lng, lat] = geom.coordinates
            const color = SEVERITY_COLORS[e.alertLevel] ?? '#22c55e'
            return (
              <CircleMarker
                key={e.id}
                center={[lat, lng]}
                radius={e.severity === 'CRITICAL' ? 12 : e.severity === 'HIGH' ? 9 : 6}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.5, weight: 2 }}
                eventHandlers={{ click: () => setSelectedEntity({ entityType: 'HazardEvent', ...e, geometry: undefined }) }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <strong>{e.type}</strong>
                    <div>Severity: {e.severity}</div>
                    <div>Alert: {e.alertLevel}</div>
                    <div>Confidence: {e.confidence}</div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}

          {/* Aircraft */}
          {isVisible('aircraft') && aircraft.map((a) => {
            const geom = a.geometry as GeoJSONPoint
            const [lng, lat] = geom.coordinates
            return (
              <Marker key={a.id} position={[lat, lng]} icon={aircraftIcon}
                eventHandlers={{ click: () => setSelectedEntity({ entityType: 'Aircraft', ...a, geometry: undefined }) }}>
                <Popup>
                  <div className="text-xs space-y-1">
                    <strong>{a.callsign || a.icao24}</strong>
                    <div>Alt: {a.altitude?.toLocaleString()}m | Speed: {a.velocity}m/s</div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Vessels */}
          {isVisible('vessels') && vessels.map((v) => {
            const geom = v.geometry as GeoJSONPoint
            const [lng, lat] = geom.coordinates
            return (
              <Marker key={v.id} position={[lat, lng]} icon={vesselIcon}
                eventHandlers={{ click: () => setSelectedEntity({ entityType: 'Vessel', ...v, geometry: undefined }) }}>
                <Popup>
                  <div className="text-xs space-y-1">
                    <strong>{v.name || v.mmsi}</strong>
                    <div>{v.shipType} | {v.speed}kn → {v.destination}</div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      ) : (
        <Suspense
          fallback={(
            <div className="flex h-full w-full items-center justify-center bg-[#020617] text-sm text-slate-400">
              Loading 3D globe...
            </div>
          )}
        >
          <CesiumGlobe
            aircraft={aircraft}
            vessels={vessels}
            satellites={satellites}
            hazards={hazards}
            gseRegions={gseRegions}
            layerVisibility={layerVisibility}
            currentTime={timelineTime}
            isPlaying={timelinePlaying}
            speed={timelineSpeed}
            onEntityClick={handleEntityClick}
            onTimeChange={handleCesiumTimeChange}
          />
        </Suspense>
      )}
    </div>
  )
}
