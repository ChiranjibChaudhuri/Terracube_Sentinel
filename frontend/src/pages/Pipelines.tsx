import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
import { Clock, CheckCircle, XCircle, Loader, ArrowRight, Activity, BarChart3 } from 'lucide-react'
import { mockPipelineExecutions } from '../lib/mock-data'

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
  return (
    <motion.div className="space-y-6" variants={stagger.container} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div variants={stagger.item} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h1 className="text-lg font-bold text-white">Data Pipelines</h1>
        </div>
        <div className="flex items-center gap-3">
          {(['SUCCEEDED', 'FAILED', 'RUNNING', 'PENDING'] as const).map((status) => {
            const count = mockPipelineExecutions.filter((p) => p.status === status).length
            const cfg = STATUS_CONFIG[status]
            return (
              <div key={status} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                <span style={{ color: 'var(--text-muted)' }}>{count} {status.toLowerCase()}</span>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Pipeline cards */}
      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PIPELINE_DEFS.map((pipe) => {
          const runs = mockPipelineExecutions.filter((r) => r.pipelineName === pipe.name)
          const latest = runs[0]
          const cfg = latest ? STATUS_CONFIG[latest.status] ?? STATUS_CONFIG.PENDING : STATUS_CONFIG.PENDING
          const StatusIcon = cfg.icon

          return (
            <div key={pipe.name} className="glass-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">{pipe.name}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Clock className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{pipe.schedule}</span>
                  </div>
                </div>
                <span
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase"
                  style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                >
                  <StatusIcon className={`w-3 h-3 ${latest?.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                  {latest?.status ?? 'NO RUNS'}
                </span>
              </div>

              {/* Recent runs */}
              {runs.length > 0 && (
                <div className="space-y-1.5 mb-4">
                  {runs.slice(0, 3).map((run) => {
                    const rcfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.PENDING
                    return (
                      <div key={run.id} className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span className="flex items-center gap-1.5" style={{ color: rcfg.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rcfg.color }} />
                          {run.status}
                        </span>
                        <span>{formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Asset dependency graph */}
              <div className="pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <h4 className="text-[10px] uppercase font-semibold tracking-widest mb-2.5" style={{ color: 'var(--text-muted)' }}>Asset Graph</h4>
                <div className="flex items-center gap-1 flex-wrap">
                  {pipe.assets.map((asset, i) => (
                    <div key={asset} className="flex items-center gap-1">
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono truncate max-w-[120px]"
                        style={{ background: 'rgba(99,130,191,0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                        title={asset}
                      >
                        {asset.replace(/^(fetch_|download_|compute_|normalize_|load_|store_|register_|update_|aggregate_|search_|filter_)/, '')}
                      </span>
                      {i < pipe.assets.length - 1 && (
                        <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </motion.div>

      {/* Pipeline health summary */}
      <motion.div variants={stagger.item} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">Pipeline Health Summary</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(['SUCCEEDED', 'FAILED', 'RUNNING', 'PENDING'] as const).map((status) => {
            const count = mockPipelineExecutions.filter((p) => p.status === status).length
            const cfg = STATUS_CONFIG[status]
            return (
              <div
                key={status}
                className="p-4 rounded-xl text-center"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
              >
                <p className="text-2xl font-bold" style={{ color: cfg.color }}>{count}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color: 'var(--text-muted)' }}>{status}</p>
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
