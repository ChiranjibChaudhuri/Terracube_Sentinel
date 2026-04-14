import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Clock, Download, FileText, FileCode2, Shield } from 'lucide-react'
import { PageErrorBanner, SkeletonBlock, SkeletonText } from '../components/AsyncState'
import { getDailyBriefing, getDailyBriefingMarkdown, type BriefingResponse } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

function StructuredSection({ section, index }: { section: BriefingResponse['sections'][number]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
    >
      <h3 className="mb-2.5 text-sm font-bold text-primary">{section.title}</h3>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {section.content.split('**').map((part, partIndex) =>
          partIndex % 2 === 1
            ? <strong key={partIndex} className="font-semibold text-amber-300">{part}</strong>
            : part,
        )}
      </div>
    </motion.div>
  )
}

function BriefingSkeleton() {
  return (
    <Card>
      <div className="px-8 py-5 bg-muted/30 border-b border-border">
        <SkeletonBlock className="h-6 w-2/3" />
        <div className="mt-3 flex gap-3">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-4 w-36" />
          <SkeletonBlock className="h-4 w-40" />
        </div>
      </div>
      <CardContent className="space-y-6 px-8 py-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3">
            <SkeletonBlock className="h-4 w-52" />
            <SkeletonText lines={4} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function Briefing() {
  const [briefingView, setBriefingView] = useState<'structured' | 'markdown'>('structured')

  const briefingQuery = useQuery({
    queryKey: ['briefing', 'daily'],
    queryFn: ({ signal }) => getDailyBriefing(signal),
    refetchInterval: 60_000,
  })

  const markdownQuery = useQuery({
    queryKey: ['briefing', 'daily', 'markdown'],
    queryFn: ({ signal }) => getDailyBriefingMarkdown(signal),
    refetchInterval: 60_000,
  })

  const isLoading = briefingView === 'structured' ? briefingQuery.isLoading : markdownQuery.isLoading
  const hasError = briefingQuery.isError || markdownQuery.isError

  const handleRetry = () => {
    void briefingQuery.refetch()
    void markdownQuery.refetch()
  }

  const handleExport = () => {
    const markdown = markdownQuery.data?.markdown
    if (!markdown) return
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'sentinel-daily-briefing.md'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div className="max-w-4xl space-y-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-2.5 text-lg font-bold">
          <FileText className="h-5 w-5 text-primary" />
          Intelligence Briefings
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!markdownQuery.data?.markdown}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Export Markdown
          </Button>
        </div>
      </div>

      {hasError && (
        <PageErrorBanner
          title="Briefing refresh failed"
          message="The page is retrying automatically. Use Retry to request a fresh copy from the backend."
          onRetry={handleRetry}
        />
      )}

      {isLoading ? (
        <BriefingSkeleton />
      ) : (
        <Card>
          <div className="border-b border-border">
            <div className="flex items-center justify-between px-8 py-5 bg-muted/30">
              {briefingView === 'structured' && briefingQuery.data ? (
                <>
                  <div>
                    <h2 className="gradient-text-cyan text-base font-bold">{briefingQuery.data.title}</h2>
                    <div className="mt-2.5 flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Shield className="h-3 w-3" />
                        <Badge variant="outline" className="text-emerald-400 border-emerald-400/20 bg-emerald-400/5">{briefingQuery.data.classification}</Badge>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {new Date(briefingQuery.data.generatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <FileCode2 className="h-4 w-4 text-primary" />
                  <div>
                    <h2 className="gradient-text-cyan text-base font-bold">Daily Briefing Markdown</h2>
                    <p className="mt-1 text-xs text-muted-foreground">/briefing/daily/markdown</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-center px-8 py-2">
              <Tabs value={briefingView} onValueChange={(v) => setBriefingView(v as 'structured' | 'markdown')}>
                <TabsList className="bg-transparent border-0">
                  <TabsTrigger value="structured">Structured</TabsTrigger>
                  <TabsTrigger value="markdown">Markdown</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {briefingView === 'structured' && briefingQuery.data ? (
            <CardContent className="space-y-6 px-8 py-6">
              {briefingQuery.data.sections.map((section, index) => (
                <StructuredSection key={`${section.title}-${index}`} section={section} index={index} />
              ))}
              <Separator />
              <p className="text-center text-[10px] italic text-muted-foreground">
                Generated by TerraCube Sentinel Intelligence Platform
              </p>
            </CardContent>
          ) : markdownQuery.data ? (
            <pre className="overflow-x-auto px-8 py-6 text-sm leading-7 whitespace-pre-wrap text-muted-foreground">
              {markdownQuery.data.markdown}
            </pre>
          ) : (
            <PageErrorBanner title="No briefing available" message="The backend did not return a structured briefing or markdown output." onRetry={handleRetry} />
          )}
        </Card>
      )}
    </motion.div>
  )
}
