import { formatDistanceStrict } from 'date-fns'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Database,
  Globe,
  Minus,
  Radio,
  Satellite,
  Shield,
  TrendingDown,
  TrendingUp,
  Wind,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  mockAlerts,
  mockAircraft,
  mockDataProducts,
  mockDataSources,
  mockGSERegions,
  mockHazardEvents,
  mockInfrastructure,
  mockPipelineExecutions,
  mockRegions,
  mockRiskAssessments,
  mockSatellitePasses,
  mockSensors,
  mockVessels,
} from '../lib/mock-data'
import type { GeoJSONPoint, PipelineExecution } from '../lib/types'

const REFERENCE_NOW = new Date('2026-04-08T12:00:00Z')
const REFERENCE_NOW_MS = REFERENCE_NOW.getTime()

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
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

const THREAT_STYLES: Record<string, { bg: string; text: string; bar: string }> = {
  STABLE: { bg: 'rgba(72, 187, 120, 0.1)', text: '#6ee7b7', bar: '#54d38a' },
  ELEVATED: { bg: 'rgba(67, 191, 255, 0.1)', text: '#66d4ff', bar: '#4dc8ff' },
  HEIGHTENED: { bg: 'rgba(251, 146, 60, 0.1)', text: '#fb923c', bar: '#fb923c' },
  CRITICAL: { bg: 'rgba(251, 113, 133, 0.1)', text: '#fb7185', bar: '#fb7185' },
}

const PIPELINE_STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  SUCCEEDED: { bg: 'rgba(72, 187, 120, 0.12)', text: '#6ee7b7', border: 'rgba(72, 187, 120, 0.22)' },
  RUNNING: { bg: 'rgba(67, 191, 255, 0.12)', text: '#66d4ff', border: 'rgba(67, 191, 255, 0.22)' },
  FAILED: { bg: 'rgba(251, 113, 133, 0.12)', text: '#fb7185', border: 'rgba(251, 113, 133, 0.22)' },
  PENDING: { bg: 'rgba(148, 163, 184, 0.12)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.22)' },
  CANCELLED: { bg: 'rgba(100, 116, 139, 0.12)', text: '#64748b', border: 'rgba(100, 116, 139, 0.22)' },
}

const TREND_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
}

const HAZARD_SEVERITY_WEIGHT: Record<string, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
}

const COMMAND_PRESSURE_SERIES = [
  { label: '00', threat: 42, throughput: 64 },
  { label: '03', threat: 45, throughput: 68 },
  { label: '06', threat: 49, throughput: 72 },
  { label: '09', threat: 53, throughput: 77 },
  { label: '12', threat: 60, throughput: 84 },
  { label: '15', threat: 58, throughput: 88 },
  { label: '18', threat: 63, throughput: 92 },
  { label: '21', threat: 68, throughput: 95 },
]

const PIPELINE_TELEMETRY_SERIES = [
  { label: '00', health: 91, autonomy: 84 },
  { label: '03', health: 92, autonomy: 85 },
  { label: '06', health: 93, autonomy: 87 },
  { label: '09', health: 94, autonomy: 88 },
  { label: '12', health: 95, autonomy: 90 },
  { label: '15', health: 95, autonomy: 91 },
  { label: '18', health: 96, autonomy: 92 },
  { label: '21', health: 97, autonomy: 94 },
]

const REGION_HEAT_SERIES = [
  { label: '01', gse: 46, volatility: 58 },
  { label: '04', gse: 48, volatility: 59 },
  { label: '07', gse: 51, volatility: 62 },
  { label: '10', gse: 55, volatility: 65 },
  { label: '13', gse: 58, volatility: 68 },
  { label: '16', gse: 61, volatility: 70 },
  { label: '19', gse: 64, volatility: 74 },
  { label: '22', gse: 67, volatility: 77 },
]

const DIAL_SPARKLINES = {
  threatLoad: [58, 61, 63, 67, 70, 73, 78],
  aiHealth: [88, 90, 92, 93, 95, 95, 96],
  dataFidelity: [84, 86, 89, 91, 92, 94, 95],
  sensorMesh: [76, 79, 81, 84, 87, 88, 89],
}

const QUALITY_SPARKLINES = {
  completeness: [89, 90, 91, 92, 93, 94, 95],
  freshness: [82, 84, 86, 88, 90, 91, 93],
  concordance: [87, 88, 90, 91, 92, 93, 94],
  anomalyCapture: [78, 80, 83, 85, 87, 89, 91],
}

const STAGGER = {
  container: { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } },
  item: { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } },
}

const chartTooltipStyle = {
  background: 'rgba(8, 16, 28, 0.96)',
  border: '1px solid rgba(110, 231, 183, 0.12)',
  borderRadius: 14,
  boxShadow: '0 22px 54px rgba(0, 0, 0, 0.42)',
  fontSize: 12,
}

type GaugeMetricProps = {
  label: string
  value: number
  display: string
  detail: string
  accent: string
  series: number[]
  compact?: boolean
}

type FeedItem = {
  id: string
  kind: 'hazard' | 'alert' | 'pipeline' | 'orbital' | 'tracking'
  title: string
  detail: string
  timestamp: string
  status: string
  live: boolean
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function formatRelativeTime(timestamp: string) {
  return formatDistanceStrict(new Date(timestamp), REFERENCE_NOW, { addSuffix: true })
}

function formatHazardLabel(value: string) {
  return value.toLowerCase().replace(/_/g, ' ')
}

function nearestRegionLabel(point: GeoJSONPoint) {
  const nearest = mockRegions.reduce(
    (best, region) => {
      if (region.geometry.type !== 'Point') return best

      const [regionLon, regionLat] = region.geometry.coordinates
      const [lon, lat] = point.coordinates
      const distance = Math.hypot(regionLon - lon, regionLat - lat)

      if (distance < best.distance) {
        return { distance, name: region.name }
      }

      return best
    },
    { distance: Number.POSITIVE_INFINITY, name: 'Open Ocean' },
  )

  return nearest.name
}

function impactedAssetEstimate(score: number) {
  return Math.max(1, Math.round(score / 24))
}

function GaugeRing({
  value,
  max,
  color,
  size = 84,
}: {
  value: number
  max: number
  color: string
  size?: number
}) {
  const strokeWidth = 7
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(value / max, 1)
  const offset = circumference * (1 - progress)

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(84, 108, 129, 0.18)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="gauge-ring"
      />
    </svg>
  )
}

function Sparkline({
  values,
  color,
  height = 34,
}: {
  values: number[]
  color: string
  height?: number
}) {
  const width = 136
  const padding = 4
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const coordinates = values.map((value, index) => {
    const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2)
    const normalized = (value - min) / range
    const y = height - padding - normalized * (height - padding * 2)
    return { x, y }
  })

  const linePath = coordinates.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  const areaPath = `${linePath} L ${coordinates.at(-1)?.x ?? width - padding} ${height - padding} L ${coordinates[0]?.x ?? padding} ${height - padding} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline-shell">
      <path d={areaPath} fill={color} fillOpacity="0.12" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SectionHeader({
  title,
  subtitle,
  aside,
}: {
  title: string
  subtitle: string
  aside?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="dashboard-kicker">{subtitle}</p>
        <h2 className="dashboard-section-title mt-1">{title}</h2>
      </div>
      {aside}
    </div>
  )
}

function GaugeMetricCard({
  label,
  value,
  display,
  detail,
  accent,
  series,
  compact = false,
}: GaugeMetricProps) {
  const delta = series.at(-1)! - series[0]!
  const positive = delta >= 0

  return (
    <div className={`metric-card ${compact ? 'metric-card-compact' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="dashboard-kicker">{label}</p>
          <p className="dashboard-metric mt-2">{display}</p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {detail}
          </p>
        </div>
        <div className="relative flex h-[84px] w-[84px] items-center justify-center">
          <GaugeRing value={value} max={100} color={accent} />
          <span className="absolute text-sm font-semibold" style={{ color: accent }}>
            {Math.round(value)}
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <Sparkline values={series} color={accent} />
        <span className={`text-xs font-semibold ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>
          {positive ? '+' : ''}
          {delta.toFixed(0)} pts
        </span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const activeHazards = [...mockHazardEvents]
    .filter((event) => !event.endTime || new Date(event.endTime) >= REFERENCE_NOW)
    .sort((left, right) => HAZARD_SEVERITY_WEIGHT[right.severity] - HAZARD_SEVERITY_WEIGHT[left.severity])

  const activeAlerts = mockAlerts.filter((alert) => !alert.expiresAt || new Date(alert.expiresAt) >= REFERENCE_NOW)
  const activeSensors = mockSensors.filter((sensor) => sensor.status === 'ACTIVE')
  const recentPipelines = [...mockPipelineExecutions].sort(
    (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  )
  const latestPipelineRuns = recentPipelines.slice(0, 6)
  const pipelineSuccessRate =
    recentPipelines.filter((pipeline) => pipeline.status === 'SUCCEEDED').length / recentPipelines.length

  const escalationRegions = mockGSERegions.filter((region) => region.trend === 'up' && region.gseScore >= 55)
  const highestGse = Math.max(...mockGSERegions.map((region) => region.gseScore))
  const threatLoad = clamp(
    activeHazards.reduce((total, event) => total + HAZARD_SEVERITY_WEIGHT[event.severity] * 8, 0),
  )
  const aiHealth = Math.round(pipelineSuccessRate * 100)
  const sensorCoverage = Math.round((activeSensors.length / mockSensors.length) * 100)

  const activeGroundSensors = activeSensors.filter((sensor) => sensor.type !== 'SATELLITE' && sensor.lastReading)
  const freshnessLagMinutes = average(
    activeGroundSensors.map(
      (sensor) => (REFERENCE_NOW_MS - new Date(sensor.lastReading as string).getTime()) / 60000,
    ),
  )

  const completenessScore = clamp(
    ((activeSensors.length / mockSensors.length) * 0.42
      + (mockDataProducts.length / 6) * 0.28
      + (mockDataSources.length / 7) * 0.3)
      * 100,
  )
  const freshnessScore = clamp(100 - freshnessLagMinutes / 2.1)
  const concordanceScore = clamp(
    average(mockRiskAssessments.map((assessment) => (assessment.confidence ?? 0.85) * 100)) + 6,
  )
  const anomalyCaptureScore = clamp(
    70 + activeAlerts.length * 2 + mockSatellitePasses.filter((pass) => (pass.cloudCover ?? 100) < 15).length * 3,
  )
  const dataFidelity = Math.round(average([completenessScore, freshnessScore, concordanceScore, anomalyCaptureScore]))

  const highExposureInfrastructure = mockInfrastructure.filter(
    (asset) => asset.exposureLevel === 'HIGH' || asset.exposureLevel === 'EXTREME',
  ).length

  const watchRegions = [...mockGSERegions].sort((left, right) => right.gseScore - left.gseScore).slice(0, 5)

  const commandMetrics = [
    {
      label: 'Threat Load',
      value: threatLoad,
      display: `${threatLoad}%`,
      detail: `${activeHazards.length} active hazards monitored across ${watchRegions.length} theaters`,
      accent: '#4fd9c6',
      series: DIAL_SPARKLINES.threatLoad,
    },
    {
      label: 'AI Pipeline Health',
      value: aiHealth,
      display: `${aiHealth}%`,
      detail: `${latestPipelineRuns.filter((pipeline) => pipeline.status === 'RUNNING').length} orchestration lanes active`,
      accent: '#67c8ff',
      series: DIAL_SPARKLINES.aiHealth,
    },
    {
      label: 'Data Fidelity',
      value: dataFidelity,
      display: `${dataFidelity}%`,
      detail: `${mockDataProducts.length} registered products and ${mockDataSources.length} upstream feeds`,
      accent: '#77e19c',
      series: DIAL_SPARKLINES.dataFidelity,
    },
    {
      label: 'Sensor Mesh',
      value: sensorCoverage,
      display: `${sensorCoverage}%`,
      detail: `${activeSensors.length}/${mockSensors.length} environmental nodes online`,
      accent: '#3ab3ff',
      series: DIAL_SPARKLINES.sensorMesh,
    },
  ]

  const pipelineStages = [
    {
      name: 'Ingestion Mesh',
      icon: Satellite,
      health: 97,
      latency: '3.2 min median',
      detail: 'Satellite, weather, and seismic inputs normal',
      accent: '#67c8ff',
    },
    {
      name: 'Feature Fusion',
      icon: Database,
      health: 94,
      latency: '840 ms join',
      detail: 'Entity resolution and spatial overlays within SLA',
      accent: '#4fd9c6',
    },
    {
      name: 'Hazard Classifier',
      icon: Activity,
      health: 96,
      latency: '420 ms inference',
      detail: 'Classification confidence remains above target',
      accent: '#77e19c',
    },
    {
      name: 'Decision Support',
      icon: Shield,
      health: 91,
      latency: '1.6 sec advisory',
      detail: 'Escalation queue elevated in two theaters',
      accent: '#fb923c',
    },
  ]

  const qualityMetrics = [
    {
      label: 'Completeness',
      value: Math.round(completenessScore),
      display: `${Math.round(completenessScore)}%`,
      detail: 'Cross-feed object coverage',
      accent: '#67c8ff',
      series: QUALITY_SPARKLINES.completeness,
    },
    {
      label: 'Freshness',
      value: Math.round(freshnessScore),
      display: `${Math.round(freshnessScore)}%`,
      detail: `${Math.round(freshnessLagMinutes)} min average lag`,
      accent: '#4fd9c6',
      series: QUALITY_SPARKLINES.freshness,
    },
    {
      label: 'Concordance',
      value: Math.round(concordanceScore),
      display: `${Math.round(concordanceScore)}%`,
      detail: 'Cross-sensor agreement score',
      accent: '#77e19c',
      series: QUALITY_SPARKLINES.concordance,
    },
    {
      label: 'Anomaly Capture',
      value: Math.round(anomalyCaptureScore),
      display: `${Math.round(anomalyCaptureScore)}%`,
      detail: 'AI-assisted event recall',
      accent: '#fb923c',
      series: QUALITY_SPARKLINES.anomalyCapture,
    },
  ]

  const liveFeed: FeedItem[] = [
    ...activeHazards.slice(0, 4).map((event) => ({
      id: event.id,
      kind: 'hazard' as const,
      title: `${formatHazardLabel(event.type)} signal crossed ${event.severity.toLowerCase()} threshold`,
      detail: `${nearestRegionLabel(event.geometry as GeoJSONPoint)} theatre | ${(event.confidence ?? 0) * 100}% confidence`,
      timestamp: event.startTime,
      status: event.severity,
      live: REFERENCE_NOW_MS - new Date(event.startTime).getTime() <= 12 * 60 * 60 * 1000,
    })),
    ...activeAlerts.slice(0, 2).map((alert) => ({
      id: alert.id,
      kind: 'alert' as const,
      title: alert.message,
      detail: alert.actionTaken ?? 'Operator acknowledgement pending',
      timestamp: alert.issuedAt,
      status: alert.severity,
      live: true,
    })),
    ...latestPipelineRuns.slice(0, 2).map((pipeline) => ({
      id: pipeline.id,
      kind: 'pipeline' as const,
      title: `${pipeline.pipelineName} ${pipeline.status.toLowerCase()}`,
      detail: pipeline.status === 'FAILED'
        ? String(pipeline.nodeResults?.error ?? 'Recovery playbook running')
        : `${pipeline.triggeredBy} trigger | ${pipeline.status === 'RUNNING' ? 'autonomous execution in progress' : 'run closed cleanly'}`,
      timestamp: pipeline.startedAt,
      status: pipeline.status,
      live: pipeline.status === 'RUNNING',
    })),
    {
      id: 'orbital-pass',
      kind: 'orbital' as const,
      title: 'Sentinel orbital pass ingested into hazard mesh',
      detail: `${mockSatellitePasses[0]?.processingLevel} scene registered with ${mockSatellitePasses[0]?.cloudCover}% cloud cover`,
      timestamp: mockSatellitePasses[0]?.acquisitionTime ?? REFERENCE_NOW.toISOString(),
      status: 'LIVE',
      live: true,
    },
    {
      id: 'tracking-corridor',
      kind: 'tracking' as const,
      title: 'Maritime and airborne corridors cross-correlated',
      detail: `${mockAircraft.length} aircraft and ${mockVessels.length} vessels fused into movement graph`,
      timestamp: mockAircraft[0]?.timestamp ?? REFERENCE_NOW.toISOString(),
      status: 'MONITOR',
      live: true,
    },
  ]
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 8)

  const feedTone: Record<FeedItem['kind'], { color: string; bg: string; border: string }> = {
    hazard: { color: '#fb923c', bg: 'rgba(251, 146, 60, 0.12)', border: 'rgba(251, 146, 60, 0.22)' },
    alert: { color: '#fb7185', bg: 'rgba(251, 113, 133, 0.12)', border: 'rgba(251, 113, 133, 0.22)' },
    pipeline: { color: '#67c8ff', bg: 'rgba(103, 200, 255, 0.12)', border: 'rgba(103, 200, 255, 0.22)' },
    orbital: { color: '#4fd9c6', bg: 'rgba(79, 217, 198, 0.12)', border: 'rgba(79, 217, 198, 0.22)' },
    tracking: { color: '#77e19c', bg: 'rgba(119, 225, 156, 0.12)', border: 'rgba(119, 225, 156, 0.22)' },
  }

  return (
    <motion.div className="space-y-6" variants={STAGGER.container} initial="hidden" animate="visible">
      <motion.section variants={STAGGER.item} className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="glass-card dashboard-hero p-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="dashboard-kicker">Environmental Intelligence Control Center</p>
                <h1 className="dashboard-display mt-2">Sentinel Command Grid</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Cross-domain hazard surveillance, AI-assisted classification, and data integrity diagnostics in a
                  single operating picture for environmental response teams.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="signal-chip">
                  <Radio className="h-3.5 w-3.5 text-emerald-300" />
                  Live mesh
                </span>
                <span className="signal-chip">
                  <Globe className="h-3.5 w-3.5 text-cyan-300" />
                  {watchRegions.length} theatres under watch
                </span>
                <span className="signal-chip">
                  <Satellite className="h-3.5 w-3.5 text-teal-300" />
                  {mockSatellitePasses.length} orbital passes queued
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="hero-stat">
                <span className="hero-stat-label">Escalating theatres</span>
                <span className="hero-stat-value">{escalationRegions.length}</span>
                <span className="hero-stat-detail">
                  {escalationRegions.map((region) => region.regionName).join(', ')}
                </span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-label">Critical infrastructure at risk</span>
                <span className="hero-stat-value">{highExposureInfrastructure}</span>
                <span className="hero-stat-detail">Assets already above high exposure threshold</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-label">Tracking mesh</span>
                <span className="hero-stat-value">{mockAircraft.length + mockVessels.length}</span>
                <span className="hero-stat-detail">
                  {mockAircraft.length} airborne and {mockVessels.length} maritime tracks correlated
                </span>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-white/6 bg-[rgba(7,18,30,0.84)] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="dashboard-kicker">Threat pressure</p>
                    <h2 className="dashboard-section-title mt-1">24-hour escalation cadence</h2>
                  </div>
                  <span className="badge-live badge-live-blue">LIVE</span>
                </div>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={COMMAND_PRESSURE_SERIES}>
                      <defs>
                        <linearGradient id="threatArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4fd9c6" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#4fd9c6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="throughputArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#67c8ff" stopOpacity={0.24} />
                          <stop offset="100%" stopColor="#67c8ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#6f8197', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#6f8197', fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Area type="monotone" dataKey="throughput" stroke="#67c8ff" strokeWidth={2} fill="url(#throughputArea)" />
                      <Area type="monotone" dataKey="threat" stroke="#4fd9c6" strokeWidth={2} fill="url(#threatArea)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-white/6 bg-[rgba(7,18,30,0.84)] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="dashboard-kicker">Watchlist</p>
                    <h2 className="dashboard-section-title mt-1">Highest pressure regions</h2>
                  </div>
                  <span className="text-xs font-medium text-slate-400">Updated every 5 min</span>
                </div>
                <div className="space-y-3">
                  {watchRegions.map((region) => {
                    const trendIcon = TREND_ICON[region.trend]
                    const RegionTrendIcon = trendIcon
                    const tone = THREAT_STYLES[region.threatLevel]

                    return (
                      <div key={region.regionId} className="watchlist-row">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">{region.regionName}</p>
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                              style={{ background: tone.bg, color: tone.text }}
                            >
                              {region.threatLevel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {region.eventCount} events correlated | Driver: {region.topCategory.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24">
                            <div className="score-track">
                              <div
                                className="score-fill"
                                style={{ width: `${Math.min(region.gseScore, 100)}%`, background: tone.bar }}
                              />
                            </div>
                            <p className="mt-1 text-right text-xs font-medium text-slate-300">{region.gseScore.toFixed(1)}</p>
                          </div>
                          <RegionTrendIcon
                            className={`h-4 w-4 ${region.trend === 'up' ? 'text-amber-300' : region.trend === 'down' ? 'text-emerald-300' : 'text-slate-500'}`}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {commandMetrics.map((metric) => (
            <motion.div key={metric.label} variants={STAGGER.item}>
              <GaugeMetricCard {...metric} />
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section variants={STAGGER.item} className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="glass-card p-5">
          <SectionHeader
            title="Hazard Monitoring Matrix"
            subtitle="Severity indicators"
            aside={
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="signal-chip">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                  {activeHazards.filter((event) => event.severity === 'CRITICAL').length} critical
                </span>
                <span className="signal-chip">
                  <Wind className="h-3.5 w-3.5 text-cyan-300" />
                  {Math.round(average(activeHazards.map((event) => (event.confidence ?? 0.85) * 100)))}% mean confidence
                </span>
              </div>
            }
          />

          <div className="mt-5 space-y-3">
            {activeHazards.slice(0, 6).map((event) => {
              const severityStyle = SEVERITY_STYLES[event.alertLevel]
              const matchingAssessment = mockRiskAssessments.find((assessment) => assessment.hazardType === event.type)
              const exposure = impactedAssetEstimate(matchingAssessment?.riskScore ?? 58)

              return (
                <article
                  key={event.id}
                  className="rounded-2xl border border-white/6 bg-[rgba(7,18,30,0.8)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex h-2.5 w-2.5 rounded-full"
                          style={{ background: severityStyle.text, boxShadow: `0 0 12px ${severityStyle.glow}` }}
                        />
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
                          {formatHazardLabel(event.type)}
                        </h3>
                        {REFERENCE_NOW_MS - new Date(event.startTime).getTime() <= 12 * 60 * 60 * 1000 && (
                          <span className="badge-live badge-live-red">LIVE</span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-slate-300">
                        {nearestRegionLabel(event.geometry as GeoJSONPoint)} | {formatRelativeTime(event.startTime)}
                      </p>
                    </div>

                    <span
                      className="inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                      style={{
                        background: severityStyle.bg,
                        color: severityStyle.text,
                        border: `1px solid ${severityStyle.border}`,
                      }}
                    >
                      {event.severity}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="monitoring-cell">
                      <span className="monitoring-cell-label">Confidence</span>
                      <span className="monitoring-cell-value">{Math.round((event.confidence ?? 0.85) * 100)}%</span>
                    </div>
                    <div className="monitoring-cell">
                      <span className="monitoring-cell-label">Risk model</span>
                      <span className="monitoring-cell-value">{(matchingAssessment?.riskScore ?? 58).toFixed(1)}</span>
                    </div>
                    <div className="monitoring-cell">
                      <span className="monitoring-cell-label">Impacted assets</span>
                      <span className="monitoring-cell-value">{exposure}</span>
                    </div>
                    <div className="monitoring-cell">
                      <span className="monitoring-cell-label">Status</span>
                      <span className="monitoring-cell-value">
                        {event.severity === 'CRITICAL' ? 'Escalating' : event.severity === 'HIGH' ? 'Containment' : 'Observed'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="score-track">
                      <div
                        className="score-fill"
                        style={{
                          width: `${(HAZARD_SEVERITY_WEIGHT[event.severity] / 4) * 100}%`,
                          background: `linear-gradient(90deg, ${severityStyle.text}, rgba(255,255,255,0.3))`,
                        }}
                      />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <div className="glass-card p-5">
          <SectionHeader
            title="Real-Time Event Feed"
            subtitle="Operator timeline"
            aside={<span className="badge-live badge-live-green">Live relay</span>}
          />

          <div className="mt-5 space-y-3">
            {liveFeed.map((item) => {
              const tone = feedTone[item.kind]
              return (
                <div key={item.id} className="feed-row">
                  <div className="feed-row-dot" style={{ background: tone.color, boxShadow: `0 0 14px ${tone.color}55` }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                        style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}
                      >
                        {item.kind}
                      </span>
                      {item.live && <span className="badge-live badge-live-blue">LIVE</span>}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-300">{formatRelativeTime(item.timestamp)}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.status}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </motion.section>

      <motion.section variants={STAGGER.item} className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr_0.95fr]">
        <div className="glass-card p-5">
          <SectionHeader
            title="AI Pipeline Health"
            subtitle="Autonomous inference and orchestration"
            aside={
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current state</p>
                <p className="mt-1 text-sm font-semibold text-white">Nominal with elevated decision queue</p>
              </div>
            }
          />

          <div className="mt-5 h-[210px] rounded-2xl border border-white/6 bg-[rgba(7,18,30,0.84)] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={PIPELINE_TELEMETRY_SERIES}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#6f8197', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[70, 100]} tick={{ fill: '#6f8197', fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="health" stroke="#77e19c" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="autonomy" stroke="#67c8ff" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-3">
            {pipelineStages.map((stage) => {
              const Icon = stage.icon

              return (
                <div key={stage.name} className="pipeline-stage-row">
                  <div className="flex items-start gap-3">
                    <div className="pipeline-stage-icon">
                      <Icon className="h-4 w-4" style={{ color: stage.accent }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{stage.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{stage.detail}</p>
                    </div>
                  </div>
                  <div className="min-w-[140px]">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{stage.latency}</span>
                      <span className="font-semibold" style={{ color: stage.accent }}>
                        {stage.health}%
                      </span>
                    </div>
                    <div className="score-track mt-2">
                      <div className="score-fill" style={{ width: `${stage.health}%`, background: stage.accent }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="glass-card p-5">
          <SectionHeader
            title="Regional Threat Surface"
            subtitle="Global severity index"
            aside={
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Peak GSE</p>
                <p className="mt-1 text-sm font-semibold text-white">{highestGse.toFixed(1)} / 100</p>
              </div>
            }
          />

          <div className="mt-5 h-[210px] rounded-2xl border border-white/6 bg-[rgba(7,18,30,0.84)] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REGION_HEAT_SERIES}>
                <defs>
                  <linearGradient id="gseSurface" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4fd9c6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#4fd9c6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#6f8197', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[35, 85]} tick={{ fill: '#6f8197', fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area type="monotone" dataKey="gse" stroke="#4fd9c6" strokeWidth={2.5} fill="url(#gseSurface)" />
                <Line type="monotone" dataKey="volatility" stroke="#fb923c" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-3">
            {watchRegions.slice(0, 4).map((region) => {
              const tone = THREAT_STYLES[region.threatLevel]
              const TrendIcon = TREND_ICON[region.trend]
              return (
                <div key={region.regionId} className="watchlist-row">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{region.regionName}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {region.eventCount} correlated events | Driver: {region.topCategory.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{region.gseScore.toFixed(1)}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.18em]" style={{ color: tone.text }}>
                        {region.threatLevel}
                      </p>
                    </div>
                    <TrendIcon
                      className={`h-4 w-4 ${region.trend === 'up' ? 'text-amber-300' : region.trend === 'down' ? 'text-emerald-300' : 'text-slate-500'}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="glass-card p-5">
          <SectionHeader
            title="Data Quality Metrics"
            subtitle="Freshness, completeness, agreement"
            aside={
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Catalog health</p>
                <p className="mt-1 text-sm font-semibold text-white">{dataFidelity}% trusted</p>
              </div>
            }
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {qualityMetrics.map((metric) => (
              <GaugeMetricCard key={metric.label} {...metric} compact />
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-white/6 bg-[rgba(7,18,30,0.84)] p-4">
            <div className="flex items-center justify-between">
              <p className="dashboard-kicker">Source integrity</p>
              <span className="text-xs font-medium text-slate-500">Current window</span>
            </div>
            <div className="mt-3 space-y-3">
              {mockDataSources.slice(0, 4).map((source) => {
                const sourceScore = clamp(
                  92
                    - (source.type === 'MODEL' ? 4 : 0)
                    + (source.type === 'SATELLITE' ? 2 : 0)
                    + (source.temporalResolution?.includes('PT') ? 2 : 0),
                )

                return (
                  <div key={source.id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{source.name}</span>
                      <span className="font-semibold text-white">{Math.round(sourceScore)}%</span>
                    </div>
                    <div className="score-track mt-2">
                      <div className="score-fill" style={{ width: `${sourceScore}%`, background: 'linear-gradient(90deg, #67c8ff, #4fd9c6)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section variants={STAGGER.item} className="glass-card p-5">
        <SectionHeader
          title="Pipeline Operations"
          subtitle="Recent execution status"
          aside={
            <div className="flex flex-wrap items-center gap-2">
              {(['SUCCEEDED', 'RUNNING', 'FAILED'] as const).map((status) => {
                const count = mockPipelineExecutions.filter((pipeline) => pipeline.status === status).length
                const tone = PIPELINE_STATUS_STYLES[status]
                return (
                  <span
                    key={status}
                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{ background: tone.bg, color: tone.text, border: `1px solid ${tone.border}` }}
                  >
                    {count} {status.toLowerCase()}
                  </span>
                )
              })}
            </div>
          }
        />

        <div className="mt-5 grid gap-3">
          {latestPipelineRuns.map((pipeline) => {
            const tone = PIPELINE_STATUS_STYLES[pipeline.status]
            const duration = pipeline.completedAt && pipeline.startedAt
              ? `${Math.round((new Date(pipeline.completedAt).getTime() - new Date(pipeline.startedAt).getTime()) / 1000)} sec`
              : 'In progress'

            return (
              <PipelineRow key={pipeline.id} pipeline={pipeline} duration={duration} tone={tone} />
            )
          })}
        </div>
      </motion.section>
    </motion.div>
  )
}

function PipelineRow({
  pipeline,
  duration,
  tone,
}: {
  pipeline: PipelineExecution
  duration: string
  tone: { bg: string; text: string; border: string }
}) {
  const outputSummary = pipeline.nodeResults
    ? Object.entries(pipeline.nodeResults)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ')
    : 'No node telemetry available yet'

  return (
    <div className="pipeline-row">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">{pipeline.pipelineName}</p>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ background: tone.bg, color: tone.text, border: `1px solid ${tone.border}` }}
          >
            {pipeline.status}
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">{outputSummary}</p>
      </div>

      <div className="grid min-w-[240px] gap-3 sm:grid-cols-3">
        <div className="pipeline-stat">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <div>
            <p className="pipeline-stat-label">Started</p>
            <p className="pipeline-stat-value">{formatRelativeTime(pipeline.startedAt)}</p>
          </div>
        </div>
        <div className="pipeline-stat">
          <Activity className="h-3.5 w-3.5 text-cyan-300" />
          <div>
            <p className="pipeline-stat-label">Duration</p>
            <p className="pipeline-stat-value">{duration}</p>
          </div>
        </div>
        <div className="pipeline-stat">
          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" />
          <div>
            <p className="pipeline-stat-label">Triggered by</p>
            <p className="pipeline-stat-value capitalize">{pipeline.triggeredBy}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
