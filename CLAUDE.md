# CLAUDE.md
总是用中文回答我，和解释给我。
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AingDesk is a desktop AI assistant application with support for local AI models, APIs, knowledge bases, web search, and intelligent agents. The application uses a multi-component architecture:

- **Electron Desktop App** - Main application shell and backend services
- **Vue 3 Frontend** - User interface built with TypeScript, Vite, and UnoCSS
- **Optional Components** - Go and Python backends, MCP (Model Context Protocol) integration

## Development Workflow

### Quick Start

```bash
# Install dependencies
yarn

# Start development mode (runs both electron and frontend)
yarn dev

# Or run them separately:
yarn dev-electron  # Electron backend only (port varies)
yarn dev-frontend  # Frontend only (port 5173)
```

### Building for Production

```bash
# Build all components
yarn build

# Platform-specific builds
yarn build-w      # Windows 64-bit
yarn build-m      # macOS (Intel)
yarn build-m-arm64 # macOS (Apple Silicon)
yarn build-l      # Linux

# Build individual components
yarn build-frontend
yarn build-electron
```

### Testing

```bash
# Run tests (vitest is configured)
npm test
# or
yarn test
```

## Architecture

### Frontend (`/frontend/`)
- **Framework**: Vue 3 + TypeScript + Vite
- **UI Library**: Naive UI (auto-imported components)
- **Styling**: UnoCSS (Tailwind-like utility classes) + Sass
- **State Management**: Pinia
- **Routing**: Vue Router
- **Internationalization**: vue-i18n

**Key directories:**
- `src/views/` - Page components
- `src/stores/` - Pinia stores
- `src/api/` - API communication
- `src/utils/` - Utility functions
- `src/assets/` - Static assets and styles

**Development Notes:**
- Naive UI components are auto-imported (no manual imports needed)
- Views use templates, not TSX (per project规范)
- Icons are loaded from `src/assets/icons/` via UnoCSS
- Global styles in `src/assets/base.scss`

### Electron Backend (`/electron/`)
- **Framework**: Electron + TypeScript
- **Service Layer**: Business logic services
- **Controllers**: Feature controllers (MCP, etc.)

**Key directories:**
- `electron/service/` - Service layer (chat, share, mcp, rag, etc.)
- `electron/controller/` - Feature controllers
- `electron/preload/` - Preload scripts for secure IPC
- `electron/rag/` - RAG (Retrieval-Augmented Generation) functionality
- `electron/search_engines/` - Web search implementations
- `electron/model_engines/` - AI model integrations (Ollama, etc.)

**Main entry**: `electron/main.ts` - Initializes Electron app, registers lifecycle hooks, and starts background services

### Build System (`/cmd/`)
- Uses `ee-bin` (a custom build tool)
- Builder configs for different platforms in `/cmd/builder-*.json`
- Build configuration in `/cmd/bin.js`

**Common build commands** (via ee-bin):
- `ee-bin dev` - Development mode
- `ee-bin build --cmds=frontend,electron` - Build both components
- `ee-bin build --cmds=win64,mac,linux` - Platform-specific builds
- `ee-bin move --flag=frontend_dist` - Move built frontend to public directory

## Key Technologies

### Frontend Stack
- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **UnoCSS** - Atomic CSS engine
- **Naive UI** - Vue 3 component library
- **Pinia** - State management
- **Vue Router** - Routing
- **Axios** - HTTP client
- **Socket.io Client** - Real-time communication
- **highlight.js** - Code syntax highlighting
- **markdown-it** - Markdown rendering
- **mermaid** - Diagram generation
- **KaTeX** - Math rendering

### Backend Stack
- **Electron** - Desktop application framework
- **ee-core** - Custom Electron framework
- **Socket.io** - Real-time communication
- **Ollama** - Local AI model runner
- **OpenAI** - OpenAI API client
- **Apache Arrow** - Columnar memory format
- **LanceDB** - Vector database
- **better-sqlite3** - SQLite database
- **pdfjs-dist** - PDF processing
- **tesseract.js** - OCR (Optical Character Recognition)
- **jszip** - ZIP file handling
- **xlsx** - Excel file processing

## Environment Configuration

### Frontend
- Development: `frontend/.env.development`
- Production: `frontend/.env.production`

### Environment Variables
Key environment variables (check `.env` files and service code):
- API endpoints
- Model configuration
- Feature flags

## File Structure (High-Level)

```
/
├── electron/              # Electron backend
│   ├── main.ts           # Entry point
│   ├── service/          # Business logic
│   ├── controller/       # Feature controllers
│   ├── preload/          # Preload scripts
│   ├── rag/             # RAG functionality
│   └── ...
├── frontend/             # Vue.js frontend
│   ├── src/
│   │   ├── views/       # Page components
│   │   ├── stores/      # Pinia stores
│   │   ├── api/         # API layer
│   │   ├── utils/       # Utilities
│   │   ├── assets/      # Assets & styles
│   │   ├── lang/        # i18n translations
│   │   └── router/      # Routes
│   ├── vite.config.ts   # Vite configuration
│   └── uno.config.ts    # UnoCSS configuration
├── cmd/                  # Build configurations
│   ├── bin.js          # ee-bin config
│   └── builder-*.json  # Platform-specific builders
├── public/              # Static assets
├── data/               # Application data
├── build/              # Build output
└── package.json        # Root package config
```

## Common Tasks

### Adding a New Frontend View
1. Create component in `frontend/src/views/`
2. Add route in `frontend/src/router/`
3. Add to navigation if needed

### Adding a New Service
1. Create service in `electron/service/`
2. Register in `electron/main.ts` if needed
3. Expose via preload if frontend needs access

### Modifying Build Configuration
- Edit `cmd/bin.js` for ee-bin configuration
- Edit `cmd/builder-*.json` for platform-specific builds
- Edit `frontend/vite.config.ts` for Vite configuration

## Development Conventions

### Frontend
- Use templates instead of TSX
- Leverage auto-import for Naive UI components
- Use UnoCSS utility classes for styling
- Follow the three-tier structure: `components`, `controller`, `store`
- Use Sass mixins from `base.scss` (search for `@use` in existing code)

### Backend
- Services handle business logic
- Controllers manage specific features
- Use IPC for frontend-backend communication
- Background tasks are started from `main.ts`

## Internationalization

- Uses `vue-i18n` for i18n
- Translation files in `frontend/src/lang/`
- Language switching supported
- Add new languages by creating translation files

## Documentation

- Main README: `README.md` (English)
- Chinese README: `README.zh_cn.md`
- Frontend README: `frontend/README.md`
- Online docs: https://docs.aingdesk.com/

## Debug Mode

```bash
# Debug mode for build issues
DEBUG=ee-* yarn dev

# Debug specific components
yarn debug-electron
yarn debug-encrypt
```

## MCP (Model Context Protocol) 支持

### MCP 功能概述
AingDesk 支持 MCP 协议，允许 AI 模型与外部工具和资源进行交互。当前主要实现是文件系统 MCP 服务器。

### 配置文件位置
- **MCP 配置**: `C:\Users\Administrator\AppData\Roaming\AingDesk\data\mcp-server.json`
- **日志目录**: `C:\Users\Administrator\.AingDesk\logs\`

### MCP 修复记录 (2025-11-08)

#### 已修复的问题
1. **连接管理问题** (`public/electron/service/mcp_client.js`)
   - 修复了 `getTools()` 方法中 finally 块调用 `cleanup()` 导致连接过早关闭
   - 修复了 `processQuery()` 方法中 finally 块调用 `cleanup()` 导致处理中断
   - 添加了连接复用机制

2. **模型兼容性检查** (`public/electron/service/tochat.js`)
   - 添加了支持 OpenAI Tool Calling API 的模型检查
   - 阻止不支持的模型（如 Kimi）使用 MCP 工具
   - 提供友好错误提示

3. **MCP 配置文件优化**
   - 移除了无效的默认路径
   - 只保留实际可用的路径 `D:/work`

4. **开发版后端启动问题**
   - 修复了 `node_modules/ee-core/app/boot.js` 中的 `getAppPath` 检查

#### 支持的 MCP 工具
文件系统 MCP 服务器提供 14 个工具：
- read_file, read_multiple_files
- write_file, create_directory
- list_directory, move_file, copy_file
- get_file_info, delete_file, delete_directory
- search_files, view_directory, view_file, edit_file

#### 推荐模型列表
使用 MCP 功能需要支持 OpenAI Tool Calling API 的模型：
- ✅ GPT-4, GPT-4o, GPT-4-turbo
- ✅ Claude 3.5 Sonnet, Claude 3 Opus
- ❌ Kimi (Moonshot) - 不支持

## 端口架构说明

### 服务端口分布
- **5173**: 前端开发服务器 (Vite)
- **7071**: 安装版后端 (AingDesk.exe 默认端口)
- **63240**: 开发版后端 (动态分配)

### 前端配置
- **文件**: `frontend/.env.development`
- **默认指向**: `VITE_BASE_URL=http://127.0.0.1:7071`
- **开发版后端**: 修改为 `VITE_BASE_URL=http://127.0.0.1:63240`

### 推荐开发方式
```bash
# 方式 1: 前端 + 安装版后端（最稳定）
cd frontend && yarn dev  # 5173
# 安装版 AingDesk 运行在 7071

# 方式 2: 前端 + 开发版后端（包含修改）
cd frontend && yarn dev  # 5173
# 修改 .env.development 中的 VITE_BASE_URL=50080
cd .. && node public/electron/main.js  # 50080
```

## 启动指南

### 方式一：前端 + 安装版后端（推荐）
```bash
# 终端 1
cd frontend
yarn dev
# 前端地址: http://localhost:5173

# 验证后端
curl http://127.0.0.1:7071/chat/model_list
```

### 方式二：完整开发版
**注意**: 需要 X Server (Windows 下使用 VcXsrv)

```bash
# 1. 安装并启动 VcXsrv
# 2. 设置环境变量
export DISPLAY=:0

# 3. 启动开发版
yarn dev  # 同时启动前端和后端
# 或分别启动：
# yarn dev-frontend  # 前端 5173
# yarn dev-electron  # 后端动态端口
```

### 开发版后端启动问题排查
如果遇到 "Cannot read properties of undefined" 错误：
1. 检查是否有 X Server 运行
2. 确认 DISPLAY 环境变量设置正确
3. 使用前端 + 安装版后端方案作为备选

## 测试 MCP 功能

### API 测试脚本
创建 `test_mcp.js` 用于测试 MCP 功能：

```javascript
const http = require('http');

const postData = {
  context_id: 'test-uuid-123',
  supplierName: 'openai',
  model: 'gpt-4o',
  parameters: 'default',
  user_content: '使用mcp工具filesystem从路径"D:\\\\work\\\\1.txt"写入新的内容"新年好"',
  mcp_servers: ['FileSystem']
};

const options = {
  hostname: '127.0.0.1',
  port: 63240,  // 或 7071 (安装版)
  path: '/chat/chat',
  method: 'POST'
};

const req = http.request(options, (res) => {
  res.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
});

req.write(JSON.stringify(postData));
req.end();
```

### 运行测试
```bash
node test_mcp.js
```

### 预期结果
- ✅ 使用支持工具调用的模型: 真正执行文件写入
- ❌ 使用不支持的模型: 显示友好错误提示

### 浏览器测试
1. 访问 http://localhost:5173
2. 选择支持的模型（如 GPT-4o）
3. 输入测试消息：
   ```
   使用 mcp 工具 filesystem 从路径 "D:\work\1.txt" 读取内容
   使用 mcp 工具 filesystem 从路径 "D:\work\1.txt" 写入新的内容 "新年好"
   ```
4. 观察是否出现 "调用结果" 面板

## 调试和日志

### 查看日志
```bash
# 后端日志
tail -f C:\Users\Administrator\.AingDesk\logs\electron.log

# 或使用 find 查找
find C:\Users\Administrator\.AingDesk\logs\ -name "*.log" -exec tail -f {} \;
```

### 验证修复生效
1. 检查文件修改时间：
   - `public/electron/service/mcp_client.js`
   - `public/electron/service/tochat.js`
2. 重启后端服务
3. 查看日志确认修改已加载

## 其他 Commands

```bash
# Clean build artifacts
yarn clean

# Start production build
yarn start

# Generate app icons
yarn icon

# Rebuild sqlite (if needed)
yarn re-sqlite
```
