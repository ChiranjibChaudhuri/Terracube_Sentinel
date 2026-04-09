import { useState } from 'react'
import { motion } from 'framer-motion'
import { Share2 } from 'lucide-react'
import { OBJECT_TYPES, LINK_TYPES } from '../lib/types'

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
}

const DOMAIN_COLORS: Record<string, string> = {
  hazard: '#f43f5e',
  spatial: '#38bdf8',
  monitoring: '#34d399',
  data: '#a855f7',
}

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
}`,
  DataProduct: `type DataProduct @objectType {
  id: ID! @primary
  name: String! @searchable
  type: DataProductType!
  format: DataProductFormat!
  storagePath: String!
  sizeBytes: Int
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
}

const CX = 500
const CY = 340
const RADIUS = 260

export default function Ontology() {
  const [selected, setSelected] = useState<string | null>(null)

  const nodePositions = OBJECT_TYPES.map((name, i) => {
    const angle = (2 * Math.PI * i) / OBJECT_TYPES.length - Math.PI / 2
    return {
      name,
      x: CX + RADIUS * Math.cos(angle),
      y: CY + RADIUS * Math.sin(angle),
    }
  })

  const posMap = Object.fromEntries(nodePositions.map((n) => [n.name, n]))

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Share2 className="w-5 h-5 text-cyan-400" />
        <h1 className="text-lg font-bold text-white">Ontology Graph</h1>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(56,189,248,0.08)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}
        >
          {OBJECT_TYPES.length} types &middot; {LINK_TYPES.length} links
        </span>
      </div>

      <div className="flex gap-4 h-[calc(100vh-10rem)]">
        {/* SVG Canvas */}
        <div className="flex-1 glass-card overflow-hidden relative">
          <svg viewBox="0 0 1000 680" className="w-full h-full">
            {/* Edges */}
            {LINK_TYPES.map((link) => {
              const from = posMap[link.from]
              const to = posMap[link.to]
              if (!from || !to) return null
              const midX = (from.x + to.x) / 2
              const midY = (from.y + to.y) / 2
              const isHighlighted = selected === link.from || selected === link.to
              return (
                <g key={link.name}>
                  <line
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={isHighlighted ? 'rgba(56,189,248,0.4)' : 'rgba(99,130,191,0.12)'}
                    strokeWidth={isHighlighted ? 2 : 1}
                    markerEnd="url(#arrowhead)"
                  />
                  <text x={midX} y={midY - 6} textAnchor="middle" fill={isHighlighted ? '#38bdf8' : 'rgba(99,130,191,0.3)'} fontSize={10}>
                    {link.name}
                  </text>
                </g>
              )
            })}

            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="rgba(99,130,191,0.3)" />
              </marker>
              {/* Glow filters */}
              {Object.entries(NODE_COLORS).map(([name, color]) => (
                <filter key={name} id={`glow-${name}`}>
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={color} floodOpacity="0.3" />
                </filter>
              ))}
            </defs>

            {/* Nodes */}
            {nodePositions.map((node) => {
              const color = NODE_COLORS[node.name] ?? '#6366f1'
              const isSelected = selected === node.name
              return (
                <g
                  key={node.name}
                  onClick={() => setSelected(isSelected ? null : node.name)}
                  className="cursor-pointer"
                  filter={isSelected ? `url(#glow-${node.name})` : undefined}
                >
                  <circle
                    cx={node.x} cy={node.y} r={isSelected ? 36 : 28}
                    fill={`${color}15`}
                    stroke={color} strokeWidth={isSelected ? 2.5 : 1.5}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                  <text
                    x={node.x} y={node.y + 4}
                    textAnchor="middle" fill="#e8ecf4" fontSize={11} fontWeight={600}
                  >
                    {node.name.length > 12 ? node.name.slice(0, 11) + '...' : node.name}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Domain legend */}
          <div className="absolute bottom-4 left-4 flex gap-4 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(5,10,24,0.8)', border: '1px solid var(--border-subtle)' }}>
            {Object.entries(DOMAIN_COLORS).map(([domain, color]) => (
              <div key={domain} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="capitalize" style={{ color: 'var(--text-muted)' }}>{domain}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar panel */}
        {selected && (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="w-80 flex-shrink-0 glass-card p-5 overflow-y-auto"
          >
            <div className="flex items-center gap-2.5 mb-5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS[selected] }} />
              <h3 className="text-sm font-bold text-white">{selected}</h3>
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {DOMAIN_LABELS[selected]}
              </span>
            </div>

            <h4 className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-muted)' }}>ODL Schema</h4>
            <pre
              className="p-4 rounded-lg text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono"
              style={{ background: 'var(--bg-primary)', color: '#38bdf8', border: '1px solid var(--border-subtle)' }}
            >
              {ODL_SCHEMAS[selected] ?? 'No schema available'}
            </pre>

            <h4 className="text-[10px] font-semibold uppercase tracking-widest mt-5 mb-2.5" style={{ color: 'var(--text-muted)' }}>Links</h4>
            <ul className="space-y-2 text-xs">
              {LINK_TYPES.filter((l) => l.from === selected || l.to === selected).map((l) => (
                <li key={l.name} className="flex items-center gap-2">
                  <span className="text-cyan-400 font-semibold">{l.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>({l.from} &rarr; {l.to})</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
