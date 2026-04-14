import { useEffect, useMemo, useState, Fragment } from 'react'
import { Database, Search, ChevronDown, ChevronRight, ExternalLink, Filter, RefreshCw, AlertTriangle } from 'lucide-react'
import { OBJECT_TYPES, LINK_TYPES } from '../lib/types'
import type { ObjectTypeName } from '../lib/types'
import { fetchObjectCollection } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PAGE_SIZE = 10

type LiveObject = Record<string, unknown> & {
  id?: string; _id?: string; objectId?: string; _type?: string; objectType?: string; name?: string
}

function getObjectId(obj: LiveObject): string {
  return String(obj.id ?? obj._id ?? obj.objectId ?? 'unidentified')
}

export default function ObjectExplorer() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ObjectTypeName | ''>('')
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [objects, setObjects] = useState<LiveObject[]>([])
  const [totalObjects, setTotalObjects] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const types = typeFilter ? [typeFilter] : [...OBJECT_TYPES]
    async function loadObjects() {
      setIsLoading(true); setError(null)
      try {
        const collections = await Promise.all(
          types.map(async (type) => {
            const response = await fetchObjectCollection<LiveObject>(type, { pageSize: 1000 }, controller.signal)
            return { type, total: response.total, data: response.data.map((obj) => ({ ...obj, _type: String(obj.objectType ?? obj._type ?? type) })) }
          }),
        )
        setObjects(collections.flatMap((c) => c.data))
        setTotalObjects(collections.reduce((t, c) => t + c.total, 0))
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setObjects([]); setTotalObjects(0)
        setError(e instanceof Error ? e.message : String(e))
      } finally { setIsLoading(false) }
    }
    void loadObjects()
    return () => controller.abort()
  }, [refreshKey, typeFilter])

  const filtered = useMemo(() => {
    if (!search) return objects
    const q = search.toLowerCase()
    return objects.filter((obj) => {
      const name = obj.name as string | undefined
      const type = obj._type as string
      const id = getObjectId(obj)
      return (name && name.toLowerCase().includes(q)) || type.toLowerCase().includes(q) || id.toLowerCase().includes(q)
    })
  }, [objects, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const getLinksForType = (typeName: string) => LINK_TYPES.filter((l) => l.from === typeName || l.to === typeName)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <Database className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Object Explorer</h1>
          <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5">
            {isLoading ? 'Loading' : `${filtered.length}/${totalObjects} objects`}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey((v) => v + 1)} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, type, or ID..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} className="pl-10" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as ObjectTypeName | ''); setPage(0) }}>
          <SelectTrigger className="w-48">
            <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_types">All Types</SelectItem>
            {OBJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <AlertTriangle className="mb-3 h-10 w-10 text-destructive" />
              <p className="mb-1 text-sm font-medium">Object API unavailable</p>
              <p className="max-w-xl text-xs text-muted-foreground">{error}</p>
            </div>
          ) : paged.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <Database className="w-10 h-10 mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">{isLoading ? 'Loading objects' : 'No live objects found'}</p>
              <p className="text-xs text-muted-foreground">{isLoading ? 'Reading from Foundry...' : 'Run an ingestion pipeline first'}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead className="text-[10px]">ID</TableHead>
                    <TableHead className="text-[10px]">Type</TableHead>
                    <TableHead className="text-[10px]">Name / Key Property</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((obj) => {
                    const id = getObjectId(obj)
                    const typeName = obj._type as string
                    const name = (obj.name ?? obj.pipelineName ?? obj.message ?? id) as string
                    const expanded = expandedId === id
                    const links = getLinksForType(typeName)
                    const entries = Object.entries(obj as Record<string, unknown>).filter(([k]) => k !== '_type')
                    return (
                      <Fragment key={id}>
                        <TableRow className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : id)}>
                          <TableCell className="pl-4">
                            {expanded ? <ChevronDown className="w-3.5 h-3.5 text-primary" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{id}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-[10px] font-semibold">{typeName}</Badge></TableCell>
                          <TableCell className="font-medium truncate max-w-xs">{String(name)}</TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={4} className="px-8 py-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Properties</h4>
                                  <dl className="space-y-1.5 text-xs">
                                    {entries.map(([k, v]) => (
                                      <div key={k} className="flex gap-3">
                                        <dt className="w-36 shrink-0 font-mono text-muted-foreground">{k}</dt>
                                        <dd className="break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                                <div>
                                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Relationships</h4>
                                  {links.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No link types defined</p>
                                  ) : (
                                    <ul className="space-y-2 text-xs">
                                      {links.map((l) => (
                                        <li key={l.name} className="flex items-center gap-2">
                                          <ExternalLink className="w-3 h-3 text-primary" />
                                          <span className="text-primary font-semibold">{l.name}</span>
                                          <span className="text-muted-foreground">{l.from === typeName ? `→ ${l.to}` : `← ${l.from}`}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filtered.length} filtered / {totalObjects} live objects</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="px-3 font-mono">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  )
}
