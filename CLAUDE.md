<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md（重构版）

此文件为 Claude Code（claude.ai/code）在本仓库工作时的权威指导，结合 Cherry Studio 实践与 AingDesk 工作空间约束，确保代理在本地与 MCP 环境下稳定运行与高质量改动。

## 0. 工作空间硬约束（必须遵守）

- 全局语言：所有思考过程与输出优先中文显示。
- 包管理器：统一使用 Yarn（不使用 npm）。
- 运行端口：
  - 前端开发：http://localhost:5173（重新运行前请关闭 5173 端口占用）
  - 后端开发：http://localhost:7071（重新运行前请关闭 7071 端口占用）
- 日志路径：
  - Claude Code 调试日志：`C:\Users\Administrator\.claude\debug`
  - AingDesk 应用日志：`C:\AingDesk\logs`
- 构建产物与源码：`public\electron\service` 为编译后产物，实际改动请在 `electron\service`（TS 源码）。禁止直接编辑构建产物。
- MCP 配置：当前实际运行的 MCP 配置文件为 `C:\Users\Administrator\AppData\Roaming\AingDesk\data\mcp-server.json`。

以上约束用于指导 Claude 的决策与工作流选择，任何偏离都必须记录理由并在 PR 中说明。

## 1. 项目总览与技术栈

AingDesk 是一个基于 Electron + Vite 的桌面 AI 应用，集成多模型、RAG、MCP 工具与工作流。与 Cherry Studio 同类场景下，本仓需兼容 MCP 的服务调用与 Claude Code 的技能（Skill）机制。

- 主进程：Electron + TypeScript（Node.js 22+）
- 渲染进程：Vue/React + TypeScript + Vite（当前前端运行端口 5173）
- 状态管理：按现有实现（Redux 或其他）保持一致
- UI 组件：遵循既有选择（本仓中 Vue/React 的 UI 方案）
- 构建系统：Electron-Vite
- 包管理器：Yarn 4.x / Yarn Workspaces（如有）

## 2. 运行与开发命令（Yarn 优先）

- 安装依赖：`yarn install`
- 前端开发：`yarn dev`（URL: http://localhost:5173）
- Electron 主进程开发：`yarn dev-electron`（URL: http://localhost:7071）
- 调试模式：`yarn debug`（开启远程调试端口 9222）
- 构建应用：`yarn build` / `yarn build-electron` / `yarn build-frontend`
- 质量检查：`yarn build:check`（提交前必须通过）
- 测试：`yarn test` / `yarn test:e2e`（Playwright）

注意：如需重启任一开发服务，先释放对应端口占用，避免端口冲突导致服务异常。

## 3. 目录与架构要点（AingDesk）

- 禁止直接改动 `public\electron\service` 中的编译后 JS 文件；应在 `electron\service`（TypeScript 源码）中实现。
- 主进程服务（示例）：`electron/service/*.ts`；前端入口：`frontend/src/main.ts`。
- IPC 桥接：`electron/preload/*`；日志集中：通过统一 Logger。
- MCP 控制器：`electron/controller/mcp.ts`；HTTP 接口：`electron/service/mcp.ts`、`electron/service/index.ts`。
- OpenSpec：遇到架构/规则/模糊需求，先查阅 `@/openspec/AGENTS.md` 并按规范提出变更草案。

## 4. Claude Code × MCP（工具与技能）约定

为兼容 Claude Code 的 Skill 机制与 AingDesk MCP 服务，代理在执行 Skill 相关工具调用时应遵循以下策略（同时指导本仓内实现与提示）：

- Skill 参数规范化：对 `Skill` 工具的 `tool_args` 中 `skill` 字段进行别名归一（如大小写、斜杠前缀等），避免因微小差异触发 `-32600` 或 Unknown Skill。
- `list`/`help` 拦截：当 `skill` 为空或为 `list`/`help`（大小写/斜杠不敏感），优先在本地拦截输出“可用技能清单（available_skills）”，避免直连服务报错。输出格式应为：技能名、简述、所在位置/入口（例如：pdf, xlsx, docx, git-pushing, video-downloader, canvas-design）。
- 错误中文降级：当工具返回 `Unknown skill` 或 `-32600`（无效请求）时，将错误降级为中文可读文本并给出下一步操作建议，而非直接抛异常。保持 push/text/raw 输出三通道一致的可读性。
- 结果渲染规范：工具结果包含 `available_skills` 时，转换为清单型中文文本（技能名/描述/位置），并在前端正确展示。
- 资源与文件：对于 DOCX 等“写前需读”的工具，遵循“自动读后写”桥接策略（先获取目标文件资源，再执行写入）。

上述规范用于指导 Claude 的自动决策与本仓实现保持一致性，减少用户看到协议不兼容的原始错误。

## 5. 日志与故障排除

- Claude Code 调试：`C:\Users\Administrator\.claude\debug`（优先查看最近日志定位 Skill/工具调用问题）。
- AingDesk 应用日志：`C:\AingDesk\logs`（ee-*.log / ee-error-*.log）。
- 常见问题与建议：
  - 端口占用：释放 5173/7071 后再启动对应服务。
  - 构建产物误改：若改动了 `public\electron\service`，请回滚并在 `electron\service` 修改，随后 `yarn build-electron`。
  - MCP 配置不生效：确认使用的是 `C:\Users\Administrator\AppData\Roaming\AingDesk\data\mcp-server.json`，并重启主进程使其生效。
  - Unknown Skill/-32600：按第 4 节的中文降级策略提示用户并引导到 `list`/`help` 拦截输出。

## 6. 开发规范（补充）

- 中文优先：思考与输出全部中文；英文仅作为引用链接或代码片段中必要部分。
- 不硬编码：能由模型决策与提示词解决的场景，优先写清“意图与边界”的系统/开发提示词。
- UI 组件与风格：统一 i18n；提交前运行 `yarn build:check`。
- 日志记录：统一 Logger，不使用 console.log；错误信息需带上下文并可定位。
- 代码搜索：优先使用 ast-grep；其后才是 rg/grep；避免全局正则替换引入回归。

## 7. 常见工作流（Claude 官方文档融合）

- 代码修复或功能实现：自然语言描述 → Claude 定位相关代码 → 提议改动 → 运行测试 → 迭代直至通过。
- 作为校验工具（linter/审查）：在脚本中加入 `claude -p 'custom prompt...'` 进行语义校验并产出统一格式报告。
- 技能开发（Skills）：
  - 个人技能：`~/.claude/skills/my-skill/SKILL.md`
  - 项目技能：`code .claude/skills/my-skill/SKILL.md`
  - 修改后需重启 Claude Code 以加载更新。

## 8. 外部参考与链接

- Claude Code 设置与工作流：
  - https://code.claude.com/docs/zh-CN/setup
  - https://code.claude.com/docs/zh-CN/quickstart
  - https://code.claude.com/docs/zh-CN/skills
  - https://code.claude.com/docs/zh-CN/common-workflows
  - https://code.claude.com/docs/zh-CN/network-config

## 9. 提交与版本

- 语义化提交；更新类型定义；附带测试用例；必要时更新 i18n 键。
- 构建发布：`yarn build:win/mac/linux`；开发构建 `yarn build:unpack`。

## 10. 重要提醒（再次强调）

- `public\electron\service` 是编译后生成的代码，不是实际的编译前代码；实际要修改的在 `electron\service`。
- MCP 当前配置文件：`C:\Users\Administrator\AppData\Roaming\AingDesk\data\mcp-server.json`。
- 所有运行服务与工具调用统一中文输出；Yarn 优先；日志路径如第 5 节。

（完）
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

## 11. 任务状态检查与重试 (check_status.js)

为方便排查知识库解析任务状态及处理失败任务，项目中提供了 `check_status.js` 脚本工具。此工具独立运行，不依赖 Electron 环境，直接操作 LanceDB。

### 使用方法

确保在项目根目录运行：

```bash
# 1. 查看任务状态统计
node check_status.js --check
# 输出：各知识库的 total, queued, processing, embedding, completed, failed 数量

# 2. 重试指定失败文件 (将状态重置为 0-Pending)
node check_status.js --reprocess-file <docId>

# 3. 重试所有失败文件 (仅针对 status = -1 的任务)
# 重试所有知识库的失败任务
node check_status.js --retry-failed
# 仅重试指定知识库的失败任务
node check_status.js --retry-failed <ragName>
```

**注意：** `--retry-failed` **仅会**重置状态为 `-1` (失败) 的任务，不会影响正在进行或已完成的任务，安全可靠。
