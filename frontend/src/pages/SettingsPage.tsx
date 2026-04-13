import { motion } from 'framer-motion'
import { Settings, Server, Palette, Info, Shield, Activity, Database, Cpu } from 'lucide-react'
import { getApiBaseUrl } from '../lib/api'
import { useAppStore } from '../lib/store'

export default function SettingsPage() {
  const apiEndpoint = useAppStore((s) => s.apiEndpoint)
  const setApiEndpoint = useAppStore((s) => s.setApiEndpoint)

  return (
    <motion.div
      className="max-w-2xl space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Settings className="w-5 h-5 text-cyan-400" />
        <h1 className="text-lg font-bold text-white">Settings</h1>
      </div>

      {/* API Configuration */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Server className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">API Configuration</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>GraphQL Endpoint</label>
            <input
              type="text"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white focus:outline-none transition-colors focus-ring"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-active)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Agents API Base URL</label>
            <input
              type="text"
              readOnly
              value={getApiBaseUrl()}
              className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none cursor-not-allowed"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
            />
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Palette className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">Appearance</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Dark Theme</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Toggle between dark and light modes</p>
          </div>
          <div
            className="w-11 h-6 rounded-full relative cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #38bdf8, #06b6d4)' }}
          >
            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-md" />
          </div>
        </div>
      </section>

      {/* About */}
      <section className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Info className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">About TerraCube Sentinel</h2>
        </div>
        <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p>
            <strong className="text-white">TerraCube Sentinel</strong> supports Earth Observation,
            hazard monitoring, and geospatial operations.
          </p>
          <p>
            Built on Open Foundry, PostGIS, Dagster, and model-assisted pipelines, it ingests,
            links, and audits geospatial and environmental data.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5 pt-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {[
            { label: 'Version', value: '0.1.0', icon: Shield },
            { label: 'Ontology', value: 'geo-sentinel', icon: Database },
            { label: 'Pipelines', value: '7 Dagster', icon: Activity },
            { label: 'AI Agents', value: '6 + orchestrator', icon: Cpu },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ background: 'rgba(99,130,191,0.04)', border: '1px solid var(--border-subtle)' }}
            >
              <item.icon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                <p className="text-sm font-medium text-white">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  )
}
