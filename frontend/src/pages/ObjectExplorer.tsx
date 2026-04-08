import { useState, useMemo, Fragment } from 'react'
import { Search, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, type, or ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-10 pr-4 py-2 bg-[#1e293b] border border-slate-700 rounded-md text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value as ObjectTypeName | ''); setPage(0) }}
          className="px-3 py-2 bg-[#1e293b] border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Types</option>
          {OBJECT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-700/30">
              <th className="w-8" />
              <th className="text-left px-4 py-2">ID</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Name / Key Property</th>
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
                    className="border-b border-slate-700/20 hover:bg-slate-800/30 cursor-pointer"
                    onClick={() => setExpandedId(expanded ? null : id)}
                  >
                    <td className="pl-3">
                      {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-400">{id}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded bg-slate-700 text-xs text-slate-300">
                        {typeName}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-200 truncate max-w-xs">{String(name)}</td>
                  </tr>
                  {expanded && (
                    <tr className="bg-slate-800/20">
                      <td colSpan={4} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Properties</h4>
                            <dl className="space-y-1 text-xs">
                              {allEntries.map(([k, v]) => (
                                <div key={k} className="flex gap-2">
                                  <dt className="text-slate-500 w-36 flex-shrink-0">{k}</dt>
                                  <dd className="text-slate-300 break-all">
                                    {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Links</h4>
                            {links.length === 0 ? (
                              <p className="text-xs text-slate-500">No link types</p>
                            ) : (
                              <ul className="space-y-1 text-xs">
                                {links.map((l) => (
                                  <li key={l.name} className="flex items-center gap-2 text-slate-300">
                                    <ExternalLink className="w-3 h-3 text-cyan-400" />
                                    <span className="text-cyan-400">{l.name}</span>
                                    <span className="text-slate-500">
                                      {l.from === typeName ? `-> ${l.to}` : `<- ${l.from}`}
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
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{filtered.length} objects</span>
        <div className="flex gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-2 py-1">
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

