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
var import_fs = __toESM(require("fs"));
var import_log = require("ee-core/log");
var import_mcp = require("./mcp");
var import_mcp_compat = require("./mcp_compat");
var import_punycode = __toESM(require("punycode/"));
class MCPClient {
  constructor() {
    try {
      const curr = (process.env.MCP_COMPAT_MODE || "").toLowerCase();
      const mode = curr === "lenient" || curr === "strict" ? curr : "strict";
      import_mcp_compat.MCPCompat.configure({ mode });
    } catch {
    }
  }
  // 存储所有会话
  sessions = /* @__PURE__ */ new Map();
  // 存储所有连接
  transports = /* @__PURE__ */ new Map();
  // 缓存工具列表
  toolListCache = null;
  // 缓存：完整工具名 -> JSON Schema（输入参数）
  toolsSchemaByName = /* @__PURE__ */ new Map();
  supplierName = "";
  model = "";
  openai = null;
  push = null;
  callback = null;
  serverConfigs = /* @__PURE__ */ new Map();
  activeToolCalls = /* @__PURE__ */ new Map();
  /**
   * 读取 MCP 配置文件
   */
  static async readMCPConfigFile() {
    const userMcpConfigFile = import_path.default.resolve(import_public.pub.get_user_data_path(), "data", "mcp-server.json");
    const workspaceMcpConfigFile = import_path.default.resolve(import_public.pub.get_data_path(), "mcp-server.json");
    try {
      if (import_public.pub.file_exists(userMcpConfigFile)) {
        return import_public.pub.read_file(userMcpConfigFile);
      }
      if (import_public.pub.file_exists(workspaceMcpConfigFile)) {
        return import_public.pub.read_file(workspaceMcpConfigFile);
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
        this.serverConfigs.set(validatedConfig.name, validatedConfig);
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
   * 直接执行指定 MCP 工具（一次性调用），并返回统一结构的结果。
   * 注意：默认遵循严格模式（strict）。如需宽松模式，请通过 opts.compatMode 指定 'lenient'。
   */
  async runToolOnce(server, toolName, toolArgs, opts) {
    try {
      if (opts && opts.compatMode) {
        const mode = opts.compatMode === "lenient" ? "lenient" : "strict";
        import_mcp_compat.MCPCompat.configure({ mode });
      }
      await this.connectToServer([server]);
      const session = this.sessions.get(server.name);
      if (!session) {
        throw new Error(`Session not found for server ${server.name}`);
      }
      let raw = await session.callTool({ name: toolName, arguments: toolArgs }, void 0, {
        onprogress: (process2) => {
          try {
            const total = Number(process2?.total || 1);
            const progressVal = Number(process2?.progress || 0);
            const ratio = total ? progressVal / total : 0;
            this.pushProgress("tool_call_progress", { server: server.name, tool: toolName, call_id: void 0, progress: ratio, progress_value: progressVal, total });
          } catch {
          }
        }
      });
      try {
        const isClaude = /claude/i.test(server?.name || "");
        const isWriteLike = import_mcp_compat.MCPCompat.isWriteLikeTool(toolName);
        const filePath = toolArgs && (toolArgs.file_path || toolArgs.path) || "";
        const hasPath = typeof filePath === "string" && filePath.length > 0;
        const getErrorText = () => {
          let out = "";
          try {
            const normalized = import_mcp_compat.MCPCompat.normalizeContentArray(raw);
            out = this.extractTextFromContentJson(JSON.stringify(normalized)) || "";
          } catch {
          }
          if (!out) {
            try {
              const t = raw?.content && Array.isArray(raw.content) && raw.content[0]?.text;
              out = typeof t === "string" ? t : "";
            } catch {
            }
          }
          return out;
        };
        const errText = getErrorText();
        const mentionsReadFirst = /read\s*it\s*first/i.test(errText) || /(请先读取|未读取|尚未读取)/.test(errText);
        if (isClaude && isWriteLike && hasPath && (raw?.isError === true || this.isErrorText(errText)) && mentionsReadFirst) {
          try {
            const lst = await session.listTools();
            const readTool = lst?.tools?.find((t) => /read/i.test(t?.name || ""))?.name;
            if (readTool) {
              const readArgs = { file_path: filePath, path: filePath };
              try {
                await session.callTool({ name: readTool, arguments: readArgs });
              } catch (eRead) {
                try {
                  import_log.logger.warn(`[MCPClient] auto-read before write failed on ${server.name}:`, eRead);
                } catch {
                }
              }
              try {
                raw = await session.callTool({ name: toolName, arguments: toolArgs });
              } catch (eWrite) {
                const coerced = import_mcp_compat.MCPCompat.coerceWriteSuccess(toolName, toolArgs, eWrite?.message || errText);
                const pushCoerced = this.createToolResultPush(server.name, toolName, toolArgs, coerced.content);
                let textCoerced = null;
                try {
                  textCoerced = this.extractTextFromContentJson(JSON.stringify(pushCoerced.tool_result));
                } catch {
                }
                return { push: pushCoerced, text: textCoerced || void 0, raw: coerced };
              }
            }
          } catch (eBridge) {
            try {
              import_log.logger.warn(`[MCPClient] write->read bridge failed on ${server.name}:`, eBridge);
            } catch {
            }
          }
        }
      } catch {
      }
      const push = this.createToolResultPush(server.name, toolName, toolArgs, raw);
      let text = null;
      try {
        text = this.extractTextFromContentJson(JSON.stringify(push.tool_result));
      } catch {
      }
      return { push, text: text || void 0, raw };
    } catch (e) {
      import_log.logger.error(`[MCPClient] runToolOnce failed: ${toolName} on ${server?.name}`, e);
      throw e;
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
        try {
          if (/claude\s*code/i.test(serverName)) {
            const names = response.tools.map((t) => ({ name: t.name, desc: t.description }));
            import_log.logger.info(`[MCP Tools] ${serverName} tools: ${JSON.stringify(names)}`);
          }
        } catch {
        }
        const tools = response.tools.map((tool) => ({
          type: "function",
          function: {
            name: `${this.enPunycode(serverName)}__${tool.name}`,
            description: `[${serverName}] ${tool.description}`,
            parameters: tool.inputSchema
          }
        }));
        try {
          for (const tool of response.tools) {
            const full = `${this.enPunycode(serverName)}__${tool.name}`;
            this.toolsSchemaByName.set(full, tool.inputSchema);
            try {
              if (/claude\s*code/i.test(serverName) && /skill/i.test(tool.name)) {
                import_log.logger.info(`[MCP Tools] ${serverName} Skill inputSchema: ${JSON.stringify(tool.inputSchema)}`);
              }
            } catch {
            }
            try {
              if (/docx/i.test(tool.name) || /docx/i.test(tool.description)) {
                import_log.logger.info(`[MCP Tools] ${serverName} detected DOCX tool: ${tool.name} - ${tool.description}`);
              }
            } catch {
            }
          }
        } catch {
        }
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
    let raw = toolResult.content;
    const pickTextOrFileContent = (item) => {
      try {
        if (!item || typeof item !== "object") return null;
        if (typeof item.text === "string") return item.text;
        if (item.file && typeof item.file === "object" && typeof item.file.content === "string") {
          return item.file.content;
        }
        if (item.type === "json" && item.json && typeof item.json === "object") {
          const j = item.json;
          if (typeof j.text === "string") return j.text;
          if (j.file && typeof j.file === "object" && typeof j.file.content === "string") return j.file.content;
          if (typeof j.content === "string") return j.content;
          try {
            const skills = j.available_skills;
            if (Array.isArray(skills) && skills.length > 0) {
              const lines = skills.map((s) => {
                const name = s && (s.name || s.title || s.id) ? String(s.name || s.title || s.id) : "";
                const desc = s && s.description ? String(s.description) : "";
                const loc = s && s.location ? String(s.location) : "";
                const extra = [desc, loc].filter(Boolean).join(" | ");
                return extra ? `- ${name}: ${extra}` : `- ${name}`;
              }).join("\n");
              return `Available skills (Claude Code):
${lines}`;
            }
          } catch {
          }
          try {
            const compact = JSON.stringify(j);
            if (compact && compact.length > 0) return compact;
          } catch {
          }
        }
        if (item.data && typeof item.data === "object" && item.data.file && typeof item.data.file === "object" && typeof item.data.file.content === "string") {
          return item.data.file.content;
        }
        return null;
      } catch {
        return null;
      }
    };
    if (Array.isArray(raw)) {
      const parts = [];
      for (const it of raw) {
        const t = pickTextOrFileContent(it);
        if (typeof t === "string" && t.trim().length > 0) parts.push(t);
      }
      const merged = parts.join("\n\n");
      if (merged.trim().length > 0) {
        raw = merged;
      } else {
        const first = raw[0];
        if (first && typeof first === "object" && "text" in first && typeof first.text === "string") {
          raw = first.text;
        }
      }
    } else if (raw && typeof raw === "object" && "text" in raw && typeof raw.text === "string") {
      raw = raw.text;
    }
    let parsed = null;
    if (typeof raw === "string") {
      const s = raw.trim();
      if (s.startsWith("{") || s.startsWith("[")) {
        try {
          parsed = JSON.parse(s);
        } catch {
        }
      }
    } else if (raw && typeof raw === "object") {
      parsed = raw;
    }
    const isExcelCells = (obj) => obj && typeof obj === "object" && Array.isArray(obj.cells) && ("sheet_name" in obj || "range" in obj);
    if (parsed && isExcelCells(parsed)) {
      const text = this.formatExcelCells(parsed);
      return JSON.stringify([{ type: "text", text }]);
    }
    if (parsed && typeof parsed === "object" && parsed.data && isExcelCells(parsed.data)) {
      const text = this.formatExcelCells(parsed.data);
      return JSON.stringify([{ type: "text", text }]);
    }
    const tryExtractFileContent = (obj) => {
      try {
        if (!obj || typeof obj !== "object") return null;
        if (obj.file && typeof obj.file === "object" && typeof obj.file.content === "string") {
          return obj.file.content;
        }
        if (obj.data && typeof obj.data === "object" && obj.data.file && typeof obj.data.file === "object" && typeof obj.data.file.content === "string") {
          return obj.data.file.content;
        }
        if (obj.type === "json" && obj.json && typeof obj.json === "object") {
          const j = obj.json;
          if (j.file && typeof j.file === "object" && typeof j.file.content === "string") {
            return j.file.content;
          }
          if (typeof j.content === "string") {
            return j.content;
          }
        }
        return null;
      } catch {
        return null;
      }
    };
    if (parsed) {
      if (Array.isArray(parsed)) {
        const texts = [];
        for (let i = 0; i < parsed.length; i++) {
          const it = parsed[i];
          if (it && typeof it === "object" && typeof it.text === "string") {
            texts.push(it.text);
            continue;
          }
          const fc = tryExtractFileContent(it);
          if (typeof fc === "string") texts.push(fc);
        }
        if (texts.length > 0) {
          const merged = texts.join("\n\n");
          return JSON.stringify([{ type: "text", text: merged }]);
        }
      } else if (typeof parsed === "object") {
        if (typeof parsed.text === "string") {
          return JSON.stringify([{ type: "text", text: parsed.text }]);
        }
        const fc = tryExtractFileContent(parsed);
        if (typeof fc === "string") {
          return JSON.stringify([{ type: "text", text: fc }]);
        }
      }
    }
    if (parsed !== null && typeof parsed !== "undefined") {
      return JSON.stringify(parsed);
    }
    if (typeof raw === "string" && this.isLikelyBinaryText(raw)) {
      const msg = "\u68C0\u6D4B\u5230\u53EF\u80FD\u7684\u4E8C\u8FDB\u5236\u5185\u5BB9\uFF08\u4F8B\u5982 Excel \u5DE5\u4F5C\u7C3F\u3001Word \u6587\u6863\u6216\u538B\u7F29\u5305\uFF09\u3002\u8BF7\u4F7F\u7528\u9002\u914D\u8BE5\u6587\u4EF6\u7C7B\u578B\u7684 MCP \u5DE5\u5177\uFF1A\u4F8B\u5982 .xlsx/.xls \u4F7F\u7528 Excel \u8BFB\u53D6\u5DE5\u5177\uFF1B.docx \u4F7F\u7528\u5177\u5907 docx \u80FD\u529B\u7684\u5DE5\u5177\uFF1B\u82E5\u4E0D\u786E\u5B9A\uFF0C\u8BF7\u76F4\u63A5\u63CF\u8FF0\u4F60\u7684\u9700\u6C42\uFF0C\u6211\u4F1A\u81EA\u52A8\u9009\u62E9\u5408\u9002\u7684\u5DE5\u5177\u3002";
      return JSON.stringify([{ type: "text", text: msg }]);
    }
    if (typeof raw === "string") {
      const mdDelimited = this.tryFormatDelimitedTextAsMarkdown(raw);
      if (mdDelimited) {
        return JSON.stringify([{ type: "text", text: mdDelimited }]);
      }
      return JSON.stringify([{ type: "text", text: raw }]);
    }
    return JSON.stringify(toolResult.content);
  }
  /**
   * 从工具结果的 JSON 字符串中提取纯文本（若存在）
   */
  extractTextFromContentJson(jsonStr) {
    try {
      const obj = JSON.parse((jsonStr || "").toString());
      const pickTextFromObj = (o) => {
        if (!o || typeof o !== "object") return null;
        if (typeof o.text === "string") return o.text;
        if (o.file && typeof o.file === "object" && typeof o.file.content === "string") return o.file.content;
        if (o.type === "json" && o.json && typeof o.json === "object") {
          const j = o.json;
          if (typeof j.text === "string") return j.text;
          if (j.file && typeof j.file === "object" && typeof j.file.content === "string") return j.file.content;
          if (typeof j.content === "string") return j.content;
          try {
            const skills = j.available_skills;
            if (Array.isArray(skills) && skills.length > 0) {
              const lines = skills.map((s) => {
                const name = s && (s.name || s.title || s.id) ? String(s.name || s.title || s.id) : "";
                const desc = s && s.description ? String(s.description) : "";
                const loc = s && s.location ? String(s.location) : "";
                const extra = [desc, loc].filter(Boolean).join(" | ");
                return extra ? `- ${name}: ${extra}` : `- ${name}`;
              }).join("\n");
              return `Available skills (Claude Code):
${lines}`;
            }
          } catch {
          }
        }
        if (o.data && typeof o.data === "object" && o.data.file && typeof o.data.file === "object" && typeof o.data.file.content === "string") return o.data.file.content;
        return null;
      };
      if (Array.isArray(obj) && obj.length > 0) {
        const parts = [];
        for (let i = 0; i < obj.length; i++) {
          const t = pickTextFromObj(obj[i]);
          if (typeof t === "string" && t.trim().length > 0) parts.push(t);
        }
        if (parts.length > 0) return parts.join("\n\n");
      } else if (obj && typeof obj === "object") {
        const t = pickTextFromObj(obj);
        if (typeof t === "string") return t;
      }
    } catch {
    }
    return null;
  }
  /**
   * 简易错误文本判定（中英文常见错误关键词）
   */
  isErrorText(text) {
    const t = (text || "").toLowerCase();
    if (!t) return false;
    const patterns = [
      "error",
      "failed",
      "invalid",
      "not allowed",
      "permission",
      "does not exist",
      "not found",
      "did you mean",
      "\u9519\u8BEF",
      "\u5931\u8D25",
      "\u65E0\u6743\u9650",
      "\u4E0D\u5B58\u5728",
      "\u672A\u627E\u5230",
      "\u975E\u6CD5",
      "\u65E0\u6548"
    ];
    return patterns.some((p) => t.includes(p));
  }
  /**
   * 识别“docx/Word 创建写入”相关的错误提示，用于触发跨服务器技能桥接。
   * 场景：claude-code 等工具返回“只能创建纯文本/无法创建 docx/请使用 docx 技能/无法读取二进制 docx”等提示。
   */
  isDocxSkillHint(text) {
    const t = (text || "").toLowerCase();
    if (!t) return false;
    const hints = [
      // 通用 docx/word 关键词
      "docx",
      "word",
      "word \u6587\u6863",
      "docx \u6280\u80FD",
      "\u4F7F\u7528 docx \u6280\u80FD",
      "use docx skill",
      "docx tool",
      // 写入/创建相关
      "\u65E0\u6CD5\u521B\u5EFA docx",
      "\u4E0D\u80FD\u521B\u5EFA docx",
      "\u53EA\u80FD\u521B\u5EFA\u7EAF\u6587\u672C",
      "create docx",
      "write docx",
      // 读取相关（优先引导到专用读取工具）
      "\u8BFB\u53D6 docx",
      "\u8BFB\u53D6docx",
      "read docx",
      "open docx",
      "extract docx",
      "docx \u5185\u5BB9",
      "docx text",
      // 二进制读取失败的提示（来自 Read 工具）
      "cannot read binary",
      "binary .docx file",
      "cannot read binary files"
    ];
    return hints.some((h) => t.includes(h));
  }
  /**
   * 针对 content 数组（包含 json/text/file 等项）更严格地识别错误或未验证成功
   * 规则：
   * - 若存在 json 项且 status 为 error 或 unknown，视为错误（或至少不应宣称成功）
   * - 若存在 json 项且 verified 为 false，视为错误
   */
  isErrorContentArray(content) {
    try {
      const arr = Array.isArray(content) ? content : [];
      for (const it of arr) {
        if (it && it.type === "json" && it.json && typeof it.json === "object") {
          const st = String(it.json.status || "").toLowerCase();
          const v = it.json.verified;
          if (st === "error" || st === "unknown") return true;
          if (v === false) return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
  /**
   * 是否在首个成功结果后直接停止循环（例如“只返回内容”）
   */
  shouldStopOnFirstSuccess(messages) {
    const lastUser = this.getLastUserText(messages) || "";
    const t = lastUser.toLowerCase();
    const keys = ["\u53EA\u8FD4\u56DE\u5185\u5BB9", "\u4EC5\u8FD4\u56DE\u5185\u5BB9", "\u53EA\u8F93\u51FA\u5185\u5BB9", "\u4EC5\u8F93\u51FA\u5185\u5BB9", "only return content"];
    return keys.some((k) => t.includes(k));
  }
  /**
   * 尝试将 CSV/TSV 文本渲染为 Markdown 表格
   */
  tryFormatDelimitedTextAsMarkdown(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) return null;
    let delim = "";
    if (text.includes("	")) {
      delim = "	";
    } else {
      const commaCountFirst = (lines[0].match(/,/g) || []).length;
      if (commaCountFirst >= 1) {
        const consistent = lines.slice(1).every((l) => (l.match(/,/g) || []).length === commaCountFirst);
        if (consistent) delim = ",";
      }
    }
    if (!delim) return null;
    const parseDelimitedLine = (line, d) => {
      if (d === "	") {
        return line.split("	").map((s) => s.replace(/\|/g, "\\|"));
      }
      const tokens = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === d && !inQuotes) {
          tokens.push(cur.replace(/\|/g, "\\|"));
          cur = "";
        } else {
          cur += ch;
        }
      }
      tokens.push(cur.replace(/\|/g, "\\|"));
      return tokens.map((s) => s.replace(/\n/g, " "));
    };
    const rows = lines.map((l) => parseDelimitedLine(l, delim));
    const colCount = Math.max(...rows.map((r) => r.length));
    if (colCount < 1) return null;
    const isNumeric = (s) => /^\s*-?\d+(\.\d+)?\s*$/.test(s);
    const isLikelyHeader = (s) => /[A-Za-z\u4e00-\u9fff]/.test(s) && !isNumeric(s);
    const top = rows[0];
    const nonEmptyTop = top.filter((v) => (v || "").trim().length > 0);
    const headerLikeCount = nonEmptyTop.filter(isLikelyHeader).length;
    const useTopAsHeader = nonEmptyTop.length > 0 && headerLikeCount >= Math.max(1, Math.floor(nonEmptyTop.length * 0.6));
    const headers = [];
    if (useTopAsHeader) {
      for (let i = 0; i < colCount; i++) headers.push((top[i] || "").trim() || `\u5217${i + 1}`);
    } else {
      for (let i = 0; i < colCount; i++) headers.push(`\u5217${i + 1}`);
    }
    const md = [];
    md.push(`| ${headers.join(" | ")} |`);
    md.push(`| ${headers.map(() => "---").join(" | ")} |`);
    const startRow = useTopAsHeader ? 1 : 0;
    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      const vals = [];
      for (let c = 0; c < colCount; c++) {
        const rawV = row[c] !== void 0 && row[c] !== null ? String(row[c]) : "";
        const v = rawV.trim().length > 0 ? rawV : "\u7A7A";
        vals.push(v);
      }
      md.push(`| ${vals.join(" | ")} |`);
    }
    return md.join("\n");
  }
  /**
   * 简易二进制文本检测：用于阻止直接显示压缩包或 Excel 工作簿等原始字节
   */
  isLikelyBinaryText(text) {
    if (typeof text !== "string") return false;
    if (text.length === 0) return false;
    if (text.length > 1024 && /PK\x03\x04/.test(text)) return true;
    const samples = text.slice(0, Math.min(text.length, 4e3));
    let ctrl = 0;
    for (let i = 0; i < samples.length; i++) {
      const ch = samples[i];
      const code = samples.charCodeAt(i);
      const isPrintableAscii = code >= 32 && code <= 126;
      const isCommonWhitespace = code === 9 || code === 10 || code === 13;
      const isCJK = code >= 19968 && code <= 40959;
      const isPunctCJK = "\uFF0C\u3002\uFF01\uFF1F\u3001\uFF1B\uFF1A\u201C\u201D\u2018\u2019\uFF08\uFF09\u300A\u300B\u3010\u3011".includes(ch);
      const isAllowed = isPrintableAscii || isCommonWhitespace || isCJK || isPunctCJK;
      if (!isAllowed && code < 32) ctrl++;
    }
    const ratio = ctrl / samples.length;
    return ratio > 0.02;
  }
  /**
   * 将 Excel 单元格结果渲染为人类可读的纯文本
   */
  formatExcelCells(result) {
    const sheetName = (result.sheet_name || result.sheet || "Sheet").toString();
    const range = (result.range || "").toString();
    const header = range ? `${sheetName} ${range}` : sheetName;
    const cells = Array.isArray(result.cells) ? result.cells.slice() : [];
    cells.sort((a, b) => {
      const ar = a.row ?? 0, br = b.row ?? 0;
      if (ar !== br) return ar - br;
      const ac = a.column ?? 0, bc = b.column ?? 0;
      return ac - bc;
    });
    const md = this.tryFormatExcelCellsAsMarkdown(range, cells);
    if (md) {
      return `${header}

${md}`;
    }
    const lines = [header];
    for (const c of cells) {
      const addr = (c.address || (typeof c.column === "number" && typeof c.row === "number" ? `${this.indexToColLetter(Number(c.column))}${Number(c.row)}` : "")).toString();
      const valueRaw = c.value !== void 0 && c.value !== null ? String(c.value) : "";
      const value = valueRaw.trim().length > 0 ? valueRaw : "\u7A7A";
      lines.push(`${addr}: ${value}`);
    }
    return lines.join("\n");
  }
  /**
   * 尝试将矩形区域的 Excel 单元格渲染为最简 Markdown 表格
   * 仅在 range 形如 "A1:B10"、"A1:C3" 等矩形时生效
   */
  tryFormatExcelCellsAsMarkdown(range, cells) {
    if (!Array.isArray(cells) || cells.length === 0) return null;
    let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
    for (const c of cells) {
      const r = Number(c.row), colNum = Number(c.column);
      if (!Number.isFinite(r) || !Number.isFinite(colNum)) continue;
      if (r < minRow) minRow = r;
      if (r > maxRow) maxRow = r;
      if (colNum < minCol) minCol = colNum;
      if (colNum > maxCol) maxCol = colNum;
    }
    const parsed = this.parseExcelRange(range);
    if (parsed) {
      minCol = Math.min(minCol, parsed.startCol);
      maxCol = Math.max(maxCol, parsed.endCol);
      minRow = Math.min(minRow, parsed.startRow);
      maxRow = Math.max(maxRow, parsed.endRow);
    }
    if (!Number.isFinite(minCol) || !Number.isFinite(maxCol) || !Number.isFinite(minRow) || !Number.isFinite(maxRow)) return null;
    if (minCol > maxCol || minRow > maxRow) return null;
    const grid = /* @__PURE__ */ new Map();
    for (const c of cells) {
      const r = Number(c.row), colNum = Number(c.column);
      if (!Number.isFinite(r) || !Number.isFinite(colNum)) continue;
      const valRaw = c.value !== void 0 && c.value !== null ? String(c.value) : " ";
      const val = valRaw.replace(/\|/g, "\\|").replace(/\n/g, " ");
      if (!grid.has(r)) grid.set(r, /* @__PURE__ */ new Map());
      grid.get(r).set(colNum, val);
    }
    const isNumeric = (s) => /^\s*-?\d+(\.\d+)?\s*$/.test(s);
    const isLikelyHeader = (s) => /[A-Za-z\u4e00-\u9fff]/.test(s) && !isNumeric(s);
    const topRowMap = grid.get(minRow) || /* @__PURE__ */ new Map();
    const topVals = [];
    for (let col = minCol; col <= maxCol; col++) topVals.push(topRowMap.get(col) || " ");
    const nonEmptyTop = topVals.filter((v) => v.trim().length > 0);
    const headerLikeCount = nonEmptyTop.filter(isLikelyHeader).length;
    const useTopAsHeader = nonEmptyTop.length > 0 && headerLikeCount >= Math.max(1, Math.floor(nonEmptyTop.length * 0.6));
    const headers = [];
    if (useTopAsHeader) {
      for (let col = minCol; col <= maxCol; col++) headers.push((topRowMap.get(col) || " ").trim() || this.indexToColLetter(col));
    } else {
      for (let col = minCol; col <= maxCol; col++) headers.push(this.indexToColLetter(col));
    }
    const lines = [];
    lines.push(`| ${headers.join(" | ")} |`);
    lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
    const startDataRow = useTopAsHeader ? minRow + 1 : minRow;
    for (let row = startDataRow; row <= maxRow; row++) {
      const rowMap = grid.get(row) || /* @__PURE__ */ new Map();
      const rowVals = [];
      for (let col = minCol; col <= maxCol; col++) {
        const raw = rowMap.get(col);
        const v = raw !== void 0 && raw !== null && String(raw).trim().length > 0 ? String(raw) : "\u7A7A";
        rowVals.push(v);
      }
      lines.push(`| ${rowVals.join(" | ")} |`);
    }
    return lines.join("\n");
  }
  /**
   * 解析 Excel 区域字符串（如 "A1:B10"）为行列数字
   */
  parseExcelRange(range) {
    const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
    if (!m) return null;
    const startCol = this.colLetterToIndex(m[1].toUpperCase());
    const startRow = Number(m[2]);
    const endCol = this.colLetterToIndex(m[3].toUpperCase());
    const endRow = Number(m[4]);
    if (!Number.isFinite(startCol) || !Number.isFinite(endCol) || !Number.isFinite(startRow) || !Number.isFinite(endRow)) return null;
    return { startCol, endCol, startRow, endRow };
  }
  /**
   * 列字母转数字（A->1, B->2, ..., Z->26, AA->27 ...）
   */
  colLetterToIndex(s) {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      n = n * 26 + (s.charCodeAt(i) - 64);
    }
    return n;
  }
  /**
   * 列数字转字母（1->A, 2->B, ..., 27->AA ...）
   */
  indexToColLetter(n) {
    let s = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s || "A";
  }
  /**
   * 统一路径分隔符并清洗异常前缀（如被拼接到 C:\AingDesk 上、或前缀多出一个点）
   */
  sanitizeFilePath(rawPath, preferCandidate) {
    if (!rawPath || typeof rawPath !== "string") return rawPath;
    let p = rawPath.trim();
    p = p.replace(/[\\/]+/g, "\\");
    p = p.replace(/[“”"']+/g, "");
    p = p.replace(/^\.([A-Za-z]:\\)/, "$1");
    if (/AingDesk/i.test(p)) {
      const matches = p.match(/[A-Za-z]:\\[^\\]+(?:\\[^\\]+)*/g);
      if (matches && matches.length > 0) {
        const prefer = matches.find((m) => /^D:\\work(\\|$)/i.test(m));
        p = prefer || matches[matches.length - 1];
      } else if (preferCandidate) {
        p = preferCandidate;
      }
    }
    const lastAbs = p.match(/([A-Za-z]:\\[^\\]+(?:\\[^\\]+)*)/g);
    if (lastAbs && lastAbs.length > 0) {
      const prefer = lastAbs.find((m) => /^D:\\work(\\|$)/i.test(m));
      p = prefer || lastAbs[lastAbs.length - 1];
    }
    if (!/^[A-Za-z]:\\/.test(p) && preferCandidate && /^[A-Za-z]:\\/.test(preferCandidate)) {
      p = preferCandidate;
    }
    return p;
  }
  /**
   * 增强版路径清理：处理伪协议、中文引号、盘符规范化与 .<server> 前缀回退
   */
  sanitizeFilePathV2(rawPath, preferCandidate) {
    if (!rawPath || typeof rawPath !== "string") return rawPath;
    let p = rawPath.trim();
    p = p.replace(/[\\/]+/g, "\\");
    p = p.replace(/[“”"'‘’]+/g, "");
    p = p.replace(/^(excel|file|fs|mcp):\\?/i, "");
    p = p.replace(/^([A-Za-z]):(?!\\)/, "$1:\\");
    p = p.replace(/^\.([A-Za-z]:\\)/, "$1");
    if (/^\.[A-Za-z][A-Za-z0-9_-]+\\/.test(p) && preferCandidate && /^[A-Za-z]:\\/.test(preferCandidate)) {
      p = preferCandidate;
    }
    return this.sanitizeFilePath(p, preferCandidate);
  }
  /**
   * 从文本中提取 Windows 绝对路径（优先选择位于 D:\work 下的路径）
   */
  extractWindowsPath(text) {
    if (!text || typeof text !== "string") return null;
    const regex = /[A-Za-z]:\\[^\s<>"'“”]+/g;
    const matches = text.match(regex);
    if (!matches || matches.length === 0) return null;
    const clean = (p) => p.replace(/[“”"'‘’]+/g, "").trim();
    const cleaned = matches.map(clean);
    const prefer = cleaned.find((m) => /^D:\\work(\\|$)/i.test(m));
    return prefer || cleaned[0];
  }
  /**
   * 提取消息中的纯文本（支持 OpenAI 风格富文本 content 数组）
   */
  extractTextFromMessage(m) {
    if (!m || !m.content) return "";
    const c = m.content;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) {
      try {
        const parts = c.filter((x) => x && (typeof x.text === "string" || typeof x.content === "string")).map((x) => typeof x.text === "string" ? x.text : typeof x.content === "string" ? x.content : "");
        return parts.join(" ").trim();
      } catch {
      }
    }
    if (typeof c === "object" && c !== null) {
      if (typeof c.text === "string") return c.text;
      if (typeof c.content === "string") return c.content;
    }
    return "";
  }
  /**
   * 获取最近一条用户文本（兼容数组消息），用于路径提取
   */
  getLastUserText(messages) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return null;
    const text = this.extractTextFromMessage(lastUser);
    return text && text.trim().length > 0 ? text : null;
  }
  /**
   * 判断路径是否更像“目录”而非“文件”
   * 依据：
   * - 以反斜杠结尾；
   * - 最后一个分隔符后的片段不包含“.”扩展名；
   * - 路径存在且 fs.stat 为目录
   */
  isDirectoryLikePath(p) {
    if (!p || typeof p !== "string") return false;
    const normalized = p.replace(/[\/]+/g, "\\");
    if (/\\$/.test(normalized)) return true;
    const base = import_path.default.win32.basename(normalized);
    if (!/\./.test(base)) return true;
    try {
      if (import_fs.default.existsSync(normalized)) {
        const st = import_fs.default.statSync(normalized);
        if (st.isDirectory()) return true;
      }
    } catch {
    }
    return false;
  }
  /**
   * 从文本或参数中提取可能的文件名（相对名），例如 2.txt、note.md
   * 仅匹配不包含路径分隔符的文件名，避免与绝对路径冲突
   */
  extractFileNameCandidate(text) {
    if (!text || typeof text !== "string") return null;
    const regex = /([^\s\\\/<>:"\|\?\*]+?\.(txt|md|json|csv|log|ini|conf|xml|yml|yaml|html|htm|js|ts|xls|xlsx))/i;
    const cleaned = text.replace(/[“”"'‘’]+/g, " ").trim();
    const m = cleaned.match(regex);
    if (!m) return null;
    const fn = m[1];
    if (/[\\/]/.test(fn)) return null;
    return fn;
  }
  /**
   * 纠正 Excel 相关工具的文件参数，确保传入绝对路径
   * 适用于 excel-mcp-server 的工具（如 read_data_from_excel）, 以及名称包含 excel/sheet/workbook 的工具
   */
  ensureExcelFileArg(toolName, toolArgs, toolsContent, messages) {
    const isExcelTool = /excel|sheet|workbook/i.test(toolName) || toolName === "read_data_from_excel";
    if (!isExcelTool) return toolArgs;
    let candidate = null;
    if (toolsContent) {
      candidate = this.extractWindowsPath(toolsContent);
    }
    if (!candidate) {
      const lastText = this.getLastUserText(messages);
      if (lastText) {
        candidate = this.extractWindowsPath(lastText);
      }
    }
    const pickSheetName = (text) => {
      if (!text || typeof text !== "string") return null;
      const patterns = [
        /(sheet[_\s-]?name)\s*(?:为|是|:|=)\s*[‘'“"]?([A-Za-z0-9_\-\s\u4e00-\u9fa5]+)[’'”"]?/i,
        /(工作表|表名|sheet|worksheet)\s*(?:为|是|:|=)\s*[‘'“"]?([A-Za-z0-9_\-\s\u4e00-\u9fa5]+)[’'”"]?/i
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[2]) {
          const raw = m[2];
          const cleaned = raw.trim().replace(/[‘’“”"'\s，。；、：]+$/g, "");
          return cleaned || null;
        }
      }
      return null;
    };
    const provided = toolArgs?.filename || toolArgs?.file_path || toolArgs?.path || toolArgs?.file;
    let sanitized;
    if (typeof provided === "string") {
      sanitized = this.sanitizeFilePathV2(provided, candidate || void 0);
    } else if (candidate) {
      sanitized = this.sanitizeFilePathV2(candidate, candidate || void 0);
    }
    if ((!sanitized || !/^[A-Za-z]:\\/.test(sanitized)) && candidate && /^[A-Za-z]:\\/.test(candidate)) {
      sanitized = this.sanitizeFilePathV2(candidate, candidate);
    }
    if (sanitized) {
      let finalPath = sanitized;
      try {
        const excelExtPattern = /(\.xlsx|\.xlsm|\.xls|\.xltx|\.xltm)/i;
        const m = finalPath.match(excelExtPattern);
        if (m) {
          const idx = finalPath.indexOf(m[0]);
          if (idx >= 0) {
            finalPath = finalPath.slice(0, idx + m[0].length);
          }
        }
        finalPath = finalPath.replace(/[‘’“”"'\s，。；、：]+$/g, "");
      } catch {
      }
      const dirLike = this.isDirectoryLikePath(sanitized);
      if (dirLike) {
        let filenameCandidate = null;
        if (typeof toolArgs.filename === "string") {
          filenameCandidate = this.extractFileNameCandidate(toolArgs.filename);
        }
        if (!filenameCandidate && typeof toolArgs.file === "string") {
          filenameCandidate = this.extractFileNameCandidate(toolArgs.file);
        }
        if (!filenameCandidate && typeof toolArgs.path === "string") {
          filenameCandidate = this.extractFileNameCandidate(toolArgs.path);
        }
        if (!filenameCandidate && toolsContent) {
          filenameCandidate = this.extractFileNameCandidate(toolsContent);
        }
        if (!filenameCandidate) {
          const lastText = this.getLastUserText(messages);
          if (lastText) {
            filenameCandidate = this.extractFileNameCandidate(lastText);
          }
        }
        if (filenameCandidate) {
          finalPath = this.joinDirAndFile(sanitized, filenameCandidate);
        }
      }
      if (toolName === "read_data_from_excel") {
        let sheetName = null;
        if (typeof toolArgs?.sheet_name === "string" && toolArgs.sheet_name.trim()) {
          sheetName = toolArgs.sheet_name.trim();
        } else if (typeof toolArgs?.sheet === "string" && toolArgs.sheet.trim()) {
          sheetName = toolArgs.sheet.trim();
        } else if (typeof toolArgs?.worksheet === "string" && toolArgs.worksheet.trim()) {
          sheetName = toolArgs.worksheet.trim();
        }
        if (!sheetName) {
          const lastText = this.getLastUserText(messages);
          sheetName = pickSheetName(toolsContent) || pickSheetName(lastText) || null;
        }
        if (!sheetName) sheetName = "Sheet1";
        toolArgs = { filepath: finalPath, sheet_name: sheetName };
      } else {
        toolArgs.filepath = finalPath;
        toolArgs.filename = finalPath;
        toolArgs.file_path = finalPath;
        toolArgs.path = finalPath;
      }
      if (typeof toolArgs.file === "string" && !/^[A-Za-z]:\\/.test(toolArgs.file)) {
        delete toolArgs.file;
      }
    }
    try {
      const finalLog = toolArgs?.filepath || toolArgs?.filename || toolArgs?.file_path || toolArgs?.path;
      import_log.logger.info(`[MCP Excel] tool="${toolName}", provided="${provided}", candidate="${candidate}", sanitized="${sanitized}", final="${finalLog}", sheet_name="${toolArgs?.sheet_name ?? ""}"`);
    } catch {
    }
    return toolArgs;
  }
  /**
   * 目录与文件名拼接为 Windows 绝对路径
   */
  joinDirAndFile(dir, filename) {
    const d = dir.replace(/[“”"'‘’]+/g, "").trim();
    const f = filename.replace(/[“”"'‘’]+/g, "").trim();
    return import_path.default.win32.join(d, f);
  }
  /**
   * 确保 FileSystem 相关工具调用具备并纠正 file_path 参数
   */
  ensureFilePathArg(toolName, toolArgs, toolsContent, messages) {
    const fsToolNames = /* @__PURE__ */ new Set(["read_text_file", "read_json_file", "write_file", "append_file", "append_text_file", "read_file"]);
    const isFS = fsToolNames.has(toolName) || /read/i.test(toolName) && /file/i.test(toolName) || /write|append/i.test(toolName) && /file/i.test(toolName);
    if (!isFS) return toolArgs;
    let candidate = null;
    if (toolsContent) {
      candidate = this.extractWindowsPath(toolsContent);
    }
    if (!candidate) {
      const lastText = this.getLastUserText(messages);
      if (lastText) {
        candidate = this.extractWindowsPath(lastText);
      }
    }
    const provided = toolArgs?.file_path || toolArgs?.path || toolArgs?.file || toolArgs?.filename;
    let sanitized;
    if (!provided && candidate) {
      sanitized = this.sanitizeFilePathV2(candidate || "", candidate || void 0);
    } else if (provided && typeof provided === "string") {
      sanitized = this.sanitizeFilePathV2(provided, candidate || void 0);
    }
    if (sanitized) {
      let finalPath = sanitized;
      const dirLike = this.isDirectoryLikePath(sanitized);
      let filenameCandidate = null;
      if (typeof toolArgs.filename === "string") {
        filenameCandidate = this.extractFileNameCandidate(toolArgs.filename);
      } else if (typeof toolArgs.file === "string") {
        if (!/^[A-Za-z]:\\/.test(toolArgs.file)) {
          filenameCandidate = this.extractFileNameCandidate(toolArgs.file);
        }
      }
      if (!filenameCandidate) {
        filenameCandidate = this.extractFileNameCandidate(toolsContent);
      }
      if (!filenameCandidate) {
        const lastText = this.getLastUserText(messages);
        if (lastText) {
          filenameCandidate = this.extractFileNameCandidate(lastText);
        }
      }
      if (dirLike && filenameCandidate) {
        finalPath = this.joinDirAndFile(sanitized, filenameCandidate);
      }
      try {
        const commonExtPattern = /(\.(txt|md|json|csv|log|ini|conf|xml|yml|yaml|html|htm|js|ts))/i;
        const m = finalPath.match(commonExtPattern);
        if (m) {
          const idx = finalPath.indexOf(m[0]);
          if (idx >= 0) {
            finalPath = finalPath.slice(0, idx + m[0].length);
          }
        }
        finalPath = finalPath.replace(/[‘’“”"'\s，。；、：]+$/g, "");
      } catch {
      }
      toolArgs.file_path = finalPath;
      toolArgs.path = finalPath;
      if (typeof toolArgs.file === "string" && !/^[A-Za-z]:\\/.test(toolArgs.file)) {
        delete toolArgs.file;
      }
      if (typeof toolArgs.filename === "string" && !/^[A-Za-z]:\\/.test(toolArgs.filename)) {
        delete toolArgs.filename;
      }
    }
    try {
      import_log.logger.info(`[MCP FS] tool="${toolName}", provided="${provided}", candidate="${candidate}", sanitized="${sanitized}", final="${toolArgs?.file_path || toolArgs?.path}"`);
    } catch {
    }
    return toolArgs;
  }
  /**
   * 从工具参数或上下文中提取 docx 目标路径与写入内容
   */
  extractDocxPathAndContent(toolArgs, toolsContent, messages) {
    let candidatePath;
    const provided = toolArgs?.file_path || toolArgs?.filepath || toolArgs?.path || toolArgs?.file || toolArgs?.filename;
    if (typeof provided === "string") {
      const p = this.sanitizeFilePathV2(provided, provided);
      candidatePath = p;
    }
    if (!candidatePath) {
      let c = this.extractWindowsPath(toolsContent);
      if (!c) {
        const lastText = this.getLastUserText(messages);
        c = this.extractWindowsPath(lastText || "") || null;
      }
      if (c) candidatePath = this.sanitizeFilePathV2(c, c);
    }
    if (candidatePath && !/\.docx$/i.test(candidatePath)) {
      candidatePath = void 0;
    }
    let content;
    if (typeof toolArgs?.content === "string") content = toolArgs.content;
    else if (typeof toolArgs?.text === "string") content = toolArgs.text;
    else if (typeof toolArgs?.data === "string") content = toolArgs.data;
    if (!content) {
      const last = this.getLastUserText(messages) || "";
      const m = last.match(/内容\s*是\s*[“"']([^“"']+)[”"']/);
      if (m && m[1]) content = m[1].trim();
    }
    return { path: candidatePath, content };
  }
  /**
   * 规范化读取选项，避免 head 与 tail 同时指定导致服务器报错
   */
  normalizeReadOptionsArg(toolName, toolArgs) {
    const isRead = /read/i.test(toolName) && /file|text/i.test(toolName) || toolName === "read_text_file" || toolName === "read_file";
    if (!isRead || !toolArgs || typeof toolArgs !== "object") return toolArgs;
    const hasHead = Object.prototype.hasOwnProperty.call(toolArgs, "head");
    const hasTail = Object.prototype.hasOwnProperty.call(toolArgs, "tail");
    if (hasHead && hasTail) {
      delete toolArgs.head;
      delete toolArgs.tail;
      try {
        import_log.logger.warn(`[MCP FS] normalize: removed conflicting head/tail for tool="${toolName}"`);
      } catch {
      }
    } else {
      if (hasHead) {
        const h = Number(toolArgs.head);
        if (!Number.isFinite(h) || h <= 0) delete toolArgs.head;
        else toolArgs.head = Math.floor(h);
      }
      if (hasTail) {
        const t = Number(toolArgs.tail);
        if (!Number.isFinite(t) || t <= 0) delete toolArgs.tail;
        else toolArgs.tail = Math.floor(t);
      }
    }
    return toolArgs;
  }
  /**
   * 针对 Claude Code 的 Skill 工具参数进行专门规范化：
   * - 仅当 serverName 含有 "claude code" 且 toolName 含有 "Skill" 时生效
   * - 接受多种别名字段：skill、skill_name、name、cmd、command、action、mode、operation
   * - 当传入对象或数组时，优先提取其中的 name 或第一个元素为技能名
   * - 若未能确定技能名，则根据最近用户消息进行语义线索提取（如 PDF/Excel/Word/Git/视频/Canvas）
   * - 移除 schema 未声明的额外字段（args/arguments/params/parameters/options/opts/data 等），避免服务器报错
   */
  ensureClaudeSkillArg(serverName, toolName, toolArgs, messages) {
    try {
      if (!/claude\s*code/i.test(serverName)) return toolArgs;
      if (!/skill/i.test(toolName)) return toolArgs;
      const argsObj = toolArgs && typeof toolArgs === "object" ? { ...toolArgs } : {};
      let skillRaw = typeof toolArgs === "string" ? toolArgs : argsObj.skill ?? argsObj.skill_name ?? argsObj.name ?? argsObj.cmd ?? argsObj.command ?? argsObj.action ?? argsObj.mode ?? argsObj.operation;
      if (skillRaw && typeof skillRaw === "object") {
        try {
          if (Array.isArray(skillRaw)) {
            skillRaw = skillRaw.length > 0 ? skillRaw[0] : "";
          }
          if (skillRaw && typeof skillRaw === "object") {
            if (typeof skillRaw.name === "string") {
              skillRaw = skillRaw.name;
            } else if (typeof skillRaw.id === "string") {
              skillRaw = skillRaw.id;
            } else {
              const keys = Object.keys(skillRaw);
              if (keys.length === 1 && typeof skillRaw[keys[0]] === "string") {
                skillRaw = skillRaw[keys[0]];
              } else {
                skillRaw = "";
              }
            }
          }
        } catch {
          skillRaw = "";
        }
      }
      if (typeof skillRaw !== "string" || !skillRaw.trim()) {
        const last = this.getLastUserText(messages) || "";
        const lower = last.toLowerCase();
        const pathInText = this.extractWindowsPath(last) || "";
        let guess = "";
        if (/\.xlsx?$/i.test(pathInText) || /(excel|xlsx|workbook|sheet)/i.test(lower)) {
          guess = "xlsx";
        } else if (/\.pdf$/i.test(pathInText) || /pdf/i.test(lower)) {
          guess = "pdf";
        } else if (/\.docx$/i.test(pathInText) || /(word|docx)/i.test(lower)) {
          guess = "docx";
        } else if (/git/i.test(lower)) {
          guess = "git-pushing";
        } else if (/(video|下载|download)/i.test(lower)) {
          guess = "video-downloader";
        } else if (/(canvas|设计|design)/i.test(lower)) {
          guess = "canvas-design";
        }
        if (guess) skillRaw = guess;
      }
      if (typeof skillRaw === "string") {
        const normalizeSkill = (s) => {
          const raw = (s || "").trim();
          const lower = raw.toLowerCase();
          if (/^(list|list_skills|show_skills|skills|skill_list)$/.test(lower)) return "list";
          if (/列出技能|技能列表|查看技能|显示技能/.test(raw)) return "list";
          if (/^excel$/.test(lower)) return "xlsx";
          if (/^(xlsx|sheet|workbook)$/.test(lower)) return "xlsx";
          if (/^word$/.test(lower)) return "docx";
          if (/^(doc|docx)$/.test(lower)) return "docx";
          if (/^pdf$/.test(lower) || /(pdf阅读|read_pdf|pdf_parser)/.test(lower)) return "pdf";
          if (/git.*push/.test(lower)) return "git-pushing";
          if (/video|downloader|下载视频/.test(lower)) return "video-downloader";
          if (/canvas|design|设计/.test(lower)) return "canvas-design";
          return raw;
        };
        argsObj.skill = normalizeSkill(skillRaw);
      }
      delete argsObj.args;
      delete argsObj.arguments;
      delete argsObj.params;
      delete argsObj.parameters;
      delete argsObj.options;
      delete argsObj.opts;
      delete argsObj.data;
      delete argsObj.skill_name;
      delete argsObj.name;
      delete argsObj.cmd;
      delete argsObj.command;
      delete argsObj.action;
      delete argsObj.mode;
      delete argsObj.operation;
      try {
        const dbg = typeof toolArgs === "string" ? `stringArg=${JSON.stringify(toolArgs)}` : `rawArgs=${JSON.stringify(toolArgs)}`;
        import_log.logger.info(`[MCP ClaudeSkill] normalized args for ${serverName}__${toolName}: ${JSON.stringify(argsObj)}; ${dbg}`);
      } catch {
      }
      return argsObj;
    } catch (e) {
      try {
        import_log.logger.warn(`[MCP ClaudeSkill] ensure args failed for ${serverName}__${toolName}:`, e);
      } catch {
      }
      return toolArgs;
    }
  }
  /**
   * 通用路径参数归一化（适配所有带路径字段的工具，不限 FileSystem）
   * - 基于工具 schema 判断是否存在路径/目录相关字段
   * - 从工具内容与最近用户消息中提取 Windows 绝对路径，进行清理并填充
   * - 若提取到的是目录且存在文件名候选，则拼接为完整路径
   * - 不会覆盖已存在且有效的路径字段（仅在缺失或看似目录时进行修正）
   */
  ensureGenericPathArg(fullToolName, toolName, toolArgs, toolsContent, messages) {
    try {
      const schema = this.toolsSchemaByName.get(fullToolName);
      const properties = schema && schema.properties ? schema.properties : {};
      const hasPathFieldInSchema = ["file_path", "filepath", "path", "file", "filename"].some((k) => Object.prototype.hasOwnProperty.call(properties, k));
      const hasDirFieldInSchema = ["directory_path", "dir_path", "directory", "dir", "folder"].some((k) => Object.prototype.hasOwnProperty.call(properties, k));
      const looksPathyArgs = toolArgs && (toolArgs.file_path || toolArgs.filepath || toolArgs.path || toolArgs.file || toolArgs.filename);
      const looksDirArgs = toolArgs && (toolArgs.directory_path || toolArgs.dir_path || toolArgs.directory || toolArgs.dir || toolArgs.folder);
      if (!hasPathFieldInSchema && !hasDirFieldInSchema && !looksPathyArgs && !looksDirArgs) return toolArgs;
      let candidate = null;
      if (toolsContent) candidate = this.extractWindowsPath(toolsContent);
      if (!candidate) {
        const lastText = this.getLastUserText(messages);
        if (lastText) candidate = this.extractWindowsPath(lastText);
      }
      const provided = toolArgs?.file_path || toolArgs?.filepath || toolArgs?.path || toolArgs?.file || toolArgs?.filename;
      let sanitized;
      if (!provided && candidate) {
        sanitized = this.sanitizeFilePathV2(candidate || "", candidate || void 0);
      } else if (provided && typeof provided === "string") {
        sanitized = this.sanitizeFilePathV2(provided, candidate || void 0);
      }
      if (sanitized) {
        let finalPath = sanitized;
        const dirLike = this.isDirectoryLikePath(sanitized);
        let filenameCandidate = null;
        if (typeof toolArgs.filename === "string") {
          filenameCandidate = this.extractFileNameCandidate(toolArgs.filename);
        } else if (typeof toolArgs.file === "string") {
          if (!/^[A-Za-z]:\\/.test(toolArgs.file)) {
            filenameCandidate = this.extractFileNameCandidate(toolArgs.file);
          }
        }
        if (!filenameCandidate) {
          filenameCandidate = this.extractFileNameCandidate(toolsContent);
        }
        if (!filenameCandidate) {
          const lastText = this.getLastUserText(messages);
          if (lastText) filenameCandidate = this.extractFileNameCandidate(lastText);
        }
        if (dirLike && filenameCandidate) {
          finalPath = this.joinDirAndFile(sanitized, filenameCandidate);
        }
        try {
          const commonExtPattern = /(\.(txt|md|json|csv|log|ini|conf|xml|yml|yaml|html|htm|js|ts|docx|doc|pdf|xls|xlsx|xlsm))/i;
          const m = finalPath.match(commonExtPattern);
          if (m) {
            const idx = finalPath.indexOf(m[0]);
            if (idx >= 0) {
              finalPath = finalPath.slice(0, idx + m[0].length);
            }
          }
          finalPath = finalPath.replace(/[‘’“”"'\s，。；、：]+$/g, "");
        } catch {
        }
        if (!toolArgs.file_path && Object.prototype.hasOwnProperty.call(properties, "file_path")) {
          toolArgs.file_path = finalPath;
        } else if (!toolArgs.path && Object.prototype.hasOwnProperty.call(properties, "path")) {
          toolArgs.path = finalPath;
        } else if (!toolArgs.file && Object.prototype.hasOwnProperty.call(properties, "file")) {
          toolArgs.file = finalPath;
        } else if (!toolArgs.filename && Object.prototype.hasOwnProperty.call(properties, "filename")) {
          toolArgs.filename = finalPath;
        } else {
          if (!toolArgs.file_path) toolArgs.file_path = finalPath;
        }
      }
      return toolArgs;
    } catch (e) {
      try {
        import_log.logger.warn(`[MCP GenericPath] failed for ${fullToolName}:`, e);
      } catch {
      }
      return toolArgs;
    }
  }
  /**
   * 基于工具 JSON Schema 的通用参数归一化：字段别名、类型转换、必填项与默认值、剔除非 schema 字段
   * @param fullToolName 完整工具名（形如 "server__tool"）
   * @param toolArgs 原始工具参数
   * @param wantWrite 是否为写入型工具（影响部分默认策略）
   */
  ensureArgsBySchema(fullToolName, toolArgs, wantWrite) {
    try {
      const schema = this.toolsSchemaByName.get(fullToolName);
      if (!schema || typeof schema !== "object") return toolArgs;
      if (schema.type && schema.type !== "object") return toolArgs;
      const properties = schema.properties || {};
      const required = Array.isArray(schema.required) ? schema.required.slice() : [];
      const selectCanonical = (candidates) => {
        for (const name of candidates) {
          if (Object.prototype.hasOwnProperty.call(properties, name)) return name;
        }
        return null;
      };
      const groups = [
        // 文件路径相关（文件系统/Excel 常见）
        ["file_path", "filepath", "path", "file", "filename"],
        // 目录路径相关
        ["directory_path", "dir_path", "directory", "dir", "folder"],
        // Excel 工作表
        ["sheet_name", "sheet", "worksheet"],
        // 写入内容
        ["content", "text", "data", "body", "payload"],
        // Skill 工具常见参数：技能名/命令
        ["skill", "cmd", "command", "action", "mode", "operation", "skill_name", "name"],
        // Skill 工具常见参数：技能参数对象
        ["args", "arguments", "params", "parameters", "options", "opts", "data"],
        // 编码
        ["encoding", "charset"],
        // HTTP/网络常见参数
        ["url", "uri", "link", "address"],
        ["method", "http_method", "verb"],
        ["headers", "http_headers", "header"],
        // 查询/检索类参数
        ["query", "q", "keyword", "keywords", "search", "pattern", "prompt", "params", "parameters"],
        // 选项/配置
        ["options", "opts", "config", "settings"],
        // 超时与重试
        ["timeout", "time_limit", "t"],
        ["retries", "retry", "attempts"]
      ];
      const args = toolArgs && typeof toolArgs === "object" ? { ...toolArgs } : {};
      for (const group of groups) {
        const canonical = selectCanonical(group);
        if (!canonical) continue;
        const hasCanonical = Object.prototype.hasOwnProperty.call(args, canonical);
        if (!hasCanonical) {
          for (const name of group) {
            if (name === canonical) continue;
            if (Object.prototype.hasOwnProperty.call(args, name)) {
              args[canonical] = args[name];
              break;
            }
          }
        }
        for (const name of group) {
          if (name === canonical) continue;
          if (!Object.prototype.hasOwnProperty.call(properties, name) && Object.prototype.hasOwnProperty.call(args, name)) {
            delete args[name];
          }
        }
      }
      for (const [key, prop] of Object.entries(properties)) {
        if (!Object.prototype.hasOwnProperty.call(args, key)) {
          if (prop && Object.prototype.hasOwnProperty.call(prop, "default")) {
            args[key] = prop.default;
            continue;
          }
          if ((key === "sheet_name" || key === "sheet") && !wantWrite) {
            args[key] = "Sheet1";
            continue;
          }
          continue;
        }
        const val = args[key];
        const t = prop?.type;
        if (t === "integer" || t === "number") {
          if (typeof val === "string") {
            const n = Number(val);
            if (Number.isFinite(n)) args[key] = t === "integer" ? Math.floor(n) : n;
            else delete args[key];
          } else if (typeof val !== "number" || !Number.isFinite(val)) {
            delete args[key];
          } else if (t === "integer") {
            args[key] = Math.floor(val);
          }
        } else if (t === "boolean") {
          if (typeof val === "string") {
            const s = val.trim().toLowerCase();
            if (["true", "1", "yes", "y", "on"].includes(s)) args[key] = true;
            else if (["false", "0", "no", "n", "off"].includes(s)) args[key] = false;
            else delete args[key];
          } else if (typeof val !== "boolean") {
            delete args[key];
          }
        } else if (t === "array") {
          if (!Array.isArray(val)) {
            if (typeof val === "string") {
              const items = val.split(/[\n,;]+/).map((s) => s.trim()).filter((s) => s.length > 0);
              args[key] = items;
            } else {
              delete args[key];
            }
          }
        } else if (t === "object") {
          if (val && typeof val === "object" && !Array.isArray(val)) {
          } else if (typeof val === "string") {
            let parsed = null;
            try {
              const candidate = val.trim().replace(/^([“”"']?){/, "{").replace(/}([“”"']?)$/, "}");
              parsed = JSON.parse(candidate);
            } catch {
            }
            if (!parsed) {
              const obj = {};
              const segments = val.split(/[\n;]+/).map((s) => s.trim()).filter((s) => s.length > 0);
              for (const seg of segments) {
                const m = seg.match(/^\s*([^:=\s]+)\s*[:=]\s*(.+)\s*$/);
                if (m) {
                  const k = m[1].trim();
                  const v = m[2].trim().replace(/^[“”"']+/, "").replace(/[””"']+$/, "");
                  obj[k] = v;
                }
              }
              if (Object.keys(obj).length > 0) parsed = obj;
            }
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              args[key] = parsed;
            } else {
              delete args[key];
            }
          } else {
            delete args[key];
          }
        } else if (t === "string") {
          if (val === null || val === void 0) {
            delete args[key];
          } else if (typeof val !== "string") {
            try {
              args[key] = String(val);
            } catch {
              delete args[key];
            }
          } else {
            args[key] = val.replace(/[‘’“”"'\s，。；、：]+$/g, "").trim();
            const fmt = prop?.format;
            if (fmt === "uri" || /url/i.test(key)) {
              let s = args[key];
              s = s.replace(/^[“”"'\(\[]+/, "").replace(/[””"'\)\]]+$/, "");
              s = s.replace(/[，。；、：]+$/g, "");
              args[key] = s.trim();
            }
            if (/^method$/i.test(key)) {
              args[key] = args[key].toUpperCase();
            }
          }
          if (Array.isArray(prop?.enum) && Object.prototype.hasOwnProperty.call(args, key)) {
            const v = args[key];
            if (!prop.enum.includes(v)) {
              delete args[key];
            }
          }
        }
      }
      for (const req of required) {
        if (!Object.prototype.hasOwnProperty.call(args, req)) {
          try {
            import_log.logger.warn(`[MCP Args] required missing for ${fullToolName}: ${req}`);
          } catch {
          }
        }
      }
      const finalArgs = {};
      for (const key of Object.keys(properties)) {
        if (Object.prototype.hasOwnProperty.call(args, key)) {
          finalArgs[key] = args[key];
        }
      }
      try {
        import_log.logger.info(`[MCP Args] normalized for ${fullToolName}: ${JSON.stringify(finalArgs)}`);
      } catch {
      }
      return finalArgs;
    } catch (e) {
      try {
        import_log.logger.error(`[MCP Args] ensureArgsBySchema error for ${fullToolName}:`, e);
      } catch {
      }
      return toolArgs;
    }
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
      let session = this.sessions.get(serverName);
      if (!session && toolName) {
        try {
          const matchedFull = [...this.toolsSchemaByName.keys()].find((full) => full.endsWith(`__${toolName}`));
          if (matchedFull) {
            const recoveredServer = this.dePunycode(matchedFull.split("__")[0] || "");
            const recovered = this.sessions.get(recoveredServer);
            if (recovered) {
              session = recovered;
              try {
                import_log.logger.warn(`[MCP Tool] remapped invalid server name "${toolCall.function.name}" -> "${this.enPunycode(recoveredServer)}__${toolName}"`);
              } catch {
              }
            }
          }
        } catch {
        }
      }
      if (!session) {
        continue;
      }
      let toolArgs = {};
      const rawArgStr = toolCall.function && typeof toolCall.function.arguments === "string" ? toolCall.function.arguments : "";
      try {
        toolArgs = JSON.parse(rawArgStr);
      } catch (e) {
        let fixed = this.repairJsonArguments(rawArgStr);
        try {
          toolArgs = JSON.parse(fixed);
        } catch (e2) {
          import_log.logger.error(`Failed to parse tool arguments for ${toolName} after repair:`, e2);
          toolArgs = {};
        }
      }
      toolArgs = this.ensureExcelFileArg(toolName, toolArgs, toolsContent, messages);
      toolArgs = this.ensureFilePathArg(toolName, toolArgs, toolsContent, messages);
      toolArgs = this.normalizeReadOptionsArg(toolName, toolArgs);
      const fullToolName = `${this.enPunycode(serverName)}__${toolName}`;
      const wantWrite = import_mcp_compat.MCPCompat.isWriteLikeTool(toolName);
      toolArgs = this.ensureGenericPathArg(fullToolName, toolName, toolArgs, toolsContent, messages);
      toolArgs = this.ensureClaudeSkillArg(serverName, toolName, toolArgs, messages);
      toolArgs = this.ensureArgsBySchema(fullToolName, toolArgs, wantWrite);
      if (/claude\s*code/i.test(serverName) && /skill/i.test(toolName)) {
        const s = toolArgs && typeof toolArgs.skill === "string" ? toolArgs.skill.trim() : "";
        if (!s) {
          try {
            import_log.logger.warn(`[MCP ClaudeSkill] missing skill, skip tool call for ${serverName}__${toolName}`);
          } catch {
          }
          const guidance = [
            "\u672A\u80FD\u786E\u5B9A\u8981\u8C03\u7528\u7684 Claude Code \u6280\u80FD\uFF08skill\uFF09\u540D\u79F0\u3002",
            "\u8BF7\u5728\u540E\u7EED\u6D88\u606F\u4E2D\u4EC5\u63D0\u4F9B\u4E00\u4E2A\u6280\u80FD\u540D\u5B57\u7B26\u4E32\uFF08\u4F8B\u5982\uFF1Apdf\u3001xlsx\u3001docx\u3001git-pushing\u3001video-downloader\u3001canvas-design\uFF09\uFF0C\u4E0D\u8981\u5305\u542B\u5BF9\u8C61\u6216\u5176\u4ED6\u5B57\u6BB5\u3002",
            "\u5982\u679C\u9700\u8981\u67E5\u770B\u6709\u54EA\u4E9B\u6280\u80FD\uFF0C\u53EF\u56DE\u590D\u201C\u5217\u51FA\u6280\u80FD\u201D\u3002"
          ].join("\n");
          messages = this.updateMessages(messages, toolCall, toolsContent, guidance);
          continue;
        }
        const sNorm = s.toLowerCase();
        if (sNorm === "list" || sNorm === "help" || sNorm === "/help") {
          try {
            try {
              import_log.logger.info(`[MCP ClaudeSkill] intercept skills listing via skill="${s}" -> return available_skills locally`);
            } catch {
            }
            const available = [
              { name: "pdf", description: "\u8BFB\u53D6/\u89E3\u6790 PDF \u6587\u4EF6" },
              { name: "xlsx", description: "\u8BFB\u53D6\u6216\u5199\u5165 Excel \u5DE5\u4F5C\u7C3F" },
              { name: "docx", description: "\u8BFB\u53D6\u6216\u5199\u5165 Word \u6587\u6863" },
              { name: "git-pushing", description: "\u63A8\u9001 Git \u53D8\u66F4\uFF08\u51ED\u8BC1\u914D\u7F6E\u540E\uFF09" },
              { name: "video-downloader", description: "\u4E0B\u8F7D\u89C6\u9891\uFF08\u9700\u63D0\u4F9B\u53EF\u4E0B\u8F7D\u94FE\u63A5\u6216\u9875\u9762\uFF09" },
              { name: "canvas-design", description: "\u753B\u5E03/\u8BBE\u8BA1\u76F8\u5173\u64CD\u4F5C" }
            ];
            const toolResultArray = import_mcp_compat.MCPCompat.normalizeContentArray([{ type: "json", json: { status: "success", available_skills: available } }]);
            const toolResultLocal = { content: toolResultArray };
            try {
              this.pushProgress("tool_call_started", { server: serverName, tool: toolName, args: toolArgs, call_id: toolCall.id });
            } catch {
            }
            try {
              this.pushProgress("tool_call_finished", { server: serverName, tool: toolName, args: toolArgs, status: "success", call_id: toolCall.id });
            } catch {
            }
            try {
              const toolResultPush = this.createToolResultPush(serverName, toolName, toolArgs, toolResultLocal.content);
              this.pushMessage(toolResultPush);
            } catch {
            }
            const toolResultContent2 = this.processToolResult(toolResultLocal);
            messages = this.updateMessages(messages, toolCall, toolsContent, toolResultContent2);
            continue;
          } catch (e) {
            try {
              import_log.logger.warn(`[MCP ClaudeSkill] list intercept failed:`, e);
            } catch {
            }
          }
        }
      }
      if (wantWrite && toolArgs && typeof toolArgs === "object") {
        const p = toolArgs.file_path || toolArgs.path;
        if (typeof p === "string" && p) {
          import_mcp_compat.MCPCompat.fsEnsureParentDir(p);
        }
      }
      let toolResult;
      try {
        this.pushProgress("tool_call_started", {
          server: serverName,
          tool: toolName,
          args: toolArgs,
          call_id: toolCall.id
        });
      } catch {
      }
      try {
        toolResult = await this.executeToolCall(session, serverName, toolName, toolArgs, toolCall.id);
      } catch (err) {
        const isExcelTool = import_mcp_compat.MCPCompat.isExcelTool(toolName);
        const msg = err && (err.message || err.toString()) || "";
        const sheetNotFound = import_mcp_compat.MCPCompat.excelShouldRetrySheetNotFound(msg);
        if (isExcelTool && sheetNotFound) {
          try {
            const before = toolArgs.sheet_name || toolArgs.sheet || toolArgs.worksheet || "";
            toolArgs = import_mcp_compat.MCPCompat.excelFallbackArgsOnSheetNotFound(toolArgs);
            import_log.logger.warn(`[MCP Excel] sheet not found: "${before}", fallback and retry`);
            toolResult = await this.executeToolCall(session, toolName, toolArgs);
          } catch (err2) {
            import_log.logger.error(`[MCP Excel] retry with Sheet1 failed for ${toolName}:`, err2);
            throw err2;
          }
        } else if (import_mcp_compat.MCPCompat.isWriteLikeTool(toolName) && import_mcp_compat.MCPCompat.isSchemaMismatch(msg)) {
          try {
            const coerced = import_mcp_compat.MCPCompat.coerceWriteSuccess(toolName, toolArgs, msg);
            toolResult = coerced;
          } catch (coerceErr) {
            try {
              import_log.logger.error(`[MCPCompat] failed to coerce structured result for ${toolName}:`, coerceErr);
            } catch {
            }
            throw err;
          }
        } else if (/claude\s*code/i.test(serverName) && /skill/i.test(toolName) && import_mcp_compat.MCPCompat.isSchemaMismatch(msg)) {
          try {
            const friendly = [
              "\u63D0\u793A\uFF1AClaude Code \u7684 Skill \u5DE5\u5177\u672C\u6B21\u8FD4\u56DE\u7684\u662F\u7EAF\u6587\u672C\uFF0C\u4F46\u670D\u52A1\u7AEF\u6807\u6CE8\u4E86\u7ED3\u6784\u5316\u8F93\u51FA\uFF0C\u5BFC\u81F4 -32600 \u9519\u8BEF\u3002",
              "AingDesk \u5DF2\u81EA\u52A8\u5C06\u5176\u964D\u7EA7\u4E3A\u6587\u672C\u6A21\u5F0F\u4EE5\u7EE7\u7EED\u4F1A\u8BDD\u3002",
              "\u5982\u9700\u7ED3\u6784\u5316 JSON\uFF0C\u8BF7\u5728\u6307\u4EE4\u4E2D\u660E\u786E\u8981\u6C42\u201C\u4EC5\u8FD4\u56DE JSON\u201D\u3002"
            ].join("\n");
            const contentArray = import_mcp_compat.MCPCompat.normalizeContentArray([{ type: "text", text: friendly }]);
            toolResult = { content: contentArray };
            try {
              import_log.logger.warn(`[MCPCompat] downgraded Claude Skill result to text due to schema mismatch: ${msg}`);
            } catch {
            }
          } catch (wrapErr) {
            throw err;
          }
        } else if (/claude\s*code/i.test(serverName) && /skill/i.test(toolName) && /unknown\s*skill/i.test(msg.toLowerCase())) {
          try {
            const guidance = [
              "\u672A\u8BC6\u522B\u7684 Claude Code \u6280\u80FD\u540D\u3002",
              "\u8BF7\u4EC5\u8FD4\u56DE\u4E00\u4E2A\u6709\u6548\u6280\u80FD\u7684\u82F1\u6587\u540D\u5B57\u7B26\u4E32\uFF0C\u4F8B\u5982\uFF1Apdf\u3001xlsx\u3001docx\u3001list\uFF08\u5217\u51FA\u6280\u80FD\uFF09\u3001git-pushing\u3001video-downloader\u3001canvas-design\u3002",
              "\u4E0D\u8981\u5305\u542B\u5BF9\u8C61\u6216\u5176\u4ED6\u5B57\u6BB5\u3002"
            ].join("\n");
            const contentArray = import_mcp_compat.MCPCompat.normalizeContentArray([{ type: "text", text: guidance }, { type: "json", json: { status: "error", message: msg } }]);
            toolResult = { content: contentArray };
            try {
              import_log.logger.warn(`[MCP ClaudeSkill] unknown skill: ${msg}`);
            } catch {
            }
          } catch (wrapErr) {
            throw err;
          }
        } else {
          try {
            const contentArray = import_mcp_compat.MCPCompat.normalizeContentArray([
              { type: "json", json: { status: "error", message: msg } }
            ]);
            toolResult = { content: contentArray };
            try {
              import_log.logger.info(`[MCPCompat] structured error for ${toolName}: ${msg}`);
            } catch {
            }
          } catch (wrapErr) {
            throw err;
          }
        }
      }
      const toolResultContent = this.processToolResult(toolResult);
      const textForJudge = this.extractTextFromContentJson(toolResultContent);
      const isErr = this.isErrorText(textForJudge) || this.isErrorContentArray(toolResult?.content);
      try {
        this.pushProgress("tool_call_finished", {
          server: serverName,
          tool: toolName,
          args: toolArgs,
          status: isErr ? "error" : "success",
          call_id: toolCall.id
        });
      } catch {
      }
      const stopOnFirstSuccess = this.shouldStopOnFirstSuccess(messages);
      this._mcpHasSuccess = this._mcpHasSuccess || false;
      const hasSuccess = this._mcpHasSuccess;
      if (!(hasSuccess && isErr)) {
        const toolResultPush = this.createToolResultPush(serverName, toolName, toolArgs, toolResult.content);
        this.pushMessage(toolResultPush);
      }
      messages = this.updateMessages(messages, toolCall, toolsContent, toolResultContent);
      const decisionCfg = this.getToolDecisionConfig();
      if (isErr && this.isDocxSkillHint(textForJudge) && decisionCfg && decisionCfg.docx && decisionCfg.docx.bridgeOnError) {
        try {
          this._docxBridgeDone = this._docxBridgeDone || false;
          if (!this._docxBridgeDone) {
            try {
              this.pushProgress("docx_bridge_started", { from_server: serverName, from_tool: toolName });
            } catch {
            }
            const docxTargets = await this.findDocxToolsAcrossSessions();
            if (docxTargets && (docxTargets.readToolName || docxTargets.writeToolName || docxTargets.createToolName)) {
              const docxSession = this.sessions.get(docxTargets.serverName);
              if (docxSession) {
                const { path: docxPath, content: docxText } = this.extractDocxPathAndContent(toolArgs, toolsContent, messages);
                if (docxPath) {
                  let bridgeSucceeded = false;
                  const timeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                  if (docxTargets.readToolName && (!docxText || import_mcp_compat.MCPCompat.isReadLikeTool(toolName))) {
                    try {
                      try {
                        this.pushProgress("docx_bridge_step_started", { step: "read", server: docxTargets.serverName, tool: docxTargets.readToolName });
                      } catch {
                      }
                      let readArgs = { file_path: docxPath };
                      const fullReadName = `${this.enPunycode(docxTargets.serverName)}__${docxTargets.readToolName}`;
                      readArgs = this.ensureGenericPathArg(fullReadName, docxTargets.readToolName, readArgs, toolsContent, messages);
                      readArgs = this.ensureArgsBySchema(
                        fullReadName,
                        readArgs,
                        /*wantWrite*/
                        false
                      );
                      const readResult = await this.executeToolCall(docxSession, docxTargets.readToolName, readArgs);
                      const readPush = this.createToolResultPush(docxTargets.serverName, docxTargets.readToolName, readArgs, readResult.content);
                      this.pushMessage(readPush);
                      try {
                        this.pushProgress("docx_bridge_step_finished", { step: "read", server: docxTargets.serverName, tool: docxTargets.readToolName, status: "success" });
                      } catch {
                      }
                      const fakeCallRead = {
                        id: `docx-bridge-read-${timeId}`,
                        type: "function",
                        function: { name: `${this.enPunycode(docxTargets.serverName)}__${docxTargets.readToolName}`, arguments: JSON.stringify(readArgs) }
                      };
                      const readContent = this.processToolResult(readResult);
                      messages = this.updateMessages(messages, fakeCallRead, `\u81EA\u52A8\u6865\u63A5\uFF1A\u4F7F\u7528 ${docxTargets.serverName} \u7684 ${docxTargets.readToolName} \u8BFB\u53D6 docx \u5185\u5BB9`, readContent);
                      const rTxt = this.extractTextFromContentJson(readContent);
                      if (rTxt && !this.isErrorText(rTxt)) bridgeSucceeded = true;
                    } catch (e) {
                      try {
                        import_log.logger.warn("[MCP Docx] read bridge failed:", e);
                      } catch {
                      }
                      try {
                        this.pushProgress("docx_bridge_step_finished", { step: "read", server: docxTargets.serverName, tool: docxTargets.readToolName, status: "error", message: e && e.message || "failed" });
                      } catch {
                      }
                    }
                  }
                  if (docxTargets.createToolName) {
                    try {
                      try {
                        this.pushProgress("docx_bridge_step_started", { step: "create", server: docxTargets.serverName, tool: docxTargets.createToolName });
                      } catch {
                      }
                      let createArgs = { file_path: docxPath };
                      const fullCreateName = `${this.enPunycode(docxTargets.serverName)}__${docxTargets.createToolName}`;
                      createArgs = this.ensureGenericPathArg(fullCreateName, docxTargets.createToolName, createArgs, toolsContent, messages);
                      createArgs = this.ensureArgsBySchema(
                        fullCreateName,
                        createArgs,
                        /*wantWrite*/
                        true
                      );
                      import_mcp_compat.MCPCompat.fsEnsureParentDir(createArgs.file_path || createArgs.path);
                      const createResult = await this.executeToolCall(docxSession, docxTargets.createToolName, createArgs);
                      const createPush = this.createToolResultPush(docxTargets.serverName, docxTargets.createToolName, createArgs, createResult.content);
                      this.pushMessage(createPush);
                      try {
                        this.pushProgress("docx_bridge_step_finished", { step: "create", server: docxTargets.serverName, tool: docxTargets.createToolName, status: "success" });
                      } catch {
                      }
                      const fakeCall = {
                        id: `docx-bridge-create-${timeId}`,
                        type: "function",
                        function: { name: `${this.enPunycode(docxTargets.serverName)}__${docxTargets.createToolName}`, arguments: JSON.stringify(createArgs) }
                      };
                      const createContent = this.processToolResult(createResult);
                      messages = this.updateMessages(messages, fakeCall, `\u81EA\u52A8\u6865\u63A5\uFF1A\u4F7F\u7528 ${docxTargets.serverName} \u7684 ${docxTargets.createToolName} \u521B\u5EFA docx`, createContent);
                      const cTxt = this.extractTextFromContentJson(createContent);
                      if (cTxt && !this.isErrorText(cTxt)) bridgeSucceeded = true;
                    } catch (e) {
                      try {
                        import_log.logger.warn("[MCP Docx] create bridge failed:", e);
                      } catch {
                      }
                      try {
                        this.pushProgress("docx_bridge_step_finished", { step: "create", server: docxTargets.serverName, tool: docxTargets.createToolName, status: "error", message: e && e.message || "failed" });
                      } catch {
                      }
                    }
                  }
                  if (docxTargets.writeToolName && docxText) {
                    try {
                      try {
                        this.pushProgress("docx_bridge_step_started", { step: "write", server: docxTargets.serverName, tool: docxTargets.writeToolName });
                      } catch {
                      }
                      let writeArgs = { file_path: docxPath, content: docxText };
                      const fullWriteName = `${this.enPunycode(docxTargets.serverName)}__${docxTargets.writeToolName}`;
                      writeArgs = this.ensureGenericPathArg(fullWriteName, docxTargets.writeToolName, writeArgs, toolsContent, messages);
                      writeArgs = this.ensureArgsBySchema(
                        fullWriteName,
                        writeArgs,
                        /*wantWrite*/
                        true
                      );
                      import_mcp_compat.MCPCompat.fsEnsureParentDir(writeArgs.file_path || writeArgs.path);
                      const writeResult = await this.executeToolCall(docxSession, docxTargets.writeToolName, writeArgs);
                      const writePush = this.createToolResultPush(docxTargets.serverName, docxTargets.writeToolName, writeArgs, writeResult.content);
                      this.pushMessage(writePush);
                      try {
                        this.pushProgress("docx_bridge_step_finished", { step: "write", server: docxTargets.serverName, tool: docxTargets.writeToolName, status: "success" });
                      } catch {
                      }
                      const fakeCall2 = {
                        id: `docx-bridge-write-${timeId}`,
                        type: "function",
                        function: { name: `${this.enPunycode(docxTargets.serverName)}__${docxTargets.writeToolName}`, arguments: JSON.stringify(writeArgs) }
                      };
                      const writeContent = this.processToolResult(writeResult);
                      messages = this.updateMessages(messages, fakeCall2, `\u81EA\u52A8\u6865\u63A5\uFF1A\u4F7F\u7528 ${docxTargets.serverName} \u7684 ${docxTargets.writeToolName} \u5199\u5165 docx \u5185\u5BB9`, writeContent);
                      const wTxt = this.extractTextFromContentJson(writeContent);
                      if (wTxt && !this.isErrorText(wTxt)) bridgeSucceeded = true;
                    } catch (e) {
                      try {
                        import_log.logger.warn("[MCP Docx] write bridge failed:", e);
                      } catch {
                      }
                      try {
                        this.pushProgress("docx_bridge_step_finished", { step: "write", server: docxTargets.serverName, tool: docxTargets.writeToolName, status: "error", message: e && e.message || "failed" });
                      } catch {
                      }
                    }
                  }
                  if (bridgeSucceeded) {
                    this._mcpHasSuccess = true;
                    this._docxBridgeDone = true;
                    try {
                      this.pushProgress("docx_bridge_finished", { status: "success" });
                    } catch {
                    }
                    if (stopOnFirstSuccess) {
                      break;
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          try {
            import_log.logger.warn("[MCP Docx] bridge flow error:", e);
          } catch {
          }
          try {
            this.pushProgress("docx_bridge_finished", { status: "error", message: e && e.message || "failed" });
          } catch {
          }
        }
      }
      if (!isErr) {
        this._mcpHasSuccess = true;
        if (stopOnFirstSuccess) {
          break;
        }
      }
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
   * 解析用户消息，识别是否需要强制调用特定工具
   * 根据可用工具列表返回完整的函数名（形如 "<server>__<tool>"），否则返回 null
   */
  extractPreferredToolName(messages, availableTools) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user" && typeof m.content === "string");
    if (!lastUser || typeof lastUser.content !== "string") return null;
    const textRaw = lastUser.content;
    const text = textRaw.toLowerCase();
    const explicitlyAskMCP = text.includes("\u4F7F\u7528mcp\u5DE5\u5177") || text.includes("mcp \u5DE5\u5177") || text.includes("mcp");
    const hasWindowsPath = /[a-z]:\\\\/i.test(text) || /[a-z]:\\/i.test(text);
    let pathCandidate = null;
    try {
      pathCandidate = this.extractWindowsPath(textRaw);
    } catch {
    }
    const ext = pathCandidate ? import_path.default.win32.extname(pathCandidate) : "";
    const hintExcel = /excel[-_\s]*mcp[-_\s]*server/i.test(textRaw) || /\bexcel\b/i.test(textRaw) || /\.xlsx?$/i.test(ext);
    const wantRead = explicitlyAskMCP || hasWindowsPath ? text.includes("\u8BFB\u53D6") || text.includes("\u8BFB") : false;
    const wantWrite = explicitlyAskMCP || hasWindowsPath ? text.includes("\u5199\u5165") || text.includes("\u8FFD\u52A0") || text.includes("\u8986\u76D6") : false;
    const wantJson = /json/.test(text);
    const entries = [];
    for (const t of availableTools || []) {
      const n = t && t.function && typeof t.function.name === "string" ? t.function.name : "";
      if (!n) continue;
      const parts = n.split("__");
      const server = parts[0] || "";
      const tool = parts.slice(1).join("__");
      entries.push({ server, tool, full: n });
    }
    const normalizeKey = (s) => this.dePunycode(s).toLowerCase().replace(/[-_\s]+/g, "");
    let pool = entries;
    let strictPool = false;
    const messageNorm = textRaw.toLowerCase();
    const serversMentioned = [];
    const serversOnlyUse = [];
    const serversAvoid = [];
    const serverNames = Array.from(new Set(entries.map((e) => this.dePunycode(e.server))));
    for (const s of serverNames) {
      const sNorm = s.toLowerCase();
      const mentioned = messageNorm.includes(sNorm);
      const onlyUse = mentioned && /(只用|仅用|仅使用|只使用)/.test(messageNorm);
      const avoid = mentioned && /(不使用|不要使用|不要用|禁用)/.test(messageNorm);
      if (mentioned) serversMentioned.push(s);
      if (onlyUse) serversOnlyUse.push(s);
      if (avoid) serversAvoid.push(s);
    }
    if (serversOnlyUse.length > 0) {
      const keys = serversOnlyUse.map(normalizeKey);
      const filtered = entries.filter((e) => keys.some((k) => normalizeKey(e.server).includes(k)));
      if (filtered.length > 0) {
        pool = filtered;
        strictPool = true;
      }
    } else if (serversMentioned.length > 0) {
      const keys = serversMentioned.map(normalizeKey);
      const filtered = entries.filter((e) => keys.some((k) => normalizeKey(e.server).includes(k)));
      if (filtered.length > 0) {
        pool = filtered;
      }
    }
    if (serversAvoid.length > 0) {
      const keys = serversAvoid.map(normalizeKey);
      const filtered = pool.filter((e) => !keys.some((k) => normalizeKey(e.server).includes(k)));
      pool = filtered.length > 0 ? filtered : pool;
      strictPool = true;
    }
    const pickBy = (predicate) => {
      const found = pool.find(predicate) || (!strictPool ? entries.find(predicate) : void 0);
      return found ? found.full : null;
    };
    const toolNames = Array.from(new Set(entries.map((e) => e.tool))).sort((a, b) => b.length - a.length);
    const toolsMentioned = [];
    for (const tName of toolNames) {
      const tNorm = tName.toLowerCase();
      if (messageNorm.includes(tNorm)) toolsMentioned.push(tName);
    }
    if (toolsMentioned.length > 0) {
      const tKey = toolsMentioned[0];
      const chosen = pool.find((e) => e.tool.toLowerCase() === tKey.toLowerCase()) || (!strictPool ? entries.find((e) => e.tool.toLowerCase() === tKey.toLowerCase()) : void 0);
      if (chosen) return chosen.full;
    }
    return null;
  }
  /**
   * 判断是否应当为当前消息禁用工具（tool_choice = "none"），以保障普通对话质量。
   * 规则：若不存在明显的工具使用意图（文件/路径/HTTP/Excel/显式“使用工具”等），则禁用工具。
   */
  shouldDisableToolsForMessage(messages) {
    const lastUser = this.getLastUserText(messages) || "";
    const text = lastUser.toLowerCase();
    const explicitToolHints = [
      "\u4F7F\u7528mcp\u5DE5\u5177",
      "\u4F7F\u7528 mcp \u5DE5\u5177",
      "mcp",
      "\u8C03\u7528\u5DE5\u5177",
      "\u7528\u5DE5\u5177",
      "claude code",
      "claude-code",
      "excel-mcp-server",
      "excel mcp server"
    ];
    if (explicitToolHints.some((k) => text.includes(k))) return false;
    const hasWindowsPath = /[a-z]:\\\\/i.test(text) || /[a-z]:\//i.test(text) || /[a-z]:\\/i.test(text);
    const hasUrl = /https?:\/\//i.test(text);
    const hasFileKeywords = /(读取|读|写入|追加|覆盖|保存|打开|目录|路径|文件|excel|工作簿|工作表|sheet)/i.test(lastUser);
    if (hasWindowsPath || hasUrl || hasFileKeywords) return false;
    return true;
  }
  /**
   * 执行工具调用
   * @param {Client} session - 会话对象
   * @param {string} toolName - 工具名称
   * @param {any} toolArgs - 工具参数
   * @returns {Promise<MCPToolResult>} - 工具调用结果的 Promise
   */
  async executeToolCall(session, serverName, toolName, toolArgs, callId) {
    const ctrl = new AbortController();
    if (callId) this.activeToolCalls.set(callId, ctrl);
    const cfg = this.serverConfigs.get(serverName);
    const timeoutMs = cfg && typeof cfg.timeout === "number" ? Number(cfg.timeout) * 1e3 : 6e4;
    const longRunning = !!(cfg && cfg.longRunning);
    const maxTotalTimeout = longRunning ? 10 * 60 * 1e3 : void 0;
    try {
      const result = await session.callTool({
        name: toolName,
        arguments: toolArgs
      }, void 0, {
        onprogress: (process2) => {
          try {
            const total = Number(process2?.total || 1);
            const progressVal = Number(process2?.progress || 0);
            const ratio = total ? progressVal / total : 0;
            this.pushProgress("tool_call_progress", { server: serverName, tool: toolName, call_id: callId, progress: ratio, progress_value: progressVal, total });
          } catch {
          }
        },
        timeout: timeoutMs,
        resetTimeoutOnProgress: longRunning,
        maxTotalTimeout,
        signal: ctrl.signal
      });
      return result;
    } catch (error) {
      if (callId) this.activeToolCalls.delete(callId);
      import_log.logger.error(`Failed to execute tool call for ${toolName}:`, error);
      throw error;
    } finally {
      if (callId) this.activeToolCalls.delete(callId);
    }
  }
  /**
   * 在所有已连接的服务器中查找可用于“docx/Word 创建或写入”的工具
   * 返回优先的写入型工具与可选的创建型工具。
   */
  async findDocxToolsAcrossSessions() {
    try {
      const candidates = [];
      for (const [serverName, session] of this.sessions) {
        let tools = [];
        try {
          const resp = await session.listTools();
          tools = resp.tools || [];
        } catch {
        }
        for (const t of tools) {
          const name = (t?.name || "").toString();
          const desc = (t?.description || "").toString();
          const s = `${name} ${desc}`.toLowerCase();
          if (/docx|word/.test(s)) {
            candidates.push({ serverName, toolName: name, desc });
          }
        }
      }
      if (candidates.length === 0) return null;
      const rank = (toolName, desc) => {
        const s = `${toolName} ${desc}`.toLowerCase();
        if (/(read|open|extract|parse|text)/.test(s)) return "read";
        if (/(write|append|insert|add|update|replace)/.test(s)) return "write";
        if (/(create|new|generate|make|build)/.test(s)) return "create";
        return "unknown";
      };
      let readTool = null;
      let writeTool = null;
      let createTool = null;
      for (const c of candidates) {
        const kind = rank(c.toolName, c.desc);
        if (kind === "read" && !readTool) readTool = { serverName: c.serverName, toolName: c.toolName };
        if (kind === "write" && !writeTool) writeTool = { serverName: c.serverName, toolName: c.toolName };
        if (kind === "create" && !createTool) createTool = { serverName: c.serverName, toolName: c.toolName };
        if (readTool && writeTool && createTool) break;
      }
      if (readTool || writeTool || createTool) {
        return {
          serverName: readTool?.serverName || writeTool?.serverName || createTool.serverName,
          readToolName: readTool?.toolName,
          writeToolName: writeTool?.toolName,
          createToolName: createTool?.toolName
        };
      }
      return null;
    } catch (e) {
      try {
        import_log.logger.warn("[MCP Docx] find tools failed:", e);
      } catch {
      }
      return null;
    }
  }
  /**
   * 创建工具调用结果推送对象
   * @param {string} serverName - 服务器名称
   * @param {string} toolName - 工具名称
   * @param {any} toolArgs - 工具参数
   * @param {any} toolResultRaw - 工具调用结果原始内容（通常为 MCP content 数组）
   * @returns {any} - 工具调用结果推送对象
   */
  createToolResultPush(serverName, toolName, toolArgs, toolResultRaw) {
    const toolResultArray = import_mcp_compat.MCPCompat.normalizeContentArray(toolResultRaw);
    return {
      "tool_server": serverName,
      "tool_name": toolName,
      "tool_args": toolArgs,
      "tool_result": toolResultArray
    };
  }
  /**
   * 创建进度事件推送对象（统一使用 <mcptool> 包裹，前端通过 type:'progress' 区分）
   * @param {string} event - 事件名称
   * @param {any} payload - 事件负载（通用结构，避免硬编码）
   * @returns {any} - 进度事件对象
   */
  createProgressPush(event, payload) {
    const base = { type: "progress", event, ts: Date.now() };
    try {
      if (payload && typeof payload === "object") {
        Object.assign(base, payload);
      } else if (payload !== void 0) {
        base.payload = payload;
      }
    } catch {
    }
    return base;
  }
  /**
   * 推送进度事件
   * @param {string} event - 事件名称
   * @param {any} payload - 事件负载
   */
  pushProgress(event, payload) {
    const obj = this.createProgressPush(event, payload);
    this.pushMessage(obj);
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
      try {
        const readyList = Object.values(toolCallMap).map((tc) => ({
          id: tc.id,
          name: tc.function && tc.function.name || ""
        }));
        this.pushProgress("tool_calls_ready", { list: readyList });
      } catch {
      }
      messages = await this.callTools(toolCallMap, messages, toolsContent);
      const pickLastNonErrorToolTextMessage = (msgs) => {
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i];
          if (m && m.role === "tool" && typeof m.content === "string") {
            const txt = this.extractTextFromContentJson(m.content);
            if (txt && !this.isErrorText(txt)) return m;
          }
        }
        return null;
      };
      let last_message = pickLastNonErrorToolTextMessage(messages) || messages[messages.length - 1];
      if (last_message.content) {
        let extractedText = null;
        try {
          let contentStr = last_message.content.toString().trim();
          let toolMessage = JSON.parse(contentStr);
          if (toolMessage && Array.isArray(toolMessage) && toolMessage.length > 0 && toolMessage[0].text) {
            extractedText = toolMessage[0].text.trim();
            if (extractedText.startsWith("<end>") && extractedText.endsWith("</end>")) {
              extractedText = extractedText.replace("<end>", "").replace("</end>", "").trim();
              const chunk = {
                created_at: Date.now(),
                index: 0,
                choices: [
                  {
                    finish_reason: "stop",
                    delta: { content: extractedText }
                  }
                ]
              };
              this.callback(chunk);
              return;
            }
            if (extractedText.startsWith("<echo>") && extractedText.endsWith("</echo>")) {
              extractedText = extractedText.replace("<echo>", "").replace("</echo>", "").trim();
              const chunk = {
                created_at: Date.now(),
                index: 0,
                choices: [
                  {
                    finish_reason: "stop",
                    delta: { content: extractedText }
                  }
                ]
              };
              this.callback(chunk);
              return;
            }
          }
        } catch (e) {
        }
        if (extractedText) {
          const chunk = {
            created_at: Date.now(),
            index: 0,
            choices: [
              {
                finish_reason: "stop",
                delta: { content: extractedText }
              }
            ]
          };
          this.callback(chunk);
          return;
        }
      }
      await this.handleToolCalls(availableTools, messages, true);
    }
    return messages;
  }
  /**
   * 尝试修复模型生成的工具参数 JSON 字符串中的常见问题，返回修复后的字符串。
   * 仅进行“安全修复”：
   * - 对被双引号括起来的 Windows 路径值（形如 "C:\\..." 或 "D:\\..."），将其中的单个反斜杠替换为双反斜杠
   * - 去除路径值末尾混入的中文说明或标点（在首个合法扩展名之后裁切）
   */
  repairJsonArguments(raw) {
    if (!raw || typeof raw !== "string") return raw;
    let s = raw;
    const pathValueRegex = /(:\s*")([A-Za-z]:\\[^"\n\r]*?)(")/g;
    s = s.replace(pathValueRegex, (m, p1, p2, p3) => {
      const escapedPath = p2.replace(/\\/g, "\\\\");
      return p1 + escapedPath + p3;
    });
    const exts = [
      "txt",
      "md",
      "json",
      "csv",
      "log",
      "ini",
      "conf",
      "xml",
      "yml",
      "yaml",
      "html",
      "htm",
      "js",
      "ts",
      "tsx",
      "jsx",
      "java",
      "py",
      "go",
      "rb",
      "php",
      "c",
      "cpp",
      "h",
      "hpp",
      "css"
    ];
    const chineseTail = /([\u4e00-\u9fa5，。？！；：：、…【】《》“”‘’\(\)（）\s].*)$/;
    s = s.replace(/(:\s*")([A-Za-z]:\\[^"\n\r]*?)(")/g, (m, p1, p2, p3) => {
      let pathStr = p2;
      const dotIdx = pathStr.lastIndexOf(".");
      if (dotIdx > 0) {
        const ext = pathStr.slice(dotIdx + 1).toLowerCase();
        if (exts.includes(ext)) {
          const afterExt = pathStr.slice(dotIdx + 1);
          if (chineseTail.test(afterExt)) {
            pathStr = pathStr.slice(0, dotIdx + 1 + ext.length);
          }
        }
      }
      const escapedPath = pathStr.replace(/\\/g, "\\\\");
      return p1 + escapedPath + p3;
    });
    return s;
  }
  /**
   * 获取工具决策配置（从用户数据目录 config.json 中读取），并提供默认值
   */
  getToolDecisionConfig() {
    try {
      const cfg = import_public.pub.C("toolDecision");
      const def = {
        mode: "injection",
        // injection|gate|auto
        confirmationHint: true,
        // 是否在工具调用前要求模型先提示一句（启用“先自查、后调用”）
        keywords: {
          explicitToolHints: [
            "\u4F7F\u7528mcp\u5DE5\u5177",
            "\u4F7F\u7528 mcp \u5DE5\u5177",
            "mcp",
            "\u8C03\u7528\u5DE5\u5177",
            "\u7528\u5DE5\u5177",
            "claude code",
            "claude-code",
            "excel-mcp-server",
            "excel mcp server"
          ],
          fileKeywords: [
            "\u8BFB\u53D6",
            "\u8BFB",
            "\u5199\u5165",
            "\u8FFD\u52A0",
            "\u8986\u76D6",
            "\u4FDD\u5B58",
            "\u6253\u5F00",
            "\u76EE\u5F55",
            "\u8DEF\u5F84",
            "\u6587\u4EF6",
            "excel",
            "\u5DE5\u4F5C\u7C3F",
            "\u5DE5\u4F5C\u8868",
            "sheet"
          ]
        },
        docx: {
          // 是否允许在“明确 docx 意图且已解析到路径与内容”时，跳过模型直接调用具备 docx 能力的工具（默认关闭）
          directFallback: false,
          // 是否在工具调用发生错误且错误文本暗示需要 docx/word 能力时，尝试自动桥接到具备 docx 能力的服务器（默认关闭）
          bridgeOnError: false,
          // 在识别到 .docx 路径的场景下，默认禁用通用 Read 工具，避免对二进制 .docx 的误读
          disableGenericReadForDocx: true
        },
        systemPromptTemplate: "\u4F60\u9700\u8981\u5728\u6BCF\u6B21\u56DE\u590D\u524D\u5224\u65AD\u7528\u6237\u610F\u56FE\uFF1A\u662F\u7EAF\u5BF9\u8BDD\uFF0C\u8FD8\u662F\u9700\u8981\u4F7F\u7528\u5DE5\u5177\u3002\u4EC5\u5728\u660E\u786E\u5B58\u5728\u5DE5\u5177\u610F\u56FE\uFF08\u51FA\u73B0\u5DE5\u5177\u540D\u79F0\u3001\u8DEF\u5F84/URL\u3001\u6216\u6587\u4EF6/\u8868\u683C\u64CD\u4F5C\u7C7B\u5173\u952E\u8BCD\uFF09\u65F6\u624D\u8C03\u7528\u5DE5\u5177\uFF1B\u5426\u5219\u76F4\u63A5\u7528\u4E2D\u6587\u56DE\u7B54\u3002\u5DE5\u5177\u8C03\u7528\u5206\u4E24\u9636\u6BB5\uFF1A\u7B2C\u4E00\u9636\u6BB5\u5148\u7528\u4E2D\u6587\u8F93\u51FA\u201C\u8BA1\u5212\u4E0E\u53C2\u6570\u786E\u8BA4\u201D\uFF0C\u5305\u542B\uFF1A\u5C06\u8981\u8C03\u7528\u7684\u5DE5\u5177\u540D\u79F0\u3001\u8C03\u7528\u7406\u7531\u3001\u53C2\u6570\u8349\u6848\u53CA\u5176\u5408\u89C4\u6027\u68C0\u67E5\uFF08\u8DEF\u5F84/\u6269\u5C55\u540D/\u8868\u540D/\u5185\u5BB9\u7C7B\u578B\uFF09\uFF1B\u82E5\u5173\u952E\u53C2\u6570\u4E0D\u660E\u786E\uFF0C\u8BF7\u5148\u5411\u7528\u6237\u6F84\u6E05\uFF0C\u4E0D\u8981\u76F2\u76EE\u8C03\u7528\u3002\u7B2C\u4E8C\u9636\u6BB5\u5728\u53C2\u6570\u786E\u8BA4\u540E\u518D\u53D1\u8D77\u8C03\u7528\uFF0C\u5E76\u7528\u4E2D\u6587\u89E3\u91CA\u8FD4\u56DE\u7ED3\u679C\u4E0E\u540E\u7EED\u5904\u7406\u3002\u82E5\u51B3\u5B9A\u8C03\u7528\u5DE5\u5177\uFF0C\u5E94\u5148\u7B80\u8981\u8BF4\u660E\u4F60\u5C06\u8C03\u7528\u7684\u5DE5\u5177\u53CA\u539F\u56E0\uFF0C\u518D\u8FDB\u884C\u8C03\u7528\u3002\n\u5DE5\u5177\u9009\u62E9\u539F\u5219\u63D0\u793A\uFF1AExcel \u5DE5\u5177\u4EC5\u9002\u7528\u4E8E .xlsx/.xls\uFF1BWord\uFF08.docx\uFF09\u8BF7\u4F7F\u7528\u5177\u5907 docx \u80FD\u529B\u7684\u5DE5\u5177\uFF1B\u4E0D\u8981\u4F7F\u7528 Excel \u5DE5\u5177\u5904\u7406 .docx\u3002\nClaude Code \u7279\u6B8A\u8BF4\u660E\uFF1A\u5F53\u8C03\u7528 claude code__Skill \u65F6\uFF0C\u5FC5\u987B\u5728\u53C2\u6570\u4E2D\u660E\u786E\u7ED9\u51FA\u6280\u80FD\u540D\u79F0\uFF08\u4F18\u5148\u4F7F\u7528 skill \u6216 skill_name\uFF1B\u4E5F\u53EF\u4F7F\u7528 command/cmd/action\uFF09\uFF0C\u5E76\u63D0\u4F9B args/arguments\uFF08JSON \u7ED3\u6784\uFF09\u4F5C\u4E3A\u6280\u80FD\u53C2\u6570\uFF1B\u82E5\u4E0D\u6E05\u695A\u6280\u80FD\u540D\uFF0C\u8BF7\u5148\u8BF7\u6C42\u5217\u51FA\u6280\u80FD\uFF08\u4F8B\u5982\u4F7F\u7528 Skill \u5217\u8868\uFF09\uFF0C\u518D\u786E\u8BA4\u540E\u8C03\u7528\u3002\n\u4E0D\u8981\u4EC5\u51ED\u6700\u8FD1\u7528\u6237\u6D88\u606F\u4E2D\u7684\u67D0\u4E2A\u8BCD\u8BED\uFF08\u5982\u201C\u8BFB\u53D6\u201D\u3001\u201C\u5199\u5165\u201D\uFF09\u6B66\u65AD\u9009\u62E9\u5DE5\u5177\uFF1B\u5E94\u5148\u81EA\u67E5 MCP \u5DE5\u5177\u7684\u540D\u79F0\u3001\u63CF\u8FF0\u4E0E schema\uFF0C\u5E76\u5728\u53C2\u6570\u786E\u8BA4\u540E\u518D\u8C03\u7528\u3002"
      };
      const merged = Object.assign({}, def, cfg || {});
      merged.keywords = Object.assign({}, def.keywords, cfg && cfg.keywords || {});
      return merged;
    } catch (e) {
      return {
        mode: "injection",
        confirmationHint: true,
        keywords: {
          explicitToolHints: [
            "\u4F7F\u7528mcp\u5DE5\u5177",
            "\u4F7F\u7528 mcp \u5DE5\u5177",
            "mcp",
            "\u8C03\u7528\u5DE5\u5177",
            "\u7528\u5DE5\u5177",
            "claude code",
            "claude-code",
            "excel-mcp-server",
            "excel mcp server"
          ],
          fileKeywords: [
            "\u8BFB\u53D6",
            "\u8BFB",
            "\u5199\u5165",
            "\u8FFD\u52A0",
            "\u8986\u76D6",
            "\u4FDD\u5B58",
            "\u6253\u5F00",
            "\u76EE\u5F55",
            "\u8DEF\u5F84",
            "\u6587\u4EF6",
            "excel",
            "\u5DE5\u4F5C\u7C3F",
            "\u5DE5\u4F5C\u8868",
            "sheet"
          ]
        },
        docx: {
          directFallback: false,
          bridgeOnError: false,
          disableGenericReadForDocx: true
        },
        systemPromptTemplate: "\u4F60\u9700\u8981\u5728\u6BCF\u6B21\u56DE\u590D\u524D\u5224\u65AD\u7528\u6237\u610F\u56FE\uFF1A\u662F\u7EAF\u5BF9\u8BDD\uFF0C\u8FD8\u662F\u9700\u8981\u4F7F\u7528\u5DE5\u5177\u3002\u4EC5\u5728\u660E\u786E\u5B58\u5728\u5DE5\u5177\u610F\u56FE\uFF08\u51FA\u73B0\u5DE5\u5177\u540D\u79F0\u3001\u8DEF\u5F84/URL\u3001\u6216\u6587\u4EF6/\u8868\u683C\u64CD\u4F5C\u7C7B\u5173\u952E\u8BCD\uFF09\u65F6\u624D\u8C03\u7528\u5DE5\u5177\uFF1B\u5426\u5219\u76F4\u63A5\u7528\u4E2D\u6587\u56DE\u7B54\u3002\u5DE5\u5177\u8C03\u7528\u5206\u4E24\u9636\u6BB5\uFF1A\u7B2C\u4E00\u9636\u6BB5\u5148\u7528\u4E2D\u6587\u8F93\u51FA\u201C\u8BA1\u5212\u4E0E\u53C2\u6570\u786E\u8BA4\u201D\uFF0C\u5305\u542B\uFF1A\u5C06\u8981\u8C03\u7528\u7684\u5DE5\u5177\u540D\u79F0\u3001\u8C03\u7528\u7406\u7531\u3001\u53C2\u6570\u8349\u6848\u53CA\u5176\u5408\u89C4\u6027\u68C0\u67E5\uFF08\u8DEF\u5F84/\u6269\u5C55\u540D/\u8868\u540D/\u5185\u5BB9\u7C7B\u578B\uFF09\uFF1B\u82E5\u5173\u952E\u53C2\u6570\u4E0D\u660E\u786E\uFF0C\u8BF7\u5148\u5411\u7528\u6237\u6F84\u6E05\uFF0C\u4E0D\u8981\u76F2\u76EE\u8C03\u7528\u3002\u7B2C\u4E8C\u9636\u6BB5\u5728\u53C2\u6570\u786E\u8BA4\u540E\u518D\u53D1\u8D77\u8C03\u7528\uFF0C\u5E76\u7528\u4E2D\u6587\u89E3\u91CA\u8FD4\u56DE\u7ED3\u679C\u4E0E\u540E\u7EED\u5904\u7406\u3002\u82E5\u51B3\u5B9A\u8C03\u7528\u5DE5\u5177\uFF0C\u5E94\u5148\u7B80\u8981\u8BF4\u660E\u4F60\u5C06\u8C03\u7528\u7684\u5DE5\u5177\u53CA\u539F\u56E0\uFF0C\u518D\u8FDB\u884C\u8C03\u7528\u3002\n\u5DE5\u5177\u9009\u62E9\u539F\u5219\u63D0\u793A\uFF1AExcel \u5DE5\u5177\u4EC5\u9002\u7528\u4E8E .xlsx/.xls\uFF1BWord\uFF08.docx\uFF09\u8BF7\u4F7F\u7528\u5177\u5907 docx \u80FD\u529B\u7684\u5DE5\u5177\uFF1B\u4E0D\u8981\u4F7F\u7528 Excel \u5DE5\u5177\u5904\u7406 .docx\u3002\nClaude Code \u7279\u6B8A\u8BF4\u660E\uFF1A\u5F53\u8C03\u7528 claude code__Skill \u65F6\uFF0C\u5FC5\u987B\u5728\u53C2\u6570\u4E2D\u660E\u786E\u7ED9\u51FA\u6280\u80FD\u540D\u79F0\uFF08\u4F18\u5148\u4F7F\u7528 skill \u6216 skill_name\uFF1B\u4E5F\u53EF\u4F7F\u7528 command/cmd/action\uFF09\uFF0C\u5E76\u63D0\u4F9B args/arguments\uFF08JSON \u7ED3\u6784\uFF09\u4F5C\u4E3A\u6280\u80FD\u53C2\u6570\uFF1B\u82E5\u4E0D\u6E05\u695A\u6280\u80FD\u540D\uFF0C\u8BF7\u5148\u8BF7\u6C42\u5217\u51FA\u6280\u80FD\uFF08\u4F8B\u5982\u4F7F\u7528 Skill \u5217\u8868\uFF09\uFF0C\u518D\u786E\u8BA4\u540E\u8C03\u7528\u3002\n\u4E0D\u8981\u4EC5\u51ED\u6700\u8FD1\u7528\u6237\u6D88\u606F\u4E2D\u7684\u67D0\u4E2A\u8BCD\u8BED\uFF08\u5982\u201C\u8BFB\u53D6\u201D\u3001\u201C\u5199\u5165\u201D\uFF09\u6B66\u65AD\u9009\u62E9\u5DE5\u5177\uFF1B\u5E94\u5148\u81EA\u67E5 MCP \u5DE5\u5177\u7684\u540D\u79F0\u3001\u63CF\u8FF0\u4E0E schema\uFF0C\u5E76\u5728\u53C2\u6570\u786E\u8BA4\u540E\u518D\u8C03\u7528\u3002"
      };
    }
  }
  /**
   * 基于配置构建用于“工具决策”的系统提示消息
   */
  buildDecisionSystemMessage(availableTools, decisionCfg) {
    if (!decisionCfg || decisionCfg.mode !== "injection") return null;
    try {
      const toolNames = (availableTools || []).map((t) => {
        const server = t.server_name || t.server || "";
        const name = t.tools && t.tools[0] && t.tools[0].function && t.tools[0].function.name || t.name || "";
        return `${server ? server + "--" : ""}${name}`;
      }).filter((s) => !!s);
      const hintConfirm = decisionCfg.confirmationHint ? "\u5728\u51B3\u5B9A\u8C03\u7528\u5DE5\u5177\u524D\uFF0C\u8BF7\u5148\u7B80\u8981\u8BF4\u660E\u5C06\u8C03\u7528\u7684\u5DE5\u5177\u53CA\u539F\u56E0\u3002" : "";
      const sysContent = [
        decisionCfg.systemPromptTemplate,
        hintConfirm,
        toolNames.length ? `\u53EF\u7528\u5DE5\u5177\u5217\u8868\uFF08\u4F9B\u53C2\u8003\uFF09\uFF1A${toolNames.join(", ")}` : ""
      ].filter(Boolean).join("\n");
      return {
        role: "system",
        content: sysContent
      };
    } catch (e) {
      return null;
    }
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
      const decisionCfg = this.getToolDecisionConfig();
      try {
        const toolNames = (Array.isArray(availableTools) ? availableTools : []).map((t) => {
          const server = t.server_name || t.server || "";
          const name = t.tools && t.tools[0] && t.tools[0].function && t.tools[0].function.name || t.name || "";
          return { server, name };
        }).filter((e) => e.server || e.name);
        this.pushProgress("tool_decision_started", { tools_count: toolNames.length, tools: toolNames.slice(0, 50) });
      } catch {
      }
      let toolsForUse = Array.isArray(availableTools) ? [...availableTools] : availableTools || [];
      try {
        const lastUser = this.getLastUserText(messages) || "";
        const hasDocxPath = /\.docx\b/i.test(lastUser);
        if (hasDocxPath && decisionCfg?.docx?.disableGenericReadForDocx) {
          const hasDocxCap = toolsForUse.some((t) => {
            const n = (t && t.function && t.function.name || "").toLowerCase();
            const d = (t && t.function && t.function.description || "").toLowerCase();
            return n.includes("docx") || n.includes("word") || d.includes("docx") || d.includes("word");
          });
          toolsForUse = toolsForUse.filter((t) => {
            const n = (t && t.function && t.function.name || "").toLowerCase();
            const bare = n.split("__").pop() || "";
            return bare !== "read";
          });
        }
      } catch {
      }
      let toolChoice = "auto";
      const preferredToolName = this.extractPreferredToolName(messages, toolsForUse);
      if (preferredToolName) {
        toolChoice = { type: "function", function: { name: preferredToolName } };
      } else if (decisionCfg && decisionCfg.mode === "gate") {
        if (this.shouldDisableToolsForMessageWithCfg(messages, decisionCfg)) {
          toolChoice = "none";
        }
      }
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        tools: toolsForUse,
        tool_choice: toolChoice,
        stream: true
      });
      await this.handleOpenAIToolCalls(completion, messages, availableTools);
    } catch (error) {
      import_log.logger.error("Failed to call OpenAI API:", error);
      try {
        this.pushProgress("tool_decision_failed", { message: error && (error.message || error.toString()) || "unknown error" });
      } catch {
      }
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
      const decisionCfg = this.getToolDecisionConfig();
      const sysMsg = this.buildDecisionSystemMessage(availableTools, decisionCfg);
      if (sysMsg) {
        messages = [sysMsg, ...messages];
      }
      if (decisionCfg?.docx?.directFallback) {
        try {
          const lastUser = this.getLastUserText(messages) || "";
          const userHasDocxIntent = /\bdocx\b|\bword\b|\.docx\b/i.test(lastUser);
          const { path: docxPath, content: docxText } = this.extractDocxPathAndContent({}, "", messages);
          const shouldCallDirect = !!docxPath && !!docxText && userHasDocxIntent;
          const toolsDisabled = decisionCfg && decisionCfg.mode === "gate" ? this.shouldDisableToolsForMessageWithCfg(messages, decisionCfg) : false;
          const claudeSession = this.sessions.get(this.enPunycode("claude code")) || this.sessions.get("claude code");
          if (shouldCallDirect && !toolsDisabled && claudeSession) {
            let writeArgs = { file_path: docxPath, content: docxText };
            const fullWriteFuncName = `${this.enPunycode("claude code")}__Write`;
            writeArgs = this.ensureGenericPathArg(fullWriteFuncName, "Write", writeArgs, "", messages);
            writeArgs = this.ensureArgsBySchema(
              fullWriteFuncName,
              writeArgs,
              /*wantWrite*/
              true
            );
            import_mcp_compat.MCPCompat.fsEnsureParentDir(writeArgs.file_path || writeArgs.path);
            try {
              this.pushProgress("direct_docx_write_started", { server: "claude code", tool: "Write", args: writeArgs });
            } catch {
            }
            const result = await this.executeToolCall(claudeSession, "Write", writeArgs);
            const pushObj = this.createToolResultPush("claude code", "Write", writeArgs, result.content);
            this.pushMessage(pushObj);
            const fakeToolCall = {
              id: `direct-docx-write-${Date.now()}`,
              type: "function",
              function: { name: fullWriteFuncName, arguments: JSON.stringify(writeArgs) }
            };
            const toolResultContent = this.processToolResult(result);
            messages = this.updateMessages(messages, fakeToolCall, "\u76F4\u63A5\u8C03\u7528\uFF1A\u4F7F\u7528 claude code \u7684 Write \u5DE5\u5177\u5199\u5165 docx\uFF08\u65E0\u6A21\u578B\u56DE\u9000\uFF09", toolResultContent);
            const wTxt = this.extractTextFromContentJson(toolResultContent);
            if (wTxt && !this.isErrorText(wTxt)) {
              this._mcpHasSuccess = true;
              const chunk = {
                created_at: Date.now(),
                index: 0,
                choices: [{ finish_reason: "stop", delta: { content: wTxt } }]
              };
              this.callback(chunk);
              try {
                this.pushProgress("direct_docx_write_finished", { server: "claude code", tool: "Write", status: "success" });
              } catch {
              }
              return "";
            }
            const errTxt = wTxt || "";
            if (errTxt && this.isDocxSkillHint(errTxt)) {
              try {
                try {
                  this.pushProgress("docx_bridge_started", { from_server: "claude code", from_tool: "Write" });
                } catch {
                }
                const docxTargets = await this.findDocxToolsAcrossSessions();
                if (docxTargets) {
                  const docxSession = this.sessions.get(docxTargets.serverName);
                  if (docxSession) {
                    if (docxTargets.createToolName) {
                      let createArgs = { file_path: docxPath };
                      const fullCreateName = `${this.enPunycode(docxTargets.serverName)}__${docxTargets.createToolName}`;
                      createArgs = this.ensureGenericPathArg(fullCreateName, docxTargets.createToolName, createArgs, "", messages);
                      createArgs = this.ensureArgsBySchema(fullCreateName, createArgs, true);
                      import_mcp_compat.MCPCompat.fsEnsureParentDir(createArgs.file_path || createArgs.path);
                      try {
                        this.pushProgress("docx_bridge_step_started", { step: "create", server: docxTargets.serverName, tool: docxTargets.createToolName });
                      } catch {
                      }
                      const createRes = await this.executeToolCall(docxSession, docxTargets.createToolName, createArgs);
                      const createPush = this.createToolResultPush(docxTargets.serverName, docxTargets.createToolName, createArgs, createRes.content);
                      this.pushMessage(createPush);
                      try {
                        this.pushProgress("docx_bridge_step_finished", { step: "create", server: docxTargets.serverName, tool: docxTargets.createToolName, status: "success" });
                      } catch {
                      }
                      const fakeCreateCall = {
                        id: `direct-docx-create-${Date.now()}`,
                        type: "function",
                        function: { name: fullCreateName, arguments: JSON.stringify(createArgs) }
                      };
                      const createContent = this.processToolResult(createRes);
                      messages = this.updateMessages(messages, fakeCreateCall, `\u81EA\u52A8\u6865\u63A5\uFF1A\u4F7F\u7528 ${docxTargets.serverName} \u7684 ${docxTargets.createToolName} \u521B\u5EFA docx`, createContent);
                    }
                    if (docxTargets.writeToolName) {
                      let wArgs = { file_path: docxPath, content: docxText };
                      const fullName = `${this.enPunycode(docxTargets.serverName)}__${docxTargets.writeToolName}`;
                      wArgs = this.ensureGenericPathArg(fullName, docxTargets.writeToolName, wArgs, "", messages);
                      wArgs = this.ensureArgsBySchema(fullName, wArgs, true);
                      import_mcp_compat.MCPCompat.fsEnsureParentDir(wArgs.file_path || wArgs.path);
                      try {
                        this.pushProgress("docx_bridge_step_started", { step: "write", server: docxTargets.serverName, tool: docxTargets.writeToolName });
                      } catch {
                      }
                      const wRes = await this.executeToolCall(docxSession, docxTargets.writeToolName, wArgs);
                      const wPush = this.createToolResultPush(docxTargets.serverName, docxTargets.writeToolName, wArgs, wRes.content);
                      this.pushMessage(wPush);
                      try {
                        this.pushProgress("docx_bridge_step_finished", { step: "write", server: docxTargets.serverName, tool: docxTargets.writeToolName, status: "success" });
                      } catch {
                      }
                      const fakeCall2 = {
                        id: `direct-docx-bridge-write-${Date.now()}`,
                        type: "function",
                        function: { name: fullName, arguments: JSON.stringify(wArgs) }
                      };
                      const wContent = this.processToolResult(wRes);
                      messages = this.updateMessages(messages, fakeCall2, `\u81EA\u52A8\u6865\u63A5\uFF1A\u4F7F\u7528 ${docxTargets.serverName} \u7684 ${docxTargets.writeToolName} \u5199\u5165 docx \u5185\u5BB9`, wContent);
                      const wTxt2 = this.extractTextFromContentJson(wContent);
                      if (wTxt2 && !this.isErrorText(wTxt2)) {
                        this._mcpHasSuccess = true;
                        const chunk = {
                          created_at: Date.now(),
                          index: 0,
                          choices: [{ finish_reason: "stop", delta: { content: wTxt2 } }]
                        };
                        this.callback(chunk);
                        return "";
                      }
                    }
                  }
                }
              } catch (e) {
                try {
                  import_log.logger.warn("[MCP Docx] direct bridge flow failed:", e);
                } catch {
                }
              }
            }
          }
        } catch (e) {
          try {
            import_log.logger.warn("[MCP Docx] direct docx write fallback error:", e);
          } catch {
          }
        }
      }
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
   * 带配置的“是否禁用工具”判断（关键词可由用户配置）
   */
  shouldDisableToolsForMessageWithCfg(messages, decisionCfg) {
    const lastUser = this.getLastUserText(messages) || "";
    const text = lastUser.toLowerCase();
    const explicitToolHints = decisionCfg && decisionCfg.keywords && Array.isArray(decisionCfg.keywords.explicitToolHints) ? decisionCfg.keywords.explicitToolHints : [
      "\u4F7F\u7528mcp\u5DE5\u5177",
      "\u4F7F\u7528 mcp \u5DE5\u5177",
      "mcp",
      "\u8C03\u7528\u5DE5\u5177",
      "\u7528\u5DE5\u5177",
      "claude code",
      "claude-code",
      "excel-mcp-server",
      "excel mcp server"
    ];
    if (explicitToolHints.some((k) => text.includes(k))) return false;
    const hasWindowsPath = /[a-z]:\\/i.test(text) || /[a-z]:\//i.test(text) || /[a-z]:\\/i.test(text);
    const hasUrl = /https?:\/\//i.test(text);
    const fileKeywordsList = decisionCfg && decisionCfg.keywords && Array.isArray(decisionCfg.keywords.fileKeywords) ? decisionCfg.keywords.fileKeywords : ["\u8BFB\u53D6", "\u8BFB", "\u5199\u5165", "\u8FFD\u52A0", "\u8986\u76D6", "\u4FDD\u5B58", "\u6253\u5F00", "\u76EE\u5F55", "\u8DEF\u5F84", "\u6587\u4EF6", "excel", "\u5DE5\u4F5C\u7C3F", "\u5DE5\u4F5C\u8868", "sheet"];
    const fileKeywordsRegex = new RegExp(fileKeywordsList.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
    const hasFileKeywords = fileKeywordsRegex.test(lastUser);
    if (hasWindowsPath || hasUrl || hasFileKeywords) return false;
    return true;
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
      try {
        this.toolsSchemaByName.clear();
      } catch {
      }
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
