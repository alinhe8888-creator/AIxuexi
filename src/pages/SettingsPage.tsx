import { Moon, RefreshCcw, Save, Settings, Sun } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Callout, Card, PageHeader, SectionTitle } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import type { AppSettings, StudentProfile, Subject } from '../types'
import {
  FIXED_SUBJECTS,
  FIXED_TEXTBOOK_VERSIONS,
  TEXTBOOK_CATALOG,
} from '../config/curriculum'

export function SettingsPage() {
  const { state, updateProfile, updateSettings, syncStatus, lastSyncedAt, syncError, syncNow, notify } = useAppStore()
  const initialProfile = useMemo<StudentProfile>(() => ({
    ...state.profile,
    selectedSubjects: [...FIXED_SUBJECTS] as Subject[],
    textbookVersions: {
      ...state.profile.textbookVersions,
      ...FIXED_TEXTBOOK_VERSIONS,
    },
  }), [state.profile])

  const [profile, setProfile] = useState<StudentProfile>(initialProfile)
  const [settings, setSettings] = useState<AppSettings>({ ...state.settings })

  useEffect(() => setProfile(initialProfile), [initialProfile])
  useEffect(() => setSettings({ ...state.settings }), [state.settings])

  const saveProfile = () => {
    updateProfile({
      ...profile,
      selectedSubjects: [...FIXED_SUBJECTS] as Subject[],
      textbookVersions: { ...FIXED_TEXTBOOK_VERSIONS },
      onboarded: Boolean(profile.grade),
    })
  }

  return (
    <div>
      <PageHeader
        eyebrow="学习设置"
        title="设置"
        description="管理年级、当前章节、学习时间和讲解方式。"
        actions={
          <>
            <Badge tone={syncStatus === 'error' ? 'danger' : syncStatus === 'synced' ? 'success' : 'warning'}>
              {syncStatus === 'error' ? '同步失败' : syncStatus === 'synced' ? '已同步' : syncStatus === 'loading' ? '同步中' : '等待同步'}
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              disabled={syncStatus === 'loading'}
              onClick={() => void syncNow()
                .then(() => notify('success', '学习数据已同步', '家长端刷新后即可看到最新数据。'))
                .catch((error) => notify('error', '同步失败', error instanceof Error ? error.message : '请稍后重试'))}
            >
              <RefreshCcw size={15} className={syncStatus === 'loading' ? 'spin' : ''} />
              立即同步
            </Button>
          </>
        }
      />

      {syncStatus === 'error' && (
        <Callout tone="danger" title="学习数据尚未同步到家长端">
          {syncError || '请检查网络和后端服务后重试。'}
        </Callout>
      )}
      {lastSyncedAt && syncStatus !== 'error' && (
        <p className="sync-timestamp">最近同步：{new Date(lastSyncedAt).toLocaleString('zh-CN')}</p>
      )}

      <div className="settings-layout">
        <div className="stack">
          <Card>
            <SectionTitle title="基础信息" />
            <div className="form-stack">
              <div className="form-row two">
                <label>
                  昵称
                  <input
                    value={profile.name}
                    onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                  />
                </label>
                <label>
                  年级
                  <select
                    value={profile.grade}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        grade: event.target.value as StudentProfile['grade'],
                      })
                    }
                  >
                    <option value="" disabled>请选择年级</option>
                    <option>高一</option>
                    <option>高二</option>
                    <option>高三</option>
                  </select>
                </label>
              </div>

              <label>
                当前成绩区间
                <input
                  value={profile.currentScoreRange}
                  onChange={(event) =>
                    setProfile({ ...profile, currentScoreRange: event.target.value })
                  }
                />
              </label>

              <label>
                每日学习时间
                <div className="range-field">
                  <input
                    type="range"
                    min="30"
                    max="240"
                    step="10"
                    value={profile.dailyMinutes}
                    onChange={(event) =>
                      setProfile({ ...profile, dailyMinutes: Number(event.target.value) })
                    }
                  />
                  <strong>{profile.dailyMinutes} 分钟</strong>
                </div>
              </label>

              <label>
                当前目标
                <textarea
                  rows={3}
                  value={profile.learningGoal}
                  onChange={(event) =>
                    setProfile({ ...profile, learningGoal: event.target.value })
                  }
                />
              </label>
            </div>
          </Card>

          <Card>
            <SectionTitle
              title="教材"
              description="版本已经固定，只需要维护当前学习章节。"
            />
            <div className="textbook-grid">
              {TEXTBOOK_CATALOG.map((item) => (
                <div key={item.subject}>
                  <strong>{item.displayName}</strong>
                  <label>
                    教材
                    <input value={item.version} disabled />
                  </label>
                  {item.requiredBooks.length > 0 && (
                    <small>{item.requiredBooks.join('、')}</small>
                  )}
                  <label>
                    当前章节
                    <input
                      value={profile.currentChapters[item.subject as Subject] || ''}
                      onChange={(event) =>
                        setProfile({
                          ...profile,
                          currentChapters: {
                            ...profile.currentChapters,
                            [item.subject]: event.target.value,
                          },
                        })
                      }
                      placeholder="填写正在学习的章节"
                    />
                  </label>
                </div>
              ))}
            </div>
            <Button onClick={saveProfile}>
              <Save size={17} />
              保存
            </Button>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <SectionTitle title="讲解方式" />
            <div className="radio-card-group">
              {[
                { value: 'guided', title: '引导式', desc: '先给提示，再逐步展开' },
                { value: 'balanced', title: '平衡式', desc: '提示和完整步骤兼顾' },
                { value: 'direct', title: '直接式', desc: '用于快速复盘' },
              ].map((item) => (
                <button type="button"
                  key={item.value}
                  className={settings.aiMode === item.value ? 'active' : ''}
                  onClick={() =>
                    setSettings({
                      ...settings,
                      aiMode: item.value as AppSettings['aiMode'],
                    })
                  }
                >
                  <span />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="setting-row">
              <div>
                <strong>错题自动保存</strong>
                <span>答错后立即进入错题本，不在训练页直接显示答案</span>
              </div>
              <button type="button"
                className={`switch ${settings.autoAddMistakes ? 'on' : ''}`}
                onClick={() =>
                  setSettings({
                    ...settings,
                    autoAddMistakes: !settings.autoAddMistakes,
                  })
                }
              >
                <span />
              </button>
            </div>

            <div className="setting-row">
              <div>
                <strong>自适应多讲法</strong>
                <span>不会时在启发、类比、图像、推导、步骤和反例之间自动切换</span>
              </div>
              <button type="button"
                className={`switch ${settings.adaptiveExplanation !== false ? 'on' : ''}`}
                onClick={() => setSettings({ ...settings, adaptiveExplanation: settings.adaptiveExplanation === false })}
              >
                <span />
              </button>
            </div>

            <div className="setting-row">
              <div>
                <strong>严格订正闭环</strong>
                <span>必须完成原题订正和迁移小测，才允许标记为已掌握</span>
              </div>
              <button type="button"
                className={`switch ${settings.strictCorrectionMode !== false ? 'on' : ''}`}
                onClick={() => setSettings({ ...settings, strictCorrectionMode: settings.strictCorrectionMode === false })}
              >
                <span />
              </button>
            </div>

            <div className="setting-row">
              <div>
                <strong>保存有效讲法</strong>
                <span>把真正帮助答对的讲解方式沉淀进学生画像，后续优先使用</span>
              </div>
              <button type="button"
                className={`switch ${settings.saveEffectiveMethods !== false ? 'on' : ''}`}
                onClick={() => setSettings({ ...settings, saveEffectiveMethods: settings.saveEffectiveMethods === false })}
              >
                <span />
              </button>
            </div>

            <label className="answer-reveal-setting">
              连续答错几次后允许显示答案
              <select
                value={settings.answerRevealAttempts || 2}
                onChange={(event) => setSettings({ ...settings, answerRevealAttempts: Number(event.target.value) })}
              >
                <option value={2}>2 次（推荐）</option>
                <option value={3}>3 次（更严格）</option>
              </select>
              <small>显示答案后仍需完成一道迁移题，避免“看懂了但不会做”。</small>
            </label>

            <Button onClick={() => updateSettings(settings)}>
              <Settings size={17} />
              保存偏好
            </Button>
          </Card>

          <Card>
            <SectionTitle title="主题" />
            <div className="theme-options">
              <button type="button"
                className={settings.theme === 'light' ? 'active' : ''}
                onClick={() => setSettings({ ...settings, theme: 'light' })}
              >
                <Sun size={21} />
                <strong>浅色</strong>
              </button>
              <button type="button"
                className={settings.theme === 'dark' ? 'active' : ''}
                onClick={() => setSettings({ ...settings, theme: 'dark' })}
              >
                <Moon size={21} />
                <strong>深色</strong>
              </button>
              <button type="button"
                className={settings.theme === 'system' ? 'active' : ''}
                onClick={() => setSettings({ ...settings, theme: 'system' })}
              >
                <Settings size={21} />
                <strong>跟随系统</strong>
              </button>
            </div>
            <Button variant="secondary" onClick={() => updateSettings(settings)}>
              应用
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
