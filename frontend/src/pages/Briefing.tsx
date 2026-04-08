import { useState } from 'react'
import { FileText, Download, Clock, Shield } from 'lucide-react'
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
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-400" /> Intelligence Briefings
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#1e293b] border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setBriefingType('daily')}
              className={`px-3 py-1.5 text-xs ${briefingType === 'daily' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400'}`}
            >
              Daily Briefing
            </button>
            <button
              onClick={() => setBriefingType('sitrep')}
              className={`px-3 py-1.5 text-xs ${briefingType === 'sitrep' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400'}`}
            >
              SITREP
            </button>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e293b] border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Briefing document */}
      <div className="bg-[#0f172a] border border-slate-700/50 rounded-lg overflow-hidden">
        <div className="bg-[#1e293b] px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-base font-bold text-cyan-400">{briefing.title}</h2>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> UNCLASSIFIED</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date().toISOString().slice(0, 19)}Z</span>
            <span>TerraCube Sentinel Automated Briefing</span>
          </div>
        </div>
        <div className="px-6 py-4 space-y-6">
          {briefing.sections.map((section, i) => (
            <div key={i}>
              <h3 className="text-sm font-semibold text-sky-300 mb-2">{section.title}</h3>
              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {section.content.split('**').map((part, j) =>
                  j % 2 === 1 ? <strong key={j} className="text-amber-300">{part}</strong> : part
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-slate-700/50 text-center">
          <p className="text-xs text-slate-500 italic">Generated by TerraCube Sentinel Intelligence Platform</p>
        </div>
      </div>
    </div>
  )
}
