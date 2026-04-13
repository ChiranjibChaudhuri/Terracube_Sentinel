import { X } from 'lucide-react'

interface Props {
  entity: Record<string, unknown> | null
  onClose: () => void
}

export default function EntityDetail({ entity, onClose }: Props) {
  if (!entity) return null

  const entityType = (entity.entityType as string) || (entity.type as string) || 'Unknown'

  const ENTITY_COLORS: Record<string, string> = {
    HazardEvent: 'border-red-500/50',
    Aircraft: 'border-sky-500/50',
    Vessel: 'border-blue-500/50',
    Sensor: 'border-cyan-500/50',
    InfrastructureAsset: 'border-slate-500/50',
    FinancialIndicator: 'border-amber-500/50',
  }

  return (
    <div className={`absolute top-4 left-4 bg-[#1e293b]/95 backdrop-blur border ${ENTITY_COLORS[entityType] ?? 'border-slate-700'} rounded-lg p-4 z-[1000] w-72 max-h-[70vh] overflow-y-auto`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-white">{entityType}</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        {Object.entries(entity).map(([key, val]) => {
          if (key === 'geometry' || val === null || val === undefined) return null
          const raw = typeof val === 'object' ? JSON.stringify(val) : String(val)
          const display = raw.length > 500 ? raw.slice(0, 500) + '…' : raw
          return (
            <div key={key} className="flex justify-between gap-2 text-xs">
              <span className="text-slate-400 shrink-0">{key}</span>
              <span className="text-slate-200 text-right truncate" title={display}>{display}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
