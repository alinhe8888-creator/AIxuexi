import type { ReactNode } from 'react'

export function MiniLineChart({ values, height = 84 }: { values: number[]; height?: number }) {
  if (!values.length) return null
  const width = 320
  const padding = 8
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 100)
  const range = Math.max(1, max - min)
  const points = values.map((value, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, values.length - 1)
    const y = height - padding - ((value - min) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg className="mini-line-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="趋势图">
      <defs>
        <linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`${points} ${width - padding},${height - padding} ${padding},${height - padding}`} fill="url(#lineArea)" stroke="none" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((value, index) => {
        const [x, y] = points.split(' ')[index].split(',')
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="3.5" fill="currentColor" />
      })}
    </svg>
  )
}

export function BarList({ items }: { items: Array<{ label: string; value: number; meta?: ReactNode }> }) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return (
    <div className="bar-list">
      {items.map((item) => (
        <div className="bar-row" key={item.label}>
          <div className="bar-row-head"><span>{item.label}</span><strong>{item.meta ?? item.value}</strong></div>
          <div className="bar-track"><span style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

export function Donut({ value, label, sublabel }: { value: number; label: string; sublabel?: string }) {
  const safe = Math.max(0, Math.min(100, value))
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(var(--primary) ${safe * 3.6}deg, var(--surface-3) 0deg)` }}>
        <div><strong>{safe}%</strong><span>{label}</span></div>
      </div>
      {sublabel && <p>{sublabel}</p>}
    </div>
  )
}
