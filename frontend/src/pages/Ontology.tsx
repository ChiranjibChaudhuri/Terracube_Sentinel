import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { ComponentType, MouseEvent, SVGProps, WheelEvent } from 'react'
import { motion } from 'framer-motion'
import {
  Share2,
  AlertTriangle,
  Bell,
  BarChart3,
  Globe,
  Radio,
  Building2,
  Database,
  Satellite,
  Package,
  GitBranch,
  Plane,
  Ship,
  TrendingUp,
  Search,
  RefreshCw,
  Activity,
  Link2,
  Layers3,
} from 'lucide-react'
import { OBJECT_TYPES, LINK_TYPES } from '../lib/types'
import type { ObjectTypeName } from '../lib/types'
import { simulate } from '../lib/force-layout'
import type { ForceLink } from '../lib/force-layout'
import { fetchLinks, fetchObjectCollection } from '../lib/api-client'
import type { LinkRecord, ObjectCollectionResponse } from '../lib/api-client'

// ── Node colors ─────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  HazardEvent: '#f43f5e',
  Alert: '#f97316',
  RiskAssessment: '#fbbf24',
  Region: '#38bdf8',
  Sensor: '#34d399',
  InfrastructureAsset: '#06b6d4',
  DataSource: '#a855f7',
  SatellitePass: '#8b5cf6',
  DataProduct: '#a78bfa',
  PipelineExecution: '#6366f1',
  Aircraft: '#38bdf8',
  Vessel: '#3b82f6',
  FinancialIndicator: '#eab308',
}

const DOMAIN_LABELS: Record<string, string> = {
  HazardEvent: 'hazard',
  Alert: 'hazard',
  RiskAssessment: 'hazard',
  Region: 'spatial',
  Sensor: 'monitoring',
  InfrastructureAsset: 'spatial',
  DataSource: 'data',
  SatellitePass: 'data',
  DataProduct: 'data',
  PipelineExecution: 'data',
  Aircraft: 'spatial',
  Vessel: 'spatial',
  FinancialIndicator: 'hazard',
}

const DOMAIN_COLORS: Record<string, string> = {
  hazard: '#f43f5e',
  spatial: '#38bdf8',
  monitoring: '#34d399',
  data: '#a855f7',
}

// ── Icons per node type (lucide-react) ──────────────────────────────

const NODE_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  HazardEvent: AlertTriangle,
  Alert: Bell,
  RiskAssessment: BarChart3,
  Region: Globe,
  Sensor: Radio,
  InfrastructureAsset: Building2,
  DataSource: Database,
  SatellitePass: Satellite,
  DataProduct: Package,
  PipelineExecution: GitBranch,
  Aircraft: Plane,
  Vessel: Ship,
  FinancialIndicator: TrendingUp,
}

// ── ODL schema strings ──────────────────────────────────────────────

const ODL_SCHEMAS: Record<string, string> = {
  Region: `type Region @objectType {
  id: ID! @primary
  name: String! @searchable
  type: RegionType!
  population: Int
  gdpPerCapita: Float
  infrastructureScore: Float
  riskScore: Float @computed
  geometry: JSON!
}`,
  HazardEvent: `type HazardEvent @objectType {
  id: ID! @primary
  type: HazardType!
  severity: SeverityLevel!
  geometry: JSON!
  startTime: DateTime!
  endTime: DateTime
  confidence: Float
  alertLevel: AlertLevel!
}`,
  Sensor: `type Sensor @objectType {
  id: ID! @primary
  type: SensorType!
  name: String! @searchable
  geometry: JSON!
  operator: String
  dataFrequency: Duration
  lastReading: DateTime
  status: SensorStatus!
}`,
  InfrastructureAsset: `type InfrastructureAsset @objectType {
  id: ID! @primary
  type: InfrastructureType!
  name: String! @searchable
  geometry: JSON!
  vulnerabilityScore: Float
  exposureLevel: ExposureLevel!
  condition: ConditionGrade!
}`,
  RiskAssessment: `type RiskAssessment @objectType {
  id: ID! @primary
  hazardType: HazardType!
  riskScore: Float!
  methodology: RiskMethodology!
  confidence: Float
  timestamp: DateTime!
}`,
  Alert: `type Alert @objectType {
  id: ID! @primary
  severity: SeverityLevel!
  message: String! @searchable
  actionTaken: String
  issuedAt: DateTime!
  expiresAt: DateTime
}`,
  DataSource: `type DataSource @objectType {
  id: ID! @primary
  name: String! @searchable
  provider: String!
  type: DataSourceType!
  temporalResolution: Duration
  spatialResolution: Float
}`,
  SatellitePass: `type SatellitePass @objectType {
  id: ID! @primary
  acquisitionTime: DateTime!
  processingLevel: ProcessingLevel!
  cloudCover: Float
  stacItemUrl: URI
  sourceCatalog: String
  sourceSceneId: String
  collection: String
  mission: String
  bbox: JSON
  aiSummary: String
  aiAnalyticPriority: String
  aiUseCases: [String!]
  aiHazardRelevance: [String!]
  aiOntologyTags: [String!]
  aiConfidence: Float
  openDataProvider: String
  rawStacItem: JSON
}`,
  DataProduct: `type DataProduct @objectType {
  id: ID! @primary
  name: String! @searchable
  type: DataProductType!
  format: DataProductFormat!
  storagePath: String!
  sizeBytes: Int
  sourceHref: URI
  sourceAssetId: String
  storageMode: String
  assetKey: String
  sourceCatalog: String
  collection: String
  etag: String
  sourceLastModified: DateTime
  aiRecommended: Boolean
}`,
  PipelineExecution: `type PipelineExecution @objectType {
  id: ID! @primary
  pipelineName: String!
  status: PipelineStatus!
  triggeredBy: String!
  startedAt: DateTime!
  completedAt: DateTime
  nodeResults: JSON
}`,
  Aircraft: `type Aircraft @objectType {
  id: ID! @primary
  icao24: String!
  callsign: String
  altitude: Float
  heading: Float
  velocity: Float
  onGround: Boolean!
  source: String!
  timestamp: DateTime!
  geometry: JSON!
}`,
  Vessel: `type Vessel @objectType {
  id: ID! @primary
  mmsi: String!
  name: String
  imo: String
  shipType: ShipType!
  speed: Float
  course: Float
  heading: Float
  destination: String
  flag: String
  navStatus: String
  isFishing: Boolean
  source: String!
  timestamp: DateTime!
  geometry: JSON!
}`,
  FinancialIndicator: `type FinancialIndicator @objectType {
  id: ID! @primary
  symbol: String!
  name: String! @searchable
  indicatorType: FinancialIndicatorType!
  value: Float!
  changePct: Float
  region: String!
  source: String!
}`,
}

// ── Helpers ─────────────────────────────────────────────────────────

const SVG_W = 1000
const SVG_H = 700
const LIVE_SAMPLE_SIZE = 4

type DomainFilter = 'all' | keyof typeof DOMAIN_COLORS
type LiveStatus = 'idle' | 'loading' | 'ready' | 'error'

type OntologyObjectPreview = Record<string, unknown> & {
  id?: string
  _id?: string
  objectId?: string
  objectType?: string
  _type?: string
  name?: string
  createdAt?: string
  updatedAt?: string
}

type TypeMetric = {
  status: LiveStatus
  count: number
  samples: OntologyObjectPreview[]
  error?: string
}

type SchemaLink = (typeof LINK_TYPES)[number]
type LinkCollection = ObjectCollectionResponse<LinkRecord>

const EMPTY_LINK_COLLECTION: LinkCollection = { data: [], total: 0 }

function emptyMetrics(status: LiveStatus = 'idle'): Record<ObjectTypeName, TypeMetric> {
  const next = {} as Record<ObjectTypeName, TypeMetric>
  for (const type of OBJECT_TYPES) {
    next[type] = { status, count: 0, samples: [] }
  }
  return next
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function objectId(object: OntologyObjectPreview): string {
  return String(object.id ?? object._id ?? object.objectId ?? 'unidentified')
}

function objectLabel(object: OntologyObjectPreview): string {
  return String(
    object.name
      ?? object.sourceSceneId
      ?? object.sourceAssetId
      ?? object.pipelineName
      ?? object.message
      ?? object.symbol
      ?? objectId(object),
  )
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function compactCount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function nodeRadius(count: number, liveEnabled: boolean): number {
  if (!liveEnabled || count <= 0) return 20
  return 20 + Math.min(12, Math.log10(count + 1) * 5)
}

/** Compute connected node ids for a given node */
function connectedNodes(nodeId: string, links: readonly SchemaLink[] = LINK_TYPES): Set<string> {
  const s = new Set<string>()
  for (const l of links) {
    if (l.from === nodeId) s.add(l.to)
    if (l.to === nodeId) s.add(l.from)
  }
  return s
}

/** Compute a quadratic bezier curve with perpendicular offset */
function edgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number = 30,
): { path: string; mx: number; my: number; angle: number } {
  const mx0 = (x1 + x2) / 2
  const my0 = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1

  // Perpendicular unit vector
  const px = -dy / len
  const py = dx / len

  const mx = mx0 + px * offset
  const my = my0 + py * offset

  const angle = (Math.atan2(dy, dx) * 180) / Math.PI

  return {
    path: `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`,
    mx,
    my,
    angle,
  }
}

// ── Component ───────────────────────────────────────────────────────

export default function Ontology() {
  // Force-directed layout computed once
  const positions = useMemo(() => {
    const ids = [...OBJECT_TYPES]
    const links: ForceLink[] = LINK_TYPES.map((l) => ({
      source: l.from,
      target: l.to,
    }))
    return simulate(ids, links, SVG_W, SVG_H, 300)
  }, [])

  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all')
  const [liveEnabled, setLiveEnabled] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [metrics, setMetrics] = useState<Record<ObjectTypeName, TypeMetric>>(() => emptyMetrics())
  const [linkCollection, setLinkCollection] = useState<LinkCollection>(EMPTY_LINK_COLLECTION)
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle')
  const [liveError, setLiveError] = useState<string | null>(null)

  // Zoom / pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  const handleWheel = useCallback((e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    setZoom((z) => {
      const next = z - e.deltaY * 0.001
      return Math.max(0.3, Math.min(3, next))
    })
  }, [])

  const handleMouseDown = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      // Only pan on middle-click or when clicking the background
      if (e.button !== 0) return
      setIsPanning(true)
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    },
    [pan],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      if (!isPanning) return
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy })
    },
    [isPanning],
  )

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  useEffect(() => {
    if (!liveEnabled) return

    const controller = new AbortController()

    async function loadLiveGraph() {
      setLiveStatus('loading')
      setLiveError(null)
      setMetrics(emptyMetrics('loading'))

      const metricEntries = await Promise.all(
        OBJECT_TYPES.map(async (type) => {
          try {
            const response = await fetchObjectCollection<OntologyObjectPreview>(
              type,
              { pageSize: LIVE_SAMPLE_SIZE },
              controller.signal,
            )
            return [
              type,
              {
                status: 'ready',
                count: response.total,
                samples: response.data,
              },
            ] as const
          } catch (error) {
            if (isAbortError(error)) throw error
            return [
              type,
              {
                status: 'error',
                count: 0,
                samples: [],
                error: errorMessage(error),
              },
            ] as const
          }
        }),
      )

      const links = await fetchLinks<LinkRecord>({ pageSize: 1000 }, controller.signal)
      setMetrics(Object.fromEntries(metricEntries) as Record<ObjectTypeName, TypeMetric>)
      setLinkCollection(links)
      setLiveStatus(metricEntries.some(([, metric]) => metric.status === 'error') ? 'error' : 'ready')
    }

    loadLiveGraph().catch((error: unknown) => {
      if (isAbortError(error)) return
      setMetrics(emptyMetrics('error'))
      setLinkCollection(EMPTY_LINK_COLLECTION)
      setLiveStatus('error')
      setLiveError(errorMessage(error))
    })

    return () => controller.abort()
  }, [liveEnabled, refreshKey])

  const visibleTypes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return OBJECT_TYPES.filter((type) => {
      const matchesDomain = domainFilter === 'all' || DOMAIN_LABELS[type] === domainFilter
      if (!matchesDomain) return false
      if (!normalizedQuery) return true
      const schema = ODL_SCHEMAS[type] ?? ''
      return (
        type.toLowerCase().includes(normalizedQuery)
        || DOMAIN_LABELS[type]?.toLowerCase().includes(normalizedQuery)
        || schema.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [domainFilter, query])

  const visibleTypeSet = useMemo(() => new Set<string>(visibleTypes), [visibleTypes])
  const visibleLinks = useMemo(
    () => LINK_TYPES.filter((link) => visibleTypeSet.has(link.from) && visibleTypeSet.has(link.to)),
    [visibleTypeSet],
  )

  const totalLiveObjects = useMemo(
    () => Object.values(metrics).reduce((total, metric) => total + metric.count, 0),
    [metrics],
  )

  const selectedLinks = useMemo(
    () => (selectedNode ? LINK_TYPES.filter((l) => l.from === selectedNode || l.to === selectedNode) : []),
    [selectedNode],
  )

  const selectedMetric = selectedNode ? metrics[selectedNode as ObjectTypeName] : null
  const selectedLiveLinkCount = selectedLinks.reduce(
    (total, schemaLink) => total + linkCollection.data.filter((link) => link.linkType === schemaLink.name).length,
    0,
  )

  // Precompute hover highlight sets
  const hoveredConnected = useMemo(
    () => (hoveredNode ? connectedNodes(hoveredNode, visibleLinks) : null),
    [hoveredNode, visibleLinks],
  )

  function nodeOpacity(name: string): number {
    if (!hoveredNode) return 1
    if (name === hoveredNode) return 1
    if (hoveredConnected?.has(name)) return 1
    return 0.2
  }

  function edgeOpacity(from: string, to: string): number {
    if (!hoveredNode) return 1
    if (from === hoveredNode || to === hoveredNode) return 1
    return 0.2
  }

  const transformStr = `translate(${pan.x}, ${pan.y}) scale(${zoom})`

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <Share2 className="w-5 h-5 text-cyan-400" />
          <h1 className="text-lg font-bold text-white">Ontology Graph</h1>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(56,189,248,0.08)',
              color: '#38bdf8',
              border: '1px solid rgba(56,189,248,0.2)',
            }}
          >
            {visibleTypes.length}/{OBJECT_TYPES.length} types | {visibleLinks.length}/{LINK_TYPES.length} schema links
          </span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: liveStatus === 'error' ? 'rgba(244,63,94,0.1)' : 'rgba(52,211,153,0.08)',
              color: liveStatus === 'error' ? '#fb7185' : '#34d399',
              border: liveStatus === 'error' ? '1px solid rgba(244,63,94,0.25)' : '1px solid rgba(52,211,153,0.2)',
            }}
          >
            {liveEnabled
              ? `${formatCount(totalLiveObjects)} live objects | ${formatCount(linkCollection.total)} live links`
              : 'Live counts off'}
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ontology"
              aria-label="Search ontology"
              className="w-full rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus-ring"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            />
          </div>

          <select
            value={domainFilter}
            aria-label="Filter ontology domain"
            onChange={(event) => setDomainFilter(event.target.value as DomainFilter)}
            className="rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus-ring"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
          >
            <option value="all">All domains</option>
            {Object.keys(DOMAIN_COLORS).map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setLiveEnabled((value) => !value)}
            className="rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-ring"
            style={{
              background: liveEnabled ? 'rgba(52,211,153,0.08)' : 'rgba(99,130,191,0.08)',
              border: liveEnabled ? '1px solid rgba(52,211,153,0.2)' : '1px solid var(--border-default)',
              color: liveEnabled ? '#34d399' : 'var(--text-secondary)',
            }}
          >
            {liveEnabled ? 'Live on' : 'Live off'}
          </button>

          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={!liveEnabled || liveStatus === 'loading'}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40 focus-ring"
            style={{
              background: 'rgba(56,189,248,0.08)',
              border: '1px solid rgba(56,189,248,0.2)',
              color: '#38bdf8',
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${liveStatus === 'loading' ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {liveError && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            background: 'rgba(244,63,94,0.08)',
            border: '1px solid rgba(244,63,94,0.2)',
            color: '#fb7185',
          }}
        >
          {liveError}
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:h-[calc(100vh-14rem)]">
        {/* SVG Canvas */}
        <div className="flex-1 glass-card overflow-hidden relative min-h-[32rem]">
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full h-full"
            style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              {/* Arrow marker */}
              <marker
                id="arrow"
                markerWidth="10"
                markerHeight="8"
                refX="10"
                refY="4"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <polygon points="0 0, 10 4, 0 8" fill="rgba(255,255,255,0.35)" />
              </marker>
              <marker
                id="arrow-highlight"
                markerWidth="10"
                markerHeight="8"
                refX="10"
                refY="4"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <polygon points="0 0, 10 4, 0 8" fill="rgba(56,189,248,0.7)" />
              </marker>

              {/* Glow filters per node color */}
              {Object.entries(NODE_COLORS).map(([name, color]) => (
                <filter key={name} id={`glow-${name}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={color} floodOpacity="0.45" />
                </filter>
              ))}
            </defs>

            <g transform={transformStr}>
              {/* Edges */}
              {visibleLinks.map((link) => {
                const fromPos = positions.nodes.get(link.from)
                const toPos = positions.nodes.get(link.to)
                if (!fromPos || !toPos) return null

                // Shorten edge endpoints by node radius so arrow meets the circle
                const dx = toPos.x - fromPos.x
                const dy = toPos.y - fromPos.y
                const dist = Math.sqrt(dx * dx + dy * dy) || 1
                const ux = dx / dist
                const uy = dy / dist
                const fromR = nodeRadius(metrics[link.from as ObjectTypeName]?.count ?? 0, liveEnabled)
                const toR = nodeRadius(metrics[link.to as ObjectTypeName]?.count ?? 0, liveEnabled)

                const x1 = fromPos.x + ux * fromR
                const y1 = fromPos.y + uy * fromR
                const x2 = toPos.x - ux * toR
                const y2 = toPos.y - uy * toR

                const { path, mx, my, angle } = edgePath(x1, y1, x2, y2, 30)
                const isHovered = hoveredNode === link.from || hoveredNode === link.to
                const opacity = edgeOpacity(link.from, link.to)
                const liveCount = linkCollection.data.filter((item) => item.linkType === link.name).length
                const linkLabel = liveEnabled && liveCount > 0 ? `${link.name} (${compactCount(liveCount)})` : link.name

                return (
                  <g key={link.name} style={{ opacity, transition: 'opacity 0.2s ease' }}>
                    <path
                      d={path}
                      fill="none"
                      stroke={isHovered ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.15)'}
                      strokeWidth={isHovered ? 2 : 1}
                      markerEnd={isHovered ? 'url(#arrow-highlight)' : 'url(#arrow)'}
                      style={{ transition: 'stroke 0.2s ease' }}
                    />
                    {/* Edge label with background pill */}
                    <g transform={`translate(${mx}, ${my}) rotate(${angle > 90 || angle < -90 ? angle + 180 : angle})`}>
                      <rect
                        x={-(linkLabel.length * 3 + 6)}
                        y={-7}
                        width={linkLabel.length * 6 + 12}
                        height={14}
                        rx={7}
                        fill="rgba(5,10,24,0.75)"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={0.5}
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={isHovered ? '#38bdf8' : 'rgba(255,255,255,0.4)'}
                        fontSize={9}
                        fontFamily="inherit"
                        style={{ transition: 'fill 0.2s ease' }}
                      >
                        {linkLabel}
                      </text>
                    </g>
                  </g>
                )
              })}

              {/* Nodes */}
              {visibleTypes.map((name) => {
                const pos = positions.nodes.get(name)
                if (!pos) return null
                const color = NODE_COLORS[name] ?? '#6366f1'
                const isSelected = selectedNode === name
                const isHovered = hoveredNode === name
                const opacity = nodeOpacity(name)
                const Icon = NODE_ICONS[name]
                const metric = metrics[name]
                const r = nodeRadius(metric.count, liveEnabled)
                const badgeText = metric.status === 'loading'
                  ? '...'
                  : metric.status === 'error'
                    ? '!'
                    : compactCount(metric.count)

                return (
                  <g
                    key={name}
                    style={{ opacity, transition: 'opacity 0.2s ease', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedNode(isSelected ? null : name)
                    }}
                    onMouseEnter={() => setHoveredNode(name)}
                    onMouseLeave={() => setHoveredNode(null)}
                    filter={(isSelected || isHovered) ? `url(#glow-${name})` : undefined}
                  >
                    {/* Outer circle */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={r}
                      fill={`${color}18`}
                      stroke={color}
                      strokeWidth={isSelected ? 2.5 : 2}
                      style={{ transition: 'all 0.25s ease' }}
                    />

                    {liveEnabled && (
                      <g style={{ pointerEvents: 'none' }}>
                        <circle
                          cx={pos.x + r - 2}
                          cy={pos.y - r + 2}
                          r={10}
                          fill={metric.status === 'error' ? 'rgba(244,63,94,0.95)' : 'rgba(5,10,24,0.95)'}
                          stroke={metric.status === 'error' ? '#fb7185' : color}
                          strokeWidth={1.2}
                        />
                        <text
                          x={pos.x + r - 2}
                          y={pos.y - r + 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={metric.status === 'error' ? '#fff1f2' : '#e8ecf4'}
                          fontSize={badgeText.length > 2 ? 6.5 : 8}
                          fontWeight={700}
                          fontFamily="inherit"
                        >
                          {badgeText}
                        </text>
                      </g>
                    )}

                    {/* Inner icon */}
                    {Icon && (
                      <foreignObject
                        x={pos.x - 10}
                        y={pos.y - 10}
                        width={20}
                        height={20}
                        style={{ pointerEvents: 'none' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '100%',
                          }}
                        >
                          <Icon width={14} height={14} color={color} strokeWidth={1.8} />
                        </div>
                      </foreignObject>
                    )}

                    {/* Label below node */}
                    <text
                      x={pos.x}
                      y={pos.y + r + 14}
                      textAnchor="middle"
                      fill="#e8ecf4"
                      fontSize={11}
                      fontWeight={500}
                      fontFamily="inherit"
                    >
                      {name.length > 16 ? name.slice(0, 15) + '\u2026' : name}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>

          {visibleTypes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No matching ontology types
            </div>
          )}

          {/* Domain legend */}
          <div
            className="absolute bottom-4 left-4 flex gap-4 text-xs px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(5,10,24,0.8)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {Object.entries(DOMAIN_COLORS).map(([domain, color]) => (
              <div key={domain} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="capitalize" style={{ color: 'var(--text-muted)' }}>
                  {domain}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel (right side) */}
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="w-80 flex-shrink-0 glass-card p-5 overflow-y-auto"
          >
            <div className="flex items-center gap-2.5 mb-5">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: NODE_COLORS[selectedNode] }}
              />
              <h3 className="text-sm font-bold text-white">{selectedNode}</h3>
              <span
                className="ml-auto text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                {DOMAIN_LABELS[selectedNode]}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { label: 'Objects', value: selectedMetric ? formatCount(selectedMetric.count) : '0', icon: Activity },
                { label: 'Schema links', value: String(selectedLinks.length), icon: Link2 },
                { label: 'Live links', value: formatCount(selectedLiveLinkCount), icon: Layers3 },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg p-2"
                  style={{ background: 'rgba(99,130,191,0.05)', border: '1px solid var(--border-subtle)' }}
                >
                  <item.icon className="mb-1 h-3.5 w-3.5 text-cyan-400" />
                  <div className="text-sm font-semibold text-white">{item.value}</div>
                  <div className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>

            {selectedMetric?.error && (
              <div
                className="mb-5 rounded-lg px-3 py-2 text-xs"
                style={{
                  background: 'rgba(244,63,94,0.08)',
                  border: '1px solid rgba(244,63,94,0.2)',
                  color: '#fb7185',
                }}
              >
                {selectedMetric.error}
              </div>
            )}

            <h4
              className="text-[10px] font-semibold uppercase tracking-widest mb-2.5"
              style={{ color: 'var(--text-muted)' }}
            >
              ODL Schema
            </h4>
            <pre
              className="p-4 rounded-lg text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono"
              style={{
                background: 'var(--bg-primary)',
                color: '#38bdf8',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {ODL_SCHEMAS[selectedNode] ?? 'No schema available'}
            </pre>

            <h4
              className="text-[10px] font-semibold uppercase tracking-widest mt-5 mb-2.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Links
            </h4>
            <ul className="space-y-2 text-xs">
              {selectedLinks.length === 0 ? (
                <li style={{ color: 'var(--text-muted)' }}>No link types defined</li>
              ) : (
                selectedLinks.map((l) => {
                  const liveCount = linkCollection.data.filter((link) => link.linkType === l.name).length
                  return (
                  <li key={l.name} className="flex items-center gap-2">
                    <span className="text-cyan-400 font-semibold">{l.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      ({l.from} &rarr; {l.to})
                    </span>
                    {liveEnabled && liveCount > 0 && (
                      <span
                        className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399' }}
                      >
                        {formatCount(liveCount)}
                      </span>
                    )}
                  </li>
                  )
                })
              )}
            </ul>

            <h4
              className="text-[10px] font-semibold uppercase tracking-widest mt-5 mb-2.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Live Objects
            </h4>
            {selectedMetric?.samples.length ? (
              <ul className="space-y-2 text-xs">
                {selectedMetric.samples.map((sample) => (
                  <li
                    key={objectId(sample)}
                    className="rounded-lg p-3"
                    style={{ background: 'rgba(99,130,191,0.05)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="truncate font-semibold text-white">{objectLabel(sample)}</div>
                    <div className="mt-1 truncate font-mono" style={{ color: 'var(--text-muted)' }}>
                      {objectId(sample)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {liveEnabled && liveStatus === 'loading' ? 'Loading live objects' : 'No live objects found'}
              </p>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
