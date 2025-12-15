# Project Context - AingDesk

## Purpose
AingDesk 是一个桌面 AI 助手应用，支持本地 AI 模型、API 模型、知识库 (RAG)、智能体、网络搜索和分享功能。基于 Electron + Vue 3 构建，提供跨平台桌面体验。

**主要目标：**
- 集成 Claude Code 功能以使用知识库对话内容作为编程提示
- 提供强大的 MCP (Model Context Protocol) 工具集成能力
- 实现可靠的 Windows 路径处理和文件操作
- 支持 Excel 工具和多种文档格式处理
- 建立稳定的 RAG (检索增强生成) 知识库系统

## Tech Stack

### 前端技术
- **框架：** Vue 3 + TypeScript + Vite
- **状态管理：** Pinia
- **样式：** UnoCSS
- **路由：** Vue Router
- **UI 组件：** 自定义组件库
- **构建工具：** Vite（热更新、TypeScript 编译）

### 后端技术
- **框架：** Electron + TypeScript（主进程）
- **核心框架：** ee-core（Electron 应用框架）
- **通信协议：**
  - HTTP REST API (http://127.0.0.1:7071)
  - SSE 流式传输（实时聊天）
  - IPC（Electron 进程间通信）

### 数据库与存储
- **向量数据库：** LanceDB（知识库 RAG，1024 维向量）
- **文件存储：** JSON 文件（聊天记录、配置、元数据）
- **内存缓存：** NodeCache（TTL: 360秒，语言设置、模型列表等）
- **聊天历史：** {data_path}/context/{uuid}/ 目录结构

### AI/ML 集成
- **OpenAI SDK：** API 模型调用
- **Ollama 客户端：** 本地模型支持
- **Tesseract.js：** OCR 图像文字识别
- **嵌入模型：** 向量化和相似度搜索

### 文档处理
- **PDF：** PDF.js
- **Office 文档：** JSZip、word-extractor、xlsx
- **HTML/Markdown：** 原生解析
- **图片：** 多种格式支持

### 构建与部署
- **构建系统：** ee-bin 编排工具
- **打包工具：** electron-builder
- **平台支持：** Windows、macOS、Linux
- **加密：** 生产环境代码加密

## Project Conventions

### 代码风格
- **TypeScript：** 严格模式，启用所有严格检查
- **Vue 3：** 组合式 API (`<script setup>`)
- **命名规范：**
  - 文件：kebab-case (例：`mcp-client.ts`)
  - 类：PascalCase (例：`MCPClient`)
  - 方法/变量：camelCase (例：`getAllAvailableTools`)
  - 常量：UPPER_SNAKE_CASE
- **代码格式：** Prettier + ESLint 自动格式化
- **注释：** JSDoc 风格，关键逻辑必须注释

### 架构模式

#### 1. MVC 模式
```
Controller (electron/controller/) → Service (electron/service/) → Class (electron/class/)
```
- **控制器：** 处理 IPC 请求，业务流程编排
- **服务：** 核心业务逻辑，数据操作
- **类：** 工具函数和共享功能

#### 2. RAG 数据管道
```
文档解析 → 文本分块 → 向量化 → 存储到 LanceDB → 检索 → 上下文注入 → 模型回答
```

#### 3. MCP 工具架构
```
MCP 客户端 (mcp_client.ts)
├── 连接管理器 (Sessions/Transports)
├── 工具调用器 (Tool Executor)
├── 参数规范化 (Args Normalization)
├── 错误处理器 (Error Handler)
└── 结果处理 (Result Processor)
```

#### 4. 前端架构
- **视图模式：** 每个视图包含 `controller/ + store/ + index.vue`
- **状态管理：** Pinia store，模块化设计
- **组件通信：** Props + Emits + Provide/Inject

### 数据存储规范

#### 存储位置
- **用户数据：** {user_data_path}/AppData/Roaming/AingDesk/
- **应用数据：** {data_path}/（可通过配置修改）
- **知识库：** {data_path}/rag/vector_db/
- **聊天记录：** {data_path}/context/{uuid}/

#### 文件结构
```
{context_id}/
├── config.json    # 对话配置（supplierName, model, rag_list, agent_name）
└── history.json   # 聊天历史（消息数组）
```

#### 消息格式
```typescript
{
  id: string,              // 消息ID
  role: 'user' | 'assistant', // 角色
  content: any,            // 消息内容（支持富文本）
  images: string[],        // Base64 图片
  doc_files: string[],     // 已处理文档
  tool_calls: string,      // 工具调用信息
  reasoning: any,          // AI 推理内容
  search_result: any[],    // 搜索结果
  tokens: number,          // Token 计数
  create_time: number      // Unix 时间戳
}
```

### API 设计规范

#### 通信方式
1. **HTTP REST API**（主要）
   - Content-Type: application/json
   - 后端端口：7071
   - CSRF 防护：X-Csrf-Token

2. **SSE 流式传输**（实时聊天）
   - Content-Type: text/event-stream;charset=utf-8
   - 实现打字机效果

3. **IPC 通信**（Electron 内部）
   - 桥接文件：`electron/preload/bridge.ts`
   - 最小权限原则

#### 响应格式
```typescript
{
  status: number;    // 0:成功, -1:失败
  code: number;      // HTTP 状态码
  msg: string;       // 消息
  error_msg: string; // 错误详情
  message: any;      // 响应数据
}
```

## Testing Strategy

### 测试框架
- **主框架：** vitest（轻量级、现代）
- **测试文件示例：** `electron/rag/doc_engins/doc.test.ts`
- **Mock：** vi.mocked, vi.fn()

### 测试类型
1. **单元测试**
   - 文档解析器 (`doc_engins/`)
   - 向量数据库操作
   - 工具函数和类方法

2. **集成测试**
   - MCP 客户端工具调用
   - RAG 检索流程
   - API 端到端测试

3. **手动测试**
   - 前端界面交互
   - 跨平台兼容性
   - 端到端用户流程

### 测试标准
- 核心业务逻辑必须有测试覆盖
- 新功能必须包含测试
- 回归测试：关键功能自动化验证

## Git Workflow

### 分支策略
- **主分支：** main（生产就绪）
- **开发分支：** develop（集成分支）
- **功能分支：** feature/*（单一功能开发）
- **修复分支：** fix/*（缺陷修复）
- **发布分支：** release/*（版本发布）

### 提交规范
- **格式：** `<type>(<scope>): <subject>`
- **类型：** feat, fix, docs, style, refactor, test, chore
- **示例：** `feat(mcp): add Excel tool path sanitization`

### 代码审查
- 所有合并必须经过 Pull Request
- 至少 1 人审查
- 自动化检查：ESLint、TypeScript 编译、测试

### 关键文件
- **不可直接编辑：** `public/electron/*.js`（编译输出）
- **编辑源文件：** `electron/*.ts`（TypeScript 源）
- **构建流程：** `cmd/bin.js`（ee-bin 配置）

## Domain Context

### 桌面 AI 助手
- **用户群体：** 开发者、数据分析师、知识工作者
- **核心价值：** 本地化、私密性、可定制
- **使用场景：** 代码辅助、数据分析、知识问答、文档处理

### RAG (检索增强生成) 系统
- **文档支持：** PDF、DOCX、HTML、MD、TXT、XLS、PPT、CSV、图片
- **处理流程：** Parse → Chunk → Embed → Vector DB → Search → Inject
- **向量数据库：** LanceDB，维度 1024，表结构 `doc_table`
- **相似度搜索：** 余弦相似度，自动重排序

### MCP (模型上下文协议)
- **功能：** 统一工具调用接口，支持本地和远程工具
- **传输类型：** stdio（本地进程）、SSE（HTTP）
- **核心特性：**
  - Windows 路径标准化和清洗
  - Excel 工具智能参数映射
  - 多层错误处理和回退机制
  - 工具结果统一格式化
  - 自动工作表名检测和回退

### Excel 工具集成
- **支持操作：** 读取、写入、追加、单元格渲染
- **智能特性：**
  - 自动检测工作表名
  - 错误时回退到 Sheet1
  - Markdown 表格格式化
  - 路径自动补全

### FileSystem 工具
- **支持操作：** 读取、写入、追加、文件管理
- **Windows 优化：**
  - 路径清洗：统一反斜杠、去除引号
  - 绝对路径兜底机制
  - 伪协议处理 (excel://, file:// 等)
  - 目录自动检测和文件名候选提取

### 流式通信
- **SSE 实现：** 实时推送聊天内容
- **处理流程：** 模型生成 → 流式传输 → 前端渲染
- **控制特性：** 支持停止生成、消息再生

## Important Constraints

### 平台约束
- **Windows：** 路径处理特殊需求（反斜杠、盘符）
- **macOS：** 构建前需移除 `@rollup/rollup-win32-x64-msvc`
- **Linux：** 测试覆盖有限，主要针对 Debian 系

### 技术约束
- **Electron 版本：** 受 ee-core 框架限制
- **Node.js：** 必须支持原生模块（sqlite, lancedb）
- **内存：** 向量数据库占用内存，谨慎管理
- **磁盘：** 知识库文件累积增长，定期清理

### 安全约束
- **本地应用：** 无 JWT 认证，纯本地运行
- **隐私优先：** 数据不离开本地机器
- **CSRF 防护：** 简单 Token 验证
- **文件访问：** 受操作系统权限控制

### 性能约束
- **上下文长度：** 自动截断 50% 防止溢出
- **消息存储：** 原子性写入，避免损坏
- **缓存策略：** 360 秒 TTL，防止内存泄漏
- **并发限制：** 串行处理工具调用，避免竞争

### 兼容性约束
- **API 版本：** 向后兼容至少 2 个小版本
- **数据库迁移：** 自动升级机制
- **配置文件：** 版本间自动迁移
- **MCP 工具：** 兼容多种服务器实现

## External Dependencies

### MCP 服务器
- **FileSystem MCP：** 本地文件读写操作
- **Excel MCP Server：** Excel 文件处理
- **Claude Code：** 编程辅助工具（待集成）
- **自定义 MCP：** 根据需求可扩展

### AI 模型提供商
- **OpenAI：** GPT-4, GPT-3.5-turbo
- **Ollama：** 本地模型（qwen2.5, llama2, codellama 等）
- **自定义 API：** 兼容 OpenAI 格式的本地服务

### 搜索服务提供商
- **国内：** 百度搜索、搜狗搜索、360 搜索
- **国际：** DuckDuckGo
- **API 限制：** 免费版有请求频率限制

### 构建和开发工具
- **ee-bin：** 构建编排工具（私有）
- **electron-builder：** 应用打包
- **Yarn：** 包管理（推荐）
- **TypeScript：** 类型系统

### 核心库依赖
- **@modelcontextprotocol/sdk：** MCP 协议实现
- **openai：** OpenAI API 客户端
- **lancedb：** 向量数据库
- **vue：** 前端框架
- **pinia：** 状态管理

### 文档处理库
- **pdfjs-dist：** PDF 解析
- **jszip：** ZIP 压缩包
- **word-extractor：** Word 文档
- **xlsx：** Excel 文件
- **tesseract.js：** OCR 识别

### 系统要求
- **Node.js：** >= 16.0.0
- **操作系统：** Windows 10+, macOS 10.14+, Ubuntu 18.04+
- **内存：** 推荐 8GB+（RAG 向量计算）
- **存储：** 至少 2GB 可用空间
