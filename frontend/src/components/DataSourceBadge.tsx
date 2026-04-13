import type { DataSource } from '../hooks/useAwarenessData'

interface Props {
  source: DataSource
  className?: string
}

const BADGE_STYLES: Record<DataSource, { bg: string; text: string; border: string; dot: string; label: string }> = {
  live: {
    bg: 'rgba(52,211,153,0.08)',
    text: '#6ee7b7',
    border: 'rgba(52,211,153,0.2)',
    dot: '#34d399',
    label: 'LIVE',
  },
  unavailable: {
    bg: 'rgba(251,191,36,0.08)',
    text: '#fbbf24',
    border: 'rgba(251,191,36,0.2)',
    dot: '#f59e0b',
    label: 'NO LIVE DATA',
  },
  loading: {
    bg: 'rgba(148,163,184,0.08)',
    text: '#94a3b8',
    border: 'rgba(148,163,184,0.2)',
    dot: '#64748b',
    label: 'LOADING',
  },
}

export function DataSourceBadge({ source, className = '' }: Props) {
  const style = BADGE_STYLES[source]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${className}`}
      style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
    >
      <span
        className={source === 'live' ? 'animate-pulse' : ''}
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: style.dot,
          display: 'inline-block',
        }}
      />
      {style.label}
    </span>
  )
}
