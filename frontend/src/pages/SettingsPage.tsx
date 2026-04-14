import { motion } from 'framer-motion'
import { Settings, Server, Palette, Info, Shield, Activity, Database, Cpu } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getApiBaseUrl } from '@/lib/api'

export default function SettingsPage() {
  return (
    <motion.div
      className="max-w-2xl space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2.5">
        <Settings className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm">API Configuration</CardTitle>
          </div>
          <CardDescription>Configure API endpoints for the agents and ontology services.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider">GraphQL Endpoint</Label>
            <Input defaultValue="/graphql" readOnly className="cursor-not-allowed" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider">Agents API Base URL</Label>
            <Input defaultValue={getApiBaseUrl()} readOnly className="cursor-not-allowed text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm">Appearance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Theme</p>
              <p className="text-xs text-muted-foreground">Always-on dark mode optimized for operations centers.</p>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">Active</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm">About TerraCube Sentinel</CardTitle>
          </div>
          <CardDescription>
            Earth Observation, hazard monitoring, and geospatial operations platform.
            Built on Open Foundry, PostGIS, Dagster, and model-assisted pipelines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Version', value: '0.1.0', icon: Shield },
              { label: 'Ontology', value: 'geo-sentinel', icon: Database },
              { label: 'Pipelines', value: '7 Dagster', icon: Activity },
              { label: 'AI Agents', value: '6 + orchestrator', icon: Cpu },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/30">
                <item.icon className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
