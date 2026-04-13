import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import { useState } from 'react'
import type { ChangeEvent } from 'react'

interface Props {
  onTimeChange?: (hoursAgo: number) => void
  hoursAgo?: number
  playing?: boolean
  speed?: number
  onPlayingChange?: (playing: boolean) => void
  onSpeedChange?: (speed: number) => void
}

const timelineStops = [
  { label: 'Now', hours: 0 },
  { label: '-6h', hours: 6 },
  { label: '-12h', hours: 12 },
  { label: '-18h', hours: 18 },
  { label: '-24h', hours: 24 },
  { label: '-36h', hours: 36 },
  { label: '-48h', hours: 48 },
]

const speedOptions = [1, 10, 60, 300]

function indexForHours(hoursAgo: number | undefined) {
  if (hoursAgo === undefined) return 0
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  timelineStops.forEach((stop, index) => {
    const distance = Math.abs(stop.hours - hoursAgo)
    if (distance < bestDistance) {
      bestIndex = index
      bestDistance = distance
    }
  })
  return bestIndex
}

export default function TimelineControls({
  onTimeChange,
  hoursAgo,
  playing,
  speed,
  onPlayingChange,
  onSpeedChange,
}: Props) {
  const [internalPlaying, setInternalPlaying] = useState(false)
  const [internalValue, setInternalValue] = useState(0)
  const [internalSpeed, setInternalSpeed] = useState(60)

  const value = hoursAgo === undefined ? internalValue : indexForHours(hoursAgo)
  const isPlaying = playing ?? internalPlaying
  const selectedSpeed = speed ?? internalSpeed

  const setTimelineIndex = (nextIndex: number) => {
    const boundedIndex = Math.min(timelineStops.length - 1, Math.max(0, nextIndex))
    if (hoursAgo === undefined) setInternalValue(boundedIndex)
    onTimeChange?.(timelineStops[boundedIndex]?.hours ?? 0)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTimelineIndex(Number(e.target.value))
  }

  const handlePlayingChange = () => {
    const nextPlaying = !isPlaying
    if (playing === undefined) setInternalPlaying(nextPlaying)
    onPlayingChange?.(nextPlaying)
  }

  const handleSpeedChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextSpeed = Number(e.target.value)
    if (speed === undefined) setInternalSpeed(nextSpeed)
    onSpeedChange?.(nextSpeed)
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1e293b]/95 backdrop-blur border border-slate-700 rounded-lg px-4 py-2 z-[1000] flex items-center gap-3">
      <button onClick={() => setTimelineIndex(value - 1)} className="text-slate-400 hover:text-white">
        <SkipBack className="w-3.5 h-3.5" />
      </button>
      <button onClick={handlePlayingChange} className="text-slate-400 hover:text-white">
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>
      <button onClick={() => setTimelineIndex(value + 1)} className="text-slate-400 hover:text-white">
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
          {timelineStops.map((stop) => <span key={stop.label}>{stop.label}</span>)}
        </div>
      </div>
      <select
        value={selectedSpeed}
        onChange={handleSpeedChange}
        className="bg-[#0f172a] border border-slate-700 text-slate-300 text-[10px] px-2 py-1"
      >
        {speedOptions.map((option) => (
          <option key={option} value={option}>{option}x</option>
        ))}
      </select>
    </div>
  )
}
