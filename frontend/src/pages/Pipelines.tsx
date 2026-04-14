import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
import { Clock, CheckCircle, XCircle, Loader, ArrowRight, Activity, BarChart3, RefreshCw, AlertTriangle } from 'lucide-react'
import { fetchObjects } from '@/lib/api-client'
import type { PipelineExecution } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const PIPELINE_DEFS = [
  { name: 'real_time_hazards', schedule: 'Every 5 minutes', assets: ['fetch_open_meteo_weather', 'fetch_usgs_earthquakes', 'fetch_nasa_firms_fires', 'fetch_nasa_eonet_events', 'normalize_hazard_records', 'load_hazards_to_foundry'] },
  { name: 'satellite_ingestion', schedule: 'Every 3 hours', assets: ['search_stac_catalogs', 'filter_scenes', 'download_cog_assets', 'store_in_minio', 'register_data_products'] },
  { name: 'climate_reanalysis', schedule: 'Daily', assets: ['download_era5_data', 'compute_degree_days', 'compute_anomalies', 'aggregate_to_regions', 'update_risk_assessments'] },
  { name: 'infrastructure_vulnerability', schedule: 'Weekly', assets: ['download_osm_data', 'fetch_active_hazards', 'compute_exposure', 'update_infrastructure_assets'] },
  { name: 'air_quality', schedule: 'Every 30 minutes', assets: ['fetch_openaq_measurements', 'fetch_waqi_status', 'normalize_air_quality', 'load_air_quality_to_foundry'] },
  { name: 'social_signals', schedule: 'Every 15 minutes', assets: ['fetch_gdelt_events', 'fetch_gdelt_tone', 'normalize_social_signals'] },
  { name: 'risk_scoring', schedule: 'Hourly', assets: ['aggregate_hazard_data', 'compute_composite_risk', 'update_region_risk_scores'] },
]

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bg: string; border: string }> = {
  SUCCEEDED: { icon: CheckCircle, color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)' },
  FAILED: { icon: XCircle, color: '#f43f5e', bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.2)' },
  RUNNING: { icon: Loader, color: '#38bdf8', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)' },
  PENDING: { icon: Clock, color: '#64748b', bg: 'rgba(99,130,191,0.06)', border: 'rgba(99,130,191,0.12)' },
}

const stagger = {
  container: { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } },
  item: { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } },
}

export default function Pipelines() {
  const [pipelineRuns, setPipelineRuns] = useState<PipelineExecution[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function loadPipelineRuns() {
      setIsLoading(true)
      setError(null)
      try {
        const runs = await fetchObjects<PipelineExecution>('PipelineExecution', { pageSize: 1000 }, controller.signal)
        setPipelineRuns(runs.toSorted((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()))
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setPipelineRuns([])
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      } finally {
        setIsLoading(false)
      }
    }
    void loadPipelineRuns()
    return () => controller.abort()
  }, [refreshKey])

  const statusCounts = useMemo(
    () => (['SUCCEEDED', 'FAILED', 'RUNNING', 'PENDING'] as const).map((status) => ({
      status,
      count: pipelineRuns.filter((p) => p.status === status).length,
      cfg: STATUS_CONFIG[status],
    })),
    [pipelineRuns],
  )

  return (
    <motion.div className="space-y-6" variants={stagger.container} initial="hidden" animate="visible">
      <motion.div variants={stagger.item} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">Data Pipelines</h1>
          <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5">
            {isLoading ? 'Loading' : `${pipelineRuns.length} live runs`}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {statusCounts.map(({ status, count, cfg }) => (
            <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
              {count} {status.toLowerCase()}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((v) => v + 1)} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {error && (
        <motion.div variants={stagger.item} className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PIPELINE_DEFS.map((pipe) => {
          const runs = pipelineRuns.filter((r) => r.pipelineName === pipe.name)
          const latest = runs[0]
          const cfg = latest ? STATUS_CONFIG[latest.status] ?? STATUS_CONFIG.PENDING : STATUS_CONFIG.PENDING
          const StatusIcon = cfg.icon

          return (
            <Card key={pipe.name}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold font-mono">{pipe.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {pipe.schedule}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="gap-1.5"
                    style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
                  >
                    <StatusIcon className={`w-3 h-3 ${latest?.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                    {latest?.status ?? 'NO RUNS'}
                  </Badge>
                </div>

                {runs.length > 0 ? (
                  <div className="space-y-1.5 mb-4">
                    {runs.slice(0, 3).map((run) => {
                      const rcfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.PENDING
                      return (
                        <div key={run.id} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5" style={{ color: rcfg.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rcfg.color }} />
                            {run.status}
                          </span>
                          <span>{formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mb-4 text-xs text-muted-foreground">
                    {isLoading ? 'Checking run history' : 'No live run registered for this pipeline'}
                  </p>
                )}

                <Separator className="mb-3" />
                <div>
                  <h4 className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-2.5">Asset Graph</h4>
                  <div className="flex items-center gap-1 flex-wrap">
                    {pipe.assets.map((asset, i) => (
                      <div key={asset} className="flex items-center gap-1">
                        <Badge variant="secondary" className="font-mono text-[10px] max-w-[120px] truncate" title={asset}>
                          {asset.replace(/^(fetch_|download_|compute_|normalize_|load_|store_|register_|update_|aggregate_|search_|filter_)/, '')}
                        </Badge>
                        {i < pipe.assets.length - 1 && <ArrowRight className="w-3 h-3 shrink-0 text-muted-foreground" />}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </motion.div>

      <motion.div variants={stagger.item}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm">Pipeline Health Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {statusCounts.map(({ status, count, cfg }) => (
                <div key={status} className="p-4 rounded-xl text-center border" style={{ background: cfg.bg, borderColor: cfg.border }}>
                  <p className="text-2xl font-bold" style={{ color: cfg.color }}>{count}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">{status}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
