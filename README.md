# 知航 AI · 高中学习助手

> **当前 GitHub Pages 稳定部署版**：仓库已包含预构建的 `dist/`。GitHub Actions 不执行 `npm install`、`npm ci` 或前端构建，只校验并直接发布 `dist/`，用于规避 GitHub Runner 的 npm `Exit handler never called` 异常。


一个可直接部署到 GitHub Pages 的完整前端项目。当前版本使用模拟 AI、模拟 OCR 和浏览器 `localStorage`，无需服务器即可体验完整学习闭环；后续可在同一仓库中接入 Cloudflare Workers、D1、R2、正式 AI/OCR 和知识库。

## 1. 当前成品包含什么

### 页面目录

- 首页：今日学习安排、复习安排、每日小测、学习进度、薄弱知识点、常用入口
- 拍题讲解：图片上传、压缩预览、模拟 OCR、人工修改、分步提示、完整答案、错因分析、即时检测、保存闭环
- 试卷分析：多图上传、模拟拆题、逐题得分确认、失分知识点、主要错因、学习建议、错题自动入库
- 错题本：科目/错因筛选、掌握度、错误次数、复习到期、错题详情、四档复习反馈、归档和删除
- 闯关学习：单词、短语、语法、古诗词、文言文、公式、物理规律、化学方程式、生物概念
- 模拟训练：按薄弱点动态组卷，提交后同步错题本、画像和复习计划
- 每日计划：任务完成、预计时间、手动添加、近期计划、任务生成依据
- 每日小测：错题与薄弱点混合出题，提交后生成第二天加强任务
- 学习画像：科目/章节/知识点掌握度、正确率、错误次数、主要错因、遗忘风险、趋势和下一步建议
- 知识库：科目、年级、章节、知识点、年份、地区、题型和来源分类
- 学习报告：掌握趋势、计划完成、薄弱排行、错因分布、下周行动清单和文本导出
- 个人设置：学生档案、选科、各科教材版本、当前章节、学习强度、AI 偏好、主题、数据导入导出和重置

### 已完成的数据联动

```text
上传错题 / 试卷
        ↓
确认识别结果
        ↓
AI 分步骤讲解
        ↓
确认错误原因
        ↓
保存错题记录
        ↓
更新知识点掌握度与错误次数
        ↓
计算遗忘风险和下次复习日期
        ↓
生成每日复习任务
        ↓
完成同类题 / 模拟训练 / 每日小测
        ↓
再次更新错题本、学习画像和次日计划
```

所有核心页面读取同一份 `AppState`，不存在每个页面各自维护互不关联的演示数据。

## 2. 技术方案

- React 19
- Vite 8
- TypeScript 6
- React Router `HashRouter`
- Lucide React 图标
- 原生 CSS 设计系统与响应式布局
- localStorage 版本化数据存储
- GitHub Actions 自动部署 GitHub Pages

电脑端使用左侧目录；手机端使用 5 个核心底部入口和“更多”功能抽屉。

## 3. 立即运行

要求：Node.js 22 或兼容版本。

```bash
npm install
npm run dev
```

浏览器打开终端显示的本地地址。

交付前检查：

```bash
npm run lint
npm run typecheck
npm run build
npm run preview
```

## 4. 上传 GitHub 并部署 Pages

### 第一步：创建仓库

在 GitHub 新建一个仓库，例如：

```text
ai-high-school-assistant
```

不要选择自动生成 README、`.gitignore` 或 License，避免与本项目文件冲突。

### 第二步：上传项目

解压 ZIP，把项目根目录中的全部文件上传到仓库根目录。必须包括隐藏目录：

```text
.github/workflows/deploy-pages.yml
```

确认默认分支名称为 `main`。

### 第三步：启用 GitHub Pages

进入仓库：

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

推送到 `main` 后，工作流将自动执行：

```text
npm ci
→ npm run lint
→ npm run typecheck
→ npm run build
→ 上传 dist
→ 部署 GitHub Pages
```

### 第四步：查看部署地址

进入：

```text
Actions → Deploy AI Learning Assistant to GitHub Pages
```

部署成功后，访问地址通常为：

```text
https://你的用户名.github.io/仓库名/
```

如果仓库名称本身是 `你的用户名.github.io`，地址为：

```text
https://你的用户名.github.io/
```

### 为什么不需要手动修改 Vite base

`vite.config.ts` 会在 GitHub Actions 中读取：

```text
GITHUB_REPOSITORY=用户名/仓库名
```

并自动生成：

```text
/仓库名/
```

本地开发仍使用 `/`。因此更换仓库名称后也不需要手动修改配置。

### 为什么刷新子页面不会 404

项目固定使用 `HashRouter`，页面地址类似：

```text
https://用户名.github.io/仓库名/#/mistakes
```

`#` 后面的路由由浏览器前端处理，不需要 GitHub Pages 返回真实子目录，因此刷新不会出现子页面 404。

## 5. 项目目录

```text
.
├── .github/workflows/
│   └── deploy-pages.yml       # GitHub Pages 自动部署
├── public/
│   └── .nojekyll              # 禁用 Jekyll 处理
├── src/
│   ├── components/            # 布局、通用 UI、图表、答题器
│   ├── data/seed.ts           # 完整演示数据
│   ├── pages/                 # 独立功能页面
│   ├── services/
│   │   ├── apiClient.ts       # 统一请求、后端地址和错误处理
│   │   ├── learningApi.ts     # AI/OCR/知识库/同步接口总入口
│   │   └── mockApi.ts         # 当前模拟服务
│   ├── store/                 # localStorage 和跨页面业务联动
│   ├── utils/                 # 日期、图片压缩、学习调度规则
│   ├── types.ts               # 统一数据模型
│   ├── App.tsx                # 路由
│   └── main.tsx               # HashRouter 和 Store 入口
├── .env.example
├── vite.config.ts
└── README.md
```

## 6. 数据结构

核心实体包括：

- `StudentProfile`
- `QuestionRecord`
- `MistakeRecord`
- `PaperRecord`
- `KnowledgePoint`
- `ReviewTask`
- `DailyPlan`
- `QuizRecord`
- `StudyCard`
- `KnowledgeItem`
- `ActivityLog`

题目来源强制使用：

- `user_upload`：用户上传
- `real_exam`：合法公开真题
- `ai_generated`：AI 生成
- `demo`：系统演示

页面中会使用明显标签区分来源。

## 7. 当前复习调度规则

当前前端使用可解释的轻量间隔复习规则：

| 学习反馈 | 掌握度变化 | 基础复习间隔 |
|---|---:|---:|
| 没掌握 | -15 | 1 天 |
| 有点模糊 | -5 | 2 天 |
| 掌握了 | +8 | 3–7 天 |
| 很熟练 | +14 | 7–14 天 |

遗忘风险综合考虑：

```text
当前掌握度 + 距上次复习时间 + 历史错误次数
```

正式版可替换为 FSRS，但应由后端统一保存复习记录和算法参数。

## 8. 接入 Cloudflare 和正式后端

复制环境变量文件：

```bash
cp .env.example .env.local
```

正式接口配置示例：

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=https://your-api.workers.dev
```

页面只调用 `src/services/learningApi.ts`，不直接写接口地址和密钥。

### 已预留的接口

```text
POST /api/ocr/question
POST /api/ocr/paper
POST /api/ai/explain
POST /api/ai/simulation
GET  /api/knowledge
POST /api/sync/snapshot
```

### 推荐 Cloudflare 结构

```text
GitHub Pages
   │
   └── HTTPS
        ↓
Cloudflare Workers API
   ├── AI Gateway / 模型服务
   ├── OCR 服务
   ├── D1：学生、错题、画像、计划、复习记录
   ├── R2：题目图片、试卷图片和资料文件
   ├── Vectorize：知识库向量检索
   └── KV：短期缓存和配置
```

密钥必须保存在 Cloudflare Worker 的 Secrets 中，不能放入前端环境变量。所有写入接口需要增加用户身份认证、权限校验、限流、日志和内容安全检查。

## 9. localStorage 限制

当前版本适合前端体验和产品验证，但不适合长期保存大量试卷图片：

- 浏览器本地容量有限
- 换浏览器或清理网站数据会丢失
- 无法自动跨设备同步
- GitHub Pages 是静态托管，不能安全保存密钥

设置页面提供 JSON 导出和导入，正式版应迁移至云端数据库和对象存储。

## 10. 开源项目与设计参考

本项目代码为独立实现，没有直接复制第三方项目源代码。主要参考：

- Vite 官方 GitHub Pages 静态部署方式
- React Router `HashRouter` 的静态站点路由思路
- `shadcn-ui/ui` 的开放式组件、可访问性和视觉层级理念
- `open-spaced-repetition/ts-fsrs` 的间隔复习工程化思路
- `PapillonApp/Papillon` 的学生端信息架构和移动导航思路

注意：Papillon 使用 GPL 许可证，本项目只研究其产品与导航思路，没有复制其代码。

## 11. 当前验收状态

项目打包前已经执行：

```text
npm run lint      → 0 warnings / 0 errors
npm run typecheck → 通过
npm run build     → 通过
```

GitHub Pages 构建时会再次执行上述检查，任何一步失败都不会发布错误版本。
