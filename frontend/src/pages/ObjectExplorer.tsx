import { useState, useMemo, Fragment } from 'react'
import { motion } from 'framer-motion'
import { Search, ChevronDown, ChevronRight, ExternalLink, Database, Filter } from 'lucide-react'
import { OBJECT_TYPES, LINK_TYPES } from '../lib/types'
import type { ObjectTypeName } from '../lib/types'
import { getMockDataByType } from '../lib/mock-data'

const PAGE_SIZE = 10

export default function ObjectExplorer() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ObjectTypeName | ''>('')
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const allObjects = useMemo(() => {
    const types = typeFilter ? [typeFilter] : [...OBJECT_TYPES]
    return types.flatMap((t) =>
      getMockDataByType(t).map((obj) => ({ ...obj, _type: t })),
    )
  }, [typeFilter])

  const filtered = useMemo(() => {
    if (!search) return allObjects
    const q = search.toLowerCase()
    return allObjects.filter((obj: Record<string, unknown>) => {
      const name = obj.name as string | undefined
      const type = obj._type as string
      const id = obj.id as string
      return (
        (name && name.toLowerCase().includes(q)) ||
        type.toLowerCase().includes(q) ||
        id.toLowerCase().includes(q)
      )
    })
  }, [allObjects, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const getLinksForType = (typeName: string) =>
    LINK_TYPES.filter((l) => l.from === typeName || l.to === typeName)

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Database className="w-5 h-5 text-cyan-400" />
          <h1 className="text-lg font-bold text-white">Object Explorer</h1>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(56,189,248,0.08)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}
          >
            {filtered.length} objects
          </span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by name, type, or ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-[var(--text-muted)] focus:outline-none transition-colors focus-ring"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-active)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as ObjectTypeName | ''); setPage(0) }}
            className="pl-9 pr-8 py-2.5 rounded-lg text-sm text-white appearance-none focus:outline-none transition-colors focus-ring"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
          >
            <option value="">All Types</option>
            {OBJECT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-card overflow-hidden">
        {paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Database className="w-10 h-10 mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-medium text-white mb-1">No objects found</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="w-8" />
                <th className="text-left px-5 py-3 font-semibold">ID</th>
                <th className="text-left px-5 py-3 font-semibold">Type</th>
                <th className="text-left px-5 py-3 font-semibold">Name / Key Property</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((obj) => {
                const record = obj as Record<string, unknown>
                const id = record.id as string
                const typeName = record._type as string
                const name = (record.name ?? record.pipelineName ?? record.message ?? id) as string
                const expanded = expandedId === id
                const links = getLinksForType(typeName)
                const allEntries = Object.entries(record).filter(([k]) => k !== '_type')

                return (
                  <Fragment key={id}>
                    <tr
                      className="table-row-hover cursor-pointer"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onClick={() => setExpandedId(expanded ? null : id)}
                    >
                      <td className="pl-4">
                        {expanded ? (
                          <ChevronDown className="w-3.5 h-3.5" style={{ color: '#38bdf8' }} />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{id}</td>
                      <td className="px-5 py-3">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
                          style={{ background: 'rgba(99,130,191,0.08)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                        >
                          {typeName}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-white truncate max-w-xs font-medium">{String(name)}</td>
                    </tr>
                    {expanded && (
                      <tr style={{ background: 'rgba(56,189,248,0.02)' }}>
                        <td colSpan={4} className="px-8 py-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Properties</h4>
                              <dl className="space-y-1.5 text-xs">
                                {allEntries.map(([k, v]) => (
                                  <div key={k} className="flex gap-3">
                                    <dt className="w-36 flex-shrink-0 font-mono" style={{ color: 'var(--text-muted)' }}>{k}</dt>
                                    <dd className="text-white break-all">
                                      {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                            <div>
                              <h4 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Relationships</h4>
                              {links.length === 0 ? (
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No link types defined</p>
                              ) : (
                                <ul className="space-y-2 text-xs">
                                  {links.map((l) => (
                                    <li key={l.name} className="flex items-center gap-2">
                                      <ExternalLink className="w-3 h-3 text-cyan-400" />
                                      <span className="text-cyan-400 font-semibold">{l.name}</span>
                                      <span style={{ color: 'var(--text-muted)' }}>
                                        {l.from === typeName ? `→ ${l.to}` : `← ${l.from}`}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{filtered.length} total objects</span>
        <div className="flex items-center gap-1">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30 focus-ring"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm font-mono">
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30 focus-ring"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            Next
          </button>
        </div>
      </div>
    </motion.div>
  )
}
