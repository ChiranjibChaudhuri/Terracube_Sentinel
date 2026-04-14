import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Database,
  Map,
  GitBranch,
  Share2,
  Settings,
  Shield,
  Globe,
  FileText,
  Bell,
  Radio,
} from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { TooltipProvider } from '@/components/ui/tooltip'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { to: '/map', label: 'Map View', icon: Map, group: 'Overview' },
  { to: '/country', label: 'Country Intel', icon: Globe, group: 'Analysis' },
  { to: '/briefing', label: 'Briefings', icon: FileText, group: 'Analysis' },
  { to: '/objects', label: 'Object Explorer', icon: Database, group: 'Data' },
  { to: '/pipelines', label: 'Pipelines', icon: GitBranch, group: 'Data' },
  { to: '/ontology', label: 'Ontology', icon: Share2, group: 'Data' },
  { to: '/settings', label: 'Settings', icon: Settings, group: 'System' },
]

function AppSidebar() {
  const location = useLocation()

  const groups = ['Overview', 'Analysis', 'Data', 'System']

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Shield className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">TerraCube</span>
                  <span className="text-xs text-muted-foreground">Sentinel</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                  const active =
                    item.to === location.pathname ||
                    (item.to !== '/' && location.pathname.startsWith(item.to))

                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
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
        <Separator />
        <div className="flex items-center justify-between px-2 py-2 text-xs text-muted-foreground">
          <span>v0.1.0</span>
          <span className="hidden sm:inline">Open Foundry | Dagster | GLM-5</span>
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
    <header className="flex items-center justify-between border-b border-border px-5 h-14">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Sentinel</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{current.label}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1.5 text-emerald-400 border-emerald-400/20 bg-emerald-400/5">
          <Radio className="size-3" />
          LIVE
        </Badge>

        <Badge variant="outline" className="relative">
          <Bell className="size-3.5" />
          <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-500" />
        </Badge>

        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary border border-primary/20">
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
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </main>
          <footer className="flex items-center justify-between border-t border-border px-5 py-2 text-xs text-muted-foreground">
            <span>TerraCube Sentinel v0.1.0</span>
            <span className="hidden sm:inline">Open Foundry Ontology | Dagster Pipelines | GLM-5 AI</span>
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
