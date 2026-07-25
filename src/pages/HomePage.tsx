import { BarChart3, Camera, FileText, FolderUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const entries = [
  { path: '/photo-explain', label: '拍题', icon: Camera },
  { path: '/paper-analysis', label: '试卷', icon: FileText },
  { path: '/materials', label: '资料', icon: FolderUp },
  { path: '/reports', label: '分析', icon: BarChart3 },
]

export function HomePage() {
  const navigate = useNavigate()

  return (
    <main className="family-home" aria-label="学习入口">
      <div className="family-home__grid">
        {entries.map(({ path, label, icon: Icon }) => (
          <button key={path} type="button" className="family-home__entry" onClick={() => navigate(path)}>
            <Icon size={34} />
            <strong>{label}</strong>
          </button>
        ))}
      </div>
    </main>
  )
}
