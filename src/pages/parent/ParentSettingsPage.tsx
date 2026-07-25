import { Link2, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Callout, Card, EmptyState, SectionTitle } from '../../components/ui'
import { useParentData } from '../../parent/useParentData'
import { parentApi } from '../../services/parentApi'

export function ParentSettingsPage() {
  const { children, refresh, unlinkChild } = useParentData()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const bind = async () => {
    setLoading(true)
    setMessage('')
    setError('')
    try {
      await parentApi.linkChildByEmail(email.trim())
      await refresh()
      setEmail('')
      setMessage('已绑定。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '绑定失败')
    } finally { setLoading(false) }
  }

  return (
    <div className="family-page">
      <Card>
        <SectionTitle title="绑定孩子" />
        <div className="family-bind-form">
          <label>学生邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="学生登录邮箱" /></label>
          <Button onClick={() => void bind()} disabled={loading || !email.trim()}><Link2 size={17} />{loading ? '绑定中…' : '绑定'}</Button>
        </div>
        {message && <Callout tone="success" title="完成">{message}</Callout>}
        {error && <Callout tone="danger" title="失败">{error}</Callout>}
      </Card>
      <Card>
        <SectionTitle title="已绑定" action={<Badge tone="info"><Users size={14} />{children.length}</Badge>} />
        {children.length ? <div className="linked-child-list">{children.map((child) => <div key={child.id}><div className="linked-child-avatar">{child.displayName.slice(0, 1)}</div><div><strong>{child.displayName}</strong><small>{child.email}</small></div><Button variant="danger" size="sm" onClick={() => void unlinkChild(child.id)}><Trash2 size={15} />解除</Button></div>)}</div> : <EmptyState title="还没有绑定" description="输入孩子的学生账号邮箱即可。" />}
      </Card>
    </div>
  )
}
