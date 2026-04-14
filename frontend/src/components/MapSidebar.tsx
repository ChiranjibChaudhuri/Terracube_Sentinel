import { useState } from 'react'
import { Plane, Satellite, Radio, Anchor, Shield, MapPin, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import type { Aircraft, HazardEvent, SatellitePass, Vessel } from '../lib/types'
import type { GeoJSONPoint } from '../lib/types'

interface LayerConfig {
  id: string
  label: string
  color: string
  visible: boolean
  count: number
}

interface MapSidebarProps {
  layers: LayerConfig[]
  onToggleLayer: (id: string) => void
  aircraft: Aircraft[]
  vessels: Vessel[]
  satellites: SatellitePass[]
  hazards: HazardEvent[]
  onEntityClick: (entity: any, entityType: string) => void
}

const QUICK_NAV_LOCATIONS = [
  { name: 'New York', lat: 40.7128, lon: -74.0060, alt: 500000 },
  { name: 'London', lat: 51.5074, lon: -0.1278, alt: 500000 },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503, alt: 500000 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, alt: 500000 },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708, alt: 300000 },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, alt: 500000 },
  { name: 'São Paulo', lat: -23.5505, lon: -46.6333, alt: 500000 },
]

export default function MapSidebar({
  layers,
  onToggleLayer,
  aircraft,
  vessels,
  satellites,
  hazards,
  onEntityClick,
}: MapSidebarProps) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-[1000] bg-[#0f172a]/90 backdrop-blur border border-slate-700 rounded-lg p-2 hover:bg-[#1e293b] transition-colors"
      >
        {isOpen ? <ChevronLeft className="w-4 h-4 text-slate-300" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}
      </button>

      {/* Sidebar panel */}
      {isOpen && (
        <div className="absolute left-4 top-4 bottom-4 w-[280px] bg-black/60 backdrop-blur-lg border border-white/10 rounded-lg z-[999] flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 px-4 py-3">
            {/* DATA LAYERS Section */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                Data Layers
              </h3>
              <div className="space-y-1">
                {layers.map((layer) => (
                  <LayerToggle
                    key={layer.id}
                    label={layer.label}
                    color={layer.color}
                    visible={layer.visible}
                    count={layer.count}
                    onToggle={() => onToggleLayer(layer.id)}
                  />
                ))}
              </div>
            </div>

            <Separator className="mb-6 bg-white/10" />

            {/* QUICK NAV Section */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                Quick Nav
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_NAV_LOCATIONS.map((loc) => (
                  <QuickNavButton key={loc.name} name={loc.name} />
                ))}
              </div>
            </div>

            <Separator className="mb-6 bg-white/10" />

            {/* ENTITY LISTS Section */}
            {aircraft.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                  <Plane className="w-3.5 h-3.5" />
                  Aircraft ({aircraft.length})
                </h3>
                <div className="space-y-0.5">
                  {aircraft.slice(0, 5).map((ac) => (
                    <EntityItem
                      key={ac.id}
                      icon={<Plane className="w-3 h-3" />}
                      name={ac.callsign || ac.icao24}
                      detail={`Alt: ${ac.altitude?.toLocaleString() || '--'}m | ${ac.velocity || 0}m/s`}
                      onClick={() => onEntityClick(ac, 'aircraft')}
                    />
                  ))}
                  {aircraft.length > 5 && (
                    <div className="text-[10px] text-slate-500 px-2 py-1">
                      +{aircraft.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {satellites.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                  <Satellite className="w-3.5 h-3.5" />
                  Satellites ({satellites.length})
                </h3>
                <div className="space-y-0.5">
                  {satellites.slice(0, 5).map((sat) => (
                    <EntityItem
                      key={sat.id}
                      icon={<Satellite className="w-3 h-3" />}
                      name={sat.name || sat.id}
                      detail={`Source: ${sat.source || 'Unknown'}`}
                      onClick={() => onEntityClick(sat, 'satellite')}
                    />
                  ))}
                  {satellites.length > 5 && (
                    <div className="text-[10px] text-slate-500 px-2 py-1">
                      +{satellites.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {hazards.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5" />
                  Hazards ({hazards.length})
                </h3>
                <div className="space-y-0.5">
                  {hazards.slice(0, 5).map((hz) => (
                    <EntityItem
                      key={hz.id}
                      icon={<Radio className="w-3 h-3" />}
                      name={hz.type}
                      detail={`Severity: ${hz.severity}`}
                      onClick={() => onEntityClick(hz, 'hazard')}
                    />
                  ))}
                  {hazards.length > 5 && (
                    <div className="text-[10px] text-slate-500 px-2 py-1">
                      +{hazards.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {vessels.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                  <Anchor className="w-3.5 h-3.5" />
                  Vessels ({vessels.length})
                </h3>
                <div className="space-y-0.5">
                  {vessels.slice(0, 5).map((v) => (
                    <EntityItem
                      key={v.id}
                      icon={<Anchor className="w-3 h-3" />}
                      name={v.name || v.mmsi}
                      detail={`${v.shipType} | ${v.speed || 0}kn`}
                      onClick={() => onEntityClick(v, 'vessel')}
                    />
                  ))}
                  {vessels.length > 5 && (
                    <div className="text-[10px] text-slate-500 px-2 py-1">
                      +{vessels.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </>
  )
}

interface LayerToggleProps {
  label: string
  color: string
  visible: boolean
  count: number
  onToggle: () => void
}

function LayerToggle({ label, color, visible, count, onToggle }: LayerToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-white/5 transition-colors group"
    >
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all"
        style={{
          backgroundColor: visible ? color : '#475569',
          boxShadow: visible ? `0 0 8px ${color}` : 'none',
        }}
      />
      <span className={visible ? 'text-slate-200 text-xs' : 'text-slate-500 text-xs'}>{label}</span>
      <Badge
        variant={visible ? 'outline' : 'secondary'}
        className={`ml-auto text-[10px] px-1.5 py-0.5 ${
          visible ? 'border-slate-600 text-slate-300' : 'bg-slate-800 text-slate-500'
        }`}
      >
        {count}
      </Badge>
    </button>
  )
}

interface EntityItemProps {
  icon: React.ReactNode
  name: string
  detail: string
  onClick: () => void
}

function EntityItem({ icon, name, detail, onClick }: EntityItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-white/5 transition-colors group text-left"
    >
      <div className="w-5 h-5 rounded bg-slate-700/50 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-600 transition-colors">
        <span className="text-slate-300 text-[10px]">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-slate-200 truncate">{name}</div>
        <div className="text-[10px] text-slate-500 truncate">{detail}</div>
      </div>
    </button>
  )
}

interface QuickNavButtonProps {
  name: string
}

function QuickNavButton({ name }: QuickNavButtonProps) {
  const handleFlyTo = () => {
    const loc = QUICK_NAV_LOCATIONS.find((l) => l.name === name)
    if (loc) {
      // Emit a custom event for the parent to handle
      window.dispatchEvent(
        new CustomEvent('quick-nav-flyto', {
          detail: { lat: loc.lat, lon: loc.lon, alt: loc.alt },
        })
      )
    }
  }

  return (
    <Button
      variant="outline"
      size="xs"
      onClick={handleFlyTo}
      className="w-full h-7 text-[10px] bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700/50 hover:text-white hover:border-slate-600 transition-all"
    >
      {name}
    </Button>
  )
}
