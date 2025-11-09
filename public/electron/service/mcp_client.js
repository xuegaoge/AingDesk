var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var mcp_client_exports = {};
__export(mcp_client_exports, {
  MCPClient: () => MCPClient
});
module.exports = __toCommonJS(mcp_client_exports);
var import_client = require("@modelcontextprotocol/sdk/client/index.js");
var import_stdio = require("@modelcontextprotocol/sdk/client/stdio.js");
var import_sse = require("@modelcontextprotocol/sdk/client/sse.js");
var import_public = require("../class/public");
var import_path = __toESM(require("path"));
var import_log = require("ee-core/log");
var import_mcp = require("./mcp");
var import_punycode = __toESM(require("punycode/"));
class MCPClient {
  // 存储所有会话
  sessions = /* @__PURE__ */ new Map();
  // 存储所有连接
  transports = /* @__PURE__ */ new Map();
  // 缓存工具列表
  toolListCache = null;
  supplierName = "";
  model = "";
  openai = null;
  push = null;
  callback = null;
  /**
   * 读取 MCP 配置文件
   */
  static async readMCPConfigFile() {
    const mcpConfigFile = import_path.default.resolve(import_public.pub.get_data_path(), "mcp-server.json");
    try {
      if (import_public.pub.file_exists(mcpConfigFile)) {
        return import_public.pub.read_file(mcpConfigFile);
      }
    } catch (error) {
      import_log.logger.error("Failed to read MCP config file:", error);
    }
    return null;
  }
  /**
   * 解析 MCP 配置文件
   * @param {string} configContent - MCP 配置文件的内容
   * @returns {ServerConfig[]} - 解析后的服务器配置数组
   */
  static parseMCPConfig(configContent) {
    try {
      const mcpConfig = JSON.parse(configContent);
      const mcpServers = [];
      if (mcpConfig && mcpConfig.mcpServers) {
        for (const server of mcpConfig.mcpServers) {
          const serverConfig = server;
          if (serverConfig.isActive) {
            mcpServers.push({
              name: serverConfig.name,
              description: serverConfig.description,
              type: serverConfig.type,
              command: serverConfig.command,
              env: serverConfig.env,
              args: serverConfig.args,
              baseUrl: serverConfig.baseUrl,
              isActive: serverConfig.isActive
            });
          }
        }
      }
      return mcpServers;
    } catch (error) {
      import_log.logger.error("Failed to parse MCP config:", error);
      return [];
    }
  }
  /**
   * 获取所有开启的 MCP 服务器
   * @param {string[]} [filter] - 服务器名称的过滤数组
   * @returns {Promise<ServerConfig[]>} - 所有开启的服务器配置数组
   */
  static async getActiveServers(filter) {
    const configContent = await this.readMCPConfigFile();
    if (!configContent) {
      return [];
    }
    let mcpServices = this.parseMCPConfig(configContent);
    if (filter) {
      mcpServices = mcpServices.filter((mcpService2) => filter.includes(mcpService2.name));
    }
    return mcpServices;
  }
  /**
   * 检查服务器配置是否有效
   * @param {ServerConfig} serverConfig - 服务器配置对象
   * @returns {ServerConfig} - 验证后的服务器配置对象
   */
  validateServerConfig(serverConfig) {
    if (serverConfig.type === void 0) {
      if (serverConfig.command) {
        serverConfig.type = "stdio";
      } else if (serverConfig.baseUrl) {
        serverConfig.type = "sse";
      } else {
        throw new Error("Invalid server configuration");
      }
    }
    return serverConfig;
  }
  /**
   * 创建 stdio 客户端传输实例
   * @param {string} command - 启动服务器的命令
   * @param {string[]} args - 启动服务器的参数
   * @param {Record<string, string>} env - 环境变量
   * @returns {Promise<StdioClientTransport>} - Stdio 客户端传输实例
   */
  async createStdioTransport(command, args, env) {
    if (!command) {
      throw new Error("Invalid shell command");
    }
    const serverParams = {
      command,
      args,
      env: env || {}
    };
    return new import_stdio.StdioClientTransport(serverParams);
  }
  /**
   * 创建 SSE 客户端传输实例
   * @param {string} url - SSE 服务器的 URL
   * @returns {Promise<SSEClientTransport>} - SSE 客户端传输实例
   */
  async createSSETransport(url) {
    try {
      return new import_sse.SSEClientTransport(new URL(url));
    } catch (error) {
      import_log.logger.error(`Failed to create SSE transport for URL ${url}:`, error);
      throw error;
    }
  }
  /**
   * 创建客户端传输实例
   * @param {ServerConfig} serverConfig - 服务器配置对象
   * @returns {Promise<StdioClientTransport | SSEClientTransport>} - 客户端传输实例
   */
  async createTransport(serverConfig) {
    if (serverConfig.type === "stdio" && serverConfig.command) {
      let command = serverConfig.command;
      let args = serverConfig.args || [];
      let env = serverConfig.env || {};
      if (command === "npx") {
        command = import_mcp.mcpService.get_bun_bin();
        args.unshift("x", "--bun");
        env.NPM_CONFIG_REGISTRY = "https://registry.npmmirror.com";
      }
      return this.createStdioTransport(command, args, env);
    } else if (serverConfig.type === "sse" && serverConfig.baseUrl) {
      return this.createSSETransport(serverConfig.baseUrl);
    } else {
      throw new Error(`Invalid server configuration for: ${serverConfig.name}`);
    }
  }
  /**
   * 连接到 MCP 服务器
   * @param {ServerConfig[]} serverConfigList - 服务器配置数组
   * @returns {Promise<void>} - 连接操作的 Promise
   */
  async connectToServer(serverConfigList) {
    for (let serverConfig of serverConfigList) {
      try {
        const validatedConfig = this.validateServerConfig(serverConfig);
        const transport = await this.createTransport(validatedConfig);
        const client = new import_client.Client(
          {
            name: "mcp-client",
            version: "1.0.0"
          },
          {
            capabilities: {
              prompts: {},
              resources: {},
              tools: {}
            }
          }
        );
        await client.connect(transport);
        this.sessions.set(validatedConfig.name, client);
        this.transports.set(validatedConfig.name, transport);
        this.toolListCache = null;
      } catch (error) {
        import_log.logger.error(`Failed to connect to server ${serverConfig.name}:`, error);
      }
    }
  }
  /**
   * 获取指定服务器的工具列表
   * @param {ServerConfig} serverConfig - 服务器配置对象
   * @returns {Promise<Tool[]>} - 工具列表的 Promise
   */
  async getTools(serverConfig) {
    try {
      await this.connectToServer([serverConfig]);
      const session = this.sessions.get(serverConfig.name);
      if (!session) {
        throw new Error(`Session not found for server ${serverConfig.name}`);
      }
      const response = await session.listTools();
      return response.tools;
    } catch (error) {
      import_log.logger.error(`Failed to get tools for server ${serverConfig.name}:`, error);
      throw error;
    } finally {
      this.cleanup();
    }
  }
  /**
   * 编码 Punycode
   * @param {string} data - 要编码的字符串
   * @returns {string} - 编码后的字符串
   */
  enPunycode(data) {
    return import_punycode.default.toASCII(data);
  }
  /**
   * 解码 Punycode
   * @param {string} data - 要解码的字符串
   * @returns {string} - 解码后的字符串
   */
  dePunycode(data) {
    return import_punycode.default.toUnicode(data);
  }
  /**
   * 获取所有服务器的工具列表
   * @returns {Promise<any[]>} - 所有服务器的工具列表的 Promise
   */
  async getAllAvailableTools() {
    if (this.toolListCache) {
      return this.toolListCache;
    }
    const availableTools = [];
    try {
      for (const [serverName, session] of this.sessions) {
        const response = await session.listTools();
        const tools = response.tools.map((tool) => ({
          type: "function",
          function: {
            name: `${this.enPunycode(serverName)}__${tool.name}`,
            description: `[${serverName}] ${tool.description}`,
            parameters: tool.inputSchema
          }
        }));
        availableTools.push(...tools);
      }
      this.toolListCache = availableTools;
    } catch (error) {
      import_log.logger.error("Failed to get available tools:", error);
      throw error;
    }
    return availableTools;
  }
  /**
   * 处理工具调用结果
   * @param {MCPToolResult} toolResult - 工具调用结果对象
   * @returns {string} - 处理后的工具调用结果字符串
   */
  processToolResult(toolResult) {
    if (toolResult.content && toolResult.content.text) {
      toolResult.content = toolResult.content.text;
    }
    if (typeof toolResult.content !== "string") {
      toolResult.content = JSON.stringify(toolResult.content);
    }
    return toolResult.content;
  }
  /**
   * 工具调用
   * @param {Record<string, OpenAI.Chat.Completions.ChatCompletionMessageToolCall>} toolCallMap - 工具调用映射
   * @param {ChatCompletionMessageParam[]} messages - 消息列表
   * @param {string} toolsContent - 工具内容
   * @returns {Promise<ChatCompletionMessageParam[]>} - 处理后的消息列表的 Promise
   */
  async callTools(toolCallMap, messages, toolsContent) {
    for (const toolCall of Object.values(toolCallMap)) {
      if (!this.isValidToolCall(toolCall)) {
        continue;
      }
      let [serverName, toolName] = toolCall.function.name.split("__");
      serverName = this.dePunycode(serverName);
      const session = this.sessions.get(serverName);
      if (!session) {
        continue;
      }
      const toolArgs = JSON.parse(toolCall.function.arguments);
      const toolResult = await this.executeToolCall(session, toolName, toolArgs);
      const toolResultContent = this.processToolResult(toolResult);
      const toolResultPush = this.createToolResultPush(serverName, toolName, toolArgs, toolResultContent);
      this.pushMessage(toolResultPush);
      messages = this.updateMessages(messages, toolCall, toolsContent, toolResultContent);
    }
    return messages;
  }
  /**
   * 检查工具调用是否有效
   * @param {OpenAI.Chat.Completions.ChatCompletionMessageToolCall} toolCall - 工具调用对象
   * @returns {boolean} - 工具调用是否有效的布尔值
   */
  isValidToolCall(toolCall) {
    if (toolCall.function && toolCall.function.name && toolCall.function.arguments) return true;
    return false;
  }
  /**
   * 执行工具调用
   * @param {Client} session - 会话对象
   * @param {string} toolName - 工具名称
   * @param {any} toolArgs - 工具参数
   * @returns {Promise<MCPToolResult>} - 工具调用结果的 Promise
   */
  async executeToolCall(session, toolName, toolArgs) {
    try {
      const result = await session.callTool({
        name: toolName,
        arguments: toolArgs
      });
      return result;
    } catch (error) {
      import_log.logger.error(`Failed to execute tool call for ${toolName}:`, error);
      if (error.code === -32600 && error.message && error.message.includes("has an output schema but did not return structured content")) {
        import_log.logger.warn(`MCP tool ${toolName} doesn't return structured content. Creating fallback result.`);
        return {
          content: [{
            type: "text",
            text: `\u5DE5\u5177 ${toolName} \u6267\u884C\u5B8C\u6210\uFF08\u4F46\u8FD4\u56DE\u683C\u5F0F\u4E0D\u517C\u5BB9MCP\u6807\u51C6\uFF09\u3002\u8BF7\u67E5\u770B\u65E5\u5FD7\u83B7\u53D6\u8BE6\u7EC6\u4FE1\u606F\u3002`
          }],
          structuredContent: {
            error: `Tool ${toolName} compatibility issue`,
            message: error.message,
            toolName,
            toolArgs,
            note: "This is a fallback result due to MCP format incompatibility"
          },
          isError: true
        };
      }
      throw error;
    }
  }
  /**
   * 创建工具调用结果推送对象
   * @param {string} serverName - 服务器名称
   * @param {string} toolName - 工具名称
   * @param {any} toolArgs - 工具参数
   * @param {string} toolResultContent - 工具调用结果内容
   * @returns {any} - 工具调用结果推送对象
   */
  createToolResultPush(serverName, toolName, toolArgs, toolResultContent) {
    return {
      "tool_server": serverName,
      "tool_name": toolName,
      "tool_args": toolArgs,
      "tool_result": JSON.parse(toolResultContent)
    };
  }
  /**
   * 推送消息
   * @param {any} message - 要推送的消息
   */
  pushMessage(message) {
    this.push("<mcptool>\n\n" + JSON.stringify(message, null, 4) + "\n\n</mcptool>\n\n");
  }
  /**
   * 更新消息列表
   * @param {ChatCompletionMessageParam[]} messages - 消息列表
   * @param {OpenAI.Chat.Completions.ChatCompletionMessageToolCall} toolCall - 工具调用对象
   * @param {string} toolsContent - 工具内容
   * @param {string} toolResultContent - 工具调用结果内容
   * @returns {ChatCompletionMessageParam[]} - 更新后的消息列表
   */
  updateMessages(messages, toolCall, toolsContent, toolResultContent) {
    messages.push({
      role: "assistant",
      content: toolsContent,
      tool_calls: [toolCall]
    });
    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: toolResultContent
    });
    return messages;
  }
  /**
   * 处理 OpenAI 响应中的工具调用
   * @param {Stream<OpenAI.Chat.Completions.ChatCompletion>} completion - OpenAI 响应流
   * @param {ChatCompletionMessageParam[]} messages - 消息列表
   * @param {any[]} availableTools - 可用的工具列表
   * @returns {Promise<ChatCompletionMessageParam[]>} - 处理后的消息列表的 Promise
   */
  async handleOpenAIToolCalls(completion, messages, availableTools) {
    let toolId = "";
    let toolCallMap = {};
    let toolsContent = "";
    for await (const chunk of completion) {
      for (let choice of chunk.choices) {
        const message = choice.delta;
        if (message.tool_calls) {
          if (message.content) {
            toolsContent += message.content;
          }
          for (const toolCall of message.tool_calls) {
            if (toolCall.id) toolId = toolCall.id;
            if (!toolCallMap[toolId]) {
              toolCallMap[toolId] = {
                id: toolId,
                type: "function",
                function: {
                  name: "",
                  arguments: ""
                }
              };
            }
            if (toolCall.type) toolCallMap[toolId].type = toolCall.type;
            if (toolCall.function) {
              if (toolCall.function.name) {
                toolCallMap[toolId].function.name = toolCall.function.name;
              }
              if (toolCall.function.arguments) {
                toolCallMap[toolId].function.arguments += toolCall.function.arguments;
              }
            }
          }
        } else {
          this.callback(chunk);
        }
      }
    }
    if (Object.keys(toolCallMap).length > 0) {
      messages = await this.callTools(toolCallMap, messages, toolsContent);
      let last_message = messages[messages.length - 1];
      if (last_message.content) {
        let content = last_message.content.toString().trim();
        let toolMessage = JSON.parse(content);
        if (toolMessage && toolMessage.length > 0 && toolMessage[0].text) {
          content = toolMessage[0].text;
          if (content.startsWith("<end>") && content.endsWith("</end>")) {
            content = content.replace("<end>", "").replace("</end>", "").trim();
            let chunk = {
              created_at: Date.now(),
              index: 0,
              choices: [
                {
                  finish_reason: "stop",
                  delta: {
                    content
                  }
                }
              ]
            };
            this.callback(chunk);
            return;
          }
          if (content.startsWith("<echo>") && content.endsWith("</echo>")) {
            content = content.replace("<echo>", "").replace("</echo>", "").trim();
            let chunk = {
              created_at: Date.now(),
              index: 0,
              choices: [
                {
                  finish_reason: "",
                  delta: {
                    content
                  }
                }
              ]
            };
            this.callback(chunk);
          }
        }
      }
      await this.handleToolCalls(availableTools, messages, true);
    }
    return messages;
  }
  /**
   * 处理工具调用
   * @param {any} availableTools - 可用的工具列表
   * @param {ChatCompletionMessageParam[]} messages - 消息列表
   * @param {boolean} [isRecursive=false] - 是否递归调用
   * @returns {Promise<void>} - 处理工具调用操作的 Promise
   */
  async handleToolCalls(availableTools, messages, isRecursive = false) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        tools: availableTools,
        tool_choice: "auto",
        stream: true
      });
      await this.handleOpenAIToolCalls(completion, messages, availableTools);
    } catch (error) {
      import_log.logger.error("Failed to call OpenAI API:", error);
      throw error;
    }
  }
  /**
   * 处理查询
   * @param {OpenAI} openai - OpenAI 实例
   * @param {string} supplierName - 供应商名称
   * @param {string} model - 模型名称
   * @param {ChatCompletionMessageParam[]} messages - 消息列表
   * @param {Function} callback - 回调函数
   * @param {Function} push - 推送函数
   * @returns {Promise<string>} - 处理结果的 Promise
   */
  async processQuery(openai, supplierName, model, messages, callback, push) {
    if (this.sessions.size === 0) {
      throw new Error("Not connected to any server");
    }
    const availableTools = await this.getAllAvailableTools();
    try {
      this.supplierName = supplierName;
      this.model = model;
      this.openai = openai;
      this.push = push;
      this.callback = callback;
      await this.handleToolCalls(availableTools, messages);
    } catch (error) {
      let chunk = {
        created_at: Date.now(),
        index: 0,
        choices: [
          {
            finish_reason: "stop",
            delta: {
              content: "Error: " + error.message
            }
          }
        ]
      };
      callback(chunk);
      import_log.logger.error("Failed to process query:", error);
      throw error;
    } finally {
      await this.cleanup();
    }
    return "";
  }
  /**
   * 关闭所有连接
   * @returns {Promise<void>} - 关闭连接操作的 Promise
   */
  async cleanup() {
    try {
      for (const transport of this.transports.values()) {
        await transport.close();
      }
      this.transports.clear();
      this.sessions.clear();
      this.toolListCache = null;
    } catch (error) {
      import_log.logger.error("Failed to cleanup connections:", error);
      throw error;
    }
  }
  /**
   * 判断是否有活动的会话
   * @returns {boolean} - 是否有活动会话的布尔值
   */
  hasActiveSessions() {
    return this.sessions.size > 0;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MCPClient
});
