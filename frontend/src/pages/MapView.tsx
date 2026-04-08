import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from 'react-leaflet'
import { Icon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { mockHazardEvents, mockSensors, mockInfrastructure } from '../lib/mock-data'
import type { GeoJSONPoint } from '../lib/types'

const SEVERITY_COLORS: Record<string, string> = {
  RED: '#ef4444',
  ORANGE: '#f97316',
  YELLOW: '#eab308',
  GREEN: '#22c55e',
}

const sensorIcon = new Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2338bdf8" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M4.5 12.5a8 8 0 0 1 15 0"/><path d="M2 12.5a12 12 0 0 1 20 0"/></svg>'
  ),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const infraIcon = new Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>'
  ),
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

export default function MapView() {
  return (
    <div className="h-[calc(100vh-8rem)] relative rounded-lg overflow-hidden border border-slate-700/50">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        className="h-full w-full"
        style={{ background: '#0f172a' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Hazard events */}
        {mockHazardEvents.map((e) => {
          const geom = e.geometry as GeoJSONPoint
          const [lng, lat] = geom.coordinates
          const color = SEVERITY_COLORS[e.alertLevel] ?? '#22c55e'
          return (
            <CircleMarker
              key={e.id}
              center={[lat, lng]}
              radius={e.severity === 'CRITICAL' ? 12 : e.severity === 'HIGH' ? 9 : 6}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.5, weight: 2 }}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <strong>{e.type}</strong>
                  <div>Severity: {e.severity}</div>
                  <div>Alert: {e.alertLevel}</div>
                  <div>Confidence: {e.confidence}</div>
                  <div>{new Date(e.startTime).toLocaleString()}</div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}

        {/* Sensors */}
        {mockSensors.map((s) => {
          const geom = s.geometry as GeoJSONPoint
          const [lng, lat] = geom.coordinates
          if (lat === 0 && lng === 0) return null
          return (
            <Marker key={s.id} position={[lat, lng]} icon={sensorIcon}>
              <Popup>
                <div className="text-xs space-y-1">
                  <strong>{s.name}</strong>
                  <div>Type: {s.type}</div>
                  <div>Status: {s.status}</div>
                  <div>Operator: {s.operator}</div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Infrastructure */}
        {mockInfrastructure.map((i) => {
          const geom = i.geometry as GeoJSONPoint
          const [lng, lat] = geom.coordinates
          return (
            <Marker key={i.id} position={[lat, lng]} icon={infraIcon}>
              <Popup>
                <div className="text-xs space-y-1">
                  <strong>{i.name}</strong>
                  <div>Type: {i.type}</div>
                  <div>Exposure: {i.exposureLevel}</div>
                  <div>Condition: {i.condition}</div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-[#1e293b]/90 backdrop-blur border border-slate-700 rounded-lg p-3 z-[1000]">
        <h4 className="text-xs font-semibold text-white mb-2">Legend</h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" /> Critical Hazard
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500" /> High Hazard
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500" /> Moderate Hazard
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500" /> Low Hazard
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400" /> Sensor
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-400" /> Infrastructure
          </div>
        </div>
      </div>
    </div>
  )
}
