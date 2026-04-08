import { formatDistanceToNow } from 'date-fns'
import { Clock, CheckCircle, XCircle, Loader, ArrowRight } from 'lucide-react'
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

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
  SUCCEEDED: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
  FAILED: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  RUNNING: { icon: Loader, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  PENDING: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10' },
}

export default function Pipelines() {
  return (
    <div className="space-y-6">
      {/* Pipeline cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PIPELINE_DEFS.map((pipe) => {
          const runs = mockPipelineExecutions.filter((r) => r.pipelineName === pipe.name)
          const latest = runs[0]
          const cfg = latest ? STATUS_CONFIG[latest.status] ?? STATUS_CONFIG.PENDING : STATUS_CONFIG.PENDING
          const StatusIcon = cfg.icon

          return (
            <div key={pipe.name} className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white font-mono">{pipe.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-xs text-slate-400">{pipe.schedule}</span>
                  </div>
                </div>
                <span className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${cfg.bg} ${cfg.color}`}>
                  <StatusIcon className={`w-3 h-3 ${latest?.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                  {latest?.status ?? 'NO RUNS'}
                </span>
              </div>

              {/* Recent runs */}
              {runs.length > 0 && (
                <div className="mt-3 space-y-1">
                  {runs.slice(0, 3).map((run) => {
                    const rcfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.PENDING
                    return (
                      <div key={run.id} className="flex items-center justify-between text-xs text-slate-400">
                        <span className={`flex items-center gap-1 ${rcfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${run.status === 'SUCCEEDED' ? 'bg-green-400' : run.status === 'FAILED' ? 'bg-red-400' : 'bg-blue-400'}`} />
                          {run.status}
                        </span>
                        <span>{formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Asset dependency graph */}
              <div className="mt-4 pt-3 border-t border-slate-700/30">
                <h4 className="text-[10px] uppercase text-slate-500 mb-2 tracking-wide">Asset Graph</h4>
                <div className="flex items-center gap-1 flex-wrap">
                  {pipe.assets.map((asset, i) => (
                    <div key={asset} className="flex items-center gap-1">
                      <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-300 font-mono truncate max-w-[120px]" title={asset}>
                        {asset.replace(/^(fetch_|download_|compute_|normalize_|load_|store_|register_|update_|aggregate_|search_|filter_)/, '')}
                      </span>
                      {i < pipe.assets.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pipeline health summary */}
      <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Pipeline Health</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {(['SUCCEEDED', 'FAILED', 'RUNNING', 'PENDING'] as const).map((status) => {
            const count = mockPipelineExecutions.filter((p) => p.status === status).length
            const cfg = STATUS_CONFIG[status]
            return (
              <div key={status} className={`p-3 rounded-lg ${cfg.bg}`}>
                <p className={`text-xl font-bold ${cfg.color}`}>{count}</p>
                <p className="text-xs text-slate-400 mt-1">{status}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
