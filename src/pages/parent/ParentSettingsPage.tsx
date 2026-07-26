import { Link2, Users } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Callout, Card, EmptyState, PageHeader, SectionTitle } from '../../components/ui'
import { useParentData } from '../../parent/useParentData'

export function ParentSettingsPage() {
  const { children, linkChild } = useParentData()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const bind = async () => {
    setLoading(true)
    setMessage('')
    setError('')
    try {
      await linkChild(code)
      setCode('')
      setMessage('已连接，之后会自动同步。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="设置" title="学习数据" description="连接一次后，后续会自动同步。" />
      {children.length ? (
        <Card>
          <SectionTitle title="已连接" action={<Badge tone="success"><Users size={14} />{children.length}</Badge>} />
          <div className="linked-child-list">{children.map((child) => <div key={child.id}><div className="linked-child-avatar">{child.displayName.slice(0, 1)}</div><div><strong>{child.displayName}</strong><small>最近同步：{child.lastSyncedAt ? new Date(child.lastSyncedAt).toLocaleString('zh-CN') : '等待首次同步'}</small></div></div>)}</div>
        </Card>
      ) : (
        <Card>
          <SectionTitle title="首次连接" description="输入一次 6 位码即可，之后不需要重复操作。" />
          <div className="pair-code-form"><label>连接码<input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label><Button onClick={() => void bind()} disabled={loading || code.length !== 6}><Link2 size={17} />{loading ? '正在连接…' : '连接'}</Button></div>
          {message && <Callout tone="success" title="完成">{message}</Callout>}
          {error && <Callout tone="danger" title="失败">{error}</Callout>}
          {!message && !error && <EmptyState title="还没有学习数据" description="完成首次连接后会自动出现。" />}
        </Card>
      )}
    </div>
  )
}
