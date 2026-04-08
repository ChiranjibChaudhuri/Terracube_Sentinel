import { useAppStore } from '../lib/store'

export default function SettingsPage() {
  const apiEndpoint = useAppStore((s) => s.apiEndpoint)
  const setApiEndpoint = useAppStore((s) => s.setApiEndpoint)

  return (
    <div className="max-w-2xl space-y-6">
      {/* API Configuration */}
      <section className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">API Configuration</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">GraphQL Endpoint</label>
            <input
              type="text"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">REST API Base URL</label>
            <input
              type="text"
              readOnly
              value="http://localhost:8080/api/v1"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-500"
            />
          </div>
        </div>
      </section>

      {/* Theme */}
      <section className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-200">Dark Theme</p>
            <p className="text-xs text-slate-500">Toggle between dark and light modes</p>
          </div>
          <div className="w-10 h-6 bg-cyan-500 rounded-full relative cursor-not-allowed opacity-60">
            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
          </div>
        </div>
      </section>

      {/* About */}
      <section className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">About</h2>
        <div className="space-y-2 text-sm text-slate-300">
          <p>
            <strong className="text-white">TerraCube Sentinel</strong> is an open-source Palantir
            Foundry alternative for Earth Observation and planetary intelligence.
          </p>
          <p>
            Built on Open Foundry, TypeDB, PostGIS, Dagster, and AI agents, it provides a complete
            platform for ingesting, linking, analyzing, and acting on geospatial and environmental data.
          </p>
          <div className="pt-2 border-t border-slate-700/30 text-xs text-slate-500 space-y-1">
            <p>Version: 0.1.0</p>
            <p>Ontology: geo-sentinel (10 object types, 9 link types)</p>
            <p>Pipelines: 7 Dagster pipelines</p>
            <p>AI Agents: 6 specialized agents + orchestrator</p>
          </div>
        </div>
      </section>
    </div>
  )
}
