import { Link, Outlet, useLocation } from 'react-router-dom'
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
} from 'lucide-react'
import { useAppStore } from '../lib/store'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/map', label: 'Map View', icon: Map },
  { to: '/country', label: 'Country Intel', icon: Globe },
  { to: '/briefing', label: 'Briefings', icon: FileText },
  { to: '/objects', label: 'Object Explorer', icon: Database },
  { to: '/pipelines', label: 'Pipelines', icon: GitBranch },
  { to: '/ontology', label: 'Ontology', icon: Share2 },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

export default function Layout() {
  const location = useLocation()
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)

  const current = NAV_ITEMS.find(
    (n) => n.to === location.pathname || (n.to !== '/' && location.pathname.startsWith(n.to)),
  ) ?? NAV_ITEMS[0]

  const breadcrumb = current.label

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a]">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 flex flex-col border-r border-slate-800 bg-[#0b1120] transition-all duration-200`}
      >
        <div className="flex items-center gap-2 px-4 h-14 border-b border-slate-800">
          <Shield className="w-6 h-6 text-cyan-400 flex-shrink-0" />
          {sidebarOpen && (
            <span className="text-sm font-semibold text-white truncate">TerraCube Sentinel</span>
          )}
        </div>
        <nav className="flex-1 py-2 space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active =
              item.to === location.pathname ||
              (item.to !== '/' && location.pathname.startsWith(item.to))
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={item.label}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 h-14 px-4 border-b border-slate-800 bg-[#0b1120]">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <span>Sentinel</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-200">{breadcrumb}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
