# 私人家庭版接口

学生接口要求：

```http
Authorization: Bearer <student-token>
```

家庭查看接口要求 parent token；账号由 `FAMILY_STUDENT_EMAIL` 自动关联。

## 教材 ZIP 与知识库

```http
GET    /api/materials/status
POST   /api/materials/presign
POST   /api/materials/imports
GET    /api/materials/imports
GET    /api/materials/imports/:id
POST   /api/materials/imports/:id/retry
DELETE /api/materials/imports/:id
DELETE /api/materials
GET    /api/knowledge?subject=数学&grade=高二&keyword=函数
```

大 ZIP 通过预签名地址直接上传 R2，避免文件经过 Render；创建解析任务时应提交 `key`、`fileName`、`subject`、`grade`、`textbookVersion`、`bookId` 和可选章节信息。

## 图片与试卷理解

```http
POST /api/ocr/question
POST /api/ocr/paper
```

图片先进入家庭私有 R2，再由视觉模型理解题干、公式、图表、章节和知识点。

## 自适应讲解

### 生成多种讲法

```http
POST /api/ai/explain
Content-Type: application/json

{
  "subject": "数学",
  "content": "题目正文",
  "correctAnswer": "参考答案",
  "studentAnswer": "学生第一次答案",
  "preferredStyles": ["启发提问", "图像框架"]
}
```

返回错因诊断、至少多种讲解方法、渐进提示、步骤、即时检测和答案开放次数。

### 判断重新作答或迁移题

```http
POST /api/ai/check-answer
Content-Type: application/json

{
  "subject": "数学",
  "content": "原题或迁移题",
  "correctAnswer": "参考答案",
  "studentAnswer": "学生答案",
  "attemptNumber": 2,
  "methodId": "method-1",
  "methodName": "画图定位关系",
  "methodStyle": "图像框架",
  "revealAllowed": true,
  "transfer": false
}
```

返回语义评分、错因、针对性提示和下一动作：`retry`、`switch_method`、`reveal` 或 `complete`。当 `revealAllowed=false` 时不得返回完整答案。

### 批量批改模拟训练

```http
POST /api/ai/grade-simulation
```

批量返回每题正确性、得分、反馈和错因；错误题由前端自动进入错题本，不在提交页直接显示完整答案。

### 生成训练

```http
POST /api/ai/simulation
```

支持专项小练、整套模拟卷和考前冲刺，并可带科目、书册、章节、知识点、题型、难度与题量。

## 学生数据分析

```http
GET  /api/ai/student-analysis
POST /api/ai/student-analysis
```

生成学习总结、优先薄弱点、根因、今日任务、阶段计划和家庭查看建议。

## 家庭自动关联

```http
POST /api/parent/link
GET  /api/parent/children
GET  /api/parent/children/:studentId/dashboard
```

固定家庭模式不使用绑定码，也不提供公开注册和解除关联。
