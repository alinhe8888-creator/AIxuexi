import { Link2, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Callout, Card, EmptyState, PageHeader, SectionTitle } from '../../components/ui'
import { useParentData } from '../../parent/useParentData'

export function ParentSettingsPage() {
  const { children, linkChild, unlinkChild } = useParentData()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const bind = async () => {
    setLoading(true); setMessage(''); setError('')
    try { await linkChild(code); setCode(''); setMessage('绑定成功，学生学习数据同步后即可查看。') }
    catch (err) { setError(err instanceof Error ? err.message : '绑定失败') }
    finally { setLoading(false) }
  }

  return <div>
    <PageHeader eyebrow="账号与学生关联" title="绑定与设置" description="必须使用学生提供的一次性家庭查看码，不能仅凭邮箱查看学生数据。" />
    <div className="content-grid two-equal">
      <Card><SectionTitle title="绑定一个学生" description="绑定码有效期 15 分钟，使用后立即失效" /><div className="pair-code-form"><label>6 位绑定码<input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label><Button onClick={() => void bind()} disabled={loading || code.length !== 6}><Link2 size={17} />{loading ? '正在绑定…' : '确认绑定'}</Button></div>{message && <Callout tone="success" title="绑定成功">{message}</Callout>}{error && <Callout tone="danger" title="绑定失败">{error}</Callout>}</Card>
      <Card><SectionTitle title="权限说明" /><div className="permission-list"><div><Badge tone="success">学生学习系统</Badge><span>与本系统使用不同域名和独立登录，不包含任何监护人页面或链接。</span></div><div><Badge tone="primary">监护人系统</Badge><span>只能查看已绑定学生的汇总数据。</span></div><div><Badge tone="danger">后端</Badge><span>所有家长接口再次验证 parent 角色和绑定关系。</span></div></div></Card>
    </div>
    <Card><SectionTitle title="已绑定学生" action={<Badge tone="info"><Users size={14} />{children.length} 人</Badge>} />{children.length ? <div className="linked-child-list">{children.map((child) => <div key={child.id}><div className="linked-child-avatar">{child.displayName.slice(0, 1)}</div><div><strong>{child.displayName}</strong><small>{child.email}｜最近同步：{child.lastSyncedAt ? new Date(child.lastSyncedAt).toLocaleString('zh-CN') : '尚未同步'}</small></div><Button variant="danger" size="sm" onClick={() => void unlinkChild(child.id)}><Trash2 size={15} />解除绑定</Button></div>)}</div> : <EmptyState title="暂无已绑定学生" description="让学生生成一次性家庭查看码，然后在上方输入。" />}</Card>
  </div>
}
