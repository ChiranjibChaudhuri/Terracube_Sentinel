import { useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Download, FileText, Shield } from 'lucide-react'
import { mockGSERegions } from '../lib/mock-data'

function generateSyntheticBriefing(type: string) {
  const now = new Date()
  const topRegions = mockGSERegions.slice(0, 5)
  const maxGSE = Math.max(...mockGSERegions.map((r) => r.gseScore))
  const globalLevel = maxGSE >= 90 ? 'CRITICAL' : maxGSE >= 60 ? 'HEIGHTENED' : maxGSE >= 30 ? 'ELEVATED' : 'STABLE'

  if (type === 'daily') {
    return {
      title: `DAILY INTELLIGENCE BRIEFING — ${now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      sections: [
        {
          title: '1. EXECUTIVE SUMMARY',
          content: `- Global threat level: **${globalLevel}** (peak GSE: ${maxGSE.toFixed(1)})\n- ${topRegions.filter((r) => r.threatLevel === 'HEIGHTENED' || r.threatLevel === 'CRITICAL').length} region(s) at HEIGHTENED or above\n- Total events processed: ${topRegions.reduce((a, r) => a + r.eventCount, 0)}\n- Escalation alerts: ${topRegions.filter((r) => r.trend === 'up').length}`,
        },
        {
          title: '2. GLOBAL STATE INDICATOR',
          content: `**${globalLevel}** ${topRegions.some((r) => r.trend === 'up') ? '↑' : '→'} Peak GSE: ${maxGSE.toFixed(1)}/200`,
        },
        {
          title: '3. REGIONAL ANALYSIS (Top 5)',
          content: topRegions.map((r) => `- **${r.regionName}**: ${r.threatLevel} (GSE: ${r.gseScore.toFixed(1)}) — ${r.eventCount} events — ${r.trend === 'up' ? '↑ ESCALATING' : '→ Stable'}`).join('\n'),
        },
        {
          title: '4. ACTIVE THREATS',
          content: topRegions.filter((r) => r.threatLevel !== 'STABLE').map((r) => `- **${r.regionName}**: ${r.threatLevel} (GSE: ${r.gseScore.toFixed(1)}) — primary driver: ${r.topCategory}`).join('\n'),
        },
        {
          title: '5. FORECAST (24-48h)',
          content: topRegions.some((r) => r.trend === 'up' && r.gseScore > 60)
            ? `- **Escalation risk HIGH** in: ${topRegions.filter((r) => r.trend === 'up' && r.gseScore > 60).map((r) => r.regionName).join(', ')}\n- Continued monitoring recommended for all HEIGHTENED+ regions`
            : '- No immediate escalation expected\n- Continue standard monitoring cadence',
        },
        {
          title: '6. RECOMMENDED ACTIONS',
          content: '- Monitor escalating regions at 15-minute intervals\n- Review cross-domain activity in Middle East and South Asia\n- Brief senior leadership on HEIGHTENED regions\n- Continue routine monitoring for STABLE regions',
        },
      ],
    }
  }

  return {
    title: `SITUATION REPORT — ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} UTC`,
    sections: [
      { title: 'THREAT ASSESSMENT', content: `Global level: ${globalLevel} | Peak GSE: ${maxGSE.toFixed(1)}` },
      { title: 'KEY EVENTS', content: 'See Active Threats table on dashboard for current events.' },
      { title: 'RECOMMENDED ACTIONS', content: '- Continue monitoring\n- Review all HEIGHTENED+ regions' },
    ],
  }
}

export default function Briefing() {
  const [briefingType, setBriefingType] = useState<'daily' | 'sitrep'>('daily')
  const briefing = generateSyntheticBriefing(briefingType)

  return (
    <motion.div
      className="space-y-6 max-w-4xl"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-cyan-400" /> Intelligence Briefings
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)', background: 'var(--bg-card)' }}>
            <button
              onClick={() => setBriefingType('daily')}
              className="px-4 py-2 text-xs font-semibold transition-all"
              style={{
                background: briefingType === 'daily' ? 'rgba(56,189,248,0.1)' : 'transparent',
                color: briefingType === 'daily' ? '#38bdf8' : 'var(--text-muted)',
              }}
            >
              Daily Briefing
            </button>
            <button
              onClick={() => setBriefingType('sitrep')}
              className="px-4 py-2 text-xs font-semibold transition-all"
              style={{
                background: briefingType === 'sitrep' ? 'rgba(56,189,248,0.1)' : 'transparent',
                color: briefingType === 'sitrep' ? '#38bdf8' : 'var(--text-muted)',
              }}
            >
              SITREP
            </button>
          </div>
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all focus-ring"
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Briefing document */}
      <div className="glass-card overflow-hidden">
        {/* Document header */}
        <div className="px-8 py-5" style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.04), rgba(139,92,246,0.04))', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-base font-bold gradient-text-cyan">{briefing.title}</h2>
          <div className="flex items-center gap-5 mt-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              <span className="badge-live badge-live-green">UNCLASSIFIED</span>
            </span>
            <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {new Date().toISOString().slice(0, 19)}Z</span>
            <span>TerraCube Sentinel Automated Briefing</span>
          </div>
        </div>

        {/* Document body */}
        <div className="px-8 py-6 space-y-6">
          {briefing.sections.map((section, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
            >
              <h3 className="text-sm font-bold text-cyan-400 mb-2.5">{section.title}</h3>
              <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {section.content.split('**').map((part, j) =>
                  j % 2 === 1 ? <strong key={j} className="text-amber-300 font-semibold">{part}</strong> : part
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Document footer */}
        <div className="px-8 py-3 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-[10px] italic" style={{ color: 'var(--text-muted)' }}>
            Generated by TerraCube Sentinel Intelligence Platform &mdash; GLM-5 Turbo AI Engine
          </p>
        </div>
      </div>
    </motion.div>
  )
}
