import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Clock, Download, FileText, FileCode2, Shield } from 'lucide-react'
import { PageErrorBanner, SkeletonBlock, SkeletonText } from '../components/AsyncState'
import {
  getDailyBriefing,
  getDailyBriefingMarkdown,
  type BriefingResponse,
} from '../lib/api'

function StructuredSection({
  section,
  index,
}: {
  section: BriefingResponse['sections'][number]
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
    >
      <h3 className="mb-2.5 text-sm font-bold text-cyan-400">{section.title}</h3>
      <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
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
    <div className="glass-card overflow-hidden">
      <div
        className="px-8 py-5"
        style={{
          background: 'linear-gradient(135deg, rgba(56,189,248,0.04), rgba(139,92,246,0.04))',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <SkeletonBlock className="h-6 w-2/3" />
        <div className="mt-3 flex gap-3">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-4 w-36" />
          <SkeletonBlock className="h-4 w-40" />
        </div>
      </div>
      <div className="space-y-6 px-8 py-6">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3">
            <SkeletonBlock className="h-4 w-52" />
            <SkeletonText lines={4} />
          </div>
        ))}
      </div>
    </div>
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

  const isLoading = briefingView === 'structured'
    ? briefingQuery.isLoading
    : markdownQuery.isLoading

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
    <motion.div
      className="max-w-4xl space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-2.5 text-lg font-bold text-white">
          <FileText className="h-5 w-5 text-cyan-400" />
          Intelligence Briefings
        </h1>

        <div className="flex items-center gap-2">
          <div
            className="flex overflow-hidden rounded-lg"
            style={{ border: '1px solid var(--border-default)', background: 'var(--bg-card)' }}
          >
            <button
              type="button"
              onClick={() => setBriefingView('structured')}
              className="px-4 py-2 text-xs font-semibold transition-all"
              style={{
                background: briefingView === 'structured' ? 'rgba(56,189,248,0.1)' : 'transparent',
                color: briefingView === 'structured' ? '#38bdf8' : 'var(--text-muted)',
              }}
            >
              Structured
            </button>
            <button
              type="button"
              onClick={() => setBriefingView('markdown')}
              className="px-4 py-2 text-xs font-semibold transition-all"
              style={{
                background: briefingView === 'markdown' ? 'rgba(56,189,248,0.1)' : 'transparent',
                color: briefingView === 'markdown' ? '#38bdf8' : 'var(--text-muted)',
              }}
            >
              Markdown
            </button>
          </div>

          <button
            type="button"
            disabled={!markdownQuery.data?.markdown}
            onClick={handleExport}
            className="focus-ring flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
            }}
          >
            <Download className="h-3.5 w-3.5" />
            Export Markdown
          </button>
        </div>
      </div>

      {hasError ? (
        <PageErrorBanner
          title="Briefing refresh failed"
          message="The page is retrying automatically. Use Retry to request a fresh copy from the backend."
          onRetry={handleRetry}
        />
      ) : null}

      {isLoading ? (
        <BriefingSkeleton />
      ) : briefingView === 'structured' && briefingQuery.data ? (
        <div className="glass-card overflow-hidden">
          <div
            className="px-8 py-5"
            style={{
              background: 'linear-gradient(135deg, rgba(56,189,248,0.04), rgba(139,92,246,0.04))',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <h2 className="gradient-text-cyan text-base font-bold">{briefingQuery.data.title}</h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                <span className="badge-live badge-live-green">{briefingQuery.data.classification}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {new Date(briefingQuery.data.generatedAt).toLocaleString()}
              </span>
              <span>TerraCube Sentinel Automated Briefing</span>
            </div>
          </div>

          <div className="space-y-6 px-8 py-6">
            {briefingQuery.data.sections.map((section, index) => (
              <StructuredSection key={`${section.title}-${index}`} section={section} index={index} />
            ))}
          </div>

          <div className="px-8 py-3 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] italic" style={{ color: 'var(--text-muted)' }}>
              Generated by TerraCube Sentinel Intelligence Platform
            </p>
          </div>
        </div>
      ) : markdownQuery.data ? (
        <div className="glass-card overflow-hidden">
          <div
            className="flex items-center justify-between px-8 py-5"
            style={{
              background: 'linear-gradient(135deg, rgba(56,189,248,0.04), rgba(14,165,233,0.02))',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <h2 className="gradient-text-cyan text-base font-bold">Daily Briefing Markdown</h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                `/briefing/daily/markdown`
              </p>
            </div>
            <FileCode2 className="h-4 w-4 text-cyan-400" />
          </div>

          <pre
            className="overflow-x-auto px-8 py-6 text-sm leading-7 whitespace-pre-wrap"
            style={{ color: 'var(--text-secondary)' }}
          >
            {markdownQuery.data.markdown}
          </pre>
        </div>
      ) : (
        <PageErrorBanner
          title="No briefing available"
          message="The backend did not return a structured briefing or markdown output."
          onRetry={handleRetry}
        />
      )}
    </motion.div>
  )
}
