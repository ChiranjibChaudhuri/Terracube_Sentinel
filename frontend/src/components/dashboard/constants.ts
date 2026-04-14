import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export const GLASS_PANEL =
  'relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.36)] transition-all duration-200 hover:scale-[1.01] hover:border-white/[0.12]'

export const SUB_PANEL =
  'rounded-xl border border-white/[0.06] bg-black/20 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'

export const KICKER_CLASS = 'text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500'

export const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  GREEN: {
    bg: 'rgba(72, 187, 120, 0.12)',
    text: '#6ee7b7',
    border: 'rgba(72, 187, 120, 0.24)',
    glow: 'rgba(72, 187, 120, 0.32)',
  },
  YELLOW: {
    bg: 'rgba(248, 186, 62, 0.12)',
    text: '#fbbf24',
    border: 'rgba(248, 186, 62, 0.24)',
    glow: 'rgba(248, 186, 62, 0.32)',
  },
  ORANGE: {
    bg: 'rgba(251, 146, 60, 0.12)',
    text: '#fb923c',
    border: 'rgba(251, 146, 60, 0.24)',
    glow: 'rgba(251, 146, 60, 0.32)',
  },
  RED: {
    bg: 'rgba(251, 113, 133, 0.12)',
    text: '#fb7185',
    border: 'rgba(251, 113, 133, 0.24)',
    glow: 'rgba(251, 113, 133, 0.34)',
  },
}

export const THREAT_STYLES: Record<string, { bg: string; text: string; bar: string }> = {
  STABLE: { bg: 'rgba(72, 187, 120, 0.1)', text: '#6ee7b7', bar: '#54d38a' },
  ELEVATED: { bg: 'rgba(67, 191, 255, 0.1)', text: '#66d4ff', bar: '#4dc8ff' },
  HEIGHTENED: { bg: 'rgba(251, 146, 60, 0.1)', text: '#fb923c', bar: '#fb923c' },
  CRITICAL: { bg: 'rgba(251, 113, 133, 0.1)', text: '#fb7185', bar: '#fb7185' },
}

export const PIPELINE_STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  SUCCEEDED: { bg: 'rgba(72, 187, 120, 0.12)', text: '#6ee7b7', border: 'rgba(72, 187, 120, 0.22)' },
  RUNNING: { bg: 'rgba(67, 191, 255, 0.12)', text: '#66d4ff', border: 'rgba(67, 191, 255, 0.22)' },
  FAILED: { bg: 'rgba(251, 113, 133, 0.12)', text: '#fb7185', border: 'rgba(251, 113, 133, 0.22)' },
  PENDING: { bg: 'rgba(148, 163, 184, 0.12)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.22)' },
  CANCELLED: { bg: 'rgba(100, 116, 139, 0.12)', text: '#64748b', border: 'rgba(100, 116, 139, 0.22)' },
}

export const LIVE_BADGE_STYLES = {
  green: {
    badge: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    dot: 'bg-emerald-400 shadow-[0_0_14px_rgba(74,222,128,0.75)]',
  },
  blue: {
    badge: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
    dot: 'bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.75)]',
  },
  amber: {
    badge: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
    dot: 'bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.75)]',
  },
  red: {
    badge: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
    dot: 'bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.75)]',
  },
} as const

export const TREND_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
}

export const HAZARD_SEVERITY_WEIGHT: Record<string, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
}

// DEMO DATA — Replace with live pipeline telemetry when Dagster is connected
export const COMMAND_PRESSURE_SERIES = [
  { label: '00', threat: 42, throughput: 64 },
  { label: '03', threat: 45, throughput: 68 },
  { label: '06', threat: 49, throughput: 72 },
  { label: '09', threat: 53, throughput: 77 },
  { label: '12', threat: 60, throughput: 84 },
  { label: '15', threat: 58, throughput: 88 },
  { label: '18', threat: 63, throughput: 92 },
  { label: '21', threat: 68, throughput: 95 },
]

// DEMO DATA — Replace with live Dagster health metrics
export const PIPELINE_TELEMETRY_SERIES = [
  { label: '00', health: 91, autonomy: 84 },
  { label: '03', health: 92, autonomy: 85 },
  { label: '06', health: 93, autonomy: 87 },
  { label: '09', health: 94, autonomy: 88 },
  { label: '12', health: 95, autonomy: 90 },
  { label: '15', health: 95, autonomy: 91 },
  { label: '18', health: 96, autonomy: 92 },
  { label: '21', health: 97, autonomy: 94 },
]

// DEMO DATA — Replace with live GSE time-series from /gse/region/{id}
export const REGION_HEAT_SERIES = [
  { label: '01', gse: 46, volatility: 58 },
  { label: '04', gse: 48, volatility: 59 },
  { label: '07', gse: 51, volatility: 62 },
  { label: '10', gse: 55, volatility: 65 },
  { label: '13', gse: 58, volatility: 68 },
  { label: '16', gse: 61, volatility: 70 },
  { label: '19', gse: 64, volatility: 74 },
  { label: '22', gse: 67, volatility: 77 },
]

// DEMO DATA — Replace with computed metrics from awareness API
export const DIAL_SPARKLINES = {
  threatLoad: [58, 61, 63, 67, 70, 73, 78],
  aiHealth: [88, 90, 92, 93, 95, 95, 96],
  dataFidelity: [84, 86, 89, 91, 92, 94, 95],
  sensorMesh: [76, 79, 81, 84, 87, 88, 89],
}

// DEMO DATA — Replace with computed data quality metrics
export const QUALITY_SPARKLINES = {
  completeness: [89, 90, 91, 92, 93, 94, 95],
  freshness: [82, 84, 86, 88, 90, 91, 93],
  concordance: [87, 88, 90, 91, 92, 93, 94],
  anomalyCapture: [78, 80, 83, 85, 87, 89, 91],
}

export const STAGGER = {
  container: { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } },
  item: { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32 } } },
}
