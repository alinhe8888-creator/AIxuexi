import { Download, Moon, RefreshCw, Save, Settings, Sun, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Badge, Button, Callout, Card, Modal, PageHeader, SectionTitle } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import type { AppSettings, StudentProfile, Subject } from '../types'

const allSubjects: Subject[] = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']
const textbookOptions: Partial<Record<Subject, string[]>> = {
  语文: ['人教版', '苏教版', '粤教版'], 数学: ['人教 A 版', '人教 B 版', '北师大版'], 英语: ['人教版', '外研版', '译林版'], 物理: ['人教版', '鲁科版', '粤教版'], 化学: ['人教版', '鲁科版', '苏教版'], 生物: ['人教版', '苏教版', '浙科版'], 历史: ['统编版'], 地理: ['人教版', '湘教版', '鲁教版'], 政治: ['统编版'],
}

export function SettingsPage() {
  const { state, updateProfile, updateSettings, exportData, importData, resetData, notify } = useAppStore()
  const [profile, setProfile] = useState<StudentProfile>({ ...state.profile })
  const [settings, setSettings] = useState<AppSettings>({ ...state.settings })
  const [resetOpen, setResetOpen] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const toggleSubject = (subject: Subject) => {
    setProfile((current) => ({ ...current, selectedSubjects: current.selectedSubjects.includes(subject) ? current.selectedSubjects.filter((item) => item !== subject) : [...current.selectedSubjects, subject] }))
  }

  const saveProfile = () => updateProfile(profile)
  const saveSettings = () => updateSettings(settings)

  const downloadData = () => {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ai-learning-data-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    notify('success', '学习数据已导出')
  }

  const readImport = async (file?: File) => {
    if (!file) return
    try {
      const text = await file.text()
      importData(text)
      setProfile({ ...JSON.parse(text).data?.profile ?? state.profile })
    } catch {
      // Store already surfaces the error toast.
    }
  }

  return (
    <div>
      <PageHeader eyebrow="学生档案与数据管理" title="个人设置" description="管理年级、选科、教材版本、学习强度、AI 讲解方式和本地数据。" actions={<Badge tone="success">数据仅保存在当前浏览器</Badge>} />

      <div className="settings-layout">
        <div className="stack">
          <Card>
            <SectionTitle title="学生基础档案" description="这些信息用于生成更贴合当前阶段的任务和讲解" />
            <div className="form-stack">
              <div className="form-row two"><label>学生昵称<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label>年级<select value={profile.grade} onChange={(event) => setProfile({ ...profile, grade: event.target.value as StudentProfile['grade'] })}><option>高一</option><option>高二</option><option>高三</option></select></label></div>
              <label>当前成绩区间<input value={profile.currentScoreRange} onChange={(event) => setProfile({ ...profile, currentScoreRange: event.target.value })} /></label>
              <label>每日可学习时间<div className="range-field"><input type="range" min="30" max="240" step="10" value={profile.dailyMinutes} onChange={(event) => setProfile({ ...profile, dailyMinutes: Number(event.target.value) })} /><strong>{profile.dailyMinutes} 分钟</strong></div></label>
              <label>当前学习诉求<textarea rows={3} value={profile.learningGoal} onChange={(event) => setProfile({ ...profile, learningGoal: event.target.value })} /></label>
              <Button onClick={saveProfile}><Save size={17} />保存基础档案</Button>
            </div>
          </Card>

          <Card>
            <SectionTitle title="选科与教材版本" description="教材版本按科目分别设置，不使用统一版本" />
            <div className="subject-toggle-grid">{allSubjects.map((subject) => <button key={subject} className={profile.selectedSubjects.includes(subject) ? 'active' : ''} onClick={() => toggleSubject(subject)}>{subject}</button>)}</div>
            <div className="textbook-grid">{profile.selectedSubjects.map((subject) => <div key={subject}><strong>{subject}</strong><label>教材版本<select value={profile.textbookVersions[subject] || textbookOptions[subject]?.[0] || '统编版'} onChange={(event) => setProfile({ ...profile, textbookVersions: { ...profile.textbookVersions, [subject]: event.target.value } })}>{(textbookOptions[subject] || ['统编版']).map((item) => <option key={item}>{item}</option>)}</select></label><label>当前章节<input value={profile.currentChapters[subject] || ''} onChange={(event) => setProfile({ ...profile, currentChapters: { ...profile.currentChapters, [subject]: event.target.value } })} placeholder="例如：函数与导数" /></label></div>)}</div>
            <Button onClick={saveProfile}><Save size={17} />保存科目设置</Button>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <SectionTitle title="AI 讲解偏好" />
            <div className="radio-card-group">{[
              { value: 'guided', title: '引导式', desc: '优先提示，不直接显示完整答案' },
              { value: 'balanced', title: '平衡式', desc: '提示与完整步骤保持平衡' },
              { value: 'direct', title: '直接式', desc: '更快展示完整解析，适合复盘' },
            ].map((item) => <button key={item.value} className={settings.aiMode === item.value ? 'active' : ''} onClick={() => setSettings({ ...settings, aiMode: item.value as AppSettings['aiMode'] })}><span /><div><strong>{item.title}</strong><p>{item.desc}</p></div></button>)}</div>
            <div className="setting-row"><div><strong>小测错题自动入错题本</strong><span>关闭后只更新画像，不新增错题记录</span></div><button className={`switch ${settings.autoAddMistakes ? 'on' : ''}`} onClick={() => setSettings({ ...settings, autoAddMistakes: !settings.autoAddMistakes })}><span /></button></div>
            <div className="setting-row"><div><strong>每日学习提醒</strong><span>静态网页无法后台推送，当前保存偏好供未来后端使用</span></div><button className={`switch ${settings.dailyReminder ? 'on' : ''}`} onClick={() => setSettings({ ...settings, dailyReminder: !settings.dailyReminder })}><span /></button></div>
            <label>提醒时间<input type="time" value={settings.reminderTime} onChange={(event) => setSettings({ ...settings, reminderTime: event.target.value })} /></label>
            <Button onClick={saveSettings}><Settings size={17} />保存偏好</Button>
          </Card>

          <Card>
            <SectionTitle title="界面主题" />
            <div className="theme-options"><button className={settings.theme === 'light' ? 'active' : ''} onClick={() => setSettings({ ...settings, theme: 'light' })}><Sun size={21} /><strong>浅色</strong></button><button className={settings.theme === 'dark' ? 'active' : ''} onClick={() => setSettings({ ...settings, theme: 'dark' })}><Moon size={21} /><strong>深色</strong></button><button className={settings.theme === 'system' ? 'active' : ''} onClick={() => setSettings({ ...settings, theme: 'system' })}><Settings size={21} /><strong>跟随系统</strong></button></div>
            <Button variant="secondary" onClick={saveSettings}>应用主题</Button>
          </Card>

          <Card>
            <SectionTitle title="本地数据管理" description="支持迁移浏览器、备份和恢复演示数据" />
            <div className="data-actions"><Button variant="secondary" onClick={downloadData}><Download size={17} />导出 JSON</Button><Button variant="secondary" onClick={() => importRef.current?.click()}><Upload size={17} />导入 JSON</Button><input ref={importRef} hidden type="file" accept="application/json" onChange={(event) => void readImport(event.target.files?.[0])} /><Button variant="danger" onClick={() => setResetOpen(true)}><RefreshCw size={17} />重置演示数据</Button></div>
            <Callout title="localStorage 容量说明">图片会经过压缩后存储。若长期上传大量试卷，浏览器本地容量可能不足，正式版应迁移到 Cloudflare R2 和数据库。</Callout>
          </Card>
        </div>
      </div>

      <Modal open={resetOpen} title="确认重置演示数据" onClose={() => setResetOpen(false)} footer={<><Button variant="secondary" onClick={() => setResetOpen(false)}>取消</Button><Button variant="danger" onClick={() => { resetData(); setProfile({ ...state.profile }); setResetOpen(false) }}>确认重置</Button></>}><p>这会清除当前浏览器中的学习记录，并恢复项目自带的完整演示数据。建议先导出备份。</p></Modal>
    </div>
  )
}
