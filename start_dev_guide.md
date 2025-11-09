# AingDesk 开发环境启动指南

## 🎯 推荐的启动方式

### 方案一：前端 + 安装版后端（最稳定）

```bash
# 终端 1: 启动前端
cd /c/AingDesk/frontend
yarn dev

# 终端 2: 检查后端
curl http://127.0.0.1:7071/chat/model_list

# 前端访问地址
# http://localhost:5173
```

**优势**:
- ✅ 无需 X Server
- ✅ 稳定性高
- ✅ 所有功能正常工作
- ✅ MCP 修复已应用

### 方案二：完整开发版（需要 X Server）

**步骤 1**: 安装 VcXsrv (Windows X Server)
- 下载: https://sourceforge.net/projects/vcxsrv/
- 安装后启动 Xlaunch
- 选择 "Disable access control"

**步骤 2**: 设置环境变量
```bash
export DISPLAY=:0
echo $DISPLAY  # 确认设置成功
```

**步骤 3**: 启动开发版
```bash
cd /c/AingDesk
yarn dev  # 同时启动前端和后端
```

**或分别启动**:
```bash
# 终端 1: 启动前端
cd /c/AingDesk/frontend
yarn dev

# 终端 2: 启动后端
cd /c/AingDesk
yarn dev-electron
```

## 🚀 快速启动命令

创建启动脚本 `start.sh`:

```bash
#!/bin/bash
echo "启动 AingDesk 开发环境..."

# 设置 X Server (仅方案二需要)
export DISPLAY=:0

# 启动前端
cd frontend
yarn dev &
FRONTEND_PID=$!

# 等待前端启动
sleep 5

# 启动后端（如果需要）
# cd ..
# yarn dev-electron &

echo "前端已启动: http://localhost:5173"
echo "按 Ctrl+C 停止"
wait $FRONTEND_PID
```

## ❓ 常见问题

### Q: 提示 "Can't find X Server"
**A**: 需要安装并启动 VcXsrv 或 Xming

### Q: 提示 "xvfb-run: command not found"
**A**: 这是 Linux 工具，在 MSYS/Windows 下不可用，需要 X Server

### Q: 哪个方案更好？
**A**: 推荐方案一（前端+安装版后端），无依赖、稳定性高

## ✅ 验证启动成功

### 前端验证
访问: http://localhost:5173

### 后端 API 验证
```bash
curl http://127.0.0.1:7071/chat/model_list
```

应该返回 JSON 格式的模型列表

## 🔧 MCP 功能测试

使用支持 OpenAI Tool Calling 的模型（如 GPT-4o）测试：

```
使用 mcp 工具 filesystem 从路径 "D:\work\1.txt" 读取内容
使用 mcp 工具 filesystem 从路径 "D:\work\1.txt" 写入新的内容 "新年好"
```

如果看到 "调用结果" 面板展开并显示工具执行详情，说明 MCP 工作正常。
