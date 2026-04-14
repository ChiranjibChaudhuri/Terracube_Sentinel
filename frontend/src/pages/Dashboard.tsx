import { formatDistanceStrict } from 'date-fns'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Database,
  GitBranch,
  Globe,
  Plane,
  Radio,
  Satellite,
  Shield,
  Wind,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  getAiStatus,
  getAlertsPending,
  getAlertsWebSocketUrl,
  getFusionAwareness,
  getGseRegions,
  getHealth,
  getPipelineExecutions,
  type AiStatusResponse,
  type AlertSocketMessage,
  type GseRegionSummaryResponse,
  type HealthResponse,
  type PendingAlertResponse,
} from '../lib/api'
import { fetchObjects } from '@/lib/api-client'
import useWebSocket from '@/hooks/useWebSocket'
import { type DataSource } from '@/hooks/useAwarenessData'
import {
  normalizeHazards,
  normalizeAircraftTracks,
  normalizeVesselTracks,
  normalizeSatellitePasses,
  formatRegionName,
} from '../lib/awareness-normalizers'
import type {
  Aircraft,
  DataProduct,
  DataSource as DataSourceObject,
  GeoJSONPoint,
  HazardEvent,
  InfrastructureAsset,
  PipelineExecution,
  RiskAssessment,
  SatellitePass,
  Sensor,
  Vessel,
} from '../lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  average,
  clamp,
  getStatusTone,
  SEVERITY_CONFIG,
  THREAT_CONFIG,
  HAZARD_SEVERITY_WEIGHT,
  TREND_ICON,
  STAGGER,
  COMMAND_PRESSURE_SERIES,
  PIPELINE_TELEMETRY_SERIES,
  REGION_HEAT_SERIES,
  DIAL_SPARKLINES,
  QUALITY_SPARKLINES,
} from '@/components/dashboard'

const REFERENCE_NOW = new Date()
const REFERENCE_NOW_MS = REFERENCE_NOW.getTime()

// ── Types ─────────────────────────────────────────────────────────────────────

type FeedItem = {
  id: string
  kind: 'hazard' | 'alert' | 'pipeline' | 'orbital' | 'tracking'
  title: string
  detail: string
  timestamp: string
  status: string
  live: boolean
}

type DashboardRegion = {
  regionId: string
  regionName: string
  gseScore: number
  threatLevel: string
  eventCount: number
  trend: 'up' | 'down' | 'stable'
  topCategory: string
  escalationAlert: boolean
}

// ── Fallbacks ────────────────────────────────────────────────────────────────

const FALLBACK_HEALTH: HealthResponse = { status: 'degraded', agents: [], version: '0.2.0' }
const FALLBACK_AI: AiStatusResponse = {
  llm: { available: false, model: 'offline', base_url: '', stats: {} },
  features: { llm_classification: true, anomaly_detection: true, auto_mapping: true },
  quality_thresholds: { min_completeness: 0.75, min_overall_quality: 0.7, duplicate_similarity_threshold: 0.92 },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(ts: string) {
  return formatDistanceStrict(new Date(ts), REFERENCE_NOW, { addSuffix: true })
}

function buildRiskAssessments(hazards: HazardEvent[]): RiskAssessment[] {
  if (!hazards.length) return []
  const grouped = new Map<string, HazardEvent[]>()
  for (const h of hazards) {
    (grouped.get(h.type) ?? []).push(h)
    grouped.set(h.type, grouped.get(h.type) ?? [])
  }
  return Array.from(grouped.entries()).map(([type, items], i) => ({
    id: `risk-${i}-${type}`,
    hazardType: type as RiskAssessment['hazardType'],
    riskScore: Number(clamp(average(items.map((it) => HAZARD_SEVERITY_WEIGHT[it.severity] * 22 + (it.confidence ?? 0.85) * 12))).toFixed(1)),
    methodology: 'COMPOSITE',
    confidence: Number(average(items.map((it) => it.confidence ?? 0.85)).toFixed(2)),
    timestamp: items[0]?.startTime ?? REFERENCE_NOW.toISOString(),
  }))
}

function buildLiveFeed({ hazards, alerts, pipelines, satellitePasses, aircraftTracks, vesselTracks }: {
  hazards: HazardEvent[]; alerts: PendingAlertResponse[]; pipelines: PipelineExecution[]
  satellitePasses: SatellitePass[]; aircraftTracks: Aircraft[]; vesselTracks: Vessel[]
}) {
  const items: FeedItem[] = [
    ...hazards.slice(0, 4).map((e) => ({
      id: e.id, kind: 'hazard' as const, title: `${e.type.toLowerCase()} — ${e.severity.toLowerCase()}`,
      detail: `${e.confidence ? Math.round(e.confidence * 100) : 85}% confidence`,
      timestamp: e.startTime, status: e.severity, live: REFERENCE_NOW_MS - new Date(e.startTime).getTime() <= 43200000,
    })),
    ...alerts.slice(0, 2).map((a) => ({
      id: a.alertId, kind: 'alert' as const, title: a.title, detail: `${formatRegionName(a.regionId)} — ${a.message}`,
      timestamp: a.timestamp, status: a.priority, live: true,
    })),
    ...pipelines.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 2).map((p) => ({
      id: p.id, kind: 'pipeline' as const, title: `${p.pipelineName} ${p.status.toLowerCase()}`,
      detail: p.triggeredBy, timestamp: p.startedAt, status: p.status, live: p.status === 'RUNNING',
    })),
  ]
  const sat = satellitePasses[0]
  if (sat) items.push({ id: 'orbital', kind: 'orbital' as const, title: `Satellite pass — ${sat.processingLevel}`, detail: `${sat.cloudCover ?? 0}% cloud cover`, timestamp: sat.acquisitionTime, status: 'LIVE', live: true })
  if (aircraftTracks.length || vesselTracks.length) items.push({ id: 'tracking', kind: 'tracking' as const, title: `${aircraftTracks.length} aircraft + ${vesselTracks.length} vessels`, detail: 'Movement graph', timestamp: aircraftTracks[0]?.timestamp ?? vesselTracks[0]?.timestamp ?? '', status: 'MONITOR', live: true })
  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10)
}

// ── Chart tooltip style ──────────────────────────────────────────────────────

const CHART_TOOLTIP_STYLE = {
  contentStyle: { background: '#0f1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, fontSize: 12, color: '#e6edf3' },
  itemStyle: { color: '#8b949e' },
  labelStyle: { color: '#e6edf3', fontWeight: 600 },
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [systemHealth, setSystemHealth] = useState<HealthResponse>(FALLBACK_HEALTH)
  const [aiPipeline, setAiPipeline] = useState<AiStatusResponse>(FALLBACK_AI)
  const [gseRegions, setGseRegions] = useState<GseRegionSummaryResponse[]>([])
  const [alerts, setAlerts] = useState<PendingAlertResponse[]>([])
  const [hazards, setHazards] = useState<HazardEvent[]>([])
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([])
  const [satellitePasses, setSatellitePasses] = useState<SatellitePass[]>([])
  const [aircraftTracks, setAircraftTracks] = useState<Aircraft[]>([])
  const [vesselTracks, setVesselTracks] = useState<Vessel[]>([])
  const [pipelineRuns, setPipelineRuns] = useState<PipelineExecution[]>([])
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [infrastructureAssets, setInfrastructureAssets] = useState<InfrastructureAsset[]>([])
  const [dataProducts, setDataProducts] = useState<DataProduct[]>([])
  const [catalogSources, setCatalogSources] = useState<DataSourceObject[]>([])
  const [awarenessFeatureCount, setAwarenessFeatureCount] = useState(0)

  useEffect(() => {
    const c = new AbortController()
    const s = c.signal
    void getHealth(s).then(setSystemHealth).catch(() => undefined)
    void getAiStatus(s).then(setAiPipeline).catch(() => undefined)
    void getGseRegions(s).then((r) => { if (r?.length) setGseRegions(r) }).catch(() => undefined)
    void getAlertsPending(s).then((r) => { if (r?.length) setAlerts(r) }).catch(() => undefined)
    void getPipelineExecutions(s).then((r) => { if (r?.length) setPipelineRuns(r) }).catch(() => undefined)
    void fetchObjects<SatellitePass>('SatellitePass', { pageSize: 100 }, s).then(setSatellitePasses).catch(() => undefined)
    void fetchObjects<Sensor>('Sensor', { pageSize: 1000 }, s).then(setSensors).catch(() => undefined)
    void fetchObjects<InfrastructureAsset>('InfrastructureAsset', { pageSize: 1000 }, s).then(setInfrastructureAssets).catch(() => undefined)
    void fetchObjects<DataProduct>('DataProduct', { pageSize: 1000 }, s).then(setDataProducts).catch(() => undefined)
    void fetchObjects<DataSourceObject>('DataSource', { pageSize: 1000 }, s).then(setCatalogSources).catch(() => undefined)
    void getFusionAwareness(undefined, s).then((a) => {
      setAwarenessFeatureCount(a.metadata.totalFeatures)
      const h = normalizeHazards(a.features); if (h.length) { setHazards(h); setRiskAssessments(buildRiskAssessments(h)) }
      const sp = normalizeSatellitePasses(a.features); if (sp.length) setSatellitePasses(sp)
      const at = normalizeAircraftTracks(a.features); if (at.length) setAircraftTracks(at)
      const vt = normalizeVesselTracks(a.features); if (vt.length) setVesselTracks(vt)
    }).catch(() => undefined)
    return () => c.abort()
  }, [])

  const { isConnected: wsConnected } = useWebSocket<AlertSocketMessage>(getAlertsWebSocketUrl(), {
    parseMessage: (r) => { try { return JSON.parse(r) as AlertSocketMessage } catch { return {} as AlertSocketMessage } },
    onMessage: (m) => {
      if (m.type !== 'alert') return
      const d = m.data
      setAlerts((prev) => [{ alertId: d.alertId, rule: d.rule, priority: d.priority, title: d.title, message: d.message, regionId: d.regionId, timestamp: d.timestamp }, ...prev.filter((a) => a.alertId !== d.alertId)].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20))
    },
  })

  // ── Derived state ─────────────────────────────────────────────────────
  const feed = useMemo(() => buildLiveFeed({ hazards, alerts, pipelines: pipelineRuns, satellitePasses, aircraftTracks, vesselTracks }), [hazards, alerts, pipelineRuns, satellitePasses, aircraftTracks, vesselTracks])
  const dashboardRegions = useMemo(() => (gseRegions || []).map((r) => ({
    ...r, regionName: formatRegionName(r.regionId),
    topCategory: [...r.contributingFactors].sort((a, b) => (b.weightedPressure ?? b.pressure * b.weight) - (a.weightedPressure ?? a.pressure * a.weight))[0]?.category ?? 'cross_domain',
    trend: r.escalationAlert ? 'up' as const : r.gseScore <= 20 ? 'down' as const : 'stable' as const,
  })), [gseRegions])

  const activeHazards = useMemo(() => [...hazards].filter((e) => !e.endTime || new Date(e.endTime) >= REFERENCE_NOW).sort((a, b) => HAZARD_SEVERITY_WEIGHT[b.severity] - HAZARD_SEVERITY_WEIGHT[a.severity]), [hazards])
  const activeSensors = sensors.filter((s) => s.status === 'ACTIVE')
  const watchRegions = [...dashboardRegions].sort((a, b) => b.gseScore - a.gseScore).slice(0, 8)
  const escalationRegions = watchRegions.filter((r) => r.trend === 'up' && r.gseScore >= 55)
  const latestPipelines = [...pipelineRuns].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 6)

  const threatLoad = clamp(activeHazards.reduce((t, e) => t + HAZARD_SEVERITY_WEIGHT[e.severity] * 8, 0))
  const sensorCov = sensors.length > 0 ? Math.round((activeSensors.length / sensors.length) * 100) : 0
  const pipelineRate = latestPipelines.length > 0 ? latestPipelines.filter((p) => p.status === 'SUCCEEDED').length / latestPipelines.length : 0
  const aiHealth = clamp(Math.round((pipelineRate * 100) * 0.6 + (aiPipeline?.llm?.available ? 40 : 18)))

  const metrics = [
    { label: 'Threat Load', value: threatLoad, detail: `${activeHazards.length} active hazards`, series: DIAL_SPARKLINES.threatLoad, color: '#ef4444' },
    { label: 'AI Pipeline', value: aiHealth, detail: aiPipeline?.llm?.model ?? 'offline', series: DIAL_SPARKLINES.aiHealth, color: '#38bdf8' },
    { label: 'Sensor Coverage', value: sensorCov, detail: `${activeSensors.length}/${sensors.length} nodes`, series: DIAL_SPARKLINES.sensorMesh, color: '#22c55e' },
    { label: 'Entities', value: awarenessFeatureCount, detail: `${catalogSources.length} sources`, series: DIAL_SPARKLINES.dataFidelity, color: '#a78bfa' },
  ]

  return (
    <motion.div className="space-y-4" variants={STAGGER.container} initial="hidden" animate="visible">
      {/* ── KPI metrics row ──────────────────────────────────────────── */}
      <motion.div variants={STAGGER.item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <Card key={m.label} className="relative overflow-hidden">
            <div className="absolute top-2 right-2 opacity-20">
              <svg width="40" height="20" className="overflow-visible">
                <polyline
                  fill="none"
                  stroke={m.color}
                  strokeWidth="1.5"
                  points={m.series.map((v, i) => `${i * (40 / (m.series.length - 1))},${20 - (v / 100) * 20}`).join(' ')}
                />
              </svg>
            </div>
            <CardContent className="p-4" style={{ borderBottom: `2px solid ${m.color}40` }}>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{m.label}</p>
              <p className="mt-1 text-3xl font-bold font-mono">{m.value}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{m.detail}</span>
                <span className={cn('text-[11px] font-mono', m.value > 70 ? 'text-red-400' : m.value > 40 ? 'text-amber-400' : 'text-green-400')}>
                  {m.value > 70 ? '↑' : m.value > 40 ? '→' : '↓'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* ── Threat watchlist (table) ──────────────────────────────── */}
        <motion.div variants={STAGGER.item} className="xl:col-span-2">
          <Card>
            <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-medium">Regional Threat Summary</CardTitle>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="status-dot status-dot-green status-dot-pulse" />
                <span>Live</span>
                <span className="mx-1 text-muted-foreground/40">·</span>
                <span>{escalationRegions.length} escalating</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Region</TableHead>
                    <TableHead className="text-[10px]">GSE</TableHead>
                    <TableHead className="text-[10px]">Threat</TableHead>
                    <TableHead className="text-[10px]">Events</TableHead>
                    <TableHead className="text-[10px]">Driver</TableHead>
                    <TableHead className="text-[10px] w-10">Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {watchRegions.map((r) => {
                    const threat = THREAT_CONFIG[r.threatLevel] ?? THREAT_CONFIG.STABLE
                    const TrendIcon = TREND_ICON[r.trend]
                    return (
                      <TableRow key={r.regionId}>
                        <TableCell className="font-medium">{r.regionName}</TableCell>
                        <TableCell className={cn('font-mono font-semibold', r.gseScore > 60 ? 'text-red-400' : r.gseScore > 40 ? 'text-amber-400' : 'text-green-400')}>{r.gseScore.toFixed(1)}</TableCell>
                        <TableCell>
                          <span className={cn('flex items-center gap-1.5 text-[11px] font-medium', threat.textClass)}>
                            <span className={cn('status-dot', threat.dotClass)} />
                            {r.threatLevel}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">{r.eventCount}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          <span className={cn('status-dot', r.topCategory === 'hazard' ? 'status-dot-red' : r.topCategory === 'conflict' ? 'status-dot-orange' : r.topCategory === 'terrorism' ? 'status-dot-amber' : 'status-dot-green')} />
                          {r.topCategory.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell>
                          <TrendIcon className={cn('size-3.5', r.trend === 'up' ? 'text-amber-400' : r.trend === 'down' ? 'text-green-400' : 'text-muted-foreground')} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Pipeline health ─────────────────────────────────────────── */}
        <motion.div variants={STAGGER.item}>
          <Card className="h-full">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-medium">Pipeline Health</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: 'Ingestion Mesh', icon: Satellite, pct: systemHealth.status === 'healthy' ? 97 : 76, detail: `${satellitePasses.length} orbital sources` },
                { name: 'Feature Fusion', icon: Database, pct: clamp(78 + watchRegions.length * 3), detail: `${awarenessFeatureCount} fused entities` },
                { name: 'Hazard Classifier', icon: Activity, pct: aiPipeline.features.llm_classification ? 96 : 74, detail: aiPipeline?.llm?.available ? aiPipeline.llm.model : 'LLM offline' },
                { name: 'Decision Support', icon: Shield, pct: clamp(92 - alerts.length * 4 + (wsConnected ? 8 : -12)), detail: `${alerts.length} alerts` },
              ].map((s) => (
                <div key={s.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <s.icon className="size-3 text-muted-foreground" />
                      {s.name}
                    </span>
                    <span className={cn('font-mono', s.pct > 90 ? 'text-green-400' : s.pct > 70 ? 'text-amber-400' : 'text-red-400')}>{s.pct}%</span>
                  </div>
                  <Progress value={s.pct} className="h-1" />
                  <p className="text-[10px] text-muted-foreground">{s.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* ── Threat pressure chart ─────────────────────────────────── */}
        <motion.div variants={STAGGER.item}>
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-medium">24h Threat Pressure</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={COMMAND_PRESSURE_SERIES}>
                  <defs>
                    <linearGradient id="gThroughput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gThreat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: '#484f58', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[30, 100]} tick={{ fill: '#484f58', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip {...CHART_TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="throughput" stroke="#38bdf8" strokeWidth={1.5} fill="url(#gThroughput)" name="Throughput" />
                  <Area type="monotone" dataKey="threat" stroke="#f97316" strokeWidth={1.5} fill="url(#gThreat)" name="Threat" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Regional severity chart ────────────────────────────────── */}
        <motion.div variants={STAGGER.item}>
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-medium">Regional Severity Index</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={REGION_HEAT_SERIES}>
                  <defs>
                    <linearGradient id="gGse" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: '#484f58', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[30, 85]} tick={{ fill: '#484f58', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip {...CHART_TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="gse" stroke="#38bdf8" strokeWidth={1.5} fill="url(#gGse)" name="GSE" />
                  <Area type="monotone" dataKey="volatility" stroke="#f59e0b" strokeWidth={1} fill="none" strokeDasharray="4 2" name="Volatility" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* ── Hazard monitoring table ────────────────────────────────── */}
        <motion.div variants={STAGGER.item} className="xl:col-span-2">
          <Card>
            <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-medium">Active Hazards</CardTitle>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {activeHazards.filter((e) => e.severity === 'CRITICAL').length} critical · {activeHazards.length} total
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[320px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Type</TableHead>
                      <TableHead className="text-[10px]">Severity</TableHead>
                      <TableHead className="text-[10px]">Confidence</TableHead>
                      <TableHead className="text-[10px]">Risk</TableHead>
                      <TableHead className="text-[10px]">Location</TableHead>
                      <TableHead className="text-[10px]">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeHazards.slice(0, 8).map((e) => {
                      const sev = SEVERITY_CONFIG[e.alertLevel] ?? SEVERITY_CONFIG.LOW
                      const isLive = REFERENCE_NOW_MS - new Date(e.startTime).getTime() <= 43200000
                      const assessment = riskAssessments.find((a) => a.hazardType === e.type)
                      const point = e.geometry as GeoJSONPoint | undefined
                      return (
                        <TableRow key={e.id} className={cn(sev.stripClass, isLive ? 'bg-accent/30' : '')}>
                          <TableCell className="font-medium text-xs flex items-center gap-2">
                            {isLive && <span className="status-dot status-dot-green status-dot-pulse" />}
                            {e.type.toLowerCase().replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-[10px] font-semibold', sev.badgeClass || '')} style={{ background: sev.bg || '', color: sev.text || '', borderColor: `${sev.text}22` || '' }}>
                              {e.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{Math.round((e.confidence ?? 0.85) * 100)}%</TableCell>
                          <TableCell className="font-mono text-xs">{assessment?.riskScore.toFixed(1) ?? '—'}</TableCell>
                          <TableCell className="text-[10px] text-muted-foreground">
                            {point?.coordinates ? `${point.coordinates[1].toFixed(2)}, ${point.coordinates[0].toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground">
                            {formatRelativeTime(e.startTime)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Live event feed ────────────────────────────────────────── */}
        <motion.div variants={STAGGER.item}>
          <Card className="h-full">
            <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-medium">Event Feed</CardTitle>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={cn('status-dot', wsConnected ? 'status-dot-green status-dot-pulse' : 'status-dot-red')} />
                <span className="text-muted-foreground">{wsConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[320px]">
                <div className="divide-y divide-border">
                  {feed.map((item) => {
                    const tone = getStatusTone(item.status)
                    return (
                      <div key={item.id} className="px-4 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {item.kind === 'hazard' && <AlertTriangle className="w-3 h-3 text-red-400" />}
                              {item.kind === 'alert' && <Bell className="w-3 h-3 text-blue-400" />}
                              {item.kind === 'pipeline' && <GitBranch className="w-3 h-3 text-purple-400" />}
                              {item.kind === 'orbital' && <Satellite className="w-3 h-3 text-amber-400" />}
                              {item.kind === 'tracking' && <Plane className="w-3 h-3 text-green-400" />}
                              <span className={cn('text-[9px] font-semibold uppercase tracking-wider text-muted-foreground')}>{item.kind}</span>
                              {item.live && <span className="status-dot status-dot-green status-dot-pulse" />}
                            </div>
                            <p className="mt-0.5 text-xs font-medium text-foreground truncate">{item.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{item.detail}</p>
                          </div>
                          <span className={cn('text-[10px] font-medium shrink-0', tone.text)}>{item.status}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Pipeline runs table ──────────────────────────────────────── */}
      <motion.div variants={STAGGER.item}>
        <Card>
          <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-medium">Recent Pipeline Runs</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              {(['SUCCEEDED', 'RUNNING', 'FAILED'] as const).map((s) => {
                const count = pipelineRuns.filter((p) => p.status === s).length
                const tone = getStatusTone(s)
                return (
                  <span key={s} className={cn('text-[10px] font-medium', tone.text)}>
                    {count} {s.toLowerCase()}
                  </span>
                )
              })}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Pipeline</TableHead>
                  <TableHead className="text-[10px]">Status</TableHead>
                  <TableHead className="text-[10px]">Trigger</TableHead>
                  <TableHead className="text-[10px]">Started</TableHead>
                  <TableHead className="text-[10px]">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestPipelines.map((p) => {
                  const tone = getStatusTone(p.status)
                  const dur = p.completedAt && p.startedAt
                    ? `${Math.round((new Date(p.completedAt).getTime() - new Date(p.startedAt).getTime()) / 1000)}s`
                    : '—'
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.pipelineName}</TableCell>
                      <TableCell>
                        <span className={cn('flex items-center gap-1.5 text-[10px] font-medium', tone.text)}>
                          <span className={cn('status-dot', p.status === 'SUCCEEDED' ? 'status-dot-green' : p.status === 'RUNNING' ? 'status-dot-blue status-dot-pulse' : p.status === 'FAILED' ? 'status-dot-red' : 'status-dot-muted')} />
                          {p.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.triggeredBy}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{formatRelativeTime(p.startedAt)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{dur}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
