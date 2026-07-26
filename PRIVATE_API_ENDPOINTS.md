# 私人家庭版接口

所有学生接口均要求：

```http
Authorization: Bearer <student-token>
```

家庭查看接口要求 parent token；账号由 `FAMILY_STUDENT_EMAIL` 自动关联。

## 教材 ZIP 与知识库

### 检查配置

```http
GET /api/materials/status
```

返回 R2、Qwen、ZIP 大小和支持文件类型。

### 获取 R2 上传地址

```http
POST /api/materials/presign
Content-Type: application/json

{
  "fileName": "高中数学.zip",
  "size": 12345678,
  "contentType": "application/zip"
}
```

浏览器收到 `uploadUrl` 后直接 PUT 到 R2，避免大 ZIP 经过 Render。

### 创建解析任务

```http
POST /api/materials/imports
Content-Type: application/json

{
  "key": "users/.../materials/...zip",
  "fileName": "高中数学.zip",
  "subject": "数学",
  "grade": "高二",
  "textbookVersion": "人教版（A版）（人民教育出版社）"
}
```

### 查询、重试和删除

```http
GET    /api/materials/imports
GET    /api/materials/imports/:id
POST   /api/materials/imports/:id/retry
DELETE /api/materials/imports/:id
DELETE /api/materials
```

### 查询真实知识库

```http
GET /api/knowledge?subject=数学&grade=高二&keyword=函数
```

旧演示资料会在 V3 第一次访问资料接口时清空。

## Qwen 学习接口

### 拍题深度识别

```http
POST /api/ocr/question

{
  "subject": "数学",
  "imageDataUrl": "data:image/jpeg;base64,..."
}
```

图片先保存到家庭私有 R2，再由 Qwen 理解题干、公式、图表、章节与知识点。

### 整卷分析

```http
POST /api/ocr/paper

{
  "subject": "数学",
  "imageDataUrls": ["data:image/jpeg;base64,..."]
}
```

### 分步讲解

```http
POST /api/ai/explain

{
  "subject": "数学",
  "content": "题目正文",
  "correctAnswer": "可选参考答案"
}
```

### 针对性训练

```http
POST /api/ai/simulation

{
  "subject": "数学",
  "points": [{ "id": "kp-1", "name": "函数单调性" }],
  "count": 5
}
```

以上接口都会优先检索用户上传的教材知识。

## 学生数据分析

```http
GET  /api/ai/student-analysis
POST /api/ai/student-analysis
```

生成学习总结、优先薄弱点、根因、今日任务、7 天计划和家庭查看建议。

## 家庭自动关联

```http
POST /api/parent/link
GET  /api/parent/children
GET  /api/parent/children/:studentId/dashboard
```

不再使用绑定码，也不允许解除固定关联。
