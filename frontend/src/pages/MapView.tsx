import { useState, useCallback, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from 'react-leaflet'
import { Icon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Map as MapIcon, Globe } from 'lucide-react'
import {
  mockHazardEvents,
  mockSensors,
  mockInfrastructure,
  mockAircraft,
  mockVessels,
  mockGSERegions,
} from '../lib/mock-data'
import type { GeoJSONPoint } from '../lib/types'
import LayerPanel, { type LayerConfig } from '../components/LayerPanel'
import TimelineControls from '../components/TimelineControls'
import EntityDetail from '../components/EntityDetail'

const SEVERITY_COLORS: Record<string, string> = {
  RED: '#ef4444', ORANGE: '#f97316', YELLOW: '#eab308', GREEN: '#22c55e',
}

const THREAT_COLORS: Record<string, string> = {
  STABLE: '#22c55e', ELEVATED: '#eab308', HEIGHTENED: '#f97316', CRITICAL: '#ef4444',
}

const sensorIcon = new Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2338bdf8" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M4.5 12.5a8 8 0 0 1 15 0"/><path d="M2 12.5a12 12 0 0 1 20 0"/></svg>'
  ),
  iconSize: [24, 24], iconAnchor: [12, 12],
})

const infraIcon = new Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>'
  ),
  iconSize: [20, 20], iconAnchor: [10, 10],
})

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

function GlobeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotRef = useRef(0)
  const dragging = useRef(false)
  const lastX = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h / 2
    const r = Math.min(cx, cy) * 0.85

    let animId: number

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      // Atmospheric glow
      const glow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.15)
      glow.addColorStop(0, 'rgba(56, 189, 248, 0.15)')
      glow.addColorStop(1, 'rgba(56, 189, 248, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      // Globe body
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r)
      grad.addColorStop(0, '#1e3a5f')
      grad.addColorStop(0.7, '#0f172a')
      grad.addColorStop(1, '#020617')
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()

      // Grid lines (longitude)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)'
      ctx.lineWidth = 0.5
      for (let lon = 0; lon < 360; lon += 30) {
        const rad = ((lon + rotRef.current) * Math.PI) / 180
        ctx.beginPath()
        for (let lat = -90; lat <= 90; lat += 2) {
          const latRad = (lat * Math.PI) / 180
          const x = cx + r * Math.cos(latRad) * Math.sin(rad)
          const y = cy - r * Math.sin(latRad)
          const z = Math.cos(latRad) * Math.cos(rad)
          if (z < 0) continue
          if (lat === -90) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // Grid lines (latitude)
      for (let lat = -60; lat <= 60; lat += 30) {
        const latRad = (lat * Math.PI) / 180
        ctx.beginPath()
        let started = false
        for (let lon = 0; lon <= 360; lon += 2) {
          const rad = ((lon + rotRef.current) * Math.PI) / 180
          const x = cx + r * Math.cos(latRad) * Math.sin(rad)
          const y = cy - r * Math.sin(latRad)
          const z = Math.cos(latRad) * Math.cos(rad)
          if (z < 0) { started = false; continue }
          if (!started) { ctx.moveTo(x, y); started = true }
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // Plot GSE regions
      mockGSERegions.forEach((region) => {
        const coords: Record<string, [number, number]> = {
          'middle-east': [43, 30], 'south-asia': [78, 22], 'europe': [15, 50],
          'east-asia': [120, 38], 'north-america': [-95, 40], 'africa': [20, 5],
          'south-america': [-60, -15], 'oceania': [140, -25],
        }
        const [lon, lat] = coords[region.regionId] ?? [0, 0]
        const latRad = (lat * Math.PI) / 180
        const lonRad = ((lon + rotRef.current) * Math.PI) / 180
        const x = cx + r * Math.cos(latRad) * Math.sin(lonRad)
        const y = cy - r * Math.sin(latRad)
        const z = Math.cos(latRad) * Math.cos(lonRad)
        if (z < 0) return

        const color = THREAT_COLORS[region.threatLevel] ?? '#6b7280'
        const pulseR = 4 + (region.gseScore / 200) * 16

        // Pulse
        ctx.beginPath()
        ctx.arc(x, y, pulseR * 1.5, 0, Math.PI * 2)
        ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba')
        ctx.fill()

        // Dot
        ctx.beginPath()
        ctx.arc(x, y, pulseR * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()

        // Label
        ctx.font = '10px Inter, sans-serif'
        ctx.fillStyle = '#e2e8f0'
        ctx.fillText(region.regionName, x + pulseR * 0.6 + 4, y + 3)
      })

      rotRef.current += 0.15
      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="w-full h-full"
      onMouseDown={(e) => { dragging.current = true; lastX.current = e.clientX }}
      onMouseMove={(e) => { if (dragging.current) { rotRef.current += (e.clientX - lastX.current) * 0.5; lastX.current = e.clientX } }}
      onMouseUp={() => { dragging.current = false }}
      onMouseLeave={() => { dragging.current = false }}
    />
  )
}

export default function MapView() {
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const [selectedEntity, setSelectedEntity] = useState<Record<string, unknown> | null>(null)
  const [layers, setLayers] = useState<LayerConfig[]>([
    { id: 'hazards', label: 'Hazard Events', color: '#ef4444', visible: true, count: mockHazardEvents.length },
    { id: 'sensors', label: 'Sensors', color: '#38bdf8', visible: true, count: mockSensors.length },
    { id: 'infrastructure', label: 'Infrastructure', color: '#94a3b8', visible: true, count: mockInfrastructure.length },
    { id: 'aircraft', label: 'Aircraft', color: '#38bdf8', visible: true, count: mockAircraft.length },
    { id: 'vessels', label: 'Vessels', color: '#3b82f6', visible: true, count: mockVessels.length },
    { id: 'gse', label: 'GSE Threat Zones', color: '#f97316', visible: true, count: mockGSERegions.length },
  ])

  const toggleLayer = useCallback((id: string) => {
    setLayers((prev) => prev.map((l) => l.id === id ? { ...l, visible: !l.visible } : l))
  }, [])

  const isVisible = (id: string) => layers.find((l) => l.id === id)?.visible ?? false

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

      {/* Entity detail panel */}
      <EntityDetail entity={selectedEntity} onClose={() => setSelectedEntity(null)} />

      {/* Layer panel */}
      <LayerPanel layers={layers} onToggle={toggleLayer} />

      {/* Timeline */}
      <TimelineControls />

      {mode === '2d' ? (
        <MapContainer center={[20, 0]} zoom={2} className="h-full w-full" style={{ background: '#0f172a' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* GSE threat zones */}
          {isVisible('gse') && mockGSERegions.map((region) => {
            const coords: Record<string, [number, number]> = {
              'middle-east': [30, 43], 'south-asia': [22, 78], 'europe': [50, 15],
              'east-asia': [38, 120], 'north-america': [40, -95], 'africa': [5, 20],
              'south-america': [-15, -60], 'oceania': [-25, 140],
            }
            const [lat, lng] = coords[region.regionId] ?? [0, 0]
            const color = THREAT_COLORS[region.threatLevel] ?? '#6b7280'
            return (
              <CircleMarker
                key={region.regionId}
                center={[lat, lng]}
                radius={20 + region.gseScore / 5}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.1, weight: 1, dashArray: '4 4' }}
                eventHandlers={{ click: () => setSelectedEntity({ entityType: 'GSE Zone', ...region }) }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <strong>{region.regionName}</strong>
                    <div>GSE: {region.gseScore} ({region.threatLevel})</div>
                    <div>Events: {region.eventCount} | Top: {region.topCategory}</div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}

          {/* Hazard events */}
          {isVisible('hazards') && mockHazardEvents.map((e) => {
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

          {/* Sensors */}
          {isVisible('sensors') && mockSensors.map((s) => {
            const geom = s.geometry as GeoJSONPoint
            const [lng, lat] = geom.coordinates
            if (lat === 0 && lng === 0) return null
            return (
              <Marker key={s.id} position={[lat, lng]} icon={sensorIcon}
                eventHandlers={{ click: () => setSelectedEntity({ entityType: 'Sensor', ...s, geometry: undefined }) }}>
                <Popup>
                  <div className="text-xs space-y-1">
                    <strong>{s.name}</strong>
                    <div>Type: {s.type} | Status: {s.status}</div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Infrastructure */}
          {isVisible('infrastructure') && mockInfrastructure.map((i) => {
            const geom = i.geometry as GeoJSONPoint
            const [lng, lat] = geom.coordinates
            return (
              <Marker key={i.id} position={[lat, lng]} icon={infraIcon}
                eventHandlers={{ click: () => setSelectedEntity({ entityType: 'InfrastructureAsset', ...i, geometry: undefined }) }}>
                <Popup>
                  <div className="text-xs space-y-1">
                    <strong>{i.name}</strong>
                    <div>Type: {i.type} | Exposure: {i.exposureLevel}</div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Aircraft */}
          {isVisible('aircraft') && mockAircraft.map((a) => {
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
          {isVisible('vessels') && mockVessels.map((v) => {
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
        <div className="h-full w-full bg-[#020617] flex items-center justify-center">
          <GlobeCanvas />
        </div>
      )}
    </div>
  )
}
