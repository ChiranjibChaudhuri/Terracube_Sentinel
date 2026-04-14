import { Link, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Database,
  Map,
  GitBranch,
  Share2,
  Settings,
  Globe,
  FileText,
  Bell,
  Search,
} from 'lucide-react'
import { TerraCubeIcon } from '@/components/brand/terracube-logo'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { TooltipProvider } from '@/components/ui/tooltip'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'INTELLIGENCE' },
  { to: '/map', label: 'Map View', icon: Map, group: 'INTELLIGENCE' },
  { to: '/country', label: 'Countries', icon: Globe, group: 'INTELLIGENCE' },
  { to: '/briefing', label: 'Briefings', icon: FileText, group: 'INTELLIGENCE' },
  { to: '/objects', label: 'Objects', icon: Database, group: 'DATA MANAGEMENT' },
  { to: '/pipelines', label: 'Pipelines', icon: GitBranch, group: 'DATA MANAGEMENT' },
  { to: '/ontology', label: 'Ontology', icon: Share2, group: 'DATA MANAGEMENT' },
  { to: '/settings', label: 'Settings', icon: Settings, group: 'CONFIGURATION' },
]

function AppSidebar() {
  const location = useLocation()
  const groups = ['INTELLIGENCE', 'DATA MANAGEMENT', 'CONFIGURATION']

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link to="/">
              <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent transition-colors">
                <div className="flex aspect-square size-9 items-center justify-center rounded-lg border border-border/50 bg-muted/50">
                  <TerraCubeIcon size={24} />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold text-sm">TerraCube</span>
                  <span className="text-[10px] text-muted-foreground">Sentinel</span>
                </div>
              </div>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-3 pb-2 pt-1">
          <p className="text-[9px] text-muted-foreground leading-tight">
            Geospatial intelligence, risk monitoring, and data pipeline orchestration.
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                  const active =
                    item.to === location.pathname ||
                    (item.to !== '/' && location.pathname.startsWith(item.to))
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton isActive={active} tooltip={item.label}>
                        <Link to={item.to}>
                          <item.icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground">
          <span>v0.1.0</span>
          <span className="hidden sidebar-expanded:inline">Open Foundry | Dagster</span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function TopBar() {
  const location = useLocation()
  const current = NAV_ITEMS.find(
    (n) => n.to === location.pathname || (n.to !== '/' && location.pathname.startsWith(n.to)),
  ) ?? NAV_ITEMS[0]

  return (
    <header className="flex h-12 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Sentinel</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium">{current.label}</span>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="h-8 w-48 pl-8 text-xs bg-secondary border-border"
          />
        </div>
        <button className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Bell className="size-4" />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent-red" />
        </button>
        <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
          OP
        </div>
      </div>
    </header>
  )
}

export default function Layout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <TopBar />
          <main className="flex-1 overflow-auto p-4">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              <Outlet />
            </motion.div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
