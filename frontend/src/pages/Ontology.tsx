import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Share2, AlertTriangle, BarChart3, Globe, Radio, Building2,
  Database, Satellite, Package, GitBranch, Plane, Ship, TrendingUp,
  Search, RefreshCw, Activity, Link2, Layers3,
} from 'lucide-react'
import ForceGraph2D from 'react-force-graph-2d'
import type { ComponentType, SVGProps } from 'react'
import { OBJECT_TYPES, LINK_TYPES } from '../lib/types'
import type { ObjectTypeName } from '../lib/types'
import { fetchLinks, fetchObjectCollection } from '../lib/api-client'
import type { LinkRecord, ObjectCollectionResponse } from '../lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// ── Constants ───────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  HazardEvent: '#ef4444', Alert: '#f97316', RiskAssessment: '#f59e0b', Region: '#38bdf8',
  Sensor: '#22c55e', InfrastructureAsset: '#06b6d4', DataSource: '#a855f7', SatellitePass: '#8b5cf6',
  DataProduct: '#a78bfa', PipelineExecution: '#6366f1', Aircraft: '#38bdf8', Vessel: '#3b82f6',
  FinancialIndicator: '#eab308',
}

const DOMAIN_LABELS: Record<string, string> = {
  HazardEvent: 'hazard', Alert: 'hazard', RiskAssessment: 'hazard', Region: 'spatial',
  Sensor: 'monitoring', InfrastructureAsset: 'spatial', DataSource: 'data', SatellitePass: 'data',
  DataProduct: 'data', PipelineExecution: 'data', Aircraft: 'spatial', Vessel: 'spatial',
  FinancialIndicator: 'hazard',
}

const DOMAIN_COLORS: Record<string, string> = { hazard: '#ef4444', spatial: '#38bdf8', monitoring: '#22c55e', data: '#a855f7' }

const NODE_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  HazardEvent: AlertTriangle, Alert: BarChart3, RiskAssessment: BarChart3, Region: Globe,
  Sensor: Radio, InfrastructureAsset: Building2, DataSource: Database, SatellitePass: Satellite,
  DataProduct: Package, PipelineExecution: GitBranch, Aircraft: Plane, Vessel: Ship, FinancialIndicator: TrendingUp,
}

const ODL_SCHEMAS: Record<string, string> = {
  Region: `type Region @objectType { id: ID! @primary; name: String! @searchable; type: RegionType!; population: Int; gdpPerCapita: Float; riskScore: Float @computed; geometry: JSON! }`,
  HazardEvent: `type HazardEvent @objectType { id: ID! @primary; type: HazardType!; severity: SeverityLevel!; geometry: JSON!; startTime: DateTime!; endTime: DateTime; confidence: Float; alertLevel: AlertLevel! }`,
  Sensor: `type Sensor @objectType { id: ID! @primary; type: SensorType!; name: String! @searchable; geometry: JSON!; status: SensorStatus!; lastReading: DateTime }`,
  InfrastructureAsset: `type InfrastructureAsset @objectType { id: ID! @primary; type: InfrastructureType!; name: String! @searchable; geometry: JSON!; exposureLevel: ExposureLevel!; vulnerabilityScore: Float }`,
  RiskAssessment: `type RiskAssessment @objectType { id: ID! @primary; hazardType: HazardType!; riskScore: Float!; methodology: RiskMethodology!; confidence: Float; timestamp: DateTime! }`,
  Alert: `type Alert @objectType { id: ID! @primary; severity: SeverityLevel!; message: String! @searchable; issuedAt: DateTime!; expiresAt: DateTime }`,
  DataSource: `type DataSource @objectType { id: ID! @primary; name: String! @searchable; provider: String!; type: DataSourceType!; temporalResolution: Duration }`,
  SatellitePass: `type SatellitePass @objectType { id: ID! @primary; acquisitionTime: DateTime!; processingLevel: ProcessingLevel!; cloudCover: Float; collection: String; mission: String }`,
  DataProduct: `type DataProduct @objectType { id: ID! @primary; name: String! @searchable; type: DataProductType!; format: DataProductFormat!; storagePath: String!; sourceCatalog: String }`,
  PipelineExecution: `type PipelineExecution @objectType { id: ID! @primary; pipelineName: String!; status: PipelineStatus!; triggeredBy: String!; startedAt: DateTime!; completedAt: DateTime }`,
  Aircraft: `type Aircraft @objectType { id: ID! @primary; icao24: String!; callsign: String; altitude: Float; heading: Float; velocity: Float; timestamp: DateTime!; geometry: JSON! }`,
  Vessel: `type Vessel @objectType { id: ID! @primary; mmsi: String!; name: String; shipType: ShipType!; speed: Float; heading: Float; flag: String; isFishing: Boolean; timestamp: DateTime!; geometry: JSON! }`,
  FinancialIndicator: `type FinancialIndicator @objectType { id: ID! @primary; symbol: String!; name: String! @searchable; indicatorType: FinancialIndicatorType!; value: Float!; changePct: Float; region: String! }`,
}

const LIVE_SAMPLE_SIZE = 4
type DomainFilter = 'all' | 'hazard' | 'spatial' | 'monitoring' | 'data'
type LiveStatus = 'idle' | 'loading' | 'ready' | 'error'

type OntologyObjectPreview = Record<string, unknown> & { id?: string; _id?: string; objectType?: string; _type?: string; name?: string }
type TypeMetric = { status: LiveStatus; count: number; samples: OntologyObjectPreview[]; error?: string }
type LinkCollection = ObjectCollectionResponse<LinkRecord>

const EMPTY_LINK_COLLECTION: LinkCollection = { data: [], total: 0 }

function emptyMetrics(status: LiveStatus = 'idle'): Record<ObjectTypeName, TypeMetric> {
  const next = {} as Record<ObjectTypeName, TypeMetric>
  for (const type of OBJECT_TYPES) next[type] = { status, count: 0, samples: [] }
  return next
}

function objectId(o: OntologyObjectPreview): string { return String(o.id ?? o._id ?? o.objectId ?? '?') }
function objectLabel(o: OntologyObjectPreview): string { return String(o.name ?? o.sourceSceneId ?? o.pipelineName ?? o.message ?? o.symbol ?? objectId(o)) }
function formatCount(v: number): string { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v) }
function compactCount(v: number): string { return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v) }

// ── Build graph data for react-force-graph ──────────────────────────

interface GraphNode {
  id: string
  name: string
  color: string
  val: number
  domain: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

interface GraphLink {
  source: string
  target: string
  name: string
}

function buildGraphData(types: ObjectTypeName[], metrics: Record<ObjectTypeName, TypeMetric>, links: typeof LINK_TYPES): { nodes: GraphNode[]; links: GraphLink[] } {
  const typeSet = new Set(types)
  const nodes: GraphNode[] = types.map((name) => ({
    id: name,
    name: name.length > 16 ? name.slice(0, 15) + '…' : name,
    color: NODE_COLORS[name] ?? '#6366f1',
    val: metrics[name]?.count ?? 0,
    domain: DOMAIN_LABELS[name] ?? 'data',
    icon: NODE_ICONS[name] ?? Activity,
  }))
  const filteredLinks = links.filter((l) => typeSet.has(l.from) && typeSet.has(l.to))
  const graphLinks: GraphLink[] = filteredLinks.map((l) => ({ source: l.from, target: l.to, name: l.name }))
  return { nodes, links: graphLinks }
}

// ── Component ───────────────────────────────────────────────────────

export default function Ontology() {
  const fgRef = useRef<any>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all')
  const [liveEnabled, setLiveEnabled] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [metrics, setMetrics] = useState<Record<ObjectTypeName, TypeMetric>>(() => emptyMetrics())
  const [linkCollection, setLinkCollection] = useState<LinkCollection>(EMPTY_LINK_COLLECTION)
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle')
  const [liveError, setLiveError] = useState<string | null>(null)

  useEffect(() => {
    if (!liveEnabled) return
    const controller = new AbortController()
    async function loadLiveGraph() {
      setLiveStatus('loading'); setLiveError(null); setMetrics(emptyMetrics('loading'))
      const entries = await Promise.all(
        OBJECT_TYPES.map(async (type) => {
          try {
            const res = await fetchObjectCollection<OntologyObjectPreview>(type, { pageSize: LIVE_SAMPLE_SIZE }, controller.signal)
            return [type, { status: 'ready', count: res.total, samples: res.data }] as const
          } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') throw e
            return [type, { status: 'error', count: 0, samples: [], error: e instanceof Error ? e.message : String(e) }] as const
          }
        }),
      )
      const links = await fetchLinks<LinkRecord>({ pageSize: 1000 }, controller.signal).catch(() => EMPTY_LINK_COLLECTION)
      setMetrics(Object.fromEntries(entries) as Record<ObjectTypeName, TypeMetric>)
      setLinkCollection(links)
      setLiveStatus(entries.some(([, m]) => m.status === 'error') ? 'error' : 'ready')
    }
    loadLiveGraph().catch((e) => {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setMetrics(emptyMetrics('error')); setLiveStatus('error')
      setLiveError(e instanceof Error ? e.message : String(e))
    })
    return () => controller.abort()
  }, [liveEnabled, refreshKey])

  const visibleTypes = useMemo(() => {
    const q = query.trim().toLowerCase()
    return OBJECT_TYPES.filter((type) => {
      if (domainFilter !== 'all' && DOMAIN_LABELS[type] !== domainFilter) return false
      if (!q) return true
      return type.toLowerCase().includes(q) || DOMAIN_LABELS[type]?.includes(q) || (ODL_SCHEMAS[type] ?? '').toLowerCase().includes(q)
    })
  }, [domainFilter, query])

  const { nodes, links: graphLinks } = useMemo(() => buildGraphData(visibleTypes, metrics, LINK_TYPES), [visibleTypes, metrics])
  const totalLiveObjects = useMemo(() => Object.values(metrics).reduce((t, m) => t + m.count, 0), [metrics])
  const selectedLinks = useMemo(() => selectedNode ? LINK_TYPES.filter((l) => l.from === selectedNode || l.to === selectedNode) : [], [selectedNode])
  const selectedMetric = selectedNode ? metrics[selectedNode as ObjectTypeName] : null
  const selectedLiveLinkCount = selectedLinks.reduce((t, sl) => t + linkCollection.data.filter((l) => l.linkType === sl.name).length, 0)

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node.id === selectedNode ? null : node.id)
  }, [selectedNode])

  const handleNodeHover = useCallback((node: any) => {
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 400)
      fgRef.current.zoom(2.5, 400)
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <Share2 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Ontology Graph</h1>
          <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5">
            {visibleTypes.length}/{OBJECT_TYPES.length} types · {graphLinks.length} links
          </Badge>
          <Badge variant="outline" className={cn(liveStatus === 'error' ? 'text-destructive border-destructive/20 bg-destructive/5' : 'text-green-400 border-green-400/20 bg-green-400/5')}>
            {liveEnabled ? `${formatCount(totalLiveObjects)} objects · ${formatCount(linkCollection.total)} links` : 'Live off'}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search ontology" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>
          <Select value={domainFilter} onValueChange={(v) => setDomainFilter(v as DomainFilter)}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All domains</SelectItem>
              {Object.entries(DOMAIN_COLORS).map(([d, c]) => (
                <SelectItem key={d} value={d}><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: c }} />{d}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setLiveEnabled((v) => !v)} className={cn('h-8 text-xs', liveEnabled && 'border-green-400/20 text-green-400')}>
            {liveEnabled ? 'Live on' : 'Live off'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((v) => v + 1)} disabled={!liveEnabled || liveStatus === 'loading'} className="h-8 text-xs">
            <RefreshCw className={cn('mr-1.5 h-3 w-3', liveStatus === 'loading' && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {liveError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {liveError}
        </div>
      )}

      {/* Graph + detail panel */}
      <div className="flex gap-4" style={{ height: 'calc(100vh - 12rem)' }}>
        <Card className="flex-1 overflow-hidden min-h-[400px]">
          <CardContent className="p-0 h-full">
            {visibleTypes.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No matching ontology types</div>
            ) : (
              <ForceGraph2D
                ref={fgRef}
                graphData={{ nodes, links: graphLinks }}
                nodeId="id"
                nodeColor={(n: any) => n.color}
                nodeVal={(n: any) => 8 + Math.min(20, Math.log10((n.val || 0) + 1) * 5)}
                nodeLabel={(n: any) => n.id}
                linkLabel={(l: any) => l.name}
                linkColor={() => 'rgba(255,255,255,0.12)'}
                linkWidth={1}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={1}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                backgroundColor="#0f1117"
                enableNodeDrag={true}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                warmupTicks={50}
                cooldownTicks={100}
                linkCurvature={0.15}
              />
            )}
          </CardContent>
        </Card>

        {/* Domain legend */}
        <div className="absolute bottom-4 left-4 flex gap-4 text-xs px-3 py-2 rounded-lg bg-[#09090b]/90 border border-border">
          {Object.entries(DOMAIN_COLORS).map(([domain, color]) => (
            <div key={domain} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize text-muted-foreground">{domain}</span>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <Card className="w-72 shrink-0 overflow-hidden">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS[selectedNode] }} />
                <CardTitle className="text-sm">{selectedNode}</CardTitle>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">{DOMAIN_LABELS[selectedNode]}</span>
              </div>
            </CardHeader>
            <Separator />
            <ScrollArea className="h-[calc(100vh-18rem)]">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Objects', value: selectedMetric ? formatCount(selectedMetric.count) : '0', icon: Activity },
                    { label: 'Links', value: String(selectedLinks.length), icon: Link2 },
                    { label: 'Live', value: formatCount(selectedLiveLinkCount), icon: Layers3 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-md border border-border p-2 bg-muted/20">
                      <item.icon className="mb-1 h-3 w-3 text-muted-foreground" />
                      <p className="text-sm font-semibold">{item.value}</p>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>

                {selectedMetric?.error && (
                  <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{selectedMetric.error}</div>
                )}

                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">ODL Schema</h4>
                  <pre className="p-3 rounded-md bg-[#09090b] border border-border text-[11px] text-primary font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                    {ODL_SCHEMAS[selectedNode] ?? 'No schema'}
                  </pre>
                </div>

                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Links</h4>
                  {selectedLinks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No links defined</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {selectedLinks.map((l) => {
                        const liveCount = linkCollection.data.filter((lnk) => lnk.linkType === l.name).length
                        return (
                          <li key={l.name} className="flex items-center gap-2">
                            <Link2 className="w-3 h-3 text-primary" />
                            <span className="text-primary font-semibold">{l.name}</span>
                            <span className="text-muted-foreground">{l.from === selectedNode ? `→ ${l.to}` : `← ${l.from}`}</span>
                            {liveEnabled && liveCount > 0 && <Badge variant="secondary" className="ml-auto text-[9px] h-5">{formatCount(liveCount)}</Badge>}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Samples</h4>
                  {selectedMetric?.samples.length ? (
                    <ul className="space-y-1.5">
                      {selectedMetric.samples.map((s) => (
                        <li key={objectId(s)} className="rounded-md border border-border p-2 bg-muted/20">
                          <p className="text-xs font-medium truncate">{objectLabel(s)}</p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{objectId(s)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">{liveStatus === 'loading' ? 'Loading...' : 'No objects found'}</p>
                  )}
                </div>
              </CardContent>
            </ScrollArea>
          </Card>
        )}
      </div>
    </div>
  )
}
