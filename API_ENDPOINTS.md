# AIxuexi Render API v1.4.0

所有受保护接口均使用：

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

## 1. 健康检查与认证

| 方法 | 路径 | 权限 | 用途 |
|---|---|---|---|
| GET | `/api/health` | 公开 | Render、数据库、AI配置状态 |
| POST | `/api/auth/student/register` | 公开 | 学生注册 |
| POST | `/api/auth/student/login` | 公开 | 学生登录 |
| POST | `/api/auth/parent/register` | 公开 | 家长注册 |
| POST | `/api/auth/parent/login` | 公开 | 家长登录 |
| GET | `/api/auth/me` | 登录 | 获取当前账号与角色 |

## 2. 学生同步与数据

| 方法 | 路径 | 权限 | 用途 |
|---|---|---|---|
| GET | `/api/student/snapshot` | student | 读取完整学习快照 |
| PUT | `/api/student/snapshot` | student | 保存完整学习快照 |
| POST | `/api/sync/snapshot` | student | 快照同步兼容入口 |
| POST | `/api/student/pair-code` | student | 生成15分钟家长绑定码 |
| GET | `/api/reports/summary` | student | 获取阶段学习摘要 |

## 3. OCR、AI与知识库

| 方法 | 路径 | 权限 | 返回结构 |
|---|---|---|---|
| POST | `/api/ocr/question` | student | 单题文字、章节、知识点、答案、题型、置信度 |
| POST | `/api/ocr/paper` | student | `PaperQuestionAnalysis[]` |
| POST | `/api/ai/explain` | student | 知识点、思路、步骤、答案、易错点、例子、即时检测 |
| POST | `/api/ai/simulation` | student | `QuizQuestion[]` |
| GET | `/api/knowledge` | student | `KnowledgeItem[]`，支持科目、年级、章节、来源与关键词筛选 |

未配置 `AI_API_BASE_URL` 和 `AI_API_KEY` 时，上述接口不会返回404，而是返回结构完整、可人工核对的兜底结果。配置OpenAI兼容多模态模型后，接口自动调用真实模型。

## 4. 学习记录通用CRUD

允许的 `type`：

```text
questions
mistakes
papers
knowledge-points
review-tasks
daily-plans
quizzes
cards
activity-logs
profile
settings
```

| 方法 | 路径 |
|---|---|
| GET | `/api/student/records/:type` |
| POST | `/api/student/records/:type` |
| GET | `/api/student/records/:type/:id` |
| PUT | `/api/student/records/:type/:id` |
| DELETE | `/api/student/records/:type/:id` |

常用兼容入口：

```text
GET/POST /api/mistakes
GET/POST /api/papers
GET/POST /api/plans
GET/POST /api/quizzes
GET/POST /api/cards
GET/POST /api/profile
```

## 5. 家长绑定与只读数据

| 方法 | 路径 | 权限 | 用途 |
|---|---|---|---|
| POST | `/api/parent/link` | parent | 使用6位码绑定学生 |
| GET | `/api/parent/children` | parent | 查看已绑定学生列表 |
| GET | `/api/parent/children/:studentId/dashboard` | parent＋已绑定 | 读取学生汇总数据 |
| DELETE | `/api/parent/children/:studentId` | parent＋已绑定 | 解除绑定 |

学生Token访问 `/api/parent/*` 返回403；家长无法读取未绑定学生。

## 6. 统一错误格式

```json
{
  "message": "可读错误说明",
  "code": "NOT_FOUND"
}
```

每个响应包含 `x-request-id`，用于Render日志定位。

## 7. CORS 与请求追踪

Render 环境变量 `CORS_ORIGIN` 使用英文逗号分隔允许的前端来源。非允许来源返回：

```json
{
  "message": "CORS origin is not allowed: https://example.com",
  "code": "CORS_DENIED"
}
```

所有响应均返回 `x-request-id`。前端也会主动发送请求ID；在Render日志中可按该ID定位一次完整请求。
