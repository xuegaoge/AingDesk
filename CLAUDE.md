# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码库中工作提供指导。

## 项目概述

AingDesk 是一个桌面 AI 助手应用，支持本地 AI 模型、API 模型、知识库（RAG）、智能体、网络搜索和分享功能。基于 Electron + Vue 3 构建，提供跨平台桌面体验。

**技术栈：**
- 前端：Vue 3 + TypeScript + Vite + Pinia + UnoCSS
- 后端：Electron + TypeScript（主进程）
- 数据库：LanceDB（向量数据库，用于 RAG）
- 构建系统：ee-bin 编排工具
- AI/ML：OpenAI SDK、Ollama 客户端、Tesseract.js（OCR）
- 文档处理：PDF.js、JSZip、word-extractor、xlsx

## 开发命令

### 环境设置
```bash
# 安装依赖
cd frontend && yarn  # 前端依赖
cd .. && yarn        # 根依赖

# macOS 用户：需从 package.json 中移除 '@rollup/rollup-win32-x64-msvc'
```

### 开发模式
```bash
yarn dev              # 完整开发模式（前端 + electron）
yarn dev-frontend     # 仅运行前端
yarn dev-electron     # 仅运行 electron
yarn debug-dev        # 调试模式（详细日志）
yarn debug-electron   # 调试 electron
```

### 构建
```bash
yarn build            # 构建所有组件
yarn build-frontend   # 仅构建前端
yarn build-electron   # 仅构建 electron
yarn build-go-w/m/l   # 构建 Go 应用（Windows/Mac/Linux）
yarn build-python     # 构建 Python 后端

# 平台特定构建
yarn build-w          # Windows 安装包
yarn build-m          # Mac 安装包
yarn build-l          # Linux 安装包
yarn build-m-arm64    # Mac ARM64
```

### 其他命令
```bash
yarn clean            # 清理构建产物
yarn start            # 启动生产构建
yarn re-sqlite        # 重新构建 sqlite（原生模块）
yarn icon             # 生成应用图标
```

## 项目结构

### 前端结构
```
frontend/src/
├── api/              # API 客户端函数
├── lang/             # 国际化语言包
├── router/           # Vue Router 配置
├── stores/           # Pinia 状态管理
├── views/            # Vue 组件（MVC 模式）
│   ├── ChatContent/  # 聊天界面
│   ├── KnowleadgeStore/ # 知识库管理
│   └── ...
└── ...
```

### Electron 后端结构
```
electron/
├── controller/       # 请求处理器（MVC 控制器）
│   ├── chat.ts       # 聊天管理
│   ├── rag.ts        # RAG 操作
│   ├── agent.ts      # 智能体操作
│   └── ...
├── service/          # 业务逻辑服务
│   ├── chat.ts       # 聊天服务
│   ├── mcp_client.ts # MCP 客户端
│   └── ...
├── rag/              # RAG 系统
│   ├── doc_engins/   # 文档解析器
│   ├── vector_database/ # 向量数据库（LanceDB）
│   └── rag_task.ts   # RAG 后台任务
└── model_engines/    # AI 模型集成
```

## 架构概览

### MVC 模式
- **控制器** (`electron/controller/`): HTTP 请求处理器
- **服务** (`electron/service/`): 业务逻辑
- **类** (`electron/class/`): 工具函数

### 核心系统
- **RAG**: 文档解析器 → LanceDB 向量搜索
- **Models**: OpenAI/Ollama + 本地 API
- **Agents**: 自定义 AI 角色
- **MCP**: 模型上下文协议（工具集成）

### 前端架构
- Vue 3 组合式 API
- Pinia 状态管理
- 每个视图: controller/ + store/ + index.vue 模式

## 数据存储架构

### 存储设计
**混合存储架构：**
- **LanceDB** - 向量数据库（知识库 RAG）
  - 路径: {data_path}/rag/vector_db/
  - 表结构: doc_table
  - 向量维度: 1024
  
- **JSON 文件** - 聊天记录、配置、元数据
  - 聊天历史: {data_path}/context/{uuid}/ (JSON 文件)
  - 知识库: LanceDB ({data_path}/rag/vector_db/)
  - 配置: {data_path}/{agent,models,rag}/ (JSON)
  
- **内存缓存** - NodeCache 提升性能
  - 缓存内容: 语言设置、模型列表、配置、嵌入模型映射
  - 标准 TTL: 360秒（6小时）

### 聊天数据存储格式
```
存储位置: {data_path}/context/{uuid}/
├── config.json    # 对话配置
└── history.json   # 聊天历史
```

**config.json 结构：**
```json
{
  "supplierName": "ollama",
  "model": "qwen2.5:latest",
  "title": "对话标题",
  "context_id": "uuid",
  "create_time": 1234567890,
  "rag_list": ["知识库1", "知识库2"],
  "agent_name": "智能体名称"
}
```

**history.json 消息结构（ChatHistory）：**
```typescript
{
  id: string,              // 唯一消息ID
  role: string,            // "user" 或 "assistant"
  content: any,            // 消息内容（支持富文本）
  images: string[],        // Base64 编码图片
  doc_files: string[],     // 已处理文档内容
  tool_calls: string,      // 工具调用信息
  reasoning: any,          // AI 推理内容（<thinking>标签）
  search_result: any[],    // 网络搜索结果
  tokens: number,          // Token 计数
  create_time: number      // Unix 时间戳
}
```

**存储特点：**
- 每个对话一个 UUID 目录
- 原子性写入（逐条保存消息）
- 自动截断（根据模型上下文长度 50%）
- 支持消息再生（从指定 ID 重新生成）
- 支持多模态（文本、图片、文档）

## API 通信设计

### 通信方式
**三种通信模式：**

1. **HTTP REST API**（主要方式）
   - 后端端口: http://127.0.0.1:7071
   - 前端通过 VITE_BASE_URL 环境变量配置

2. **SSE 流式传输**（实时聊天）
   - 用于流式响应（打字机效果）
   - 格式: text/event-stream;charset=utf-8

3. **IPC**（Electron 进程间通信）
   - 桥接: electron/preload/bridge.ts
   - 最小权限原则

### 主要接口

**聊天接口（/chat/*）：**
```
GET  /chat/get_chat_list      # 获取对话列表
POST /chat/create_chat        # 创建新对话
GET  /chat/get_model_list     # 获取可用模型列表
POST /chat/chat               # 发送消息（SSE 流式传输）
GET  /chat/get_chat_info      # 获取对话历史
POST /chat/stop_generate      # 停止生成
```

**知识库接口（/rag/*）：**
```
GET  /rag/get_rag_list        # 获取知识库列表
POST /rag/create_rag          # 创建知识库
POST /rag/upload_doc          # 上传文档
POST /rag/search_document     # 搜索知识库
```

**其他接口：**
- /index/* - 系统配置（语言、数据路径）
- /agent/* - 智能体管理
- /mcp/* - MCP 工具管理
- /search/* - 网络搜索

### 请求/响应格式

**标准响应结构（ReturnMsg）：**
```typescript
{
    status: number;    // 0:成功, -1:失败
    code: number;      // HTTP 状态码
    msg: string;       // 消息
    error_msg: string; // 错误详情
    message: any;      // 响应数据
}
```

**SSE 流式响应：**
```
data: {"role":"assistant","content":"你好"}
data: {"role":"assistant","content":"我是 AI"}
data: null  // 结束标记
```

### 认证与状态管理

**无用户登录系统：**
- 无 JWT 令牌
- 无 OAuth 认证
- 纯本地桌面应用（隐私优先）
- 简单 CSRF 防护

**状态管理：**
- **前端**: Pinia（Vue 状态管理）
- **后端**: 文件持久化（JSON）
- **会话**: 基于 UUID 的对话管理

## 核心工作流程

### 完整流程：用户发消息到收到回复

```
用户输入 → 前端（Vue 3）→ HTTP → 控制器（chat.ts）→ 服务（tochat.ts）→ 模型 → SSE → 前端 → UI
                ↓                    ↓           ↓
           Pinia 状态管理        RAG/搜索   文件 I/O
```

**详细步骤：**

1. **用户输入** - 前端处理（Vue 3 + Pinia）
2. **HTTP 请求** - 发送到 /chat/chat
3. **控制器** - ChatController.chat() 接收并委派
4. **服务层** - ToChatService.chat() 处理
   - 加载对话上下文
   - 处理用户输入（图片、文档）
   - 构建聊天历史
5. **可选：RAG 检索** - Rag.searchAndSuggest()
6. **可选：网络搜索** - getPromptForWeb()
7. **可选：智能体注入** - 加载 agent 配置
8. **可选：MCP 工具** - 连接 MCP 服务器
9. **模型调用** - Ollama（本地）或 OpenAI 兼容（远程）
10. **SSE 流式响应** - 实时推送内容
11. **保存历史** - 写入 {context_id}/history.json
12. **用户看到回复**

### RAG 集成流程
```typescript
if (rag_list.length > 0) {
  const results = await Rag.searchAndSuggest({
    supplierName, model, user_content, ragList
  });
  // 注入到历史记录中
}
```

### 网络搜索集成
- **提供商**: baidu.ts, sogou.ts, so360.ts, duckduckgo.ts
- **流程**: 获取搜索结果 → 注入上下文 → 模型回答

### 智能体系统
- **配置**: data/agent/{agent_name}.json
- **注入**: history.unshift({role: 'system', content: prompt})

### MCP 工具集成
- **类型**: stdio（Node.js/Python）、sse（HTTP）
- **流程**: 连接服务器 → 工具调用 → 注入结果 → 继续生成

## 开发注意事项

### 构建流程
1. Vite 构建前端 → frontend/dist/
2. 移动到 public/dist/
3. 编译 TS → public/electron/
4. 生产环境加密

### 关键规则
- **编辑源文件**: 始终编辑 electron/ 中的 TypeScript（不是 public/electron/ 中的 JS）
- **开发端口**: Frontend 5173, Backend 7071
- **环境变量**: VITE_BASE_URL 必须指向后端
- **使用 Yarn**: 推荐 Yarn（不是 npm）

### 平台说明
- **macOS**: 构建前移除 @rollup/rollup-win32-x64-msvc
- **Windows**: build-w（安装包）、build-we（便携版）
- **Linux**: build-l（deb 包）

### 测试
- 测试文件: electron/rag/doc_engins/doc.test.ts
- 框架: vitest

### 调试与日志
- 优先使用 sourcemap 调试 TS 源文件
- Claude Code 调试日志（Windows）: C:\Users\Administrator\.claude\debug

## 常见开发模式

1. **控制器-服务模式**: IPC → Controller → Service → Data
2. **文档管道**: Parse → Chunk → Embed → Vector DB
3. **模型抽象**: AI 提供商的供应商模式
4. **RAG 集成**: Search → Context → Prompt injection
5. **Vue 视图**: controller/ + store/ + index.vue

## 重要文件

- `electron/main.ts` - Electron 主进程入口
- `frontend/src/main.ts` - Vue 应用入口
- `cmd/bin.js` - 构建编排配置
- `electron/controller/chat.ts` - 聊天 API 控制器
- `electron/service/chat.ts` - 聊天业务逻辑
- `electron/service/tochat.ts` - 聊天处理服务（核心流程）
- `electron/rag/rag.ts` - RAG 服务
- `electron/controller/rag.ts` - RAG API 控制器
- `electron/service/mcp_client.ts` - MCP 客户端
