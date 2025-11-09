# MCP 功能问题分析报告

## 问题描述
用户报告：在 http://localhost:5173 发送 MCP 测试消息后，接口有数据返回，但页面不会更新显示。

## 环境配置
- 前端地址：http://localhost:5173
- 后端地址：http://127.0.0.1:52500 (配置在 `frontend/.env.development`)

## MCP 工作流程分析

### 1. 后端发送 MCP 消息
在 `electron/service/mcp_client.ts:400`：
```javascript
this.push("<mcptool>\n\n" + JSON.stringify(message, null, 4) + "\n\n</mcptool>\n\n");
```

**消息格式**：
```javascript
<mcptool>

{
    "tool_server": "FileSystem",
    "tool_name": "read_file",
    "tool_args": {...},
    "tool_result": [...]
}

</mcptool>

```

### 2. 前端接收 SSE 响应
在 `frontend/src/views/ChatTools/controller/index.ts:138-210`：
```javascript
fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params)
})
.then(response => {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    const read = () => {
        reader.read().then(({ done, value }) => {
            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')
            lines.forEach(line => {
                if (line.trim() && line.startsWith('data:')) {
                    const data = line.slice(5).trim()
                    const parsed = JSON.parse(data)
                    // 只处理 parsed.content 字段
                    if (currentChat && parsed.content !== undefined) {
                        chat.content += parsed.content  // 问题所在！
                    }
                }
            })
        })
    }
})
```

### 3. 前端显示 MCP 结果
在 `frontend/src/views/Answer/components/MarkdownRender.vue`：
```javascript
// 提取 MCP 内容
const tools_content_arr = computed(() => {
    const matches = props.content.match(/<mcptool>([\s\S]*?)<\/mcptool>/g);
    return matches ? matches.map(match => match.replace(/<mcptool>|<\/mcptool>/g, "").trim()) : [];
})

// 渲染组件
<McpToolsWrapper v-for="(item, index) in tools_content_arr" :key="index" :content="item" />
```

## 问题根源

### 根本问题：**流式传输时的数据分片**

当后端发送包含 `<mcptool>` 的响应时，通过 SSE (Server-Sent Events) 进行流式传输。由于网络传输的原因，完整的 `<mcptool>...</mcptool>` 标签可能被**拆分到多个数据块 (chunk) 中**。

#### 示例场景：

**后端发送的完整消息**：
```
data: {"content": "<mcptool>\n\n{\"tool_server\":\"FileSystem\",\"tool_name\":\"read_file\",\"tool_result\":[{\"type\":\"text\",\"text\":\"文件内容\"}]}\n\n</mcptool>\n\n这是回答内容"}
```

**网络传输时可能被拆分为多个 chunk**：

**Chunk 1**:
```
data: {"content": "<mcptool>\n\n{\"tool_server\":\"FileSystem\",\"tool_nam"
```

**Chunk 2**:
```
data: {"content": "e\":\"read_file\",\"tool_result\":[{\"type\":\"text\",\"tex"
```

**Chunk 3**:
```
data: {"content": "t\":\"文件内容\"}]}\n\n</mcptool>\n\n这是回答内容"}
```

### 为什么页面不更新

1. 在 `sendStreamChat` 中，代码会立即将每个 chunk 的 `parsed.content` 追加到 `chat.content`
2. 这导致 `chat.content` 变成：
   ```
   <mcptool>

   {"tool_server":"FileSystem","tool_nam
e":"read_file","tool_result":[{"type":"text","tex
t":"文件内容"}]}

   </mcptool>

   这是回答内容
   ```
3. 注意：content 中有换行符，导致标签和内容被断开
4. `MarkdownRender.vue` 中的正则表达式：
   ```javascript
   /<mcptool>([\s\S]*?)<\/mcptool>/g
   ```
   这个正则可以跨行匹配（因为使用了 `[\s\S]`），但是在拼接后的字符串中可能存在格式问题

### 可能的错误场景

**场景 1：标签被拆分在不同 chunk**
```
Chunk 1: data: {"content": "这是一些内容 <mcpto"}
Chunk 2: data: {"content": "ol>\n\n{\"tool_server\":...}\n\n</mcptool>\n\n这是其他内容"}
```
**结果**：正则无法匹配到 `<mcptool>`，因为不完整

**场景 2：JSON 被拆分到不同 chunk**
```
Chunk 1: data: {"content": "<mcptool>\n\n{\"tool_server\":\"FileSystem\"\n\n</mcpto"}
Chunk 2: data: {"content": "ol>\n\n这是其他内容"}
```
**结果**：正则虽然匹配到了标签，但内部 JSON 不完整，无法解析

**场景 3：正则匹配成功但 JSON 解析失败**
若 `McpToolsWrapper.vue:28`：
```javascript
const mcpToolContent = computed(() => {
    return JSON.parse(props.content.replace(/<mcptool>|<\/mcptool>/g, '').trim())
})
```
如果标签内的内容不是完整有效的 JSON，`JSON.parse()` 会抛出错误，导致组件无法渲染

## 解决方案

### 方案 1：完整接收后再处理（推荐）

修改 `frontend/src/views/ChatTools/controller/index.ts` 中的 `sendStreamChat` 函数：

```javascript
async function sendStreamChat(params: any, currentChat: MultipeQuestionDto | null, chatHistory: any) {
    return new Promise<void>((resolve, reject) => {
        const baseURL = import.meta.env.VITE_BASE_URL
        const url = `${baseURL}/chat/chat`

        // 临时存储所有 SSE 数据
        let fullResponse = ""

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const reader = response.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) {
                throw new Error('No response body')
            }

            // 读取流式数据
            const read = () => {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        // 所有数据接收完成，统一处理
                        if (currentChat && fullResponse) {
                            const chat = chatHistory.value.get(currentChat)
                            if (chat) {
                                if (typeof chat.content === 'string') {
                                    chat.content += fullResponse
                                } else if (Array.isArray(chat.content)) {
                                    // 多模型情况
                                    chat.content[0] = (chat.content[0] || '') + fullResponse
                                }
                            }
                        }
                        resolve()
                        return
                    }

                    const chunk = decoder.decode(value, { stream: true })
                    const lines = chunk.split('\n')

                    lines.forEach(line => {
                        if (line.trim() && line.startsWith('data:')) {
                            const data = line.slice(5).trim()
                            if (data === '[DONE]') {
                                // 所有数据接收完成，统一处理
                                if (currentChat && fullResponse) {
                                    const chat = chatHistory.value.get(currentChat)
                                    if (chat) {
                                        if (typeof chat.content === 'string') {
                                            chat.content += fullResponse
                                        } else if (Array.isArray(chat.content)) {
                                            chat.content[0] = (chat.content[0] || '') + fullResponse
                                        }
                                    }
                                }
                                resolve()
                                return
                            }

                            try {
                                const parsed = JSON.parse(data)
                                // 积累所有 content，不立即更新
                                if (parsed.content !== undefined) {
                                    fullResponse += parsed.content
                                }
                            } catch (e) {
                                // 忽略解析错误，继续读取
                            }
                        }
                    })

                    read()
                })
                .catch(reject)
            }

            read()
        })
        .catch(reject)
    })
}
```

**优点**：
- 确保 MCP 标签完整性修复：一次性处理完整的响应内容，避免分片导致的标签不完整
- JSON 解析稳定：保证 MCP 内容是完整且结构正确的
- 实现复杂度：代码修改相对直接，易于维护

**缺点**：
- 内存使用可能增加：需要临时存储整个响应内容
- 实时交互体验下降：用户无法看到逐步生成的内容

### 方案 2：流式缓冲区修复（推荐）

```javascript
async function sendStreamChat(params: any, currentChat: MultipeQuestionDto | null, chatHistory: any) {
    return new Promise<void>((resolve, reject) => {
        const baseURL = import.meta.env.VITE_BASE_URL
        const url = `${baseURL}/chat/chat`

        // 创建缓冲区
        let buffer = ""
        let inMcpTag = false
        let mcpBuffer = ""

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const reader = response.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) {
                throw new Error('No response body')
            }

            // 读取流式数据
            const read = () => {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        // 处理缓冲区剩余内容
                        if (buffer && !inMcpTag) {
                            if (currentChat) {
                                const chat = chatHistory.value.get(currentChat)
                                if (chat) {
                                    if (typeof chat.content === 'string') {
                                        chat.content += buffer
                                    } else if (Array.isArray(chat.content)) {
                                        chat.content[0] = (chat.content[0] || '') + buffer
                                    }
                                }
                            }
                        }
                        resolve()
                        return
                    }

                    const chunk = decoder.decode(value, { stream: true })
                    const lines = chunk.split('\n')

                    lines.forEach(line => {
                        if (line.trim() && line.startsWith('data:')) {
                            const data = line.slice(5).trim()
                            if (data === '[DONE]') {
                                // 处理缓冲区剩余内容
                                if (buffer && !inMcpTag) {
                                    if (currentChat) {
                                        const chat = chatHistory.value.get(currentChat)
                                        if (chat) {
                                            if (typeof chat.content === 'string') {
                                                chat.content += buffer
                                            } else if (Array.isArray(chat.content)) {
                                                chat.content[0] = (chat.content[0] || '') + buffer
                                            }
                                        }
                                    }
                                }
                                resolve()
                                return
                            }

                            try {
                                const parsed = JSON.parse(data)
                                if (parsed.content !== undefined) {
                                    const content = parsed.content
                                    let i = 0

                                    while (i < content.length) {
                                        // 检测 <mcptool> 标签开始
                                        if (!inMcpTag && content.substring(i, i + 9) === '<mcptool>') {
                                            inMcpTag = true
                                            mcpBuffer = '<mcptool>'
                                            i += 9
                                            continue
                                        }

                                        // 检测 </mcptool> 标签结束
                                        if (inMcpTag && content.substring(i, i + 10) === '</mcptool>') {
                                            inMcpTag = false
                                            mcpBuffer += '</mcptool>'
                                            // 追加完整的 MCP 内容
                                            buffer += mcpBuffer
                                            mcpBuffer = ""
                                            i += 10
                                            continue
                                        }

                                        // 如果在 MCP 标签内，累加到 mcpBuffer
                                        if (inMcpTag) {
                                            mcpBuffer += content[i]
                                        } else {
                                            // 如果不在 MCP 标签内，累加到 buffer
                                            buffer += content[i]
                                        }

                                        i++
                                    }

                                    // 实时更新非 MCP 内容
                                    if (buffer && !inMcpTag) {
                                        if (currentChat) {
                                            const chat = chatHistory.value.get(currentChat)
                                            if (chat) {
                                                if (typeof chat.content === 'string') {
                                                    const currentContent = chat.content
                                                    // 只追加新内容
                                                    const newContent = buffer.substring(currentContent.length)
                                                    if (newContent) {
                                                        chat.content += newContent
                                                    }
                                                } else if (Array.isArray(chat.content)) {
                                                    const currentContent = chat.content[0] || ''
                                                    const newContent = buffer.substring(currentContent.length)
                                                    if (newContent) {
                                                        chat.content[0] = currentContent + newContent
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (e) {
                                // 忽略解析错误，继续读取
                            }
                        }
                    })

                    read()
                })
                .catch(reject)
            }

            read()
        })
        .catch(reject)
    })
}
```

**优点**：
- 实时内容显示：用户能立即看到响应内容
- 完整的 MCP 支持：通过缓冲区确保标签完整
- 体验保持：基本维持原有交互体验

**缺点**：
- 实现复杂度高：需要精细管理缓冲区逻辑
- 处理细节敏感：对边界条件处理要求严格

### 方案 3：后端修改消息格式（备选）

修改后端 `electron/service/mcp_client.ts:400`，使用 JSON 包装而不是字符串拼接：

```javascript
private pushMessage(message: any): void {
    // 改用 JSON 封装，而不是字符串拼接
    this.push(JSON.stringify({
        content: message.content || "",
        tool_call: {
            server: message.tool_server,
            name: message.tool_name,
            result: message.tool_result
        }
    }) + "\n\n");
}
```

这样前端可以直接访问 `parsed.tool_call`，不需要正则匹配。

**优点**：
- 结构清晰，避免字符串解析
- 流式传输更稳定

**缺点**：
- 需要修改后端代码
- 前端也需要相应调整

## 调试建议

### 1. 查看后端日志
```bash
tail -f ~/.AingDesk/logs/electron.log
```

### 2. 查看前端日志
在浏览器控制台查看：
- Network 标签页的 /chat/chat 请求
- Console 日志

### 3. 使用测试脚本
创建 `test_mcp.js`：

```javascript
const http = require('http');

const postData = {
  context_id: 'test-uuid-123',
  supplierName: 'openai',
  model: 'gpt-4o',
  parameters: 'default',
  user_content: '使用mcp工具filesystem从路径"D:\\\\work\\\\1.txt"读取内容',
  mcp_servers: ['FileSystem']
};

const options = {
  hostname: '127.0.0.1',
  port: 52500,
  path: '/chat/chat',
  method: 'POST'
};

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(chunk.toString());
  });
});

req.on('error', (e) => {
  console.error(`请求遇到问题: ${e.message}`);
});

req.write(JSON.stringify(postData));
req.end();
```

运行：`node test_mcp.js`

### 4. 检查 MCP 配置
确认 `C:\Users\Administrator\AppData\Roaming\AingDesk\data\mcp-server.json` 配置正确：

```json
{
  "mcpServers": [
    {
      "name": "FileSystem",
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "D:/work"],
      "isActive": true
    }
  ]
}
```

## 建议实施步骤

1. **立即实施**：方案 1（完整接收后再处理）
   - 修改 `frontend/src/views/ChatTools/controller/index.ts`
   - 修改 `sendStreamChat` 函数
   - 测试并验证

2. **后续优化**：方案 2（流式缓冲区）
   - 实现更复杂的状态管理
   - 提升用户体验

3. **长期方案**：方案 3（后端修改）
   - 重构消息格式
   - 提升系统稳定性

## 相关代码文件

- **前端**：
  - `frontend/src/views/ChatTools/controller/index.ts` - 发送和接收聊天消息
  - `frontend/src/views/Answer/components/MarkdownRender.vue` - 渲染 MCP 结果
  - `frontend/src/views/Answer/components/McpToolsWrapper.vue` - MCP 结果面板
  - `frontend/src/views/ChatTools/components/ToolsChoosePanel.vue` - 选择 MCP 服务器

- **后端**：
  - `electron/service/mcp_client.ts` - MCP 客户端
  - `electron/service/tochat.ts` - 聊天服务
  - `electron/service/chat.ts` - 聊天历史管理

## 测试验证

### 步骤 1：使用支持工具调用的模型
- ✅ GPT-4, GPT-4o, GPT-4-turbo
- ✅ Claude 3.5 Sonnet, Claude 3 Opus
- ❌ Kimi (Moonshot) - 不支持工具调用

### 步骤 2：发送测试消息
```
使用 mcp 工具 filesystem 从路径 "D:\work\1.txt" 读取内容
```

### 步骤 3：观察界面
- 应该显示"调用结果"面板
- 面板中显示工具名称和结果
- 显示最终回答内容

### 步骤 4：查看日志
确认没有错误日志，特别是：
- `JSON.parse` 错误
- 正则匹配错误
- 流式传输中断
