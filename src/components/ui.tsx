import { AlertCircle, CheckCircle2, ChevronRight, Inbox, LoaderCircle, X } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'; size?: 'sm' | 'md' | 'lg' }) {
  return <button className={`btn btn-${variant} btn-${size} ${className}`} {...props}>{children}</button>
}

export function Card({ children, className = '', interactive = false }: { children: ReactNode; className?: string; interactive?: boolean }) {
  return <section className={`card ${interactive ? 'card-interactive' : ''} ${className}`}>{children}</section>
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function ProgressBar({ value, label, compact = false }: { value: number; label?: string; compact?: boolean }) {
  const safe = Math.max(0, Math.min(100, value))
  return (
    <div className={`progress-wrap ${compact ? 'progress-compact' : ''}`}>
      {label && <div className="progress-label"><span>{label}</span><strong>{safe}%</strong></div>}
      <div className="progress-track"><span style={{ width: `${safe}%` }} /></div>
    </div>
  )
}

export function StatCard({ label, value, hint, icon, trend }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; trend?: { value: number; label: string } }) {
  return (
    <Card className="stat-card">
      <div className="stat-top">
        <div className="stat-icon">{icon}</div>
        {trend && <span className={`trend ${trend.value >= 0 ? 'up' : 'down'}`}>{trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}</span>}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </Card>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Inbox size={28} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function LoadingState({ text = '正在处理…' }: { text?: string }) {
  return <div className="loading-state"><LoaderCircle className="spin" size={22} /><span>{text}</span></div>
}

export function Callout({ title, children, tone = 'info' }: { title: string; children: ReactNode; tone?: 'info' | 'success' | 'warning' | 'danger' }) {
  return (
    <div className={`callout callout-${tone}`}>
      {tone === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
      <div><strong>{title}</strong><div>{children}</div></div>
    </div>
  )
}

export function SectionTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="section-title">
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {action}
    </div>
  )
}

export function IconLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return <button className="icon-link" onClick={onClick}>{children}<ChevronRight size={16} /></button>
}

export function Modal({ open, title, children, footer, onClose, size = 'md' }: { open: boolean; title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; size?: 'sm' | 'md' | 'lg' }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return <div className="segmented">{options.map((option) => <button key={option.value} className={value === option.value ? 'active' : ''} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>
}
