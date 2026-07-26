import { RefreshCw, UserRound } from 'lucide-react'
import { Badge, Button, Callout, Card, EmptyState, PageHeader, SectionTitle } from '../../components/ui'
import { useParentData } from '../../parent/useParentData'

export function ParentSettingsPage() {
  const { children, loading, error, refresh } = useParentData()
  const child = children[0]

  return (
    <div>
      <PageHeader
        eyebrow="家庭设置"
        title="设置"
        description="学习账号已由系统自动关联，不需要绑定码。"
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            刷新
          </Button>
        }
      />

      <Card>
        <SectionTitle
          title="学习档案"
          action={<Badge tone={child ? 'success' : 'info'}>{child ? '已连接' : '连接中'}</Badge>}
        />

        {child ? (
          <div className="linked-child-list">
            <div>
              <div className="linked-child-avatar">
                <UserRound size={20} />
              </div>
              <div>
                <strong>{child.displayName}</strong>
                <small>
                  {child.email}
                  {'｜'}
                  最近同步：
                  {child.lastSyncedAt
                    ? new Date(child.lastSyncedAt).toLocaleString('zh-CN')
                    : '等待首次同步'}
                </small>
              </div>
            </div>
          </div>
        ) : loading ? (
          <EmptyState title="正在连接学习档案" description="通常几秒内完成，无需输入任何验证码。" />
        ) : (
          <EmptyState title="暂未找到学习档案" description="请确认 Render 已配置 FAMILY_STUDENT_EMAIL。" />
        )}

        {error && (
          <Callout tone="danger" title="同步失败">
            {error}
          </Callout>
        )}
      </Card>
    </div>
  )
}
