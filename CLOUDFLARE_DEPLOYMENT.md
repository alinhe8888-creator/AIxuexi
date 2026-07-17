# Cloudflare Pages 双前端部署（v1.4.0）

本仓库构建两个完全隔离的前端站点。两端共享同一个 Render API 和 PostgreSQL 数据库，但互不暴露页面和导航。

```text
学生端 Cloudflare Pages        家长端 Cloudflare Pages
├─ 学生登录/注册               ├─ 家长登录/注册
├─ 11 个学习页面               ├─ 5 个家长观察页面
└─ 生成家长绑定码              └─ 绑定后只读学生汇总
             \                 /
              └── Render API ──┘
```

## 1. 学生端项目

建议沿用现有项目：`aixuexi-29x`。

```text
Production branch: main
Root directory: /
Framework preset: Vite
Build command: npm ci && npm run build:student
Build output directory: dist-student
```

生产环境变量：

```env
VITE_API_BASE_URL=https://aixuexi-api.onrender.com
VITE_USE_MOCK_API=false
VITE_ALLOW_API_FALLBACK=true
```

不要手动设置 `VITE_PORTAL_ROLE`。`npm run build:student` 会从 `.env.student` 自动选择学生入口。

## 2. 家长端项目

新建或更新独立 Pages 项目，例如：`aixuexi-parent`。

```text
Production branch: main
Root directory: /
Framework preset: Vite
Build command: npm ci && npm run build:parent
Build output directory: dist-parent
```

生产环境变量与学生端相同：

```env
VITE_API_BASE_URL=https://aixuexi-api.onrender.com
VITE_USE_MOCK_API=false
VITE_ALLOW_API_FALLBACK=true
```

不要手动设置 `VITE_PORTAL_ROLE`。`npm run build:parent` 会从 `.env.parent` 自动选择家长入口。

## 3. Render CORS

Render 使用的变量名是 **`CORS_ORIGIN`**（不是 `CORS_ORIGINS`）。必须包含学生端、家长端以及所有正式自定义域名，使用英文逗号分隔：

```env
CORS_ORIGIN=https://aixuexi-29x.pages.dev,https://aixuexi-parent.pages.dev
```

更换 Pages 项目地址或绑定自定义域名后，需要同步更新该变量并重新部署 Render。

## 4. SPA 路由与缓存

`public/_redirects` 会被复制到两个构建目录：

```text
/* /index.html 200
```

它保证直接访问或刷新 `/paper-analysis`、`/reports` 等前端路由时仍返回 SPA 入口。

`public/_headers` 对 `index.html` 使用禁止缓存规则，防止 Cloudflare 持续返回旧入口文件。JS/CSS 哈希资源可以长期缓存。

## 5. 发布后必须验收

```text
学生端
├─ 依次点击 11 个导航，全部立即显示
├─ 不允许手动刷新后才显示
├─ Console 无红色异常
├─ Network 不出现业务接口 404
└─ 不出现家长端登录、注册、菜单或文案

家长端
├─ 独立域名打开
├─ 只能注册/登录家长账号
├─ 5 个导航全部立即显示
├─ 未绑定时显示空状态
└─ 绑定后读取学生汇总

后端
├─ /api/health 返回 ok: true
├─ /api/ocr/question 与 /api/ocr/paper 不再 404
├─ /api/ai/explain 与 /api/ai/simulation 不再 404
├─ 学生访问 /api/parent/* 返回 403
└─ 未绑定家长访问学生数据返回 404
```
