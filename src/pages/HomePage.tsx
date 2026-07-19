import { useNavigate } from 'react-router-dom'

export function HomePage() {
  const navigate = useNavigate()

  return (
    <main className="clean-home">
      <div className="clean-home__orb clean-home__orb--one" aria-hidden="true" />
      <div className="clean-home__orb clean-home__orb--two" aria-hidden="true" />

      <section className="upload-home-card" aria-labelledby="upload-home-title">
        <div className="upload-home-card__mascot" aria-hidden="true">
          <span className="upload-home-card__mascot-face">✦</span>
          <span className="upload-home-card__spark upload-home-card__spark--one">✦</span>
          <span className="upload-home-card__spark upload-home-card__spark--two">✦</span>
        </div>

        <p className="upload-home-card__eyebrow">今天从一道题开始</p>
        <h1 id="upload-home-title">上传学习资料</h1>
        <p className="upload-home-card__description">
          选择一道不会的题，或者上传整张试卷。系统会识别内容、分步讲解，并把需要复习的部分整理好。
        </p>

        <div className="upload-home-card__choices" aria-label="选择上传类型">
          <button
            type="button"
            className="upload-choice upload-choice--question"
            onClick={() => navigate('/photo-explain')}
          >
            <span className="upload-choice__icon" aria-hidden="true">📷</span>
            <span className="upload-choice__copy">
              <strong>上传一道题</strong>
              <small>适合单题、作业截图和拍照讲解</small>
            </span>
            <span className="upload-choice__arrow" aria-hidden="true">→</span>
          </button>

          <button
            type="button"
            className="upload-choice upload-choice--paper"
            onClick={() => navigate('/paper-analysis')}
          >
            <span className="upload-choice__icon" aria-hidden="true">📝</span>
            <span className="upload-choice__copy">
              <strong>上传整张试卷</strong>
              <small>适合多页试卷、批量错题和整卷分析</small>
            </span>
            <span className="upload-choice__arrow" aria-hidden="true">→</span>
          </button>
        </div>

        <div className="upload-home-card__steps" aria-label="处理流程">
          <span><i aria-hidden="true">1</i>识别题目</span>
          <b aria-hidden="true">·</b>
          <span><i aria-hidden="true">2</i>分步讲解</span>
          <b aria-hidden="true">·</b>
          <span><i aria-hidden="true">3</i>安排复习</span>
        </div>
      </section>
    </main>
  )
}
