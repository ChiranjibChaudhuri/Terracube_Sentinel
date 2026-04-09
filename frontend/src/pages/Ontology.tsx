import { useState } from 'react'
import { OBJECT_TYPES, LINK_TYPES } from '../lib/types'

const NODE_COLORS: Record<string, string> = {
  HazardEvent: '#ef4444',
  Alert: '#f97316',
  RiskAssessment: '#f59e0b',
  Region: '#3b82f6',
  Sensor: '#22c55e',
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
  hazard: '#ef4444',
  spatial: '#3b82f6',
  monitoring: '#22c55e',
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
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* SVG Canvas */}
      <div className="flex-1 bg-[#1e293b] rounded-lg border border-slate-700/50 overflow-hidden relative">
        <svg viewBox="0 0 1000 680" className="w-full h-full">
          {/* Edges */}
          {LINK_TYPES.map((link) => {
            const from = posMap[link.from]
            const to = posMap[link.to]
            if (!from || !to) return null
            const midX = (from.x + to.x) / 2
            const midY = (from.y + to.y) / 2
            return (
              <g key={link.name}>
                <line
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke="#475569" strokeWidth={1.5} markerEnd="url(#arrowhead)"
                />
                <text x={midX} y={midY - 6} textAnchor="middle" fill="#64748b" fontSize={10}>
                  {link.name}
                </text>
              </g>
            )
          })}

          {/* Arrow marker */}
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#475569" />
            </marker>
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
              >
                <circle
                  cx={node.x} cy={node.y} r={isSelected ? 34 : 28}
                  fill={color} fillOpacity={0.2}
                  stroke={color} strokeWidth={isSelected ? 3 : 2}
                />
                <text
                  x={node.x} y={node.y + 4}
                  textAnchor="middle" fill="#e2e8f0" fontSize={11} fontWeight={600}
                >
                  {node.name.length > 12 ? node.name.slice(0, 11) + '...' : node.name}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Domain legend */}
        <div className="absolute bottom-4 left-4 flex gap-4 text-xs">
          {Object.entries(DOMAIN_COLORS).map(([domain, color]) => (
            <div key={domain} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-slate-400 capitalize">{domain}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar panel */}
      {selected && (
        <div className="w-80 flex-shrink-0 bg-[#1e293b] rounded-lg border border-slate-700/50 p-4 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: NODE_COLORS[selected] }}
            />
            <h3 className="text-sm font-semibold text-white">{selected}</h3>
            <span className="ml-auto text-[10px] text-slate-500 uppercase">
              {DOMAIN_LABELS[selected]}
            </span>
          </div>

          <h4 className="text-xs text-slate-400 uppercase mb-2">ODL Schema</h4>
          <pre className="bg-slate-900 p-3 rounded text-[11px] text-cyan-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {ODL_SCHEMAS[selected] ?? 'No schema available'}
          </pre>

          <h4 className="text-xs text-slate-400 uppercase mt-4 mb-2">Links</h4>
          <ul className="space-y-1 text-xs">
            {LINK_TYPES.filter((l) => l.from === selected || l.to === selected).map((l) => (
              <li key={l.name} className="text-slate-300">
                <span className="text-cyan-400">{l.name}</span>
                {' '}
                <span className="text-slate-500">
                  ({l.from} &rarr; {l.to})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
