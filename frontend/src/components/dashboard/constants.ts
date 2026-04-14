import { cn } from '@/lib/utils'

// ── Utility functions ─────────────────────────────────────────────────────────

export function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

export function getStatusTone(status: string) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    SUCCEEDED: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
    RUNNING: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    FAILED: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
    CRITICAL: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
    HIGH: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
    MODERATE: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    LOW: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
    LIVE: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
    MONITOR: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    PENDING: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' },
    GREEN: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  }
  return map[status] ?? { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' }
}

// ── Severity system ───────────────────────────────────────────────────────────

export const SEVERITY_CONFIG: Record<string, { color: string; stripClass: string; textClass: string }> = {
  CRITICAL: { color: '#ef4444', stripClass: 'severity-strip-red', textClass: 'text-red-400' },
  HIGH: { color: '#f97316', stripClass: 'severity-strip-orange', textClass: 'text-orange-400' },
  MODERATE: { color: '#f59e0b', stripClass: 'severity-strip-amber', textClass: 'text-amber-400' },
  LOW: { color: '#22c55e', stripClass: 'severity-strip-green', textClass: 'text-green-400' },
}

export const THREAT_CONFIG: Record<string, { textClass: string; dotClass: string }> = {
  STABLE: { textClass: 'text-green-400', dotClass: 'status-dot-green' },
  ELEVATED: { textClass: 'text-blue-400', dotClass: 'status-dot-blue' },
  HEIGHTENED: { textClass: 'text-amber-400', dotClass: 'status-dot-amber' },
  CRITICAL: { textClass: 'text-red-400', dotClass: 'status-dot-red' },
}

export const HAZARD_SEVERITY_WEIGHT: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MODERATE: 2,
  LOW: 1,
}

// ── Trend icons ───────────────────────────────────────────────────────────────

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export const TREND_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
} as const

export type TrendDirection = keyof typeof TREND_ICON

// ── Data constants (DEMO — replace with live pipeline telemetry) ─────────────

// Command metric sparkline data (demo)
export const DIAL_SPARKLINES = {
  threatLoad: [42, 48, 51, 47, 55, 52, 58, 61, 57, 63, 60, 58],
  aiHealth: [88, 92, 90, 91, 93, 89, 94, 92, 95, 93, 91, 94],
  dataFidelity: [78, 80, 82, 81, 83, 85, 84, 86, 85, 87, 86, 88],
  sensorMesh: [72, 74, 76, 75, 78, 77, 80, 79, 82, 81, 83, 82],
}

export const QUALITY_SPARKLINES = {
  completeness: [82, 84, 83, 85, 86, 85, 87, 88, 87, 89, 88, 90],
  freshness: [90, 88, 89, 87, 88, 86, 87, 85, 86, 84, 85, 83],
  concordance: [75, 77, 76, 78, 79, 78, 80, 81, 80, 82, 81, 83],
  anomalyCapture: [68, 70, 72, 71, 74, 73, 76, 75, 78, 77, 79, 78],
}

// Pipeline telemetry (demo)
export const COMMAND_PRESSURE_SERIES = [
  { label: '00:00', throughput: 87, threat: 52 },
  { label: '04:00', throughput: 82, threat: 48 },
  { label: '08:00', throughput: 91, threat: 55 },
  { label: '12:00', throughput: 88, threat: 61 },
  { label: '16:00', throughput: 94, threat: 58 },
  { label: '20:00', throughput: 89, threat: 63 },
]

export const PIPELINE_TELEMETRY_SERIES = [
  { label: '00:00', health: 94, autonomy: 82 },
  { label: '04:00', health: 96, autonomy: 85 },
  { label: '08:00', health: 93, autonomy: 88 },
  { label: '12:00', health: 97, autonomy: 91 },
  { label: '16:00', health: 95, autonomy: 89 },
  { label: '20:00', health: 98, autonomy: 93 },
]

export const REGION_HEAT_SERIES = [
  { label: 'Mon', gse: 58, volatility: 32 },
  { label: 'Tue', gse: 62, volatility: 38 },
  { label: 'Wed', gse: 65, volatility: 42 },
  { label: 'Thu', gse: 61, volatility: 35 },
  { label: 'Fri', gse: 68, volatility: 45 },
  { label: 'Sat', gse: 72, volatility: 48 },
  { label: 'Sun', gse: 70, volatility: 44 },
]

export const STAGGER = {
  container: { hidden: {}, visible: { transition: { staggerChildren: 0.03 } } },
  item: { hidden: { opacity: 0, y: 4 }, visible: { opacity: 1, y: 0, transition: { duration: 0.2 } } },
}
