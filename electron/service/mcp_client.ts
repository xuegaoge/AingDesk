import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import OpenAI from "openai";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { pub } from "../class/public";
import path from "path";
import { logger } from "ee-core/log";
import { mcpService } from "./mcp";
import Stream from "openai/streaming";
import punycode from "punycode/";

// MCP配置对象
export type McpConfig = {
    mcpServers: ServerConfig[];
}

export interface MCPToolResult {
    content: any;
}

export interface ToolInfo {
    name: string,
    description: string,
    is_active: boolean,
}

export interface ServerConfig {
    name: string;
    description: string;
    type: 'stdio' | 'sse';
    command?: string;
    env?: any;
    args?: string[];
    baseUrl?: string;
    isActive?: boolean;
    tools?: any[];
}

export class MCPClient {
    // 存储所有会话
    private sessions: Map<string, Client> = new Map();
    // 存储所有连接
    private transports: Map<string, StdioClientTransport | SSEClientTransport> = new Map();
    // 缓存工具列表
    private toolListCache: any[] | null = null;
    private supplierName: string = "";
    private model: string = "";
    private openai: OpenAI | null = null;
    private push: Function | null = null;
    private callback: Function | null = null;

    /**
     * 读取 MCP 配置文件
     */
    private static async readMCPConfigFile(): Promise<string | null> {
        const mcpConfigFile = path.resolve(pub.get_data_path(), "mcp-server.json");
        try {
            if (pub.file_exists(mcpConfigFile)) {
                return pub.read_file(mcpConfigFile);
            }
        } catch (error) {
            logger.error('Failed to read MCP config file:', error);
        }
        return null;
    }

    /**
     * 解析 MCP 配置文件
     * @param {string} configContent - MCP 配置文件的内容
     * @returns {ServerConfig[]} - 解析后的服务器配置数组
     */
    private static parseMCPConfig(configContent: string): ServerConfig[] {
        try {
            const mcpConfig = JSON.parse(configContent);
            const mcpServers: ServerConfig[] = [];
            if (mcpConfig && mcpConfig.mcpServers) {
                for (const server of mcpConfig.mcpServers) {
                    const serverConfig = server as ServerConfig;
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
            logger.error('Failed to parse MCP config:', error);
            return [];
        }
    }

    /**
     * 获取所有开启的 MCP 服务器
     * @param {string[]} [filter] - 服务器名称的过滤数组
     * @returns {Promise<ServerConfig[]>} - 所有开启的服务器配置数组
     */
    static async getActiveServers(filter?: string[]): Promise<ServerConfig[]> {
        const configContent = await this.readMCPConfigFile();
        if (!configContent) {
            return [];
        }
        let mcpServices = this.parseMCPConfig(configContent);
        if (filter) {
            mcpServices = mcpServices.filter(mcpService => filter.includes(mcpService.name));
        }
        return mcpServices;
    }

    /**
     * 检查服务器配置是否有效
     * @param {ServerConfig} serverConfig - 服务器配置对象
     * @returns {ServerConfig} - 验证后的服务器配置对象
     */
    private validateServerConfig(serverConfig: ServerConfig): ServerConfig {
        if (serverConfig.type === undefined) {
            if (serverConfig.command) {
                serverConfig.type = 'stdio';
            } else if (serverConfig.baseUrl) {
                serverConfig.type = 'sse';
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
    private async createStdioTransport(command: string, args: string[], env: Record<string, string>): Promise<StdioClientTransport> {
        if (!command) {
            throw new Error("Invalid shell command");
        }
        const serverParams: StdioServerParameters = {
            command,
            args,
            env: env || {},
        };
        return new StdioClientTransport(serverParams);
    }

    /**
     * 创建 SSE 客户端传输实例
     * @param {string} url - SSE 服务器的 URL
     * @returns {Promise<SSEClientTransport>} - SSE 客户端传输实例
     */
    private async createSSETransport(url: string): Promise<SSEClientTransport> {
        try {
            return new SSEClientTransport(new URL(url));
        } catch (error) {
            logger.error(`Failed to create SSE transport for URL ${url}:`, error);
            throw error;
        }
    }

    /**
     * 创建客户端传输实例
     * @param {ServerConfig} serverConfig - 服务器配置对象
     * @returns {Promise<StdioClientTransport | SSEClientTransport>} - 客户端传输实例
     */
    private async createTransport(serverConfig: ServerConfig): Promise<StdioClientTransport | SSEClientTransport> {
        if (serverConfig.type === 'stdio' && serverConfig.command) {
            let command = serverConfig.command;
            let args = serverConfig.args || [];
            let env = serverConfig.env || {};
            if (command === 'npx') {
                command = mcpService.get_bun_bin();
                args.unshift('x', '--bun');
                env.NPM_CONFIG_REGISTRY = "https://registry.npmmirror.com";
            }
            return this.createStdioTransport(command, args, env);
        } else if (serverConfig.type === 'sse' && serverConfig.baseUrl) {
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
    async connectToServer(serverConfigList: ServerConfig[]): Promise<void> {
        for (let serverConfig of serverConfigList) {
            try {
                const validatedConfig = this.validateServerConfig(serverConfig);
                const transport = await this.createTransport(validatedConfig);

                const client = new Client(
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
                // 连接新服务器后，清空工具列表缓存
                this.toolListCache = null;
            } catch (error) {
                logger.error(`Failed to connect to server ${serverConfig.name}:`, error);
                // 此处可根据需求决定是否继续连接其他服务器
                // throw error;
            }
        }
    }

    /**
     * 获取指定服务器的工具列表
     * @param {ServerConfig} serverConfig - 服务器配置对象
     * @returns {Promise<Tool[]>} - 工具列表的 Promise
     */
    async getTools(serverConfig: ServerConfig): Promise<Tool[]> {
        try {
            await this.connectToServer([serverConfig]);
            const session = this.sessions.get(serverConfig.name);
            if (!session) {
                throw new Error(`Session not found for server ${serverConfig.name}`);
            }
            const response = await session.listTools();
            return response.tools;
        } catch (error) {
            logger.error(`Failed to get tools for server ${serverConfig.name}:`, error);
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
    private enPunycode(data: string): string {
        return punycode.toASCII(data);
    }

    /**
     * 解码 Punycode
     * @param {string} data - 要解码的字符串
     * @returns {string} - 解码后的字符串
     */
    private dePunycode(data: string): string {
        return punycode.toUnicode(data);
    }

    /**
     * 获取所有服务器的工具列表
     * @returns {Promise<any[]>} - 所有服务器的工具列表的 Promise
     */
    private async getAllAvailableTools(): Promise<any[]> {
        if (this.toolListCache) {
            return this.toolListCache;
        }
        const availableTools: any[] = [];
        try {
            for (const [serverName, session] of this.sessions) {
                const response = await session.listTools();
                const tools = response.tools.map((tool: Tool) => ({
                    type: "function" as const,
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
            logger.error("Failed to get available tools:", error);
            throw error;
        }
        return availableTools;
    }

    /**
     * 处理工具调用结果
     * @param {MCPToolResult} toolResult - 工具调用结果对象
     * @returns {string} - 处理后的工具调用结果字符串
     */
    private processToolResult(toolResult: MCPToolResult): string {
        if (toolResult.content && toolResult.content.text) {
            toolResult.content = toolResult.content.text;
        }
        if (typeof toolResult.content !== 'string') {
            toolResult.content = JSON.stringify(toolResult.content);
        }
        return toolResult.content;
    }

    /**
     * 统一路径分隔符并清洗异常前缀（如被拼接到 C:\AingDesk 上、或前缀多出一个点）
     */
    private sanitizeFilePath(rawPath: string, preferCandidate?: string): string {
        if (!rawPath || typeof rawPath !== 'string') return rawPath;
        let p = rawPath.trim();
        // 统一分隔符为反斜杠（正反斜杠都归一为单个反斜杠）
        p = p.replace(/[\\/]+/g, '\\');
        // 去除中英文引号
        p = p.replace(/[“”"']+/g, '');
        // 去掉开头错误的点前缀：.D:\work\...
        p = p.replace(/^\.([A-Za-z]:\\)/, '$1');
        // 如果被错误拼接到 AingDesk 路径前面，尝试提取最后一个绝对盘符路径
        if (/AingDesk/i.test(p)) {
            const matches = p.match(/[A-Za-z]:\\[^\\]+(?:\\[^\\]+)*/g);
            if (matches && matches.length > 0) {
                // 优先选择包含 D:\work 的候选
                const prefer = matches.find(m => /^D:\\work(\\|$)/i.test(m));
                p = (prefer || matches[matches.length - 1]);
            } else if (preferCandidate) {
                p = preferCandidate;
            }
        }
        // 再次修正可能出现的双盘符或奇怪的前缀，比如 C:\AingDesk\.D:\work\...
        const lastAbs = p.match(/([A-Za-z]:\\[^\\]+(?:\\[^\\]+)*)/g);
        if (lastAbs && lastAbs.length > 0) {
            const prefer = lastAbs.find(m => /^D:\\work(\\|$)/i.test(m));
            p = (prefer || lastAbs[lastAbs.length - 1]);
        }
        // 最终兜底：确保是以盘符开头的绝对路径
        if (!/^[A-Za-z]:\\/.test(p) && preferCandidate && /^[A-Za-z]:\\/.test(preferCandidate)) {
            p = preferCandidate;
        }
        return p;
    }

    /**
     * 从文本中提取 Windows 绝对路径（优先选择位于 D:\work 下的路径）
     */
    private extractWindowsPath(text: string): string | null {
        if (!text || typeof text !== 'string') return null;
        // 捕获 Windows 绝对路径，排除空格、尖括号和中英文引号
        const regex = /[A-Za-z]:\\[^\s<>"'“”]+/g;
        const matches = text.match(regex);
        if (!matches || matches.length === 0) return null;
        const clean = (p: string) => p.replace(/[“”"']+/g, '').trim();
        const cleaned = matches.map(clean);
        const prefer = cleaned.find(m => /^D:\\work(\\|$)/i.test(m));
        return prefer || cleaned[0];
    }

    /**
     * 确保 FileSystem 相关工具调用具备并纠正 file_path 参数
     */
    private ensureFilePathArg(toolName: string, toolArgs: any, toolsContent: string, messages: ChatCompletionMessageParam[]): any {
        // 工具名为拆分后的短名：read_text_file/read_json_file/write_file
        const fsToolNames = new Set(["read_text_file", "read_json_file", "write_file", "append_file", "append_text_file", "read_file"]);
        const isFS = fsToolNames.has(toolName) || (/read/i.test(toolName) && /file/i.test(toolName)) || (/write|append/i.test(toolName) && /file/i.test(toolName));
        if (!isFS) return toolArgs;

        let candidate: string | null = null;
        // 优先从工具内容里找路径
        if (toolsContent) {
            candidate = this.extractWindowsPath(toolsContent);
        }
        // 再尝试从最近的用户消息里找路径
        if (!candidate) {
            const lastUser = [...messages].reverse().find(m => m.role === 'user' && typeof m.content === 'string') as ChatCompletionMessageParam | undefined;
            if (lastUser && typeof lastUser.content === 'string') {
                candidate = this.extractWindowsPath(lastUser.content as string);
            }
        }

        // 接受模型可能提供的多个字段名，并归一到 file_path
        const provided = toolArgs?.file_path || toolArgs?.path || toolArgs?.file || toolArgs?.filename;
        let sanitized: string | undefined;
        if (!provided && candidate) {
            sanitized = this.sanitizeFilePath(candidate || '', candidate || undefined);
        } else if (provided && typeof provided === 'string') {
            sanitized = this.sanitizeFilePath(provided, candidate || undefined);
        }

        if (sanitized) {
            // 同步设置 file_path 与 path，确保兼容不同服务器的参数命名
            toolArgs.file_path = sanitized;
            toolArgs.path = sanitized;
            // 清理其他可能存在但非绝对路径的歧义字段
            if (typeof toolArgs.file === 'string' && !/^[A-Za-z]:\\/.test(toolArgs.file)) {
                delete toolArgs.file;
            }
            if (typeof toolArgs.filename === 'string' && !/^[A-Za-z]:\\/.test(toolArgs.filename)) {
                delete toolArgs.filename;
            }
        }

        // 关键日志，帮助定位后续问题
        try {
            logger.info(`[MCP FS] tool="${toolName}", provided="${provided}", candidate="${candidate}", sanitized="${sanitized}"`);
        } catch {}

        return toolArgs;
    }

    /**
     * 工具调用
     * @param {Record<string, OpenAI.Chat.Completions.ChatCompletionMessageToolCall>} toolCallMap - 工具调用映射
     * @param {ChatCompletionMessageParam[]} messages - 消息列表
     * @param {string} toolsContent - 工具内容
     * @returns {Promise<ChatCompletionMessageParam[]>} - 处理后的消息列表的 Promise
     */
    async callTools(toolCallMap: Record<string, OpenAI.Chat.Completions.ChatCompletionMessageToolCall>, messages: ChatCompletionMessageParam[], toolsContent: string): Promise<ChatCompletionMessageParam[]> {
        for (const toolCall of Object.values(toolCallMap)) {
            if (!this.isValidToolCall(toolCall)) {
                continue;
            }
            let [serverName, toolName] = toolCall.function.name.split('__');
            serverName = this.dePunycode(serverName);
            const session = this.sessions.get(serverName);

            if (!session) {
                continue;
            }
            let toolArgs: any = {};
            try {
                toolArgs = JSON.parse(toolCall.function.arguments);
            } catch (e) {
                logger.error(`Failed to parse tool arguments for ${toolName}:`, e);
                // 尝试容错：继续执行但以空对象为参数
                toolArgs = {};
            }

            // 规范化并纠正 FileSystem 路径参数
            toolArgs = this.ensureFilePathArg(toolName, toolArgs, toolsContent, messages);

            const toolResult = await this.executeToolCall(session, toolName, toolArgs);
            const toolResultContent = this.processToolResult(toolResult);

            const toolResultPush = this.createToolResultPush(serverName, toolName, toolArgs, toolResultContent);
            this.pushMessage(toolResultPush);
            // 继续与工具结果的对话
            messages = this.updateMessages(messages, toolCall, toolsContent, toolResultContent);
        }

        return messages;
    }

    /**
     * 检查工具调用是否有效
     * @param {OpenAI.Chat.Completions.ChatCompletionMessageToolCall} toolCall - 工具调用对象
     * @returns {boolean} - 工具调用是否有效的布尔值
     */
    private isValidToolCall(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall): boolean {
        if(toolCall.function && toolCall.function.name && toolCall.function.arguments) return true;
        return false;
    }

    /**
     * 解析用户消息，识别是否需要强制调用特定工具
     * 根据可用工具列表返回完整的函数名（形如 "<server>__<tool>"），否则返回 null
     */
    private extractPreferredToolName(messages: ChatCompletionMessageParam[], availableTools: any[]): string | null {
        // 寻找最后一条用户消息（文本）
        const lastUser = [...messages].reverse().find(m => m.role === 'user' && typeof m.content === 'string') as ChatCompletionMessageParam | undefined;
        if (!lastUser || typeof lastUser.content !== 'string') return null;

        const textRaw = lastUser.content as string;
        const text = textRaw.toLowerCase();

        // 识别显式意图与路径提示（Windows 路径）
        const explicitlyAskMCP = text.includes("使用mcp工具") || text.includes("mcp 工具") || text.includes("mcp");
        const hasWindowsPath = /[a-z]:\\\\/i.test(text) || /[a-z]:\\/i.test(text);

        // 简单意图分类
        let suffix: string | null = null;
        if (explicitlyAskMCP || hasWindowsPath) {
            const wantRead = text.includes("读取") || text.includes("读");
            const wantWrite = text.includes("写入") || text.includes("追加") || text.includes("覆盖");

            if (wantRead) {
                if (text.includes("json")) suffix = "__read_json_file"; else suffix = "__read_text_file";
            } else if (wantWrite) {
                suffix = "__write_file";
            }
        }

        if (!suffix) return null;

        // 在可用工具列表中按结尾匹配函数名
        const found = availableTools.find((t: any) => t && t.function && typeof t.function.name === 'string' && t.function.name.endsWith(suffix));
        return found ? found.function.name : null;
    }

    /**
     * 执行工具调用
     * @param {Client} session - 会话对象
     * @param {string} toolName - 工具名称
     * @param {any} toolArgs - 工具参数
     * @returns {Promise<MCPToolResult>} - 工具调用结果的 Promise
     */
    private async executeToolCall(session: Client, toolName: string, toolArgs: any): Promise<MCPToolResult> {
        try {
            const result = await session.callTool({
                name: toolName,
                arguments: toolArgs
            });
            return result as unknown as MCPToolResult;
        } catch (error) {
            logger.error(`Failed to execute tool call for ${toolName}:`, error);
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
    private createToolResultPush(serverName: string, toolName: string, toolArgs: any, toolResultContent: string): any {
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
    private pushMessage(message: any): void {
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
    private updateMessages(messages: ChatCompletionMessageParam[], toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall, toolsContent: string, toolResultContent: string): ChatCompletionMessageParam[] {
        messages.push({
            role: "assistant",
            content: toolsContent,
            tool_calls: [toolCall]
        });
        messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResultContent,
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
    private async handleOpenAIToolCalls(completion: Stream.Stream<OpenAI.Chat.Completions.ChatCompletionChunk>, messages: ChatCompletionMessageParam[], availableTools: any[]): Promise<ChatCompletionMessageParam[]> {
        let toolId = "";
        let toolCallMap: Record<string, OpenAI.Chat.Completions.ChatCompletionMessageToolCall> = {};
        let toolsContent = "";
        for await (const chunk of completion) {
            for (let choice of chunk.choices) {
                const message = choice.delta;

                // 合并工具调用
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

        // 处理工具调用
        if (Object.keys(toolCallMap).length > 0) {
            messages = await this.callTools(toolCallMap, messages, toolsContent);
            let last_message = messages[messages.length - 1];

            // 尝试解析工具返回的文本，并在满足条件时直接结束流
            if (last_message.content) {
                let extractedText: string | null = null;
                try {
                    let contentStr = last_message.content.toString().trim();
                    let toolMessage = JSON.parse(contentStr);
                    if (toolMessage && Array.isArray(toolMessage) && toolMessage.length > 0 && toolMessage[0].text) {
                        extractedText = (toolMessage[0].text as string).trim();

                        // 若内容以 <end> / </end> 包裹，去掉包裹并以 stop 结束
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

                        // 若内容以 <echo> / </echo> 包裹，去掉包裹并以 stop 结束
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
                    // 忽略解析错误，进入递归逻辑
                }

                // 当工具返回了纯文本（不含 <end>/<echo>）时，直接以 stop 结束，避免递归导致不复位
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
            // 递归处理工具调用（上述未命中终止条件时）
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
    async handleToolCalls(availableTools: any, messages: ChatCompletionMessageParam[], isRecursive = false) {
        // 调用OpenAI API
        try {
            // 根据用户最新消息尝试强制选择工具，避免模型在重复请求中不再调用 MCP
            let toolChoice: any = "auto";
            const preferredToolName = this.extractPreferredToolName(messages, availableTools);
            if (preferredToolName) {
                toolChoice = { type: "function", function: { name: preferredToolName } };
            }

            const completion = await this.openai.chat.completions.create({
                model: this.model,
                messages,
                tools: availableTools,
                tool_choice: toolChoice,
                stream: true
            });

            // 处理OpenAI的响应
            await this.handleOpenAIToolCalls(completion, messages, availableTools);
        } catch (error) {
            logger.error("Failed to call OpenAI API:", error);
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
    async processQuery(openai: OpenAI, supplierName: string, model: string, messages: ChatCompletionMessageParam[], callback: Function, push: Function): Promise<string> {
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

            // 处理工具调用
            await this.handleToolCalls(availableTools, messages);
        } catch (error) {
            // push("Failed to process query:" + error.message);

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
            }
            callback(chunk)
            logger.error("Failed to process query:", error);
            throw error;
        } finally {
            // 关闭所有连接
            await this.cleanup();
        }
        // 此处可根据实际需求返回处理结果
        return '';
    }

    /**
     * 关闭所有连接
     * @returns {Promise<void>} - 关闭连接操作的 Promise
     */
    async cleanup(): Promise<void> {
        try {
            for (const transport of this.transports.values()) {
                await transport.close();
            }
            this.transports.clear();
            this.sessions.clear();
            this.toolListCache = null;
        } catch (error) {
            logger.error("Failed to cleanup connections:", error);
            throw error;
        }
    }

    /**
     * 判断是否有活动的会话
     * @returns {boolean} - 是否有活动会话的布尔值
     */
    hasActiveSessions(): boolean {
        return this.sessions.size > 0;
    }
}    
