import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Database,
  Map,
  GitBranch,
  Share2,
  Settings,
  Menu,
  ChevronRight,
  Shield,
  Globe,
  FileText,
  Bell,
  Radio,
  ChevronLeft,
  X,
} from 'lucide-react'
import { useAppStore } from '../lib/store'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'overview' },
  { to: '/map', label: 'Map View', icon: Map, group: 'overview' },
  { to: '/country', label: 'Country Intel', icon: Globe, group: 'analysis' },
  { to: '/briefing', label: 'Briefings', icon: FileText, group: 'analysis' },
  { to: '/objects', label: 'Object Explorer', icon: Database, group: 'data' },
  { to: '/pipelines', label: 'Pipelines', icon: GitBranch, group: 'data' },
  { to: '/ontology', label: 'Ontology', icon: Share2, group: 'data' },
  { to: '/settings', label: 'Settings', icon: Settings, group: 'system' },
] as const

const GROUP_LABELS: Record<string, string> = {
  overview: 'OVERVIEW',
  analysis: 'ANALYSIS',
  data: 'DATA PLATFORM',
  system: 'SYSTEM',
}

export default function Layout() {
  const location = useLocation()
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const current = NAV_ITEMS.find(
    (n) => n.to === location.pathname || (n.to !== '/' && location.pathname.startsWith(n.to)),
  ) ?? NAV_ITEMS[0]

  const groups = ['overview', 'analysis', 'data', 'system']
  const showSidebarLabels = sidebarOpen || mobileNavOpen

  return (
    <div className="flex h-screen overflow-hidden noise-overlay" style={{ background: 'var(--bg-primary)' }}>
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-64 flex-col transition-transform duration-200 ease-out md:relative md:translate-x-0 ${sidebarOpen ? 'md:w-60' : 'md:w-[68px]'} md:flex-shrink-0 md:transition-all`}
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 h-16" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(6, 182, 212, 0.1))', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <Shield className="w-4 h-4 text-cyan-400" />
          </div>
          <AnimatePresence>
            {showSidebarLabels && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="min-w-0 flex-1 overflow-hidden whitespace-nowrap"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white tracking-tight">TerraCube</span>
                  <span className="text-[10px] font-medium text-cyan-400/80 uppercase">Sentinel</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="ml-auto rounded-lg p-2 text-slate-400 md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Main navigation">
          {groups.map((group) => {
            const items = NAV_ITEMS.filter((n) => n.group === group)
            return (
              <div key={group} className="mb-3">
                <AnimatePresence>
                  {showSidebarLabels && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="px-3 mb-1.5 text-[10px] font-semibold"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {GROUP_LABELS[group]}
                    </motion.p>
                  )}
                </AnimatePresence>
                {items.map((item) => {
                  const Icon = item.icon
                  const active =
                    item.to === location.pathname ||
                    (item.to !== '/' && location.pathname.startsWith(item.to))
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      aria-label={item.label}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 mb-0.5 focus-ring relative ${
                        active
                          ? 'nav-active-indicator'
                          : ''
                      }`}
                      style={{
                        background: active ? 'rgba(56, 189, 248, 0.06)' : 'transparent',
                        color: active ? '#38bdf8' : 'var(--text-secondary)',
                      }}
                      title={item.label}
                      onClick={() => setMobileNavOpen(false)}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = 'rgba(99, 130, 191, 0.06)'
                          e.currentTarget.style.color = 'var(--text-primary)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--text-secondary)'
                        }
                      }}
                    >
                      <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                      <AnimatePresence>
                        {showSidebarLabels && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="font-medium truncate"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="hidden px-3 py-3 md:block" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-150 focus-ring"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(99, 130, 191, 0.06)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            {sidebarOpen ? (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse</span>
              </>
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center justify-between h-14 px-5"
          style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Toggle navigation menu"
              className="p-1.5 rounded-lg transition-colors focus-ring md:hidden"
              style={{ color: 'var(--text-muted)' }}
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex items-center gap-1.5 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Sentinel</span>
              <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
              <span className="truncate font-medium text-white">{current.label}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Live indicator */}
            <div className="badge-live badge-live-green mr-2 hidden sm:inline-flex">
              <Radio className="w-3 h-3" />
              <span>LIVE</span>
            </div>

            {/* Notifications */}
            <button
              className="relative p-2 rounded-lg transition-colors focus-ring"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99, 130, 191, 0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
            </button>

            {/* User avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ml-1"
              style={{
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(139, 92, 246, 0.2))',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                color: '#38bdf8'
              }}
            >
              OP
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6" style={{ background: 'var(--bg-primary)' }}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>

        {/* Footer */}
        <footer
          className="flex items-center justify-between px-5 py-2 text-[10px]"
          style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
        >
          <span>TerraCube Sentinel v0.1.0</span>
          <span className="hidden sm:inline">Open Foundry Ontology | Dagster Pipelines | GLM-5 AI</span>
        </footer>
      </div>
    </div>
  )
}
