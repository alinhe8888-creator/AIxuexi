import { useNavigate } from 'react-router-dom'

export function HomePage() {
  const navigate = useNavigate()

  return (
    <main className="clean-home private-clean-home">
      <section className="upload-home-card private-home-card" aria-labelledby="upload-home-title">
        <h1 id="upload-home-title">开始学习</h1>
        <div className="upload-home-card__choices" aria-label="选择内容">
          <button type="button" className="upload-choice upload-choice--question" onClick={() => navigate('/photo-explain')}>
            <span className="upload-choice__icon" aria-hidden="true">📷</span>
            <span className="upload-choice__copy"><strong>拍一道题</strong><small>拍照或上传图片</small></span>
            <span className="upload-choice__arrow" aria-hidden="true">→</span>
          </button>
          <button type="button" className="upload-choice upload-choice--paper" onClick={() => navigate('/paper-analysis')}>
            <span className="upload-choice__icon" aria-hidden="true">📝</span>
            <span className="upload-choice__copy"><strong>上传试卷</strong><small>整张试卷或多页图片</small></span>
            <span className="upload-choice__arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </main>
  )
}
