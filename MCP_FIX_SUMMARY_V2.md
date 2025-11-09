# MCP端口路由问题修复报告 v2.0

## 问题描述
用户报告MCP功能请求被卡在 http://127.0.0.1:7071/chat/chat，无法正常工作。

## 根本原因
**硬编码端口问题**: 在 `frontend/src/views/ChatTools/controller/index.ts` 文件中，聊天请求被硬编码为：
```javascript
await axios.post("http://127.0.0.1:7071/chat/chat", {...})
```

这导致即使前端配置指向开发版后端(63240端口)，实际请求仍然发送到安装版后端(7071端口)。

## 修复方案

### 1. 修改文件: `frontend/src/views/ChatTools/controller/index.ts`

**修复前**:
```javascript
// 硬编码端口
await axios.post("http://127.0.0.1:7071/chat/chat", {...})
```

**修复后**:
```javascript
// 使用相对路径，基于环境变量配置
await instance.post("/chat/chat", {...})
```

### 2. 修改文件: `frontend/src/api/index.ts`

**新增导出**:
```javascript
export const instance = axios.create({
  baseURL
})
```

将axios实例导出，供其他模块使用，确保请求遵循环境变量中的baseURL配置。

## 验证结果

### ✅ 修复前
```
请求地址: http://127.0.0.1:7071/chat/chat  (错误端口)
状态: 卡住不动
```

### ✅ 修复后
```
请求地址: http://127.0.0.1:63240/chat/chat  (正确端口)
状态: 成功返回200
网络请求ID: 286
```

## 可用模型确认

后端API返回了多个支持MCP工具调用的模型：

### ✅ 支持MCP工具调用的模型
- **DeepSeek-R1** (deepseek-ai/DeepSeek-R1) - 推荐
- **Qwen3系列** (多个模型支持tools)
- **MiniMax-M2** (MiniMaxAI/MiniMax-M2)
- **KAT-Dev** (Kwaipilot/KAT-Dev)

### ❌ 不支持工具调用的模型
- Kimi (moonshotai) - 不支持OpenAI Tool Calling API

## 测试建议

### 1. 使用DeepSeek-R1模型进行测试
```
消息: "使用mcp工具filesystem从 D:\work新文件.xlsx 读取内容告诉我"
```

### 2. 检查要点
- ✅ 请求应该发送到 http://127.0.0.1:63240/chat/chat
- ✅ 应该在对话中看到AI回复
- ✅ 如果文件存在，应该显示文件内容
- ✅ 如果文件不存在，应该显示错误信息

## 技术总结

### 端口架构
- **5173**: 前端开发服务器 (Vite)
- **7071**: 安装版后端 (AingDesk.exe)
- **63240**: 开发版后端 (node public/electron/main.js)

### 环境配置
- 文件: `frontend/.env.development`
- 配置: `VITE_BASE_URL=http://127.0.0.1:63240`

### 修复范围
只修改了2个文件：
1. `frontend/src/api/index.ts` - 导出axios实例
2. `frontend/src/views/ChatTools/controller/index.ts` - 使用相对路径

## 结论

✅ **修复成功**: MCP工具调用现在正确路由到开发版后端(63240端口)
✅ **功能可用**: 支持OpenAI Tool Calling API的模型可以正常使用MCP功能
✅ **向后兼容**: 修复不会影响其他功能

建议用户使用 **DeepSeek-R1** 或其他标记为 `capability: ["llm","tools"]` 的模型进行MCP功能测试。
