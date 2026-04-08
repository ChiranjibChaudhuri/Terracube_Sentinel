import { Eye, EyeOff } from 'lucide-react'

export interface LayerConfig {
  id: string
  label: string
  color: string
  visible: boolean
  count: number
}

interface Props {
  layers: LayerConfig[]
  onToggle: (id: string) => void
}

export default function LayerPanel({ layers, onToggle }: Props) {
  return (
    <div className="absolute top-4 right-4 bg-[#1e293b]/95 backdrop-blur border border-slate-700 rounded-lg p-3 z-[1000] w-52">
      <h4 className="text-xs font-semibold text-white mb-2 uppercase tracking-wider">Data Layers</h4>
      <div className="space-y-1">
        {layers.map((layer) => (
          <button
            key={layer.id}
            onClick={() => onToggle(layer.id)}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-slate-700/50 transition-colors"
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: layer.visible ? layer.color : '#475569' }} />
            <span className={layer.visible ? 'text-slate-200' : 'text-slate-500'}>{layer.label}</span>
            <span className="ml-auto text-slate-500 text-[10px]">{layer.count}</span>
            {layer.visible ? <Eye className="w-3 h-3 text-slate-400" /> : <EyeOff className="w-3 h-3 text-slate-600" />}
          </button>
        ))}
      </div>
    </div>
  )
}
