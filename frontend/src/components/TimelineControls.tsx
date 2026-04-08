import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import { useState } from 'react'

interface Props {
  onTimeChange?: (hoursAgo: number) => void
}

export default function TimelineControls({ onTimeChange }: Props) {
  const [playing, setPlaying] = useState(false)
  const [value, setValue] = useState(0)

  const labels = ['Now', '-6h', '-12h', '-18h', '-24h', '-36h', '-48h']

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setValue(v)
    const hours = [0, 6, 12, 18, 24, 36, 48]
    onTimeChange?.(hours[v] ?? 0)
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1e293b]/95 backdrop-blur border border-slate-700 rounded-lg px-4 py-2 z-[1000] flex items-center gap-3">
      <button onClick={() => setValue(Math.max(0, value - 1))} className="text-slate-400 hover:text-white">
        <SkipBack className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => setPlaying(!playing)} className="text-slate-400 hover:text-white">
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>
      <button onClick={() => setValue(Math.min(6, value + 1))} className="text-slate-400 hover:text-white">
        <SkipForward className="w-3.5 h-3.5" />
      </button>
      <div className="flex flex-col items-center gap-0.5">
        <input
          type="range"
          min={0}
          max={6}
          step={1}
          value={value}
          onChange={handleChange}
          className="w-48 h-1 accent-cyan-400"
        />
        <div className="flex justify-between w-48 text-[9px] text-slate-500">
          {labels.map((l) => <span key={l}>{l}</span>)}
        </div>
      </div>
    </div>
  )
}
