import type { ReactNode } from 'react'

export function MiniLineChart({ values, height = 84 }: { values: number[]; height?: number }) {
  if (!values.length) return null
  const width = 320
  const padding = 10
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 100)
  const range = Math.max(1, max - min)
  const coordinates = values.map((value, index) => ({
    x: padding + (index * (width - padding * 2)) / Math.max(1, values.length - 1),
    y: height - padding - ((value - min) / range) * (height - padding * 2),
  }))
  const points = coordinates.map(({ x, y }) => `${x},${y}`).join(' ')
  return (
    <svg className="mini-line-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="趋势图">
      <defs><linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.22" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      <polyline points={`${points} ${width - padding},${height - padding} ${padding},${height - padding}`} fill="url(#lineArea)" stroke="none" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {coordinates.map(({ x, y }, index) => <circle key={`${values[index]}-${index}`} cx={x} cy={y} r="3.5" fill="currentColor" />)}
    </svg>
  )
}

export function BarList({ items }: { items: Array<{ label: string; value: number; meta?: ReactNode }> }) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return <div className="bar-list">{items.map((item) => <div className="bar-row" key={item.label}><div className="bar-row-head"><span>{item.label}</span><strong>{item.meta ?? item.value}</strong></div><div className="bar-track"><span style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} /></div></div>)}</div>
}

export function Donut({ value, label, sublabel }: { value: number; label: string; sublabel?: string }) {
  const safe = Math.max(0, Math.min(100, value))
  return <div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(var(--primary) ${safe * 3.6}deg, var(--surface-3) 0deg)` }}><div><strong>{safe}%</strong><span>{label}</span></div></div>{sublabel && <p>{sublabel}</p>}</div>
}

export function DonutBreakdown({ items, centerLabel = '分布' }: { items: Array<{ label: string; value: number }>; centerLabel?: string }) {
  const total = Math.max(1, items.reduce((sum, item) => sum + item.value, 0))
  let cursor = 0
  const colors = ['var(--primary)', '#28a57a', '#f2a93b', '#ef6b79', '#5b8def', '#9b72df']
  const segments = items.map((item, index) => {
    const start = cursor
    cursor += (item.value / total) * 360
    return `${colors[index % colors.length]} ${start}deg ${cursor}deg`
  })
  return <div className="donut-breakdown"><div className="donut-breakdown-chart" style={{ background: `conic-gradient(${segments.join(',')})` }}><div><strong>{total}</strong><span>{centerLabel}</span></div></div><div className="chart-legend">{items.map((item, index) => <div key={item.label}><i style={{ background: colors[index % colors.length] }} /><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div>
}

export function GroupedBarChart({ items }: { items: Array<{ label: string; primary: number; secondary?: number; tertiary?: number }> }) {
  const max = Math.max(100, ...items.flatMap((item) => [item.primary, item.secondary || 0, item.tertiary || 0]))
  return <div className="grouped-bar-chart">{items.map((item) => <div className="grouped-bar-column" key={item.label}><div className="grouped-bar-bars"><span className="primary" style={{ height: `${(item.primary / max) * 100}%` }} title={`掌握度 ${item.primary}%`} />{item.secondary !== undefined && <span className="secondary" style={{ height: `${(item.secondary / max) * 100}%` }} title={`正确率 ${item.secondary}%`} />}{item.tertiary !== undefined && <span className="tertiary" style={{ height: `${(item.tertiary / max) * 100}%` }} title={`稳定度 ${item.tertiary}%`} />}</div><strong>{item.label}</strong></div>)}</div>
}

export function RadarChart({ items }: { items: Array<{ label: string; value: number }> }) {
  if (items.length < 3) return null
  const size = 280
  const center = size / 2
  const radius = 100
  const point = (index: number, value: number) => {
    const angle = (-Math.PI / 2) + (index * Math.PI * 2) / items.length
    const scale = Math.max(0, Math.min(100, value)) / 100
    return { x: center + Math.cos(angle) * radius * scale, y: center + Math.sin(angle) * radius * scale }
  }
  const grid = [25, 50, 75, 100].map((level) => items.map((_, index) => { const p = point(index, level); return `${p.x},${p.y}` }).join(' '))
  const values = items.map((item, index) => { const p = point(index, item.value); return `${p.x},${p.y}` }).join(' ')
  return <div className="radar-chart-wrap"><svg className="radar-chart" viewBox={`0 0 ${size} ${size}`} aria-label="能力雷达图">{grid.map((points, index) => <polygon key={index} points={points} className="radar-grid" />)}{items.map((_, index) => { const p = point(index, 100); return <line key={index} x1={center} y1={center} x2={p.x} y2={p.y} className="radar-axis" /> })}<polygon points={values} className="radar-area" />{items.map((item, index) => { const p = point(index, 112); return <text key={item.label} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle">{item.label}</text> })}</svg><div className="radar-value-list">{items.map((item) => <span key={item.label}>{item.label}<strong>{Math.round(item.value)}%</strong></span>)}</div></div>
}

export function ActivityHeatmap({ items }: { items: Array<{ date: string; completionRate: number; completedMinutes: number }> }) {
  return <div className="activity-heatmap">{items.map((item) => <div key={item.date} title={`${item.date}：完成 ${item.completionRate}%，${item.completedMinutes} 分钟`}><span style={{ opacity: Math.max(.15, item.completionRate / 100) }} /><small>{item.date.slice(5)}</small></div>)}</div>
}
