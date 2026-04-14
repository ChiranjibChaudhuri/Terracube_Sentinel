import { formatDistanceStrict } from 'date-fns'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Database,
  Globe,
  Satellite,
  Shield,
  Wind,
} from 'lucide-react'
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
import { fetchObjects } from '../lib/api-client'
import useWebSocket from '../hooks/useWebSocket'
import { type DataSource } from '../hooks/useAwarenessData'
import { DataSourceBadge } from '../components/DataSourceBadge'
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

// ── Dashboard components & constants ─────────────────────────────────
import {
  LiveBadge,
  SectionHeader,
  OperationalChart,
  GaugeMetricCard,
  PipelineRow,
  type GaugeMetricProps,
  cn,
  average,
  clamp,
  getStatusTone,
  GLASS_PANEL,
  SUB_PANEL,
  KICKER_CLASS,
  SEVERITY_STYLES,
  THREAT_STYLES,
  PIPELINE_STATUS_STYLES,
  HAZARD_SEVERITY_WEIGHT,
  STAGGER,
  COMMAND_PRESSURE_SERIES,
  PIPELINE_TELEMETRY_SERIES,
  REGION_HEAT_SERIES,
  DIAL_SPARKLINES,
  QUALITY_SPARKLINES,
  TREND_ICON,
} from '../components/dashboard'

// ── Dashboard-specific types ─────────────────────────────────────────

const REFERENCE_NOW = new Date()
const REFERENCE_NOW_MS = REFERENCE_NOW.getTime()

type FeedItem = {
  id: string
  kind: 'hazard' | 'alert' | 'pipeline' | 'orbital' | 'tracking'
  title: string
  detail: string
  timestamp: string
  status: string
  live: boolean
}

type ChartSeries = {
  key: string
  label: string
  color: string
  fillOpacity?: number
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

// ── Fallbacks ────────────────────────────────────────────────────────

const FALLBACK_SYSTEM_HEALTH: HealthResponse = {
  status: 'degraded',
  agents: ['hazard_sentinel', 'predictive_analyst', 'pattern_discovery'],
  version: '0.2.0',
}

const FALLBACK_AI_PIPELINE: AiStatusResponse = {
  llm: { available: false, model: 'fallback-offline', base_url: 'http://localhost:11434', stats: {} },
  features: { llm_classification: true, anomaly_detection: true, auto_mapping: true },
  quality_thresholds: { min_completeness: 0.75, min_overall_quality: 0.7, duplicate_similarity_threshold: 0.92 },
}

const FALLBACK_PENDING_ALERTS: PendingAlertResponse[] = []
const FALLBACK_GSE_REGIONS: GseRegionSummaryResponse[] = []

// ── Dashboard-specific helpers ───────────────────────────────────────

function formatRelativeTime(timestamp: string) {
  return formatDistanceStrict(new Date(timestamp), REFERENCE_NOW, { addSuffix: true })
}

function formatHazardLabel(value: string) {
  return value.toLowerCase().replace(/_/g, ' ')
}

function nearestRegionLabel(point: GeoJSONPoint) {
  const [lon, lat] = point.coordinates
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`
}

function impactedAssetEstimate(score: number) {
  return Math.max(1, Math.round(score / 24))
}

// ── Data builders ────────────────────────────────────────────────────

function buildRiskAssessmentsFromHazards(hazards: HazardEvent[]): RiskAssessment[] {
  if (hazards.length === 0) return []

  const grouped = new Map<string, HazardEvent[]>()
  for (const hazard of hazards) {
    const bucket = grouped.get(hazard.type) ?? []
    bucket.push(hazard)
    grouped.set(hazard.type, bucket)
  }

  return Array.from(grouped.entries()).map(([hazardType, items], index) => ({
    id: `risk-live-${index}-${hazardType.toLowerCase()}`,
    hazardType: hazardType as RiskAssessment['hazardType'],
    riskScore: Number(
      clamp(average(items.map((item) => HAZARD_SEVERITY_WEIGHT[item.severity] * 22 + (item.confidence ?? 0.85) * 12))).toFixed(1),
    ),
    methodology: 'COMPOSITE',
    confidence: Number(average(items.map((item) => item.confidence ?? 0.85)).toFixed(2)),
    timestamp: items[0]?.startTime ?? REFERENCE_NOW.toISOString(),
  }))
}

function normalizeDashboardRegions(regions: GseRegionSummaryResponse[]): DashboardRegion[] {
  if (!Array.isArray(regions)) return []
  return regions.map((region) => {
    const topFactor = [...region.contributingFactors]
      .sort((left, right) => (right.weightedPressure ?? right.pressure * right.weight) - (left.weightedPressure ?? left.pressure * left.weight))[0]

    return {
      regionId: region.regionId,
      regionName: formatRegionName(region.regionId),
      gseScore: region.gseScore,
      threatLevel: region.threatLevel,
      eventCount: region.eventCount,
      trend: region.escalationAlert ? 'up' : region.gseScore <= 20 ? 'down' : 'stable',
      topCategory: topFactor?.category ?? 'cross_domain_signal',
      escalationAlert: region.escalationAlert,
    }
  })
}

function buildLiveFeed({
  hazards,
  alerts,
  pipelines,
  satellitePasses,
  aircraftTracks,
  vesselTracks,
}: {
  hazards: HazardEvent[]
  alerts: PendingAlertResponse[]
  pipelines: PipelineExecution[]
  satellitePasses: SatellitePass[]
  aircraftTracks: Aircraft[]
  vesselTracks: Vessel[]
}) {
  const latestPipelines = [...pipelines]
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
    .slice(0, 2)

  const items: FeedItem[] = [
    ...hazards.slice(0, 4).map((event) => ({
      id: event.id,
      kind: 'hazard' as const,
      title: `${formatHazardLabel(event.type)} signal crossed ${event.severity.toLowerCase()} threshold`,
      detail: `${nearestRegionLabel(event.geometry as GeoJSONPoint)} theatre | ${Math.round((event.confidence ?? 0.85) * 100)}% confidence`,
      timestamp: event.startTime,
      status: event.severity,
      live: REFERENCE_NOW_MS - new Date(event.startTime).getTime() <= 12 * 60 * 60 * 1000,
    })),
    ...alerts.slice(0, 2).map((alert) => ({
      id: alert.alertId,
      kind: 'alert' as const,
      title: alert.title,
      detail: `${formatRegionName(alert.regionId)} | ${alert.message}`,
      timestamp: alert.timestamp,
      status: alert.priority,
      live: true,
    })),
    ...latestPipelines.map((pipeline) => ({
      id: pipeline.id,
      kind: 'pipeline' as const,
      title: `${pipeline.pipelineName} ${pipeline.status.toLowerCase()}`,
      detail:
        pipeline.status === 'FAILED'
          ? String(pipeline.nodeResults?.error ?? 'Run requires operator review')
          : `${pipeline.triggeredBy} trigger | ${pipeline.status === 'RUNNING' ? 'execution in progress' : 'run closed'}`,
      timestamp: pipeline.startedAt,
      status: pipeline.status,
      live: pipeline.status === 'RUNNING',
    })),
  ]

  const latestSatellitePass = satellitePasses[0]
  if (latestSatellitePass) {
    items.push({
      id: 'orbital-pass',
      kind: 'orbital' as const,
      title: 'Sentinel orbital pass registered',
      detail: `${latestSatellitePass.processingLevel} scene registered with ${latestSatellitePass.cloudCover ?? 'n/a'}% cloud cover`,
      timestamp: latestSatellitePass.acquisitionTime,
      status: 'LIVE',
      live: true,
    })
  }

  if (aircraftTracks.length > 0 || vesselTracks.length > 0) {
    items.push({
      id: 'tracking-corridor',
      kind: 'tracking' as const,
      title: 'Maritime and airborne tracks correlated',
      detail: `${aircraftTracks.length} aircraft and ${vesselTracks.length} vessels in the movement graph`,
      timestamp: aircraftTracks[0]?.timestamp ?? vesselTracks[0]?.timestamp ?? REFERENCE_NOW.toISOString(),
      status: 'MONITOR',
      live: true,
    })
  }

  return items
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 8)
}

// ── Dashboard component ─────────────────────────────────────────────

export default function Dashboard() {
  const [systemHealth, setSystemHealth] = useState<HealthResponse>(FALLBACK_SYSTEM_HEALTH)
  const [aiPipeline, setAiPipeline] = useState<AiStatusResponse>(FALLBACK_AI_PIPELINE)
  const [gseRegions, setGseRegions] = useState<GseRegionSummaryResponse[]>(FALLBACK_GSE_REGIONS)
  const [alerts, setAlerts] = useState<PendingAlertResponse[]>(FALLBACK_PENDING_ALERTS)
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
  const [dataSources, setDataSources] = useState<Record<string, DataSource>>({
    health: 'loading', ai: 'loading', gse: 'loading',
    alerts: 'loading', awareness: 'loading', pipelines: 'loading',
  })
  const [awarenessFeatureCount, setAwarenessFeatureCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    void getHealth(controller.signal).then((h) => {
      setSystemHealth(h)
      setDataSources((prev) => ({ ...prev, health: 'live' }))
    }).catch(() => setDataSources((prev) => ({ ...prev, health: 'unavailable' })))
    void getAiStatus(controller.signal).then((ai) => {
      setAiPipeline(ai)
      setDataSources((prev) => ({ ...prev, ai: 'live' }))
    }).catch(() => setDataSources((prev) => ({ ...prev, ai: 'unavailable' })))
    void getGseRegions(controller.signal).then((regions) => {
      if (Array.isArray(regions) && regions.length > 0) setGseRegions(regions)
      setDataSources((prev) => ({ ...prev, gse: 'live' }))
    }).catch(() => setDataSources((prev) => ({ ...prev, gse: 'unavailable' })))
    void getAlertsPending(controller.signal).then((pendingAlerts) => {
      if (Array.isArray(pendingAlerts) && pendingAlerts.length > 0) setAlerts(pendingAlerts)
      setDataSources((prev) => ({ ...prev, alerts: 'live' }))
    }).catch(() => setDataSources((prev) => ({ ...prev, alerts: 'unavailable' })))
    void getPipelineExecutions(controller.signal).then((runs) => {
      if (Array.isArray(runs) && runs.length > 0) setPipelineRuns(runs)
      setDataSources((prev) => ({ ...prev, pipelines: 'live' }))
    }).catch(() => setDataSources((prev) => ({ ...prev, pipelines: 'unavailable' })))
    void fetchObjects<SatellitePass>('SatellitePass', { pageSize: 100 }, controller.signal).then(setSatellitePasses).catch(() => undefined)
    void fetchObjects<Sensor>('Sensor', { pageSize: 1000 }, controller.signal).then(setSensors).catch(() => undefined)
    void fetchObjects<InfrastructureAsset>('InfrastructureAsset', { pageSize: 1000 }, controller.signal).then(setInfrastructureAssets).catch(() => undefined)
    void fetchObjects<DataProduct>('DataProduct', { pageSize: 1000 }, controller.signal).then(setDataProducts).catch(() => undefined)
    void fetchObjects<DataSourceObject>('DataSource', { pageSize: 1000 }, controller.signal).then(setCatalogSources).catch(() => undefined)
    void getFusionAwareness(undefined, controller.signal).then((awareness) => {
      setAwarenessFeatureCount(awareness.metadata.totalFeatures)

      const nextHazards = normalizeHazards(awareness.features)
      if (nextHazards.length > 0) {
        setHazards(nextHazards)
        setRiskAssessments(buildRiskAssessmentsFromHazards(nextHazards))
      }
      const nextSatellitePasses = normalizeSatellitePasses(awareness.features)
      if (nextSatellitePasses.length > 0) setSatellitePasses(nextSatellitePasses)
      const nextAircraftTracks = normalizeAircraftTracks(awareness.features)
      if (nextAircraftTracks.length > 0) setAircraftTracks(nextAircraftTracks)
      const nextVesselTracks = normalizeVesselTracks(awareness.features)
      if (nextVesselTracks.length > 0) setVesselTracks(nextVesselTracks)
      setDataSources((prev) => ({ ...prev, awareness: 'live' }))
    }).catch(() => setDataSources((prev) => ({ ...prev, awareness: 'unavailable' })))

    return () => { controller.abort() }
  }, [])

  const { isConnected: isAlertSocketConnected } = useWebSocket<AlertSocketMessage>(getAlertsWebSocketUrl(), {
    parseMessage: (raw) => {
      try { return JSON.parse(raw) as AlertSocketMessage }
      catch { return { type: 'error', data: {} } as unknown as AlertSocketMessage }
    },
    onMessage: (message) => {
      if (message.type !== 'alert') return
      setAlerts((currentAlerts) =>
        [
          {
            alertId: message.data.alertId,
            rule: message.data.rule,
            priority: message.data.priority,
            title: message.data.title,
            message: message.data.message,
            regionId: message.data.regionId,
            timestamp: message.data.timestamp,
          },
          ...currentAlerts.filter((alert) => alert.alertId !== message.data.alertId),
        ]
          .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
          .slice(0, 20),
      )
    },
  })

  // ── Derived state ─────────────────────────────────────────────────

  const feed = useMemo(() => buildLiveFeed({
    hazards, alerts, pipelines: pipelineRuns, satellitePasses, aircraftTracks, vesselTracks,
  }), [aircraftTracks, alerts, hazards, pipelineRuns, satellitePasses, vesselTracks])

  const dashboardRegions = useMemo(() => normalizeDashboardRegions(Array.isArray(gseRegions) ? gseRegions : []), [gseRegions])

  const activeHazards = useMemo(() => (Array.isArray(hazards) ? [...hazards] : [])
    .filter((event) => !event.endTime || new Date(event.endTime) >= REFERENCE_NOW)
    .sort((left, right) => HAZARD_SEVERITY_WEIGHT[right.severity] - HAZARD_SEVERITY_WEIGHT[left.severity]),
    [hazards])

  const activeAlerts = useMemo(() => (Array.isArray(alerts) ? [...alerts] : []).sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  ), [alerts])

  const activeSensors = useMemo(() => sensors.filter((sensor) => sensor.status === 'ACTIVE'), [sensors])

  const recentPipelines = useMemo(() => (Array.isArray(pipelineRuns) ? [...pipelineRuns] : []).sort(
    (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  ), [pipelineRuns])

  const latestPipelineRuns = recentPipelines.slice(0, 6)
  const pipelineSuccessRate = recentPipelines.length > 0
    ? recentPipelines.filter((pipeline) => pipeline.status === 'SUCCEEDED').length / recentPipelines.length
    : 0

  const escalationRegions = dashboardRegions.filter((region) => region.trend === 'up' && region.gseScore >= 55)
  const highestGse = dashboardRegions.length > 0 ? Math.max(...dashboardRegions.map((region) => region.gseScore)) : 0
  const threatLoad = clamp(activeHazards.reduce((total, event) => total + HAZARD_SEVERITY_WEIGHT[event.severity] * 8, 0))
  const aiHealth = clamp(Math.round(((pipelineSuccessRate * 100) * 0.6) + (aiPipeline?.llm?.available ? 40 : 18)))
  const sensorCoverage = sensors.length > 0 ? Math.round((activeSensors.length / sensors.length) * 100) : 0

  const activeGroundSensors = activeSensors.filter((sensor) => sensor.type !== 'SATELLITE' && sensor.lastReading)
  const freshnessLagMinutes = average(
    activeGroundSensors.map((sensor) => (REFERENCE_NOW_MS - new Date(sensor.lastReading as string).getTime()) / 60000),
  )

  const completenessScore = clamp(
    (((sensors.length > 0 ? activeSensors.length / sensors.length : 0) * 0.42)
      + (Math.min(dataProducts.length, 6) / 6) * 0.28
      + (Math.min(catalogSources.length, 7) / 7) * 0.3) * 100,
  )
  const freshnessScore = clamp(100 - freshnessLagMinutes / 2.1)
  const concordanceScore = clamp(average(riskAssessments.map((assessment) => (assessment.confidence ?? 0.85) * 100)) + 6)
  const anomalyCaptureScore = clamp(70 + activeAlerts.length * 2 + satellitePasses.filter((pass) => (pass.cloudCover ?? 100) < 15).length * 3)
  const dataFidelity = Math.round(average([completenessScore, freshnessScore, concordanceScore, anomalyCaptureScore]))

  const highExposureInfrastructure = infrastructureAssets.filter(
    (asset) => asset.exposureLevel === 'HIGH' || asset.exposureLevel === 'EXTREME',
  ).length

  const watchRegions = [...dashboardRegions].sort((left, right) => right.gseScore - left.gseScore).slice(0, 5)
  const escalatingTheatreLabel = escalationRegions.length
    ? escalationRegions.map((region) => region.regionName).join(', ')
    : 'No theatres currently escalating'

  const commandMetrics: Array<GaugeMetricProps & { label: string }> = [
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
      detail: `${latestPipelineRuns.filter((pipeline) => pipeline.status === 'RUNNING').length} orchestration lanes active | ${aiPipeline?.llm?.model ?? 'offline'}`,
      accent: '#67c8ff',
      series: DIAL_SPARKLINES.aiHealth,
    },
    {
      label: 'Data Fidelity',
      value: dataFidelity,
      display: `${dataFidelity}%`,
      detail: `${dataProducts.length} registered products and ${catalogSources.length} upstream feeds`,
      accent: '#77e19c',
      series: DIAL_SPARKLINES.dataFidelity,
    },
    {
      label: 'Sensor Mesh',
      value: sensorCoverage,
      display: `${sensorCoverage}%`,
      detail: `${activeSensors.length}/${sensors.length} environmental nodes online`,
      accent: '#3ab3ff',
      series: DIAL_SPARKLINES.sensorMesh,
    },
  ]

  const pipelineStages = [
    { name: 'Ingestion Mesh', icon: Satellite, health: systemHealth.status === 'healthy' ? 97 : 76, latency: `${satellitePasses.length} live orbital sources`, detail: `${systemHealth.agents.length} agents reporting healthy status`, accent: '#67c8ff' },
    { name: 'Feature Fusion', icon: Database, health: clamp(78 + watchRegions.length * 3), latency: `${awarenessFeatureCount} fused entities`, detail: 'Entity resolution and regional overlays refreshed from situational awareness API', accent: '#4fd9c6' },
    { name: 'Hazard Classifier', icon: Activity, health: aiPipeline.features.llm_classification ? 96 : 74, latency: aiPipeline?.llm?.available ? aiPipeline?.llm?.model ?? 'offline' : 'LLM unavailable', detail: aiPipeline.features.anomaly_detection ? 'Anomaly detection pipeline enabled' : 'Anomaly detection disabled', accent: '#77e19c' },
    { name: 'Decision Support', icon: Shield, health: clamp(92 - activeAlerts.length * 4 + (isAlertSocketConnected ? 8 : -12)), latency: `${activeAlerts.length} pending alerts`, detail: isAlertSocketConnected ? 'Live alert relay connected to /ws/alerts' : 'Live alert relay disconnected', accent: '#fb923c' },
  ]

  const qualityMetrics: Array<GaugeMetricProps & { label: string }> = [
    { label: 'Completeness', value: Math.round(completenessScore), display: `${Math.round(completenessScore)}%`, detail: 'Cross-feed object coverage', accent: '#67c8ff', series: QUALITY_SPARKLINES.completeness },
    { label: 'Freshness', value: Math.round(freshnessScore), display: `${Math.round(freshnessScore)}%`, detail: `${Math.round(freshnessLagMinutes)} min average lag`, accent: '#4fd9c6', series: QUALITY_SPARKLINES.freshness },
    { label: 'Concordance', value: Math.round(concordanceScore), display: `${Math.round(concordanceScore)}%`, detail: 'Cross-sensor agreement score', accent: '#77e19c', series: QUALITY_SPARKLINES.concordance },
    { label: 'Anomaly Capture', value: Math.round(anomalyCaptureScore), display: `${Math.round(anomalyCaptureScore)}%`, detail: 'Event recall', accent: '#fb923c', series: QUALITY_SPARKLINES.anomalyCapture },
  ]

  const feedTone: Record<FeedItem['kind'], { color: string; bg: string; border: string }> = {
    hazard: { color: '#fb923c', bg: 'rgba(251, 146, 60, 0.12)', border: 'rgba(251, 146, 60, 0.22)' },
    alert: { color: '#fb7185', bg: 'rgba(251, 113, 133, 0.12)', border: 'rgba(251, 113, 133, 0.22)' },
    pipeline: { color: '#67c8ff', bg: 'rgba(103, 200, 255, 0.12)', border: 'rgba(103, 200, 255, 0.22)' },
    orbital: { color: '#4fd9c6', bg: 'rgba(79, 217, 198, 0.12)', border: 'rgba(79, 217, 198, 0.22)' },
    tracking: { color: '#77e19c', bg: 'rgba(119, 225, 156, 0.12)', border: 'rgba(119, 225, 156, 0.22)' },
  }

  return (
    <motion.div
      className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-[#0b0f0e] p-4 sm:p-6 xl:p-8"
      variants={STAGGER.container}
      initial="hidden"
      animate="visible"
    >
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:56px_56px]" />

      <div className="relative z-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {/* ── Header ────────────────────────────────────────────── */}
        <motion.section variants={STAGGER.item} className={cn(GLASS_PANEL, 'xl:col-span-4 p-6 lg:p-7')}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className={KICKER_CLASS}>Operational picture</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Sentinel Operations</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                  Hazard surveillance, classification, and data integrity checks for environmental response teams.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <DataSourceBadge source={
                  Object.values(dataSources).every((s) => s === 'loading') ? 'loading'
                  : Object.values(dataSources).some((s) => s === 'live') ? 'live'
                  : 'unavailable'
                } />
                <LiveBadge label="LIVE" tone="green" />
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                  <span className={cn('h-2.5 w-2.5 rounded-full', isAlertSocketConnected ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.85)]' : 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.8)]')} />
                  {isAlertSocketConnected ? 'Alerts socket connected' : 'Alerts socket disconnected'}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                  <Globe className="h-3.5 w-3.5 text-cyan-300" />
                  {watchRegions.length} theatres under watch
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                  <Satellite className="h-3.5 w-3.5 text-teal-300" />
                  {satellitePasses.length} orbital passes queued
                </span>
              </div>
            </div>

            {/* ── KPI cards ─────────────────────────────────────── */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className={cn(SUB_PANEL, 'p-4')}>
                <p className={KICKER_CLASS}>Escalating theatres</p>
                <p className="mt-3 text-[30px] font-bold leading-none text-white">{escalationRegions.length}</p>
                <p className="mt-3 text-sm leading-6 text-slate-400">{escalatingTheatreLabel}</p>
              </div>
              <div className={cn(SUB_PANEL, 'p-4')}>
                <p className={KICKER_CLASS}>Critical infrastructure at risk</p>
                <p className="mt-3 text-[30px] font-bold leading-none text-white">{highExposureInfrastructure}</p>
                <p className="mt-3 text-sm leading-6 text-slate-400">Assets already above high exposure threshold</p>
              </div>
              <div className={cn(SUB_PANEL, 'p-4')}>
                <p className={KICKER_CLASS}>Tracking coverage</p>
                <p className="mt-3 text-[30px] font-bold leading-none text-white">{aircraftTracks.length + vesselTracks.length}</p>
                <p className="mt-3 text-sm leading-6 text-slate-400">{aircraftTracks.length} airborne and {vesselTracks.length} maritime tracks correlated</p>
              </div>
            </div>

            {/* ── Threat pressure + watchlist ───────────────────── */}
            <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
              <div className={cn(SUB_PANEL, 'p-4')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className={KICKER_CLASS}>Threat pressure</p>
                    <h2 className="mt-2 text-lg font-semibold text-white">24-hour escalation cadence</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <LiveBadge tone="blue" />
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">Throughput</span>
                      <span className="rounded-full border border-teal-400/20 bg-teal-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-200">Threat</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <OperationalChart
                    id="command-pressure"
                    data={COMMAND_PRESSURE_SERIES}
                    domain={[35, 100]}
                    series={[
                      { key: 'throughput', label: 'Throughput', color: '#67c8ff', fillOpacity: 0.2 },
                      { key: 'threat', label: 'Threat', color: '#4fd9c6', fillOpacity: 0.16 },
                    ]}
                  />
                </div>
              </div>

              <div className={cn(SUB_PANEL, 'p-4')}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={KICKER_CLASS}>Watchlist</p>
                    <h2 className="mt-2 text-lg font-semibold text-white">Highest pressure regions</h2>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Updated 5m</span>
                </div>
                <div className="mt-4 space-y-3">
                  {watchRegions.map((region) => {
                    const RegionTrendIcon = TREND_ICON[region.trend]
                    const tone = THREAT_STYLES[region.threatLevel]
                    return (
                      <div key={region.regionId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all duration-200 hover:scale-[1.01]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-white">{region.regionName}</p>
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ background: tone.bg, color: tone.text }}>{region.threatLevel}</span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-400">{region.eventCount} events correlated | Driver: {region.topCategory.replace(/_/g, ' ')}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24">
                              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(region.gseScore, 100)}%`, background: `linear-gradient(90deg, ${tone.bar}, rgba(255,255,255,0.9))` }} />
                              </div>
                              <p className="mt-2 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{region.gseScore.toFixed(1)}</p>
                            </div>
                            <RegionTrendIcon className={cn('h-4 w-4', region.trend === 'up' ? 'text-amber-300' : region.trend === 'down' ? 'text-emerald-300' : 'text-slate-500')} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Command metrics (gauges) ─────────────────────────── */}
        {commandMetrics.map((metric) => (
          <motion.section key={metric.label} variants={STAGGER.item} className="xl:col-span-1">
            <GaugeMetricCard {...metric} />
          </motion.section>
        ))}

        {/* ── Hazard monitoring matrix ─────────────────────────── */}
        <motion.section variants={STAGGER.item} className={cn(GLASS_PANEL, 'xl:col-span-2 p-5')}>
          <SectionHeader
            title="Hazard Monitoring Matrix"
            subtitle="Severity indicators"
            aside={
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {activeHazards.filter((event) => event.severity === 'CRITICAL').length} critical
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                  <Wind className="h-3.5 w-3.5" />
                  {Math.round(average(activeHazards.map((event) => (event.confidence ?? 0.85) * 100)))}% mean confidence
                </span>
              </div>
            }
          />

          <div className="mt-5 space-y-3">
            {activeHazards.slice(0, 6).map((event) => {
              const severityStyle = SEVERITY_STYLES[event.alertLevel]
              const matchingAssessment = riskAssessments.find((assessment) => assessment.hazardType === event.type)
              const exposure = impactedAssetEstimate(matchingAssessment?.riskScore ?? 58)
              const isLive = REFERENCE_NOW_MS - new Date(event.startTime).getTime() <= 12 * 60 * 60 * 1000

              return (
                <article key={event.id} className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-black/20 px-4 py-4 transition-all duration-200 hover:scale-[1.01]">
                  <span className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ background: severityStyle.text, boxShadow: `0 0 16px ${severityStyle.glow}` }} />
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-white">{formatHazardLabel(event.type)}</h3>
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ background: severityStyle.bg, color: severityStyle.text, border: `1px solid ${severityStyle.border}` }}>{event.severity}</span>
                        {isLive ? <LiveBadge label="LIVE" tone="red" /> : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{nearestRegionLabel(event.geometry as GeoJSONPoint)} | {formatRelativeTime(event.startTime)}</p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">Alert {event.alertLevel}</div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: 'Confidence', value: `${Math.round((event.confidence ?? 0.85) * 100)}%` },
                      { label: 'Risk model', value: `${(matchingAssessment?.riskScore ?? 58).toFixed(1)}` },
                      { label: 'Impacted assets', value: String(exposure) },
                      { label: 'Status', value: event.severity === 'CRITICAL' ? 'Escalating' : event.severity === 'HIGH' ? 'Containment' : 'Observed' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className={KICKER_CLASS}>{item.label}</p>
                        <p className="mt-2 text-2xl font-bold leading-none text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div className="h-full rounded-full" style={{ width: `${(HAZARD_SEVERITY_WEIGHT[event.severity] / 4) * 100}%`, background: `linear-gradient(90deg, ${severityStyle.text}, rgba(255,255,255,0.9))` }} />
                  </div>
                </article>
              )
            })}
          </div>
        </motion.section>

        {/* ── Live event feed ──────────────────────────────────── */}
        <motion.section variants={STAGGER.item} className={cn(GLASS_PANEL, 'xl:col-span-2 p-5')}>
          <SectionHeader title="Real-Time Event Feed" subtitle="Operator timeline" aside={<LiveBadge label="LIVE RELAY" tone="green" />} />

          <div className="mt-5 space-y-3">
            {feed.map((item) => {
              const tone = feedTone[item.kind]
              const statusTone = getStatusTone(item.status)
              return (
                <div key={item.id} className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 transition-all duration-200 hover:scale-[1.01]">
                  <span className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ background: tone.color, boxShadow: `0 0 16px ${tone.color}55` }} />
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">{item.kind}</span>
                        {item.live ? <LiveBadge tone="green" /> : null}
                      </div>
                      <p className="mt-2 text-sm font-medium leading-6 text-white">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ background: statusTone.bg, color: statusTone.text, border: `1px solid ${statusTone.border}` }}>{item.status}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{formatRelativeTime(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.section>

        {/* ── Pipeline health ──────────────────────────────────── */}
        <motion.section variants={STAGGER.item} className={cn(GLASS_PANEL, 'xl:col-span-2 p-5')}>
          <SectionHeader
            title="Pipeline Health"
            subtitle="Inference and orchestration"
            aside={
              <div className="text-right">
                <p className={KICKER_CLASS}>Current state</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {systemHealth.status === 'healthy' ? `Live backend healthy | ${aiPipeline?.llm?.available ? 'LLM online' : 'LLM degraded'}` : 'Live telemetry unavailable'}
                </p>
              </div>
            }
          />

          <div className={cn(SUB_PANEL, 'mt-5 p-4')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">Health</span>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">Autonomy</span>
              </div>
              <LiveBadge tone="blue" />
            </div>
            <div className="mt-4">
              <OperationalChart id="pipeline-telemetry" data={PIPELINE_TELEMETRY_SERIES} domain={[70, 100]} series={[
                { key: 'health', label: 'Health', color: '#77e19c' },
                { key: 'autonomy', label: 'Autonomy', color: '#67c8ff' },
              ]} />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {pipelineStages.map((stage) => {
              const Icon = stage.icon
              return (
                <div key={stage.name} className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 transition-all duration-200 hover:scale-[1.01]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2"><Icon className="h-4 w-4" style={{ color: stage.accent }} /></div>
                      <div>
                        <p className="text-sm font-semibold text-white">{stage.name}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{stage.detail}</p>
                      </div>
                    </div>
                    <div className="min-w-[180px]">
                      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                        <span>{stage.latency}</span>
                        <span style={{ color: stage.accent }}>{stage.health}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full" style={{ width: `${stage.health}%`, background: stage.accent }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.section>

        {/* ── Regional threat surface ──────────────────────────── */}
        <motion.section variants={STAGGER.item} className={cn(GLASS_PANEL, 'xl:col-span-1 p-5')}>
          <SectionHeader title="Regional Threat Surface" subtitle="Global severity index" aside={
            <div className="text-right">
              <p className={KICKER_CLASS}>Peak GSE</p>
              <p className="mt-2 text-sm font-semibold text-white">{highestGse.toFixed(1)} / 100</p>
            </div>
          } />

          <div className={cn(SUB_PANEL, 'mt-5 p-4')}>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-teal-400/20 bg-teal-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-200">GSE</span>
              <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-200">Volatility</span>
            </div>
            <div className="mt-4">
              <OperationalChart id="regional-surface" data={REGION_HEAT_SERIES} domain={[35, 85]} series={[
                { key: 'gse', label: 'GSE', color: '#4fd9c6', fillOpacity: 0.2 },
                { key: 'volatility', label: 'Volatility', color: '#fb923c' },
              ]} />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {watchRegions.slice(0, 4).map((region) => {
              const tone = THREAT_STYLES[region.threatLevel]
              const TrendIcon = TREND_ICON[region.trend]
              return (
                <div key={region.regionId} className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 transition-all duration-200 hover:scale-[1.01]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{region.regionName}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{region.eventCount} correlated events | Driver: {region.topCategory.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-semibold leading-none text-white">{region.gseScore.toFixed(1)}</p>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: tone.text }}>{region.threatLevel}</p>
                      </div>
                      <TrendIcon className={cn('h-4 w-4', region.trend === 'up' ? 'text-amber-300' : region.trend === 'down' ? 'text-emerald-300' : 'text-slate-500')} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.section>

        {/* ── Data quality metrics ─────────────────────────────── */}
        <motion.section variants={STAGGER.item} className={cn(GLASS_PANEL, 'xl:col-span-1 p-5')}>
          <SectionHeader title="Data Quality Metrics" subtitle="Freshness, completeness, agreement" aside={
            <div className="text-right">
              <p className={KICKER_CLASS}>Catalog health</p>
              <p className="mt-2 text-sm font-semibold text-white">{dataFidelity}% trusted</p>
            </div>
          } />

          <div className="mt-5 grid gap-3">
            {qualityMetrics.map((metric) => (
              <GaugeMetricCard key={metric.label} {...metric} compact />
            ))}
          </div>

          <div className={cn(SUB_PANEL, 'mt-4 p-4')}>
            <div className="flex items-center justify-between gap-3">
              <p className={KICKER_CLASS}>Source integrity</p>
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Current window</span>
            </div>
            <div className="mt-4 space-y-3">
              {catalogSources.length === 0 && <p className="text-sm leading-6 text-slate-400">No live data-source objects registered.</p>}
              {catalogSources.slice(0, 4).map((source) => {
                const sourceScore = clamp(92 - (source.type === 'MODEL' ? 4 : 0) + (source.type === 'SATELLITE' ? 2 : 0) + (source.temporalResolution?.includes('PT') ? 2 : 0))
                return (
                  <div key={source.id}>
                    <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.22em]">
                      <span className="text-slate-300">{source.name}</span>
                      <span className="text-white">{Math.round(sourceScore)}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full" style={{ width: `${sourceScore}%`, background: 'linear-gradient(90deg, #67c8ff, #4fd9c6)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.section>

        {/* ── Pipeline operations ──────────────────────────────── */}
        <motion.section variants={STAGGER.item} className={cn(GLASS_PANEL, 'xl:col-span-4 p-5')}>
          <SectionHeader title="Pipeline Operations" subtitle="Recent execution status" aside={
            <div className="flex flex-wrap items-center gap-2">
              {(['SUCCEEDED', 'RUNNING', 'FAILED'] as const).map((status) => {
                const count = pipelineRuns.filter((pipeline) => pipeline.status === status).length
                const tone = PIPELINE_STATUS_STYLES[status]
                return (
                  <span key={status} className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ background: tone.bg, color: tone.text, border: `1px solid ${tone.border}` }}>
                    {count} {status.toLowerCase()}
                  </span>
                )
              })}
            </div>
          } />

          <div className="mt-5 grid gap-3">
            {latestPipelineRuns.map((pipeline) => {
              const tone = PIPELINE_STATUS_STYLES[pipeline.status]
              const duration = pipeline.completedAt && pipeline.startedAt
                ? `${Math.round((new Date(pipeline.completedAt).getTime() - new Date(pipeline.startedAt).getTime()) / 1000)} sec`
                : 'In progress'
              return <PipelineRow key={pipeline.id} pipeline={pipeline} duration={duration} tone={tone} />
            })}
          </div>
        </motion.section>
      </div>
    </motion.div>
  )
}

