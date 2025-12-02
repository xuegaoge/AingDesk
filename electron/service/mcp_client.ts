import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import OpenAI from "openai";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import { pub } from "../class/public";
import path from "path";
import fs from "fs";
import { logger } from "ee-core/log";
import { mcpService } from "./mcp";
import { MCPCompat } from "./mcp_compat";
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
    constructor() {
        // 兼容模式默认遵循环境变量，未设置时采用严格模式（strict），避免影响主聊天输出
        try {
            const curr = (process.env.MCP_COMPAT_MODE || '').toLowerCase();
            const mode: 'lenient' | 'strict' = (curr === 'lenient' || curr === 'strict') ? (curr as any) : 'strict';
            MCPCompat.configure({ mode });
        } catch {}
    }
    // 存储所有会话
    private sessions: Map<string, Client> = new Map();
    // 存储所有连接
    private transports: Map<string, StdioClientTransport | SSEClientTransport> = new Map();
    // 缓存工具列表
    private toolListCache: any[] | null = null;
    // 缓存：完整工具名 -> JSON Schema（输入参数）
    private toolsSchemaByName: Map<string, any> = new Map();
    private supplierName: string = "";
    private model: string = "";
    private openai: OpenAI | null = null;
    private push: Function | null = null;
    private callback: Function | null = null;
    private serverConfigs: Map<string, ServerConfig> = new Map();
    private activeToolCalls: Map<string, AbortController> = new Map();

    /**
     * 读取 MCP 配置文件
     */
    private static async readMCPConfigFile(): Promise<string | null> {
        // 优先读取用户数据目录（Roaming）下的配置文件，其路径示例：
        // C:\Users\Administrator\AppData\Roaming\AingDesk\data\mcp-server.json
        const userMcpConfigFile = path.resolve(pub.get_user_data_path(), "data", "mcp-server.json");
        // 工作区 data 目录（供开发调试使用）
        const workspaceMcpConfigFile = path.resolve(pub.get_data_path(), "mcp-server.json");
        try {
            // 运行时优先使用用户数据目录下的配置
            if (pub.file_exists(userMcpConfigFile)) {
                return pub.read_file(userMcpConfigFile);
            }
            // 若用户数据目录不存在该文件，则回退到工作区 data 目录（用于开发阶段）
            if (pub.file_exists(workspaceMcpConfigFile)) {
                return pub.read_file(workspaceMcpConfigFile);
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
                this.serverConfigs.set(validatedConfig.name, validatedConfig);
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
     * 直接执行指定 MCP 工具（一次性调用），并返回统一结构的结果。
     * 注意：默认遵循严格模式（strict）。如需宽松模式，请通过 opts.compatMode 指定 'lenient'。
     */
    public async runToolOnce(server: ServerConfig, toolName: string, toolArgs: any, opts?: { compatMode?: 'lenient' | 'strict' }): Promise<{ push: any, text?: string, raw?: any }> {
        try {
            // 按需切换兼容模式
            if (opts && opts.compatMode) {
                const mode = opts.compatMode === 'lenient' ? 'lenient' : 'strict';
                // 优先使用 configure，避免污染全局环境
                MCPCompat.configure({ mode });
            }

            // 连接并获取会话
            await this.connectToServer([server]);
            const session = this.sessions.get(server.name);
            if (!session) {
                throw new Error(`Session not found for server ${server.name}`);
            }

            // 首次执行工具
            let raw: any = await (session as any).callTool({ name: toolName, arguments: toolArgs }, undefined, {
                onprogress: (process: any) => {
                    try {
                        const total = Number(process?.total || 1);
                        const progressVal = Number(process?.progress || 0);
                        const ratio = total ? (progressVal / total) : 0;
                        this.pushProgress('tool_call_progress', { server: server.name, tool: toolName, call_id: undefined, progress: ratio, progress_value: progressVal, total: total });
                    } catch {}
                }
            });

            // 针对 Claude Code 的 Write 工具要求“先 Read 再 Write”的兼容桥接：
            // - 仅当服务器名称含 "claude"，且工具为写入类并提供了文件路径时触发
            // - 发现错误文本中包含 “Read it first before writing” 或中文“请先读取/未读取”等提示时，自动先调用 Read 再重试 Write
            try {
                const isClaude = /claude/i.test(server?.name || "");
                const isWriteLike = MCPCompat.isWriteLikeTool(toolName);
                const filePath = (toolArgs && (toolArgs.file_path || toolArgs.path)) || "";
                const hasPath = typeof filePath === "string" && filePath.length > 0;

                const getErrorText = (): string => {
                    let out = "";
                    // 尝试从规范化 content 中提取文本
                    try {
                        const normalized = MCPCompat.normalizeContentArray(raw);
                        out = this.extractTextFromContentJson(JSON.stringify(normalized)) || "";
                    } catch {}
                    // 若未获取到文本，再从原始 raw.content 提取
                    if (!out) {
                        try {
                            const t = raw?.content && Array.isArray(raw.content) && raw.content[0]?.text;
                            out = typeof t === "string" ? t : "";
                        } catch {}
                    }
                    return out;
                };

                const errText = getErrorText();
                const mentionsReadFirst = /read\s*it\s*first/i.test(errText) || /(请先读取|未读取|尚未读取)/.test(errText);

                if (isClaude && isWriteLike && hasPath && (raw?.isError === true || this.isErrorText(errText)) && mentionsReadFirst) {
                    try {
                        // 寻找 Read 类工具名
                        const lst = await session.listTools();
                        const readTool = lst?.tools?.find((t: any) => /read/i.test(t?.name || ""))?.name;
                        if (readTool) {
                            const readArgs: any = { file_path: filePath, path: filePath };
                            try {
                                await session.callTool({ name: readTool, arguments: readArgs });
                            } catch (eRead) {
                                // 读取失败不阻断后续写入重试，仅记录日志
                                try { logger.warn(`[MCPClient] auto-read before write failed on ${server.name}:`, eRead as any); } catch {}
                            }
                            // 再次尝试写入
                            try {
                                raw = await session.callTool({ name: toolName, arguments: toolArgs });
                            } catch (eWrite) {
                                // 如果重试仍失败，尝试侧写校验并返回结构化结果
                                const coerced = MCPCompat.coerceWriteSuccess(toolName, toolArgs, (eWrite as any)?.message || errText);
                                const pushCoerced = this.createToolResultPush(server.name, toolName, toolArgs, coerced.content);
                                let textCoerced: string | null = null;
                                try { textCoerced = this.extractTextFromContentJson(JSON.stringify(pushCoerced.tool_result)); } catch {}
                                return { push: pushCoerced, text: textCoerced || undefined, raw: coerced };
                            }
                        }
                    } catch (eBridge) {
                        try { logger.warn(`[MCPClient] write->read bridge failed on ${server.name}:`, eBridge as any); } catch {}
                    }
                }
            } catch {}

            // 组装推送与文本
            const push = this.createToolResultPush(server.name, toolName, toolArgs, raw);
            let text: string | null = null;
            try {
                text = this.extractTextFromContentJson(JSON.stringify(push.tool_result));
            } catch {}

            return { push, text: text || undefined, raw };
        } catch (e) {
            logger.error(`[MCPClient] runToolOnce failed: ${toolName} on ${server?.name}`, e);
            throw e;
        } finally {
            // 单次调用默认清理连接，避免资源占用
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
                // 调试：列出 claude code 的工具名与描述，便于确认是否出现 docx 相关工具
                try {
                    if (/claude\s*code/i.test(serverName)) {
                        const names = response.tools.map(t => ({ name: t.name, desc: t.description }));
                        logger.info(`[MCP Tools] ${serverName} tools: ${JSON.stringify(names)}`);
                    }
                } catch {}
                const tools = response.tools.map((tool: Tool) => ({
                    type: "function" as const,
                    function: {
                        name: `${this.enPunycode(serverName)}__${tool.name}`,
                        description: `[${serverName}] ${tool.description}`,
                        parameters: tool.inputSchema
                    }
                }));
                // 建立 schema 映射缓存，键为完整工具名
                try {
                    for (const tool of response.tools) {
                        const full = `${this.enPunycode(serverName)}__${tool.name}`;
                        this.toolsSchemaByName.set(full, tool.inputSchema);
                        // 调试：输出 claude code 的 Skill 工具 schema，便于定位参数格式
                        try {
                            if (/claude\s*code/i.test(serverName) && /skill/i.test(tool.name)) {
                                logger.info(`[MCP Tools] ${serverName} Skill inputSchema: ${JSON.stringify(tool.inputSchema)}`);
                            }
                        } catch {}
                        // 调试：标记 docx 相关工具
                        try {
                            if (/docx/i.test(tool.name) || /docx/i.test(tool.description)) {
                                logger.info(`[MCP Tools] ${serverName} detected DOCX tool: ${tool.name} - ${tool.description}`);
                            }
                        } catch {}
                    }
                } catch {}
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
        let raw = toolResult.content;

        // 兼容 MCP 返回的 content 为数组或对象的情况
        // 增强：当 content 为数组时，合并所有块中的文本/文件内容为一个纯文本（而不是仅取第一个）
        const pickTextOrFileContent = (item: any): string | null => {
            try {
                if (!item || typeof item !== 'object') return null;
                if (typeof item.text === 'string') return item.text as string;
                if (item.file && typeof item.file === 'object' && typeof item.file.content === 'string') {
                    return item.file.content as string;
                }
                if (item.type === 'json' && item.json && typeof item.json === 'object') {
                    const j = item.json as any;
                    if (typeof j.text === 'string') return j.text as string;
                    if (j.file && typeof j.file === 'object' && typeof j.file.content === 'string') return j.file.content as string;
                    if (typeof j.content === 'string') return j.content as string;
                    // 兼容 Claude Code：当返回包含 available_skills 时，转为可读文本
                    try {
                        const skills = j.available_skills;
                        if (Array.isArray(skills) && skills.length > 0) {
                            const lines = skills.map((s: any) => {
                                const name = (s && (s.name || s.title || s.id)) ? String(s.name || s.title || s.id) : '';
                                const desc = (s && s.description) ? String(s.description) : '';
                                const loc = (s && s.location) ? String(s.location) : '';
                                const extra = [desc, loc].filter(Boolean).join(' | ');
                                return extra ? `- ${name}: ${extra}` : `- ${name}`;
                            }).join('\n');
                            return `Available skills (Claude Code):\n${lines}`;
                        }
                    } catch { /* ignore */ }
                    // 兜底：无显式文本字段但可序列化时，返回紧凑 JSON 字符串
                    try {
                        const compact = JSON.stringify(j);
                        if (compact && compact.length > 0) return compact;
                    } catch { /* ignore */ }
                }
                if (item.data && typeof item.data === 'object' && item.data.file && typeof item.data.file === 'object' && typeof item.data.file.content === 'string') {
                    return item.data.file.content as string;
                }
                return null;
            } catch { return null; }
        };
        if (Array.isArray(raw)) {
            const parts: string[] = [];
            for (const it of raw) {
                const t = pickTextOrFileContent(it);
                if (typeof t === 'string' && t.trim().length > 0) parts.push(t);
            }
            const merged = parts.join('\n\n');
            if (merged.trim().length > 0) {
                raw = merged;
            } else {
                const first = raw[0];
                if (first && typeof first === 'object' && 'text' in first && typeof first.text === 'string') {
                    raw = first.text;
                }
            }
        } else if (raw && typeof raw === 'object' && 'text' in raw && typeof raw.text === 'string') {
            raw = raw.text;
        }

        // 尝试解析为 JSON，以便做结构化到人类可读的渲染
        let parsed: any = null;
        if (typeof raw === 'string') {
            const s = raw.trim();
            if (s.startsWith('{') || s.startsWith('[')) {
                try { parsed = JSON.parse(s); } catch {}
            }
        } else if (raw && typeof raw === 'object') {
            parsed = raw;
        }

        // Excel 结果结构的人类可读渲染：识别包含 cells/sheet_name/range 的对象
        const isExcelCells = (obj: any) => obj && typeof obj === 'object' && Array.isArray(obj.cells) && (('sheet_name' in obj) || ('range' in obj));
        if (parsed && isExcelCells(parsed)) {
            const text = this.formatExcelCells(parsed);
            return JSON.stringify([{ type: 'text', text }]);
        }
        if (parsed && typeof parsed === 'object' && parsed.data && isExcelCells(parsed.data)) {
            const text = this.formatExcelCells(parsed.data);
            return JSON.stringify([{ type: 'text', text }]);
        }

        // claude-code 等工具的文件读取结果归一化：优先提取 file.content 为纯文本
        const tryExtractFileContent = (obj: any): string | null => {
            try {
                if (!obj || typeof obj !== 'object') return null;
                // 顶层 file.content
                if (obj.file && typeof obj.file === 'object' && typeof obj.file.content === 'string') {
                    return obj.file.content as string;
                }
                // 顶层 data.file.content
                if (obj.data && typeof obj.data === 'object' && obj.data.file && typeof obj.data.file === 'object' && typeof obj.data.file.content === 'string') {
                    return obj.data.file.content as string;
                }
                // json 包裹：{ type: 'json', json: { file: { content } } }
                if (obj.type === 'json' && obj.json && typeof obj.json === 'object') {
                    const j = obj.json as any;
                    if (j.file && typeof j.file === 'object' && typeof j.file.content === 'string') {
                        return j.file.content as string;
                    }
                    if (typeof j.content === 'string') {
                        return j.content as string;
                    }
                }
                return null;
            } catch { return null; }
        };
        if (parsed) {
            if (Array.isArray(parsed)) {
                // 在数组中合并所有包含 text 或 file.content 的项
                const texts: string[] = [];
                for (let i = 0; i < parsed.length; i++) {
                    const it = parsed[i];
                    if (it && typeof it === 'object' && typeof it.text === 'string') {
                        texts.push(it.text);
                        continue;
                    }
                    const fc = tryExtractFileContent(it);
                    if (typeof fc === 'string') texts.push(fc);
                }
                if (texts.length > 0) {
                    const merged = texts.join('\n\n');
                    return JSON.stringify([{ type: 'text', text: merged }]);
                }
            } else if (typeof parsed === 'object') {
                // 单对象：尝试从 file.content 提取
                if (typeof (parsed as any).text === 'string') {
                    return JSON.stringify([{ type: 'text', text: (parsed as any).text }]);
                }
                const fc = tryExtractFileContent(parsed);
                if (typeof fc === 'string') {
                    return JSON.stringify([{ type: 'text', text: fc }]);
                }
            }
        }

        // 若解析成功但非 Excel/文件结构，则原样返回结构化 JSON 字符串
        if (parsed !== null && typeof parsed !== 'undefined') {
            return JSON.stringify(parsed);
        }

        // 二进制内容阻断：提示使用合适的工具（不再只引导 Excel）
        if (typeof raw === 'string' && this.isLikelyBinaryText(raw)) {
            const msg = "检测到可能的二进制内容（例如 Excel 工作簿、Word 文档或压缩包）。请使用适配该文件类型的 MCP 工具：例如 .xlsx/.xls 使用 Excel 读取工具；.docx 使用具备 docx 能力的工具；若不确定，请直接描述你的需求，我会自动选择合适的工具。";
            return JSON.stringify([{ type: 'text', text: msg }]);
        }

        // 若为纯文本，优先尝试按 CSV/TSV 渲染为 Markdown 表格
        if (typeof raw === 'string') {
            const mdDelimited = this.tryFormatDelimitedTextAsMarkdown(raw);
            if (mdDelimited) {
                return JSON.stringify([{ type: 'text', text: mdDelimited }]);
            }
            return JSON.stringify([{ type: 'text', text: raw }]);
        }

        // 兜底：序列化原始内容
        return JSON.stringify(toolResult.content);
    }

    /**
     * 从工具结果的 JSON 字符串中提取纯文本（若存在）
     */
    private extractTextFromContentJson(jsonStr: string): string | null {
        try {
            const obj = JSON.parse((jsonStr || '').toString());
            const pickTextFromObj = (o: any): string | null => {
                if (!o || typeof o !== 'object') return null;
                if (typeof o.text === 'string') return o.text as string;
                // 提取 file.content
                if (o.file && typeof o.file === 'object' && typeof o.file.content === 'string') return o.file.content as string;
                // json 包裹
                if (o.type === 'json' && o.json && typeof o.json === 'object') {
                    const j = o.json as any;
                    if (typeof j.text === 'string') return j.text as string;
                    if (j.file && typeof j.file === 'object' && typeof j.file.content === 'string') return j.file.content as string;
                    if (typeof j.content === 'string') return j.content as string;
                    // 兼容 Claude Code Skill：available_skills 列表转为文本
                    try {
                        const skills = j.available_skills;
                        if (Array.isArray(skills) && skills.length > 0) {
                            const lines = skills.map((s: any) => {
                                const name = (s && (s.name || s.title || s.id)) ? String(s.name || s.title || s.id) : '';
                                const desc = (s && s.description) ? String(s.description) : '';
                                const loc = (s && s.location) ? String(s.location) : '';
                                const extra = [desc, loc].filter(Boolean).join(' | ');
                                return extra ? `- ${name}: ${extra}` : `- ${name}`;
                            }).join('\n');
                            return `Available skills (Claude Code):\n${lines}`;
                        }
                    } catch { /* ignore */ }
                }
                // data.file.content
                if (o.data && typeof o.data === 'object' && o.data.file && typeof o.data.file === 'object' && typeof o.data.file.content === 'string') return o.data.file.content as string;
                return null;
            };

            if (Array.isArray(obj) && obj.length > 0) {
                // 增强：合并所有块中的文本/文件内容为一个纯文本返回
                const parts: string[] = [];
                for (let i = 0; i < obj.length; i++) {
                    const t = pickTextFromObj(obj[i]);
                    if (typeof t === 'string' && t.trim().length > 0) parts.push(t);
                }
                if (parts.length > 0) return parts.join('\n\n');
            } else if (obj && typeof obj === 'object') {
                const t = pickTextFromObj(obj);
                if (typeof t === 'string') return t;
            }
        } catch { /* ignore */ }
        return null;
    }

    /**
     * 简易错误文本判定（中英文常见错误关键词）
     */
    private isErrorText(text: string | null | undefined): boolean {
        const t = (text || '').toLowerCase();
        if (!t) return false;
        const patterns = [
            'error', 'failed', 'invalid', 'not allowed', 'permission', 'does not exist', 'not found', 'did you mean',
            '错误', '失败', '无权限', '不存在', '未找到', '非法', '无效'
        ];
        return patterns.some(p => t.includes(p));
    }

    /**
     * 识别“docx/Word 创建写入”相关的错误提示，用于触发跨服务器技能桥接。
     * 场景：claude-code 等工具返回“只能创建纯文本/无法创建 docx/请使用 docx 技能/无法读取二进制 docx”等提示。
     */
    private isDocxSkillHint(text: string | null | undefined): boolean {
        const t = (text || '').toLowerCase();
        if (!t) return false;
        const hints = [
            // 通用 docx/word 关键词
            'docx', 'word', 'word 文档', 'docx 技能', '使用 docx 技能', 'use docx skill', 'docx tool',
            // 写入/创建相关
            '无法创建 docx', '不能创建 docx', '只能创建纯文本', 'create docx', 'write docx',
            // 读取相关（优先引导到专用读取工具）
            '读取 docx', '读取docx', 'read docx', 'open docx', 'extract docx', 'docx 内容', 'docx text',
            // 二进制读取失败的提示（来自 Read 工具）
            'cannot read binary', 'binary .docx file', 'cannot read binary files'
        ];
        return hints.some(h => t.includes(h));
    }

    /**
     * 针对 content 数组（包含 json/text/file 等项）更严格地识别错误或未验证成功
     * 规则：
     * - 若存在 json 项且 status 为 error 或 unknown，视为错误（或至少不应宣称成功）
     * - 若存在 json 项且 verified 为 false，视为错误
     */
    private isErrorContentArray(content: any): boolean {
        try {
            const arr = Array.isArray(content) ? content : [];
            for (const it of arr) {
                if (it && it.type === 'json' && it.json && typeof it.json === 'object') {
                    const st = String((it.json as any).status || '').toLowerCase();
                    const v = (it.json as any).verified;
                    if (st === 'error' || st === 'unknown') return true;
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
    private shouldStopOnFirstSuccess(messages: ChatCompletionMessageParam[]): boolean {
        const lastUser = this.getLastUserText(messages) || '';
        const t = lastUser.toLowerCase();
        const keys = ['只返回内容', '仅返回内容', '只输出内容', '仅输出内容', 'only return content'];
        return keys.some(k => t.includes(k));
    }

    /**
     * 尝试将 CSV/TSV 文本渲染为 Markdown 表格
     */
    private tryFormatDelimitedTextAsMarkdown(text: string): string | null {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) return null;

        // 选择分隔符：优先 TSV，其次 CSV
        let delim = '';
        if (text.includes('\t')) {
            delim = '\t';
        } else {
            const commaCountFirst = (lines[0].match(/,/g) || []).length;
            if (commaCountFirst >= 1) {
                // 检查行间一致性（粗略）
                const consistent = lines.slice(1).every(l => (l.match(/,/g) || []).length === commaCountFirst);
                if (consistent) delim = ',';
            }
        }
        if (!delim) return null;

        const parseDelimitedLine = (line: string, d: string): string[] => {
            if (d === '\t') {
                return line.split('\t').map(s => s.replace(/\|/g, '\\|'));
            }
            // 简易 CSV 解析，支持双引号包裹与逗号分隔
            const tokens: string[] = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    // 处理转义双引号
                    if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                        cur += '"';
                        i++; // 跳过下一个引号
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (ch === d && !inQuotes) {
                    tokens.push(cur.replace(/\|/g, '\\|'));
                    cur = '';
                } else {
                    cur += ch;
                }
            }
            tokens.push(cur.replace(/\|/g, '\\|'));
            return tokens.map(s => s.replace(/\n/g, ' '));
        };

        const rows = lines.map(l => parseDelimitedLine(l, delim));
        const colCount = Math.max(...rows.map(r => r.length));
        if (colCount < 1) return null;

        // 自动表头识别（与 Excel 相同策略）
        const isNumeric = (s: string) => /^\s*-?\d+(\.\d+)?\s*$/.test(s);
        const isLikelyHeader = (s: string) => /[A-Za-z\u4e00-\u9fff]/.test(s) && !isNumeric(s);
        const top = rows[0];
        const nonEmptyTop = top.filter(v => (v || '').trim().length > 0);
        const headerLikeCount = nonEmptyTop.filter(isLikelyHeader).length;
        const useTopAsHeader = nonEmptyTop.length > 0 && headerLikeCount >= Math.max(1, Math.floor(nonEmptyTop.length * 0.6));

        const headers: string[] = [];
        if (useTopAsHeader) {
            for (let i = 0; i < colCount; i++) headers.push(((top[i] || '').trim()) || `列${i + 1}`);
        } else {
            for (let i = 0; i < colCount; i++) headers.push(`列${i + 1}`);
        }

        const md: string[] = [];
        md.push(`| ${headers.join(' | ')} |`);
        md.push(`| ${headers.map(() => '---').join(' | ')} |`);
        const startRow = useTopAsHeader ? 1 : 0;
        for (let r = startRow; r < rows.length; r++) {
            const row = rows[r];
            const vals: string[] = [];
            for (let c = 0; c < colCount; c++) {
                const rawV = (row[c] !== undefined && row[c] !== null) ? String(row[c]) : '';
                const v = rawV.trim().length > 0 ? rawV : '空';
                vals.push(v);
            }
            md.push(`| ${vals.join(' | ')} |`);
        }
        return md.join('\n');
    }

    /**
     * 简易二进制文本检测：用于阻止直接显示压缩包或 Excel 工作簿等原始字节
     */
    private isLikelyBinaryText(text: string): boolean {
        if (typeof text !== 'string') return false;
        if (text.length === 0) return false;
        // ZIP 文件特征（xlsx/docx 等）
        if (text.length > 1024 && /PK\x03\x04/.test(text)) return true;
        const samples = text.slice(0, Math.min(text.length, 4000));
        let ctrl = 0;
        for (let i = 0; i < samples.length; i++) {
            const ch = samples[i];
            const code = samples.charCodeAt(i);
            const isPrintableAscii = code >= 0x20 && code <= 0x7E;
            const isCommonWhitespace = code === 0x09 || code === 0x0A || code === 0x0D;
            const isCJK = (code >= 0x4E00 && code <= 0x9FFF);
            const isPunctCJK = '，。！？、；：“”‘’（）《》【】'.includes(ch);
            const isAllowed = isPrintableAscii || isCommonWhitespace || isCJK || isPunctCJK;
            if (!isAllowed && code < 0x20) ctrl++;
        }
        const ratio = ctrl / samples.length;
        return ratio > 0.02; // 控制字符比例阈值
    }

    /**
     * 将 Excel 单元格结果渲染为人类可读的纯文本
     */
    private formatExcelCells(result: any): string {
        const sheetName = (result.sheet_name || result.sheet || 'Sheet').toString();
        const range = (result.range || '').toString();
        const header = range ? `${sheetName} ${range}` : sheetName;

        const cells = Array.isArray(result.cells) ? result.cells.slice() : [];
        // 行列排序，保证阅读顺序
        cells.sort((a: any, b: any) => {
            const ar = (a.row ?? 0), br = (b.row ?? 0);
            if (ar !== br) return ar - br;
            const ac = (a.column ?? 0), bc = (b.column ?? 0);
            return ac - bc;
        });

        // 增强：无论 range 是否为标准矩形，都尝试以“包含所有单元格的外接矩形”渲染 Markdown 表格
        const md = this.tryFormatExcelCellsAsMarkdown(range, cells);
        if (md) {
            return `${header}\n\n${md}`;
        }

        // 默认纯文本渲染（按地址逐行显示），统一空单元格展示
        const lines: string[] = [header];
        for (const c of cells) {
            const addr = (c.address || (typeof c.column === 'number' && typeof c.row === 'number' ? `${this.indexToColLetter(Number(c.column))}${Number(c.row)}` : '')).toString();
            const valueRaw = (c.value !== undefined && c.value !== null) ? String(c.value) : '';
            const value = valueRaw.trim().length > 0 ? valueRaw : '空';
            lines.push(`${addr}: ${value}`);
        }
        return lines.join('\n');
    }

    /**
     * 尝试将矩形区域的 Excel 单元格渲染为最简 Markdown 表格
     * 仅在 range 形如 "A1:B10"、"A1:C3" 等矩形时生效
     */
    private tryFormatExcelCellsAsMarkdown(range: string, cells: any[]): string | null {
        if (!Array.isArray(cells) || cells.length === 0) return null;

        // 计算所有单元格的外接矩形（支持非矩形输入与超出 range 的单元格）
        let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
        for (const c of cells) {
            const r = Number(c.row), colNum = Number(c.column);
            if (!Number.isFinite(r) || !Number.isFinite(colNum)) continue;
            if (r < minRow) minRow = r;
            if (r > maxRow) maxRow = r;
            if (colNum < minCol) minCol = colNum;
            if (colNum > maxCol) maxCol = colNum;
        }

        // 若提供了矩形 range，则与外接矩形取并集，避免遗漏额外单元格（如 A4）
        const parsed = this.parseExcelRange(range);
        if (parsed) {
            minCol = Math.min(minCol, parsed.startCol);
            maxCol = Math.max(maxCol, parsed.endCol);
            minRow = Math.min(minRow, parsed.startRow);
            maxRow = Math.max(maxRow, parsed.endRow);
        }

        if (!Number.isFinite(minCol) || !Number.isFinite(maxCol) || !Number.isFinite(minRow) || !Number.isFinite(maxRow)) return null;
        if (minCol > maxCol || minRow > maxRow) return null;

        // 构建网格 row -> (col -> value)
        const grid = new Map<number, Map<number, string>>();
        for (const c of cells) {
            const r = Number(c.row), colNum = Number(c.column);
            if (!Number.isFinite(r) || !Number.isFinite(colNum)) continue;
            const valRaw = (c.value !== undefined && c.value !== null) ? String(c.value) : ' ';
            const val = valRaw.replace(/\|/g, '\\|').replace(/\n/g, ' ');
            if (!grid.has(r)) grid.set(r, new Map<number, string>());
            grid.get(r)!.set(colNum, val);
        }

        // 自动表头识别：若顶行非纯数字/日期文本占比居多，则认为顶行为表头
        const isNumeric = (s: string) => /^\s*-?\d+(\.\d+)?\s*$/.test(s);
        const isLikelyHeader = (s: string) => /[A-Za-z\u4e00-\u9fff]/.test(s) && !isNumeric(s);
        const topRowMap = grid.get(minRow) || new Map<number, string>();
        const topVals: string[] = [];
        for (let col = minCol; col <= maxCol; col++) topVals.push(topRowMap.get(col) || ' ');
        const nonEmptyTop = topVals.filter(v => v.trim().length > 0);
        const headerLikeCount = nonEmptyTop.filter(isLikelyHeader).length;
        const useTopAsHeader = nonEmptyTop.length > 0 && headerLikeCount >= Math.max(1, Math.floor(nonEmptyTop.length * 0.6));

        // 构造表头
        const headers: string[] = [];
        if (useTopAsHeader) {
            for (let col = minCol; col <= maxCol; col++) headers.push((topRowMap.get(col) || ' ').trim() || this.indexToColLetter(col));
        } else {
            for (let col = minCol; col <= maxCol; col++) headers.push(this.indexToColLetter(col));
        }

        const lines: string[] = [];
        lines.push(`| ${headers.join(' | ')} |`);
        lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
        const startDataRow = useTopAsHeader ? (minRow + 1) : minRow;
        for (let row = startDataRow; row <= maxRow; row++) {
            const rowMap = grid.get(row) || new Map<number, string>();
            const rowVals: string[] = [];
            for (let col = minCol; col <= maxCol; col++) {
                const raw = rowMap.get(col);
                const v = (raw !== undefined && raw !== null && String(raw).trim().length > 0) ? String(raw) : '空';
                rowVals.push(v);
            }
            lines.push(`| ${rowVals.join(' | ')} |`);
        }
        return lines.join('\n');
    }

    /**
     * 解析 Excel 区域字符串（如 "A1:B10"）为行列数字
     */
    private parseExcelRange(range: string): { startCol: number; endCol: number; startRow: number; endRow: number } | null {
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
    private colLetterToIndex(s: string): number {
        let n = 0;
        for (let i = 0; i < s.length; i++) {
            n = n * 26 + (s.charCodeAt(i) - 64);
        }
        return n;
    }

    /**
     * 列数字转字母（1->A, 2->B, ..., 27->AA ...）
     */
    private indexToColLetter(n: number): string {
        let s = '';
        while (n > 0) {
            const rem = (n - 1) % 26;
            s = String.fromCharCode(65 + rem) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s || 'A';
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
     * 增强版路径清理：处理伪协议、中文引号、盘符规范化与 .<server> 前缀回退
     */
    private sanitizeFilePathV2(rawPath: string, preferCandidate?: string): string {
        if (!rawPath || typeof rawPath !== 'string') return rawPath;
        let p = rawPath.trim();
        // 统一分隔符为反斜杠
        p = p.replace(/[\\/]+/g, '\\');
        // 去除中英文引号（含中文单引号）
        p = p.replace(/[“”"'‘’]+/g, '');
        // 处理伪协议前缀（excel:, file:, fs:, mcp:）
        p = p.replace(/^(excel|file|fs|mcp):\\?/i, '');
        // 规范化盘符后没有反斜杠：D:work -> D:\\work
        p = p.replace(/^([A-Za-z]):(?!\\)/, '$1:\\');
        // 去掉错误点前缀
        p = p.replace(/^\.([A-Za-z]:\\)/, '$1');
        // .<server>\\ 前缀回退为绝对候选
        if (/^\.[A-Za-z][A-Za-z0-9_-]+\\/.test(p) && preferCandidate && /^[A-Za-z]:\\/.test(preferCandidate)) {
            p = preferCandidate;
        }
        // 复用原有的兜底逻辑
        return this.sanitizeFilePath(p, preferCandidate);
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
        const clean = (p: string) => p.replace(/[“”"'‘’]+/g, '').trim();
        const cleaned = matches.map(clean);
        const prefer = cleaned.find(m => /^D:\\work(\\|$)/i.test(m));
        return prefer || cleaned[0];
    }

    /**
     * 提取消息中的纯文本（支持 OpenAI 风格富文本 content 数组）
     */
    private extractTextFromMessage(m: ChatCompletionMessageParam): string {
        if (!m || !m.content) return '';
        const c: any = (m as any).content;
        if (typeof c === 'string') return c as string;
        if (Array.isArray(c)) {
            try {
                const parts = c
                    .filter((x: any) => x && (typeof x.text === 'string' || typeof x.content === 'string'))
                    .map((x: any) => (typeof x.text === 'string' ? x.text : (typeof x.content === 'string' ? x.content : '')));
                return parts.join(' ').trim();
            } catch {}
        }
        if (typeof c === 'object' && c !== null) {
            if (typeof (c as any).text === 'string') return (c as any).text;
            if (typeof (c as any).content === 'string') return (c as any).content;
        }
        return '';
    }

    /**
     * 获取最近一条用户文本（兼容数组消息），用于路径提取
     */
    private getLastUserText(messages: ChatCompletionMessageParam[]): string | null {
        const lastUser = [...messages].reverse().find(m => m.role === 'user') as ChatCompletionMessageParam | undefined;
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
    private isDirectoryLikePath(p: string): boolean {
        if (!p || typeof p !== 'string') return false;
        const normalized = p.replace(/[\/]+/g, '\\');
        if (/\\$/.test(normalized)) return true;
        const base = path.win32.basename(normalized);
        if (!/\./.test(base)) return true;
        try {
            if (fs.existsSync(normalized)) {
                const st = fs.statSync(normalized);
                if (st.isDirectory()) return true;
            }
        } catch {}
        return false;
    }

    /**
     * 从文本或参数中提取可能的文件名（相对名），例如 2.txt、note.md
     * 仅匹配不包含路径分隔符的文件名，避免与绝对路径冲突
     */
    private extractFileNameCandidate(text?: string): string | null {
        if (!text || typeof text !== 'string') return null;
        // 支持常见文本/数据扩展名
        // 允许中文/Unicode 文件名，排除路径分隔与非法字符
        const regex = /([^\s\\\/<>:"\|\?\*]+?\.(txt|md|json|csv|log|ini|conf|xml|yml|yaml|html|htm|js|ts|xls|xlsx))/i;
        const cleaned = text.replace(/[“”"'‘’]+/g, ' ').trim();
        const m = cleaned.match(regex);
        if (!m) return null;
        const fn = m[1];
        if (/[\\/]/.test(fn)) return null; // 含分隔符则认为不是纯文件名
        return fn;
    }

    /**
     * 纠正 Excel 相关工具的文件参数，确保传入绝对路径
     * 适用于 excel-mcp-server 的工具（如 read_data_from_excel）, 以及名称包含 excel/sheet/workbook 的工具
     */
    private ensureExcelFileArg(toolName: string, toolArgs: any, toolsContent: string, messages: ChatCompletionMessageParam[]): any {
        const isExcelTool = /excel|sheet|workbook/i.test(toolName) || toolName === 'read_data_from_excel';
        if (!isExcelTool) return toolArgs;

        let candidate: string | null = null;
        if (toolsContent) {
            candidate = this.extractWindowsPath(toolsContent);
        }
        if (!candidate) {
            const lastText = this.getLastUserText(messages);
            if (lastText) {
                candidate = this.extractWindowsPath(lastText);
            }
        }

        // 本地函数：模糊提取工作表名（sheet_name）
        const pickSheetName = (text?: string | null): string | null => {
            if (!text || typeof text !== 'string') return null;
            const patterns: RegExp[] = [
                /(sheet[_\s-]?name)\s*(?:为|是|:|=)\s*[‘'“"]?([A-Za-z0-9_\-\s\u4e00-\u9fa5]+)[’'”"]?/i,
                /(工作表|表名|sheet|worksheet)\s*(?:为|是|:|=)\s*[‘'“"]?([A-Za-z0-9_\-\s\u4e00-\u9fa5]+)[’'”"]?/i,
            ];
            for (const p of patterns) {
                const m = text.match(p);
                if (m && m[2]) {
                    const raw = m[2];
                    const cleaned = raw.trim().replace(/[‘’“”"'\s，。；、：]+$/g, '');
                    return cleaned || null;
                }
            }
            return null;
        };

        const provided = toolArgs?.filename || toolArgs?.file_path || toolArgs?.path || toolArgs?.file;
        let sanitized: string | undefined;
        if (typeof provided === 'string') {
            sanitized = this.sanitizeFilePathV2(provided, candidate || undefined);
        } else if (candidate) {
            sanitized = this.sanitizeFilePathV2(candidate, candidate || undefined);
        }

        // 如果清理后为空或非绝对路径，但存在候选绝对路径，则回退到候选
        if ((!sanitized || !/^[A-Za-z]:\\/.test(sanitized)) && candidate && /^[A-Za-z]:\\/.test(candidate)) {
            sanitized = this.sanitizeFilePathV2(candidate, candidate);
        }

        if (sanitized) {
            let finalPath = sanitized;
            // 针对 Excel 文件扩展名，裁切掉跟随的中文标点或说明性文本（如 “，工作表为 ...”）
            try {
                const excelExtPattern = /(\.xlsx|\.xlsm|\.xls|\.xltx|\.xltm)/i;
                const m = finalPath.match(excelExtPattern);
                if (m) {
                    const idx = finalPath.indexOf(m[0]);
                    if (idx >= 0) {
                        finalPath = finalPath.slice(0, idx + m[0].length);
                    }
                }
                // 去除末尾的中文/英文引号与标点
                finalPath = finalPath.replace(/[‘’“”"'\s，。；、：]+$/g, '');
            } catch {}
            const dirLike = this.isDirectoryLikePath(sanitized);

            // 如果是目录样式，尝试拼接文件名
            if (dirLike) {
                let filenameCandidate: string | null = null;
                if (typeof toolArgs.filename === 'string') {
                    filenameCandidate = this.extractFileNameCandidate(toolArgs.filename);
                }
                if (!filenameCandidate && typeof toolArgs.file === 'string') {
                    filenameCandidate = this.extractFileNameCandidate(toolArgs.file);
                }
                if (!filenameCandidate && typeof toolArgs.path === 'string') {
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

            // Excel 工具参数同步：兼容服务端对 `filepath` 与 `sheet_name` 的要求
            // 1) read_data_from_excel：显式传递 { filepath, sheet_name }（仅必要键，避免 extra fields）
            // 2) 其他 Excel 工具：同步常见字段，包含 filepath/filename/file_path/path，最大化兼容
            if (toolName === 'read_data_from_excel') {
                let sheetName: string | null = null;
                // 优先使用显式字段
                if (typeof toolArgs?.sheet_name === 'string' && toolArgs.sheet_name.trim()) {
                    sheetName = toolArgs.sheet_name.trim();
                } else if (typeof toolArgs?.sheet === 'string' && toolArgs.sheet.trim()) {
                    sheetName = toolArgs.sheet.trim();
                } else if (typeof toolArgs?.worksheet === 'string' && toolArgs.worksheet.trim()) {
                    sheetName = toolArgs.worksheet.trim();
                }
                // 其次从工具内容与用户文本模糊提取
                if (!sheetName) {
                    const lastText = this.getLastUserText(messages);
                    sheetName = pickSheetName(toolsContent) || pickSheetName(lastText) || null;
                }
                if (!sheetName) sheetName = 'Sheet1';
                toolArgs = { filepath: finalPath, sheet_name: sheetName };
            } else {
                toolArgs.filepath = finalPath;
                toolArgs.filename = finalPath;
                toolArgs.file_path = finalPath;
                toolArgs.path = finalPath;
            }

            // 清理可能引起歧义的相对字段
            if (typeof toolArgs.file === 'string' && !/^[A-Za-z]:\\/.test(toolArgs.file)) {
                delete toolArgs.file;
            }
        }

        try {
            const finalLog = toolArgs?.filepath || toolArgs?.filename || toolArgs?.file_path || toolArgs?.path;
            logger.info(`[MCP Excel] tool="${toolName}", provided="${provided}", candidate="${candidate}", sanitized="${sanitized}", final="${finalLog}", sheet_name="${toolArgs?.sheet_name ?? ''}"`);
        } catch {}

        return toolArgs;
    }

    /**
     * 目录与文件名拼接为 Windows 绝对路径
     */
    private joinDirAndFile(dir: string, filename: string): string {
        const d = dir.replace(/[“”"'‘’]+/g, '').trim();
        const f = filename.replace(/[“”"'‘’]+/g, '').trim();
        return path.win32.join(d, f);
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
            const lastText = this.getLastUserText(messages);
            if (lastText) {
                candidate = this.extractWindowsPath(lastText);
            }
        }

        // 接受模型可能提供的多个字段名，并归一到 file_path
        const provided = toolArgs?.file_path || toolArgs?.path || toolArgs?.file || toolArgs?.filename;
        let sanitized: string | undefined;
        if (!provided && candidate) {
            sanitized = this.sanitizeFilePathV2(candidate || '', candidate || undefined);
        } else if (provided && typeof provided === 'string') {
            sanitized = this.sanitizeFilePathV2(provided, candidate || undefined);
        }

        if (sanitized) {
            // 如果像目录，则尝试从参数或上下文中提取文件名，并拼接
            let finalPath = sanitized;
            const dirLike = this.isDirectoryLikePath(sanitized);

            // 参数中的文件名候选
            let filenameCandidate: string | null = null;
            if (typeof toolArgs.filename === 'string') {
                filenameCandidate = this.extractFileNameCandidate(toolArgs.filename);
            } else if (typeof toolArgs.file === 'string') {
                // 某些模型可能把文件名放在 file 字段
                // 如果是相对名，则作为候选
                if (!/^[A-Za-z]:\\/.test(toolArgs.file)) {
                    filenameCandidate = this.extractFileNameCandidate(toolArgs.file);
                }
            }
            // 从工具内容与用户消息中再找一次文件名
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

            // 针对常见文件扩展名，裁切掉跟随的中文标点或说明性文本（例如 “，内容为：...”）
            try {
                const commonExtPattern = /(\.(txt|md|json|csv|log|ini|conf|xml|yml|yaml|html|htm|js|ts))/i;
                const m = finalPath.match(commonExtPattern);
                if (m) {
                    const idx = finalPath.indexOf(m[0]);
                    if (idx >= 0) {
                        finalPath = finalPath.slice(0, idx + m[0].length);
                    }
                }
                // 去除末尾的引号与标点
                finalPath = finalPath.replace(/[‘’“”"'\s，。；、：]+$/g, '');
            } catch {}

            // 同步设置 file_path 与 path，确保兼容不同服务器的参数命名
            toolArgs.file_path = finalPath;
            toolArgs.path = finalPath;

            // 清理其他可能存在但非绝对路径的歧义字段（避免让服务器误解）
            if (typeof toolArgs.file === 'string' && !/^[A-Za-z]:\\/.test(toolArgs.file)) {
                delete toolArgs.file;
            }
            if (typeof toolArgs.filename === 'string' && !/^[A-Za-z]:\\/.test(toolArgs.filename)) {
                delete toolArgs.filename;
            }
        }

        // 关键日志，帮助定位后续问题
        try {
            logger.info(`[MCP FS] tool="${toolName}", provided="${provided}", candidate="${candidate}", sanitized="${sanitized}", final="${toolArgs?.file_path || toolArgs?.path}"`);
        } catch {}

        return toolArgs;
    }

    /**
     * 从工具参数或上下文中提取 docx 目标路径与写入内容
     */
    private extractDocxPathAndContent(toolArgs: any, toolsContent: string, messages: ChatCompletionMessageParam[]): { path?: string, content?: string } {
        let candidatePath: string | undefined;
        // 1) 参数内路径
        const provided = toolArgs?.file_path || toolArgs?.filepath || toolArgs?.path || toolArgs?.file || toolArgs?.filename;
        if (typeof provided === 'string') {
            const p = this.sanitizeFilePathV2(provided, provided);
            candidatePath = p;
        }
        // 2) 工具内容/用户消息提取路径
        if (!candidatePath) {
            let c = this.extractWindowsPath(toolsContent);
            if (!c) {
                const lastText = this.getLastUserText(messages);
                c = this.extractWindowsPath(lastText || '') || null;
            }
            if (c) candidatePath = this.sanitizeFilePathV2(c, c);
        }
        // 若不是 .docx，忽略
        if (candidatePath && !/\.docx$/i.test(candidatePath)) {
            candidatePath = undefined;
        }
        // 写入内容候选
        let content: string | undefined;
        if (typeof toolArgs?.content === 'string') content = toolArgs.content;
        else if (typeof toolArgs?.text === 'string') content = toolArgs.text;
        else if (typeof toolArgs?.data === 'string') content = toolArgs.data;
        // 若参数缺失，尝试从用户消息中提取“内容是 …”的片段（简单中文规则）
        if (!content) {
            const last = this.getLastUserText(messages) || '';
            const m = last.match(/内容\s*是\s*[“"']([^“"']+)[”"']/);
            if (m && m[1]) content = m[1].trim();
        }
        return { path: candidatePath, content };
    }

    /**
     * 规范化读取选项，避免 head 与 tail 同时指定导致服务器报错
     */
    private normalizeReadOptionsArg(toolName: string, toolArgs: any): any {
        const isRead = (/read/i.test(toolName) && /file|text/i.test(toolName)) || toolName === 'read_text_file' || toolName === 'read_file';
        if (!isRead || !toolArgs || typeof toolArgs !== 'object') return toolArgs;

        const hasHead = Object.prototype.hasOwnProperty.call(toolArgs, 'head');
        const hasTail = Object.prototype.hasOwnProperty.call(toolArgs, 'tail');

        // 同时出现则移除两者，默认读取全文
        if (hasHead && hasTail) {
            delete toolArgs.head;
            delete toolArgs.tail;
            try { logger.warn(`[MCP FS] normalize: removed conflicting head/tail for tool="${toolName}"`); } catch {}
        } else {
            // 若仅存在一者，确保为正整数，否则删除
            if (hasHead) {
                const h = Number(toolArgs.head);
                if (!Number.isFinite(h) || h <= 0) delete toolArgs.head; else toolArgs.head = Math.floor(h);
            }
            if (hasTail) {
                const t = Number(toolArgs.tail);
                if (!Number.isFinite(t) || t <= 0) delete toolArgs.tail; else toolArgs.tail = Math.floor(t);
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
    private ensureClaudeSkillArg(serverName: string, toolName: string, toolArgs: any, messages: ChatCompletionMessageParam[]): any {
        try {
            if (!/claude\s*code/i.test(serverName)) return toolArgs;
            if (!/skill/i.test(toolName)) return toolArgs;
            const argsObj: any = (toolArgs && typeof toolArgs === 'object') ? { ...toolArgs } : {};

            // 统一获取技能名（支持别名），并兼容直接将整个 arguments 写成字符串的情况（例如 "pdf"）
            let skillRaw: any = (typeof toolArgs === 'string') ? toolArgs : (argsObj.skill ?? argsObj.skill_name ?? argsObj.name ?? argsObj.cmd ?? argsObj.command ?? argsObj.action ?? argsObj.mode ?? argsObj.operation);
            // 若为对象或数组，尝试提取 name 或第一个元素
            if (skillRaw && typeof skillRaw === 'object') {
                try {
                    if (Array.isArray(skillRaw)) {
                        skillRaw = skillRaw.length > 0 ? skillRaw[0] : '';
                    }
                    if (skillRaw && typeof skillRaw === 'object') {
                        if (typeof (skillRaw as any).name === 'string') {
                            skillRaw = (skillRaw as any).name;
                        } else if (typeof (skillRaw as any).id === 'string') {
                            skillRaw = (skillRaw as any).id;
                        } else {
                            // 兜底：字符串化但避免 "[object Object]"
                            const keys = Object.keys(skillRaw);
                            if (keys.length === 1 && typeof (skillRaw as any)[keys[0]] === 'string') {
                                skillRaw = (skillRaw as any)[keys[0]];
                            } else {
                                skillRaw = '';
                            }
                        }
                    }
                } catch { skillRaw = ''; }
            }

            // 若仍未得到字符串技能名，根据上下文猜测
            if (typeof skillRaw !== 'string' || !skillRaw.trim()) {
                const last = this.getLastUserText(messages) || '';
                const lower = last.toLowerCase();
                // 文件扩展名线索
                const pathInText = this.extractWindowsPath(last) || '';
                let guess = '';
                if (/\.xlsx?$/i.test(pathInText) || /(excel|xlsx|workbook|sheet)/i.test(lower)) {
                    guess = 'xlsx';
                } else if (/\.pdf$/i.test(pathInText) || /pdf/i.test(lower)) {
                    guess = 'pdf';
                } else if (/\.docx$/i.test(pathInText) || /(word|docx)/i.test(lower)) {
                    guess = 'docx';
                } else if (/git/i.test(lower)) {
                    guess = 'git-pushing';
                } else if (/(video|下载|download)/i.test(lower)) {
                    guess = 'video-downloader';
                } else if (/(canvas|设计|design)/i.test(lower)) {
                    guess = 'canvas-design';
                }
                if (guess) skillRaw = guess;
            }

            if (typeof skillRaw === 'string') {
                // 同义词与中文别称归一化
                const normalizeSkill = (s: string): string => {
                    const raw = (s || '').trim();
                    const lower = raw.toLowerCase();
                    // 列出技能相关（中英文）统一为 list
                    if (/^(list|list_skills|show_skills|skills|skill_list)$/.test(lower)) return 'list';
                    if (/列出技能|技能列表|查看技能|显示技能/.test(raw)) return 'list';
                    if (/^excel$/.test(lower)) return 'xlsx';
                    if (/^(xlsx|sheet|workbook)$/.test(lower)) return 'xlsx';
                    if (/^word$/.test(lower)) return 'docx';
                    if (/^(doc|docx)$/.test(lower)) return 'docx';
                    if (/^pdf$/.test(lower) || /(pdf阅读|read_pdf|pdf_parser)/.test(lower)) return 'pdf';
                    if (/git.*push/.test(lower)) return 'git-pushing';
                    if (/video|downloader|下载视频/.test(lower)) return 'video-downloader';
                    if (/canvas|design|设计/.test(lower)) return 'canvas-design';
                    return raw;
                };
                argsObj.skill = normalizeSkill(skillRaw);
            }

            // 移除未在 schema 中声明且常导致报错的字段
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
                const dbg = (typeof toolArgs === 'string') ? `stringArg=${JSON.stringify(toolArgs)}` : `rawArgs=${JSON.stringify(toolArgs)}`;
                logger.info(`[MCP ClaudeSkill] normalized args for ${serverName}__${toolName}: ${JSON.stringify(argsObj)}; ${dbg}`);
            } catch {}
            return argsObj;
        } catch (e) {
            try { logger.warn(`[MCP ClaudeSkill] ensure args failed for ${serverName}__${toolName}:`, e as any); } catch {}
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
    private ensureGenericPathArg(fullToolName: string, toolName: string, toolArgs: any, toolsContent: string, messages: ChatCompletionMessageParam[]): any {
        try {
            const schema = this.toolsSchemaByName.get(fullToolName);
            // 若无 schema，尝试基于现有参数猜测
            const properties: Record<string, any> = (schema && schema.properties) ? schema.properties : {};

            // 判断是否为“有路径字段”的工具
            const hasPathFieldInSchema = ['file_path','filepath','path','file','filename'].some(k => Object.prototype.hasOwnProperty.call(properties, k));
            const hasDirFieldInSchema = ['directory_path','dir_path','directory','dir','folder'].some(k => Object.prototype.hasOwnProperty.call(properties, k));
            const looksPathyArgs = toolArgs && (toolArgs.file_path || toolArgs.filepath || toolArgs.path || toolArgs.file || toolArgs.filename);
            const looksDirArgs = toolArgs && (toolArgs.directory_path || toolArgs.dir_path || toolArgs.directory || toolArgs.dir || toolArgs.folder);
            if (!hasPathFieldInSchema && !hasDirFieldInSchema && !looksPathyArgs && !looksDirArgs) return toolArgs;

            // 从上下文提取候选绝对路径
            let candidate: string | null = null;
            if (toolsContent) candidate = this.extractWindowsPath(toolsContent);
            if (!candidate) {
                const lastText = this.getLastUserText(messages);
                if (lastText) candidate = this.extractWindowsPath(lastText);
            }

            // 现有参数中的路径值（别名接受）
            const provided = toolArgs?.file_path || toolArgs?.filepath || toolArgs?.path || toolArgs?.file || toolArgs?.filename;
            let sanitized: string | undefined;
            if (!provided && candidate) {
                sanitized = this.sanitizeFilePathV2(candidate || '', candidate || undefined);
            } else if (provided && typeof provided === 'string') {
                sanitized = this.sanitizeFilePathV2(provided, candidate || undefined);
            }

            if (sanitized) {
                let finalPath = sanitized;
                const dirLike = this.isDirectoryLikePath(sanitized);

                // 文件名候选（来自参数或上下文）
                let filenameCandidate: string | null = null;
                if (typeof toolArgs.filename === 'string') {
                    filenameCandidate = this.extractFileNameCandidate(toolArgs.filename);
                } else if (typeof toolArgs.file === 'string') {
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

                // 针对常见扩展名，裁切掉扩展名之后的中文说明或标点，避免污染路径
                try {
                    const commonExtPattern = /(\.(txt|md|json|csv|log|ini|conf|xml|yml|yaml|html|htm|js|ts|docx|doc|pdf|xls|xlsx|xlsm))/i;
                    const m = finalPath.match(commonExtPattern);
                    if (m) {
                        const idx = finalPath.indexOf(m[0]);
                        if (idx >= 0) {
                            finalPath = finalPath.slice(0, idx + m[0].length);
                        }
                    }
                    finalPath = finalPath.replace(/[‘’“”"'\s，。；、：]+$/g, '');
                } catch {}

                // 写入到最合适的字段：优先 file_path -> path -> file
                if (!toolArgs.file_path && Object.prototype.hasOwnProperty.call(properties, 'file_path')) {
                    toolArgs.file_path = finalPath;
                } else if (!toolArgs.path && Object.prototype.hasOwnProperty.call(properties, 'path')) {
                    toolArgs.path = finalPath;
                } else if (!toolArgs.file && Object.prototype.hasOwnProperty.call(properties, 'file')) {
                    toolArgs.file = finalPath;
                } else if (!toolArgs.filename && Object.prototype.hasOwnProperty.call(properties, 'filename')) {
                    toolArgs.filename = finalPath;
                } else {
                    // 无 schema 或无法判断时，保守写入 file_path 字段
                    if (!toolArgs.file_path) toolArgs.file_path = finalPath;
                }
            }

            return toolArgs;
        } catch (e) {
            try { logger.warn(`[MCP GenericPath] failed for ${fullToolName}:`, e as any); } catch {}
            return toolArgs;
        }
    }

    /**
     * 基于工具 JSON Schema 的通用参数归一化：字段别名、类型转换、必填项与默认值、剔除非 schema 字段
     * @param fullToolName 完整工具名（形如 "server__tool"）
     * @param toolArgs 原始工具参数
     * @param wantWrite 是否为写入型工具（影响部分默认策略）
     */
    private ensureArgsBySchema(fullToolName: string, toolArgs: any, wantWrite?: boolean): any {
        try {
            const schema = this.toolsSchemaByName.get(fullToolName);
            if (!schema || typeof schema !== 'object') return toolArgs;
            if (schema.type && schema.type !== 'object') return toolArgs;

            const properties: Record<string, any> = schema.properties || {};
            const required: string[] = Array.isArray(schema.required) ? schema.required.slice() : [];

            // 选择存在于 schema 中的规范字段作为“正名”
            const selectCanonical = (candidates: string[]): string | null => {
                for (const name of candidates) {
                    if (Object.prototype.hasOwnProperty.call(properties, name)) return name;
                }
                return null;
            };

            // 别名分组：会根据 schema 实际包含的字段选择正名
            const groups: string[][] = [
                // 文件路径相关（文件系统/Excel 常见）
                ['file_path','filepath','path','file','filename'],
                // 目录路径相关
                ['directory_path','dir_path','directory','dir','folder'],
                // Excel 工作表
                ['sheet_name','sheet','worksheet'],
                // 写入内容
                ['content','text','data','body','payload'],
                // Skill 工具常见参数：技能名/命令
                ['skill','cmd','command','action','mode','operation','skill_name','name'],
                // Skill 工具常见参数：技能参数对象
                ['args','arguments','params','parameters','options','opts','data'],
                // 编码
                ['encoding','charset'],
                // HTTP/网络常见参数
                ['url','uri','link','address'],
                ['method','http_method','verb'],
                ['headers','http_headers','header'],
                // 查询/检索类参数
                ['query','q','keyword','keywords','search','pattern','prompt','params','parameters'],
                // 选项/配置
                ['options','opts','config','settings'],
                // 超时与重试
                ['timeout','time_limit','t'],
                ['retries','retry','attempts']
            ];

            // 复制一份，避免直接修改传入对象引用引发副作用
            const args: any = (toolArgs && typeof toolArgs === 'object') ? { ...toolArgs } : {};

            // 别名归一：若正名未设置但存在同组其他别名，则迁移到正名
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
                // 删除同组中非正名且不在 schema 中的字段，减少歧义
                for (const name of group) {
                    if (name === canonical) continue;
                    if (!Object.prototype.hasOwnProperty.call(properties, name) && Object.prototype.hasOwnProperty.call(args, name)) {
                        delete args[name];
                    }
                }
            }

            // 类型转换与默认值填充
            for (const [key, prop] of Object.entries(properties)) {
                if (!Object.prototype.hasOwnProperty.call(args, key)) {
                    // 默认值填充
                    if (prop && Object.prototype.hasOwnProperty.call(prop, 'default')) {
                        args[key] = prop.default;
                        continue;
                    }
                    // Excel sheet_name 常用默认
                    if ((key === 'sheet_name' || key === 'sheet') && !wantWrite) {
                        args[key] = 'Sheet1';
                        continue;
                    }
                    continue;
                }

                const val = args[key];
                const t = prop?.type;
                if (t === 'integer' || t === 'number') {
                    if (typeof val === 'string') {
                        const n = Number(val);
                        if (Number.isFinite(n)) args[key] = (t === 'integer') ? Math.floor(n) : n; else delete args[key];
                    } else if (typeof val !== 'number' || !Number.isFinite(val)) {
                        delete args[key];
                    } else if (t === 'integer') {
                        args[key] = Math.floor(val);
                    }
                } else if (t === 'boolean') {
                    if (typeof val === 'string') {
                        const s = val.trim().toLowerCase();
                        if (['true','1','yes','y','on'].includes(s)) args[key] = true;
                        else if (['false','0','no','n','off'].includes(s)) args[key] = false;
                        else delete args[key];
                    } else if (typeof val !== 'boolean') {
                        delete args[key];
                    }
                } else if (t === 'array') {
                    if (!Array.isArray(val)) {
                        if (typeof val === 'string') {
                            const items = val.split(/[\n,;]+/).map(s => s.trim()).filter(s => s.length > 0);
                            args[key] = items;
                        } else {
                            delete args[key];
                        }
                    }
                } else if (t === 'object') {
                    if (val && typeof val === 'object' && !Array.isArray(val)) {
                        // 保留已是对象的值
                    } else if (typeof val === 'string') {
                        let parsed: any = null;
                        // 优先尝试 JSON 解析
                        try {
                            const candidate = val.trim()
                                // 去掉包裹的大括号或引号
                                .replace(/^([“”"']?){/, '{').replace(/}([“”"']?)$/, '}');
                            parsed = JSON.parse(candidate);
                        } catch {}
                        if (!parsed) {
                            // 解析 KV 格式：key:value 或 key=value，多行或分号分隔
                            const obj: any = {};
                            const segments = val.split(/[\n;]+/).map(s => s.trim()).filter(s => s.length > 0);
                            for (const seg of segments) {
                                const m = seg.match(/^\s*([^:=\s]+)\s*[:=]\s*(.+)\s*$/);
                                if (m) {
                                    const k = m[1].trim();
                                    const v = m[2].trim().replace(/^[“”"']+/, '').replace(/[””"']+$/, '');
                                    obj[k] = v;
                                }
                            }
                            if (Object.keys(obj).length > 0) parsed = obj;
                        }
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            args[key] = parsed;
                        } else {
                            delete args[key];
                        }
                    } else {
                        delete args[key];
                    }
                } else if (t === 'string') {
                    if (val === null || val === undefined) {
                        delete args[key];
                    } else if (typeof val !== 'string') {
                        try { args[key] = String(val); } catch { delete args[key]; }
                    } else {
                        // 基础清理：去除末尾中文/英文引号与标点
                        args[key] = val.replace(/[‘’“”"'\s，。；、：]+$/g, '').trim();
                        // 针对 URL 等格式的进一步清理
                        const fmt = prop?.format;
                        if (fmt === 'uri' || /url/i.test(key)) {
                            let s = args[key];
                            s = s.replace(/^[“”"'\(\[]+/, '').replace(/[””"'\)\]]+$/, '');
                            s = s.replace(/[，。；、：]+$/g, '');
                            args[key] = s.trim();
                        }
                        // HTTP 方法统一为大写（若字段名为 method）
                        if (/^method$/i.test(key)) {
                            args[key] = args[key].toUpperCase();
                        }
                    }
                    // enum 校验（如存在）
                    if (Array.isArray(prop?.enum) && Object.prototype.hasOwnProperty.call(args, key)) {
                        const v = args[key];
                        if (!prop.enum.includes(v)) {
                            // 不在枚举中则删除，避免请求失败
                            delete args[key];
                        }
                    }
                }
            }

            // 必填项检查：若缺失但存在同组别名已设置，则上面已迁移；此处仅记录日志
            for (const req of required) {
                if (!Object.prototype.hasOwnProperty.call(args, req)) {
                    try { logger.warn(`[MCP Args] required missing for ${fullToolName}: ${req}`); } catch {}
                }
            }

            // 仅保留 schema 中声明的字段
            const finalArgs: any = {};
            for (const key of Object.keys(properties)) {
                if (Object.prototype.hasOwnProperty.call(args, key)) {
                    finalArgs[key] = args[key];
                }
            }

            try { logger.info(`[MCP Args] normalized for ${fullToolName}: ${JSON.stringify(finalArgs)}`); } catch {}
            return finalArgs;
        } catch (e) {
            try { logger.error(`[MCP Args] ensureArgsBySchema error for ${fullToolName}:`, e); } catch {}
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
    async callTools(toolCallMap: Record<string, OpenAI.Chat.Completions.ChatCompletionMessageToolCall>, messages: ChatCompletionMessageParam[], toolsContent: string): Promise<ChatCompletionMessageParam[]> {
        for (const toolCall of Object.values(toolCallMap)) {
            if (!this.isValidToolCall(toolCall)) {
                continue;
            }
            let [serverName, toolName] = toolCall.function.name.split('__');
            serverName = this.dePunycode(serverName);
            let session = this.sessions.get(serverName);

            // 容错：若无法找到会话，尝试按工具短名重映射到真实服务器
            if (!session && toolName) {
                try {
                    const matchedFull = [...this.toolsSchemaByName.keys()].find(full => full.endsWith(`__${toolName}`));
                    if (matchedFull) {
                        const recoveredServer = this.dePunycode(matchedFull.split('__')[0] || '');
                        const recovered = this.sessions.get(recoveredServer);
                        if (recovered) {
                            session = recovered;
                            try { logger.warn(`[MCP Tool] remapped invalid server name "${toolCall.function.name}" -> "${this.enPunycode(recoveredServer)}__${toolName}"`); } catch {}
                        }
                    }
                } catch {}
            }

            if (!session) {
                continue;
            }
            let toolArgs: any = {};
            // 原始参数字符串（可能包含 Windows 路径等需要转义的内容）
            const rawArgStr = (toolCall.function && typeof toolCall.function.arguments === 'string') ? toolCall.function.arguments : '';
            try {
                toolArgs = JSON.parse(rawArgStr);
            } catch (e) {
                // 第一次解析失败，尝试自动修复常见问题：
                // 1）Windows 路径中的反斜杠未转义导致 JSON 无法解析
                // 2）路径值后混入中文说明/标点
                let fixed = this.repairJsonArguments(rawArgStr);
                try {
                    toolArgs = JSON.parse(fixed);
                } catch (e2) {
                    logger.error(`Failed to parse tool arguments for ${toolName} after repair:`, e2);
                    // 容错：继续执行但以空对象为参数
                    toolArgs = {};
                }
            }

            // 先纠正 Excel 工具的 filename 绝对路径
            toolArgs = this.ensureExcelFileArg(toolName, toolArgs, toolsContent, messages);
            // 再规范化并纠正 FileSystem 路径参数
            toolArgs = this.ensureFilePathArg(toolName, toolArgs, toolsContent, messages);
            // 规范化读取选项，避免 head/tail 冲突
            toolArgs = this.normalizeReadOptionsArg(toolName, toolArgs);
            // 基于实际工具 schema 做通用归一化与剔除非声明字段
            const fullToolName = `${this.enPunycode(serverName)}__${toolName}`;
            const wantWrite = MCPCompat.isWriteLikeTool(toolName);
            // 新增：通用路径归一化，适配非 FileSystem 工具（如 claude-code 的 Read/Write）
            toolArgs = this.ensureGenericPathArg(fullToolName, toolName, toolArgs, toolsContent, messages);
            // 新增：Claude Code Skill 参数矫正（在按 schema 归一化之前执行，确保 skill 为字符串且移除多余字段）
            toolArgs = this.ensureClaudeSkillArg(serverName, toolName, toolArgs, messages);
            toolArgs = this.ensureArgsBySchema(fullToolName, toolArgs, wantWrite);

            // Claude Code Skill 防御：若仍缺失或为空字符串，则不实际调用该工具，改为给出提示消息，避免服务器报错
            if (/claude\s*code/i.test(serverName) && /skill/i.test(toolName)) {
                const s = (toolArgs && typeof toolArgs.skill === 'string') ? toolArgs.skill.trim() : '';
                if (!s) {
                    try { logger.warn(`[MCP ClaudeSkill] missing skill, skip tool call for ${serverName}__${toolName}`); } catch {}
                    const guidance = [
                        '未能确定要调用的 Claude Code 技能（skill）名称。',
                        '请在后续消息中仅提供一个技能名字符串（例如：pdf、xlsx、docx、git-pushing、video-downloader、canvas-design），不要包含对象或其他字段。',
                        '如果需要查看有哪些技能，可回复“列出技能”。'
                    ].join('\n');
                    // 将提示作为工具结果返回到消息流，促使大模型修正下一次的工具调用
                    messages = this.updateMessages(messages, toolCall, toolsContent, guidance);
                    continue;
                }
                // 特例：拦截 skill='list'，以及 LM 常用的 '/help'/'help' 别名，直接返回可用技能的结构化列表，避免服务端未知技能或 400 报错
                const sNorm = s.toLowerCase();
                if (sNorm === 'list' || sNorm === 'help' || sNorm === '/help') {
                    try {
                        try { logger.info(`[MCP ClaudeSkill] intercept skills listing via skill="${s}" -> return available_skills locally`); } catch {}
                        const available = [
                            { name: 'pdf', description: '读取/解析 PDF 文件' },
                            { name: 'xlsx', description: '读取或写入 Excel 工作簿' },
                            { name: 'docx', description: '读取或写入 Word 文档' },
                            { name: 'git-pushing', description: '推送 Git 变更（凭证配置后）' },
                            { name: 'video-downloader', description: '下载视频（需提供可下载链接或页面）' },
                            { name: 'canvas-design', description: '画布/设计相关操作' }
                        ];
                        const toolResultArray = MCPCompat.normalizeContentArray([{ type: 'json', json: { status: 'success', available_skills: available } }]);
                        const toolResultLocal: MCPToolResult = { content: toolResultArray };
                        // 进度：开始/完成
                        try {
                            this.pushProgress('tool_call_started', { server: serverName, tool: toolName, args: toolArgs, call_id: toolCall.id });
                        } catch {}
                        try {
                            this.pushProgress('tool_call_finished', { server: serverName, tool: toolName, args: toolArgs, status: 'success', call_id: toolCall.id });
                        } catch {}
                        // 推送原始数组，更新消息（使用可读文本）
                        try {
                            const toolResultPush = this.createToolResultPush(serverName, toolName, toolArgs, toolResultLocal.content);
                            this.pushMessage(toolResultPush);
                        } catch {}
                        const toolResultContent = this.processToolResult(toolResultLocal);
                        messages = this.updateMessages(messages, toolCall, toolsContent, toolResultContent);
                        continue;
                    } catch (e) {
                        try { logger.warn(`[MCP ClaudeSkill] list intercept failed:`, e as any); } catch {}
                    }
                }
            }

            // 写入型工具：在调用前确保父目录存在（宽松模式下自动创建）
            if (wantWrite && toolArgs && typeof toolArgs === 'object') {
                const p = toolArgs.file_path || toolArgs.path;
                if (typeof p === 'string' && p) {
                    MCPCompat.fsEnsureParentDir(p);
                }
            }

            let toolResult: MCPToolResult;
            // 进度：准备调用工具
            try {
                this.pushProgress('tool_call_started', {
                    server: serverName,
                    tool: toolName,
                    args: toolArgs,
                    call_id: toolCall.id
                });
            } catch {}
            try {
                toolResult = await this.executeToolCall(session, serverName, toolName, toolArgs, toolCall.id);
            } catch (err: any) {
                // Excel 专用容错：工作表未找到时回退为 Sheet1 再重试一次
                const isExcelTool = MCPCompat.isExcelTool(toolName);
                const msg = (err && (err.message || err.toString())) || '';
                const sheetNotFound = MCPCompat.excelShouldRetrySheetNotFound(msg);
                if (isExcelTool && sheetNotFound) {
                    try {
                        const before = toolArgs.sheet_name || toolArgs.sheet || toolArgs.worksheet || '';
                        toolArgs = MCPCompat.excelFallbackArgsOnSheetNotFound(toolArgs);
                        logger.warn(`[MCP Excel] sheet not found: "${before}", fallback and retry`);
                        toolResult = await this.executeToolCall(session, toolName, toolArgs);
                    } catch (err2) {
                        logger.error(`[MCP Excel] retry with Sheet1 failed for ${toolName}:`, err2);
                        throw err2;
                    }
                } else if (MCPCompat.isWriteLikeTool(toolName) && MCPCompat.isSchemaMismatch(msg)) {
                    // 兼容：工具声明输出 schema，但返回非结构化文本。写入类工具在本地侧写成功时，强制构造结构化 JSON。
                    try {
                        const coerced = MCPCompat.coerceWriteSuccess(toolName, toolArgs, msg);
                        toolResult = coerced as unknown as MCPToolResult;
                    } catch (coerceErr) {
                        try { logger.error(`[MCPCompat] failed to coerce structured result for ${toolName}:`, coerceErr as any); } catch {}
                        throw err;
                    }
                } else if (/claude\s*code/i.test(serverName) && /skill/i.test(toolName) && MCPCompat.isSchemaMismatch(msg)) {
                    // Claude Code Skill：当服务端声明了 output_schema 但返回纯文本导致 -32600，降级为文本结果，避免中断。
                    try {
                        const friendly = [
                            '提示：Claude Code 的 Skill 工具本次返回的是纯文本，但服务端标注了结构化输出，导致 -32600 错误。',
                            'AingDesk 已自动将其降级为文本模式以继续会话。',
                            '如需结构化 JSON，请在指令中明确要求“仅返回 JSON”。'
                        ].join('\n');
                        const contentArray = MCPCompat.normalizeContentArray([{ type: 'text', text: friendly }]);
                        toolResult = { content: contentArray } as MCPToolResult;
                        try { logger.warn(`[MCPCompat] downgraded Claude Skill result to text due to schema mismatch: ${msg}`); } catch {}
                    } catch (wrapErr) {
                        throw err;
                    }
                } else if (/claude\s*code/i.test(serverName) && /skill/i.test(toolName) && /unknown\s*skill/i.test(msg.toLowerCase())) {
                    // Claude Code Skill：未知技能名时，返回中文引导，提示仅返回英文技能名字符串
                    try {
                        const guidance = [
                            '未识别的 Claude Code 技能名。',
                            '请仅返回一个有效技能的英文名字符串，例如：pdf、xlsx、docx、list（列出技能）、git-pushing、video-downloader、canvas-design。',
                            '不要包含对象或其他字段。'
                        ].join('\n');
                        // 调整顺序：先推送中文引导，再附加原始错误结构，便于前端优先展示中文提示
                        const contentArray = MCPCompat.normalizeContentArray([{ type: 'text', text: guidance }, { type: 'json', json: { status: 'error', message: msg } }]);
                        toolResult = { content: contentArray } as MCPToolResult;
                        try { logger.warn(`[MCP ClaudeSkill] unknown skill: ${msg}`); } catch {}
                    } catch (wrapErr) {
                        // 若结构化失败，保持原始异常行为
                        throw err;
                    }
                } else {
                    // 通用错误结构化：将错误包装为 JSON，以便前端一致渲染
                    try {
                        const contentArray = MCPCompat.normalizeContentArray([
                            { type: 'json', json: { status: 'error', message: msg } },
                        ]);
                        toolResult = { content: contentArray } as MCPToolResult;
                        try { logger.info(`[MCPCompat] structured error for ${toolName}: ${msg}`); } catch {}
                    } catch (wrapErr) {
                        // 若结构化失败，保持原始异常行为
                        throw err;
                    }
                }
            }
            const toolResultContent = this.processToolResult(toolResult);
            const textForJudge = this.extractTextFromContentJson(toolResultContent);
            const isErr = this.isErrorText(textForJudge) || this.isErrorContentArray((toolResult as any)?.content);

            // 进度：工具调用完成（成功/失败）
            try {
                this.pushProgress('tool_call_finished', {
                    server: serverName,
                    tool: toolName,
                    args: toolArgs,
                    status: isErr ? 'error' : 'success',
                    call_id: toolCall.id
                });
            } catch {}

            // 控制重复与错误的推送：若已出现成功，则跳过后续错误的卡片推送
            const stopOnFirstSuccess = this.shouldStopOnFirstSuccess(messages);
            (this as any)._mcpHasSuccess = (this as any)._mcpHasSuccess || false;
            const hasSuccess = (this as any)._mcpHasSuccess as boolean;

            // 向前端推送原始 MCP content 数组，避免错误 JSON.parse
            if (!(hasSuccess && isErr)) {
                const toolResultPush = this.createToolResultPush(serverName, toolName, toolArgs, toolResult.content);
                this.pushMessage(toolResultPush);
            }

            // 继续与工具结果的对话
            messages = this.updateMessages(messages, toolCall, toolsContent, toolResultContent);

            // 桥接：若当前错误文本暗示“无法创建 docx/只能纯文本/请用 docx 技能”，尝试在已连接服务器中查找 docx/word 相关工具以自动完成创建与写入
            // 注意：不要依赖上层作用域的 decisionCfg，这里显式获取一次，避免未定义错误
            const decisionCfg = this.getToolDecisionConfig();
            if (isErr && this.isDocxSkillHint(textForJudge) && decisionCfg && decisionCfg.docx && decisionCfg.docx.bridgeOnError) {
                try {
                    // 仅桥接一次，避免死循环
                    (this as any)._docxBridgeDone = (this as any)._docxBridgeDone || false;
                    if (!(this as any)._docxBridgeDone) {
                        try { this.pushProgress('docx_bridge_started', { from_server: serverName, from_tool: toolName }); } catch {}
                        const docxTargets = await this.findDocxToolsAcrossSessions();
                        if (docxTargets && (docxTargets.readToolName || docxTargets.writeToolName || docxTargets.createToolName)) {
                            const docxSession = this.sessions.get(docxTargets.serverName);
                            if (docxSession) {
                                const { path: docxPath, content: docxText } = this.extractDocxPathAndContent(toolArgs, toolsContent, messages);
                                if (docxPath) {
                                    let bridgeSucceeded = false;
                                    const timeId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
                                    // 先尝试读取（若存在 read 工具，且当前为读取场景或无内容）
                                    if (docxTargets.readToolName && (!docxText || MCPCompat.isReadLikeTool(toolName))) {
                                        try {
                                            try { this.pushProgress('docx_bridge_step_started', { step: 'read', server: docxTargets.serverName, tool: docxTargets.readToolName }); } catch {}
                                            let readArgs: any = { file_path: docxPath };
                                            const fullReadName = `${this.enPunycode(docxTargets.serverName)}__${docxTargets.readToolName}`;
                                            readArgs = this.ensureGenericPathArg(fullReadName, docxTargets.readToolName!, readArgs, toolsContent, messages);
                                            readArgs = this.ensureArgsBySchema(fullReadName, readArgs, /*wantWrite*/ false);
                                            const readResult = await this.executeToolCall(docxSession, docxTargets.readToolName!, readArgs);
                                            const readPush = this.createToolResultPush(docxTargets.serverName, docxTargets.readToolName!, readArgs, readResult.content);
                                            this.pushMessage(readPush);
                                            try { this.pushProgress('docx_bridge_step_finished', { step: 'read', server: docxTargets.serverName, tool: docxTargets.readToolName, status: 'success' }); } catch {}
                                            const fakeCallRead: OpenAI.Chat.Completions.ChatCompletionMessageToolCall = {
                                                id: `docx-bridge-read-${timeId}`,
                                                type: 'function',
                                                function: { name: `${this.enPunycode(docxTargets.serverName)}__${docxTargets.readToolName!}`, arguments: JSON.stringify(readArgs) }
                                            } as any;
                                            const readContent = this.processToolResult(readResult);
                                            messages = this.updateMessages(messages, fakeCallRead, `自动桥接：使用 ${docxTargets.serverName} 的 ${docxTargets.readToolName} 读取 docx 内容`, readContent);
                                            const rTxt = this.extractTextFromContentJson(readContent);
                                            if (rTxt && !this.isErrorText(rTxt)) bridgeSucceeded = true;
                                        } catch (e) {
                                            try { logger.warn('[MCP Docx] read bridge failed:', e as any); } catch {}
                                            try { this.pushProgress('docx_bridge_step_finished', { step: 'read', server: docxTargets.serverName, tool: docxTargets.readToolName, status: 'error', message: (e && (e as any).message) || 'failed' }); } catch {}
                                        }
                                    }
                                    // 可选：先创建
                                    if (docxTargets.createToolName) {
                                        try {
                                            try { this.pushProgress('docx_bridge_step_started', { step: 'create', server: docxTargets.serverName, tool: docxTargets.createToolName }); } catch {}
                                            let createArgs: any = { file_path: docxPath };
                                            const fullCreateName = `${this.enPunycode(docxTargets.serverName)}__${docxTargets.createToolName}`;
                                            createArgs = this.ensureGenericPathArg(fullCreateName, docxTargets.createToolName!, createArgs, toolsContent, messages);
                                            createArgs = this.ensureArgsBySchema(fullCreateName, createArgs, /*wantWrite*/ true);
                                            MCPCompat.fsEnsureParentDir(createArgs.file_path || createArgs.path);
                                            const createResult = await this.executeToolCall(docxSession, docxTargets.createToolName!, createArgs);
                                            const createPush = this.createToolResultPush(docxTargets.serverName, docxTargets.createToolName!, createArgs, createResult.content);
                                            this.pushMessage(createPush);
                                            try { this.pushProgress('docx_bridge_step_finished', { step: 'create', server: docxTargets.serverName, tool: docxTargets.createToolName, status: 'success' }); } catch {}
                                            const fakeCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall = {
                                                id: `docx-bridge-create-${timeId}`,
                                                type: 'function',
                                                function: { name: `${this.enPunycode(docxTargets.serverName)}__${docxTargets.createToolName!}`, arguments: JSON.stringify(createArgs) }
                                            } as any;
                                            const createContent = this.processToolResult(createResult);
                                            messages = this.updateMessages(messages, fakeCall, `自动桥接：使用 ${docxTargets.serverName} 的 ${docxTargets.createToolName} 创建 docx`, createContent);
                                            const cTxt = this.extractTextFromContentJson(createContent);
                                            if (cTxt && !this.isErrorText(cTxt)) bridgeSucceeded = true;
                                        } catch (e) {
                                            try { logger.warn('[MCP Docx] create bridge failed:', e as any); } catch {}
                                            try { this.pushProgress('docx_bridge_step_finished', { step: 'create', server: docxTargets.serverName, tool: docxTargets.createToolName, status: 'error', message: (e && (e as any).message) || 'failed' }); } catch {}
                                        }
                                    }
                                    // 再写入内容（若存在写入工具）
                                    if (docxTargets.writeToolName && docxText) {
                                        try {
                                            try { this.pushProgress('docx_bridge_step_started', { step: 'write', server: docxTargets.serverName, tool: docxTargets.writeToolName }); } catch {}
                                            let writeArgs: any = { file_path: docxPath, content: docxText };
                                            const fullWriteName = `${this.enPunycode(docxTargets.serverName)}__${docxTargets.writeToolName}`;
                                            writeArgs = this.ensureGenericPathArg(fullWriteName, docxTargets.writeToolName!, writeArgs, toolsContent, messages);
                                            writeArgs = this.ensureArgsBySchema(fullWriteName, writeArgs, /*wantWrite*/ true);
                                            MCPCompat.fsEnsureParentDir(writeArgs.file_path || writeArgs.path);
                                            const writeResult = await this.executeToolCall(docxSession, docxTargets.writeToolName!, writeArgs);
                                            const writePush = this.createToolResultPush(docxTargets.serverName, docxTargets.writeToolName!, writeArgs, writeResult.content);
                                            this.pushMessage(writePush);
                                            try { this.pushProgress('docx_bridge_step_finished', { step: 'write', server: docxTargets.serverName, tool: docxTargets.writeToolName, status: 'success' }); } catch {}
                                            const fakeCall2: OpenAI.Chat.Completions.ChatCompletionMessageToolCall = {
                                                id: `docx-bridge-write-${timeId}`,
                                                type: 'function',
                                                function: { name: `${this.enPunycode(docxTargets.serverName)}__${docxTargets.writeToolName!}`, arguments: JSON.stringify(writeArgs) }
                                            } as any;
                                            const writeContent = this.processToolResult(writeResult);
                                            messages = this.updateMessages(messages, fakeCall2, `自动桥接：使用 ${docxTargets.serverName} 的 ${docxTargets.writeToolName} 写入 docx 内容`, writeContent);
                                            const wTxt = this.extractTextFromContentJson(writeContent);
                                            if (wTxt && !this.isErrorText(wTxt)) bridgeSucceeded = true;
                                        } catch (e) {
                                            try { logger.warn('[MCP Docx] write bridge failed:', e as any); } catch {}
                                            try { this.pushProgress('docx_bridge_step_finished', { step: 'write', server: docxTargets.serverName, tool: docxTargets.writeToolName, status: 'error', message: (e && (e as any).message) || 'failed' }); } catch {}
                                        }
                                    }


                                    if (bridgeSucceeded) {
                                        (this as any)._mcpHasSuccess = true;
                                        (this as any)._docxBridgeDone = true;
                                        try { this.pushProgress('docx_bridge_finished', { status: 'success' }); } catch {}
                                        if (stopOnFirstSuccess) {
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    try { logger.warn('[MCP Docx] bridge flow error:', e as any); } catch {}
                    try { this.pushProgress('docx_bridge_finished', { status: 'error', message: (e && (e as any).message) || 'failed' }); } catch {}
                }
            }

            // 首次成功后标记，并在“只返回内容”指令下直接退出循环
            if (!isErr) {
                (this as any)._mcpHasSuccess = true;
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

        // 从文本中提取路径与扩展名
        let pathCandidate: string | null = null;
        try { pathCandidate = this.extractWindowsPath(textRaw); } catch {}
        const ext = pathCandidate ? path.win32.extname(pathCandidate) : '';

        // 服务器提示（excel）与扩展名偏好
        const hintExcel = /excel[-_\s]*mcp[-_\s]*server/i.test(textRaw) || /\bexcel\b/i.test(textRaw) || /\.xlsx?$/i.test(ext);

        // 简单意图分类
        const wantRead = explicitlyAskMCP || hasWindowsPath ? (text.includes("读取") || text.includes("读")) : false;
        const wantWrite = explicitlyAskMCP || hasWindowsPath ? (text.includes("写入") || text.includes("追加") || text.includes("覆盖")) : false;
        const wantJson = /json/.test(text);

        // 整理可用工具列表（按当前 MCP 列表动态生成，不做硬编码服务器名）
        const entries: { server: string, tool: string, full: string }[] = [];
        for (const t of (availableTools || [])) {
            const n = t && t.function && typeof t.function.name === 'string' ? t.function.name : '';
            if (!n) continue;
            const parts = n.split('__');
            const server = parts[0] || '';
            const tool = parts.slice(1).join('__');
            entries.push({ server, tool, full: n });
        }
        const normalizeKey = (s: string) => this.dePunycode(s).toLowerCase().replace(/[-_\s]+/g, '');

        // 基于消息内容的“动态服务器提及/排除”，不硬编码具体名称
        let pool = entries;
        let strictPool = false;
        const messageNorm = textRaw.toLowerCase();
        const serversMentioned: string[] = [];
        const serversOnlyUse: string[] = [];
        const serversAvoid: string[] = [];

        // 从 entries 中抽取现有服务器名，按消息包含进行匹配
        const serverNames = Array.from(new Set(entries.map(e => this.dePunycode(e.server))));
        for (const s of serverNames) {
            const sNorm = s.toLowerCase();
            const mentioned = messageNorm.includes(sNorm);
            const onlyUse = mentioned && (/(只用|仅用|仅使用|只使用)/.test(messageNorm));
            const avoid = mentioned && (/(不使用|不要使用|不要用|禁用)/.test(messageNorm));
            if (mentioned) serversMentioned.push(s);
            if (onlyUse) serversOnlyUse.push(s);
            if (avoid) serversAvoid.push(s);
        }

        // 如果明确“只用”某个服务器，则仅保留该服务器的工具
        if (serversOnlyUse.length > 0) {
            const keys = serversOnlyUse.map(normalizeKey);
            const filtered = entries.filter(e => keys.some(k => normalizeKey(e.server).includes(k)));
            if (filtered.length > 0) {
                pool = filtered;
                strictPool = true;
            }
        } else if (serversMentioned.length > 0) {
            // 若只是“提及”某些服务器，尽量从这些服务器中挑选（保留回退）
            const keys = serversMentioned.map(normalizeKey);
            const filtered = entries.filter(e => keys.some(k => normalizeKey(e.server).includes(k)));
            if (filtered.length > 0) {
                pool = filtered;
            }
        }

        // 若明确“不要使用”某些服务器，则从池中排除，并开启严格池，避免回退
        if (serversAvoid.length > 0) {
            const keys = serversAvoid.map(normalizeKey);
            const filtered = pool.filter(e => !keys.some(k => normalizeKey(e.server).includes(k)));
            pool = filtered.length > 0 ? filtered : pool;
            strictPool = true;
        }

        // 选择策略：按意图与扩展名偏好
        const pickBy = (predicate: (e: {server:string,tool:string,full:string}) => boolean): string | null => {
            const found = pool.find(predicate) || (!strictPool ? entries.find(predicate) : undefined);
            return found ? found.full : null;
        };

        // 尽量不做硬编码：仅在用户明确点名“工具名”时强制选择
        const toolNames = Array.from(new Set(entries.map(e => e.tool))).sort((a, b) => b.length - a.length);
        const toolsMentioned: string[] = [];
        for (const tName of toolNames) {
            const tNorm = tName.toLowerCase();
            if (messageNorm.includes(tNorm)) toolsMentioned.push(tName);
        }
        if (toolsMentioned.length > 0) {
            // 优先从当前池选择被点名的工具
            const tKey = toolsMentioned[0];
            const chosen = pool.find(e => e.tool.toLowerCase() === tKey.toLowerCase()) || (!strictPool ? entries.find(e => e.tool.toLowerCase() === tKey.toLowerCase()) : undefined);
            if (chosen) return chosen.full;
        }

        // 不强制选择具体工具：若未明确点名工具名，则返回 null，让模型自动选择

        return null;
    }

    /**
     * 判断是否应当为当前消息禁用工具（tool_choice = "none"），以保障普通对话质量。
     * 规则：若不存在明显的工具使用意图（文件/路径/HTTP/Excel/显式“使用工具”等），则禁用工具。
     */
    private shouldDisableToolsForMessage(messages: ChatCompletionMessageParam[]): boolean {
        const lastUser = this.getLastUserText(messages) || "";
        const text = lastUser.toLowerCase();

        // 明显的“要用工具”指示
        const explicitToolHints = [
            "使用mcp工具", "使用 mcp 工具", "mcp", "调用工具", "用工具",
            "claude code", "claude-code", "excel-mcp-server", "excel mcp server",
        ];
        if (explicitToolHints.some(k => text.includes(k))) return false;

        // 具备路径/URL/文件等强烈工具使用信号
        const hasWindowsPath = /[a-z]:\\\\/i.test(text) || /[a-z]:\//i.test(text) || /[a-z]:\\/i.test(text);
        const hasUrl = /https?:\/\//i.test(text);
        const hasFileKeywords = /(读取|读|写入|追加|覆盖|保存|打开|目录|路径|文件|excel|工作簿|工作表|sheet)/i.test(lastUser);
        if (hasWindowsPath || hasUrl || hasFileKeywords) return false;

        // 默认禁用工具，保证普通问答直出文本
        return true;
    }

    /**
     * 执行工具调用
     * @param {Client} session - 会话对象
     * @param {string} toolName - 工具名称
     * @param {any} toolArgs - 工具参数
     * @returns {Promise<MCPToolResult>} - 工具调用结果的 Promise
     */
    private async executeToolCall(session: Client, serverName: string, toolName: string, toolArgs: any, callId?: string): Promise<MCPToolResult> {
        const ctrl = new AbortController();
        if (callId) this.activeToolCalls.set(callId, ctrl);
        const cfg = this.serverConfigs.get(serverName);
        const timeoutMs = cfg && typeof (cfg as any).timeout === 'number' ? Number((cfg as any).timeout) * 1000 : 60000;
        const longRunning = !!(cfg && (cfg as any).longRunning);
        const maxTotalTimeout = longRunning ? 10 * 60 * 1000 : undefined;
        try {
            const result = await (session as any).callTool({
                name: toolName,
                arguments: toolArgs
            }, undefined, {
                onprogress: (process: any) => {
                    try {
                        const total = Number(process?.total || 1);
                        const progressVal = Number(process?.progress || 0);
                        const ratio = total ? (progressVal / total) : 0;
                        this.pushProgress('tool_call_progress', { server: serverName, tool: toolName, call_id: callId, progress: ratio, progress_value: progressVal, total: total });
                    } catch {}
                },
                timeout: timeoutMs,
                resetTimeoutOnProgress: longRunning,
                maxTotalTimeout,
                signal: ctrl.signal
            });
            return result as unknown as MCPToolResult;
        } catch (error) {
            if (callId) this.activeToolCalls.delete(callId);
            logger.error(`Failed to execute tool call for ${toolName}:`, error);
            throw error;
        } finally {
            if (callId) this.activeToolCalls.delete(callId);
        }
    }

    /**
     * 在所有已连接的服务器中查找可用于“docx/Word 创建或写入”的工具
     * 返回优先的写入型工具与可选的创建型工具。
     */
    private async findDocxToolsAcrossSessions(): Promise<{ serverName: string, readToolName?: string, writeToolName?: string, createToolName?: string } | null> {
        try {
            // 若此前已缓存工具 schema，尽量复用；否则动态拉取
            const candidates: { serverName: string, toolName: string, desc: string }[] = [];
            for (const [serverName, session] of this.sessions) {
                let tools: Tool[] = [];
                try {
                    const resp = await session.listTools();
                    tools = resp.tools || [];
                } catch {}
                for (const t of tools) {
                    const name = (t?.name || '').toString();
                    const desc = (t?.description || '').toString();
                    const s = `${name} ${desc}`.toLowerCase();
                    if (/docx|word/.test(s)) {
                        candidates.push({ serverName, toolName: name, desc });
                    }
                }
            }
            if (candidates.length === 0) return null;
            const rank = (toolName: string, desc: string): ('read'|'write'|'create'|'unknown') => {
                const s = `${toolName} ${desc}`.toLowerCase();
                if (/(read|open|extract|parse|text)/.test(s)) return 'read';
                if (/(write|append|insert|add|update|replace)/.test(s)) return 'write';
                if (/(create|new|generate|make|build)/.test(s)) return 'create';
                return 'unknown';
            };
            let readTool: { serverName: string, toolName: string } | null = null;
            let writeTool: { serverName: string, toolName: string } | null = null;
            let createTool: { serverName: string, toolName: string } | null = null;
            for (const c of candidates) {
                const kind = rank(c.toolName, c.desc);
                if (kind === 'read' && !readTool) readTool = { serverName: c.serverName, toolName: c.toolName };
                if (kind === 'write' && !writeTool) writeTool = { serverName: c.serverName, toolName: c.toolName };
                if (kind === 'create' && !createTool) createTool = { serverName: c.serverName, toolName: c.toolName };
                if (readTool && writeTool && createTool) break;
            }
            if (readTool || writeTool || createTool) {
                return {
                    serverName: (readTool?.serverName || writeTool?.serverName || createTool!.serverName),
                    readToolName: readTool?.toolName,
                    writeToolName: writeTool?.toolName,
                    createToolName: createTool?.toolName
                };
            }
            return null;
        } catch (e) {
            try { logger.warn('[MCP Docx] find tools failed:', e as any); } catch {}
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
    private createToolResultPush(serverName: string, toolName: string, toolArgs: any, toolResultRaw: any): any {
        // 统一为前端期望的 content 数组结构（兼容多服务端差异）
        const toolResultArray = MCPCompat.normalizeContentArray(toolResultRaw);
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
    private createProgressPush(event: string, payload: any): any {
        const base: any = { type: 'progress', event, ts: Date.now() };
        try {
            if (payload && typeof payload === 'object') {
                Object.assign(base, payload);
            } else if (payload !== undefined) {
                base.payload = payload;
            }
        } catch {}
        return base;
    }

    /**
     * 推送进度事件
     * @param {string} event - 事件名称
     * @param {any} payload - 事件负载
     */
    private pushProgress(event: string, payload: any): void {
        const obj = this.createProgressPush(event, payload);
        this.pushMessage(obj);
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
            // 工具调用准备完成，推送一次进度事件（不包含敏感信息）
            try {
                const readyList = Object.values(toolCallMap).map(tc => ({
                    id: tc.id,
                    name: (tc.function && tc.function.name) || ''
                }));
                this.pushProgress('tool_calls_ready', { list: readyList });
            } catch {}

            messages = await this.callTools(toolCallMap, messages, toolsContent);

            // 优先选择最后一个“非错误”的工具文本消息，避免末尾错误覆盖前面成功
            const pickLastNonErrorToolTextMessage = (msgs: ChatCompletionMessageParam[]): ChatCompletionMessageParam | null => {
                for (let i = msgs.length - 1; i >= 0; i--) {
                    const m = msgs[i];
                    if (m && m.role === 'tool' && typeof m.content === 'string') {
                        const txt = this.extractTextFromContentJson(m.content as string);
                        if (txt && !this.isErrorText(txt)) return m;
                    }
                }
                return null;
            };

            let last_message = pickLastNonErrorToolTextMessage(messages) || messages[messages.length - 1];

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
     * 尝试修复模型生成的工具参数 JSON 字符串中的常见问题，返回修复后的字符串。
     * 仅进行“安全修复”：
     * - 对被双引号括起来的 Windows 路径值（形如 "C:\\..." 或 "D:\\..."），将其中的单个反斜杠替换为双反斜杠
     * - 去除路径值末尾混入的中文说明或标点（在首个合法扩展名之后裁切）
     */
    private repairJsonArguments(raw: string): string {
        if (!raw || typeof raw !== 'string') return raw;

        let s = raw;

        // 修复：双引号包裹的 Windows 路径值内，反斜杠未转义
        // 仅在值看起来是驱动器开头的路径时进行替换，避免误伤其它 JSON 转义序列
        // 示例匹配："D:\work\ad-test.txt"
        const pathValueRegex = /(:\s*")([A-Za-z]:\\[^"\n\r]*?)(")/g;
        s = s.replace(pathValueRegex, (m, p1, p2, p3) => {
            // 将路径中的单反斜杠替换为双反斜杠
            const escapedPath = p2.replace(/\\/g, "\\\\");
            return p1 + escapedPath + p3;
        });

        // 额外修复：若路径末尾在合法扩展名之后混入中文说明或标点，则先裁切
        // 为避免复杂的 JSON 解析，这里仍在字符串层做有限处理
        // 合法扩展名列表（与 ensureGenericPathArg/ensureFilePathArg 保持一致的大众类型）
        const exts = [
            'txt','md','json','csv','log','ini','conf','xml','yml','yaml','html','htm','js','ts','tsx','jsx','java','py','go','rb','php','c','cpp','h','hpp','css'
        ];
        const chineseTail = /([\u4e00-\u9fa5，。？！；：：、…【】《》“”‘’\(\)（）\s].*)$/;

        s = s.replace(/(:\s*")([A-Za-z]:\\[^"\n\r]*?)(")/g, (m, p1, p2, p3) => {
            let pathStr = p2;
            // 查找首个合法扩展名位置
            const dotIdx = pathStr.lastIndexOf('.');
            if (dotIdx > 0) {
                const ext = pathStr.slice(dotIdx + 1).toLowerCase();
                // 若扩展名后还有中文说明或标点，尝试裁切至扩展名末尾
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
    private getToolDecisionConfig(): any {
        try {
            const cfg = pub.C('toolDecision');
            const def = {
                mode: 'injection', // injection|gate|auto
                confirmationHint: true, // 是否在工具调用前要求模型先提示一句（启用“先自查、后调用”）
                keywords: {
                    explicitToolHints: [
                        '使用mcp工具', '使用 mcp 工具', 'mcp', '调用工具', '用工具',
                        'claude code', 'claude-code', 'excel-mcp-server', 'excel mcp server'
                    ],
                    fileKeywords: [
                        '读取','读','写入','追加','覆盖','保存','打开','目录','路径','文件','excel','工作簿','工作表','sheet'
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
                systemPromptTemplate: (
                    '你需要在每次回复前判断用户意图：是纯对话，还是需要使用工具。' +
                    '仅在明确存在工具意图（出现工具名称、路径/URL、或文件/表格操作类关键词）时才调用工具；否则直接用中文回答。' +
                    '工具调用分两阶段：第一阶段先用中文输出“计划与参数确认”，包含：将要调用的工具名称、调用理由、参数草案及其合规性检查（路径/扩展名/表名/内容类型）；若关键参数不明确，请先向用户澄清，不要盲目调用。第二阶段在参数确认后再发起调用，并用中文解释返回结果与后续处理。' +
                    '若决定调用工具，应先简要说明你将调用的工具及原因，再进行调用。' +
                    '\n工具选择原则提示：Excel 工具仅适用于 .xlsx/.xls；Word（.docx）请使用具备 docx 能力的工具；不要使用 Excel 工具处理 .docx。' +
                    '\nClaude Code 特殊说明：当调用 claude code__Skill 时，必须在参数中明确给出技能名称（优先使用 skill 或 skill_name；也可使用 command/cmd/action），并提供 args/arguments（JSON 结构）作为技能参数；若不清楚技能名，请先请求列出技能（例如使用 Skill 列表），再确认后调用。' +
                    '\n不要仅凭最近用户消息中的某个词语（如“读取”、“写入”）武断选择工具；应先自查 MCP 工具的名称、描述与 schema，并在参数确认后再调用。'
                )
            };
            const merged = Object.assign({}, def, cfg || {});
            merged.keywords = Object.assign({}, def.keywords, (cfg && cfg.keywords) || {});
            return merged;
        } catch (e) {
            return {
                mode: 'injection',
                confirmationHint: true,
                keywords: {
                    explicitToolHints: [
                        '使用mcp工具', '使用 mcp 工具', 'mcp', '调用工具', '用工具',
                        'claude code', 'claude-code', 'excel-mcp-server', 'excel mcp server'
                    ],
                    fileKeywords: [
                        '读取','读','写入','追加','覆盖','保存','打开','目录','路径','文件','excel','工作簿','工作表','sheet'
                    ]
                },
                docx: {
                    directFallback: false,
                    bridgeOnError: false,
                    disableGenericReadForDocx: true
                },
                systemPromptTemplate: (
                    '你需要在每次回复前判断用户意图：是纯对话，还是需要使用工具。' +
                    '仅在明确存在工具意图（出现工具名称、路径/URL、或文件/表格操作类关键词）时才调用工具；否则直接用中文回答。' +
                    '工具调用分两阶段：第一阶段先用中文输出“计划与参数确认”，包含：将要调用的工具名称、调用理由、参数草案及其合规性检查（路径/扩展名/表名/内容类型）；若关键参数不明确，请先向用户澄清，不要盲目调用。第二阶段在参数确认后再发起调用，并用中文解释返回结果与后续处理。' +
                    '若决定调用工具，应先简要说明你将调用的工具及原因，再进行调用。' +
                    '\n工具选择原则提示：Excel 工具仅适用于 .xlsx/.xls；Word（.docx）请使用具备 docx 能力的工具；不要使用 Excel 工具处理 .docx。' +
                    '\nClaude Code 特殊说明：当调用 claude code__Skill 时，必须在参数中明确给出技能名称（优先使用 skill 或 skill_name；也可使用 command/cmd/action），并提供 args/arguments（JSON 结构）作为技能参数；若不清楚技能名，请先请求列出技能（例如使用 Skill 列表），再确认后调用。' +
                    '\n不要仅凭最近用户消息中的某个词语（如“读取”、“写入”）武断选择工具；应先自查 MCP 工具的名称、描述与 schema，并在参数确认后再调用。'
                )
            };
        }
    }

    /**
     * 基于配置构建用于“工具决策”的系统提示消息
     */
    private buildDecisionSystemMessage(availableTools: any[], decisionCfg: any): ChatCompletionMessageParam | null {
        if (!decisionCfg || decisionCfg.mode !== 'injection') return null;
        try {
            const toolNames = (availableTools || [])
                .map((t: any) => {
                    const server = t.server_name || t.server || '';
                    const name = (t.tools && t.tools[0] && t.tools[0].function && t.tools[0].function.name) || t.name || '';
                    return `${server ? server + '--' : ''}${name}`;
                })
                .filter((s: string) => !!s);

            const hintConfirm = decisionCfg.confirmationHint ? '在决定调用工具前，请先简要说明将调用的工具及原因。' : '';
            const sysContent = [
                decisionCfg.systemPromptTemplate,
                hintConfirm,
                toolNames.length ? `可用工具列表（供参考）：${toolNames.join(', ')}` : ''
            ].filter(Boolean).join('\n');

            return {
                role: 'system',
                content: sysContent
            } as ChatCompletionMessageParam;
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
    async handleToolCalls(availableTools: any, messages: ChatCompletionMessageParam[], isRecursive = false) {
        // 调用OpenAI API
        try {
            const decisionCfg = this.getToolDecisionConfig();
            // 进度：工具判定开始（列出可用工具简要信息）
            try {
                const toolNames = (Array.isArray(availableTools) ? availableTools : []).map((t: any) => {
                    const server = t.server_name || t.server || '';
                    const name = (t.tools && t.tools[0] && t.tools[0].function && t.tools[0].function.name) || t.name || '';
                    return { server, name };
                }).filter((e: any) => e.server || e.name);
                this.pushProgress('tool_decision_started', { tools_count: toolNames.length, tools: toolNames.slice(0, 50) });
            } catch {}
            // 针对 .docx 场景的安全防误用：可选地在当前调用中移除通用 Read 工具，避免错误读取二进制文件
            let toolsForUse: any[] = Array.isArray(availableTools) ? [...availableTools] : (availableTools || []);
            try {
                const lastUser = this.getLastUserText(messages) || '';
                const hasDocxPath = /\.docx\b/i.test(lastUser);
                if (hasDocxPath && decisionCfg?.docx?.disableGenericReadForDocx) {
                    const hasDocxCap = toolsForUse.some(t => {
                        const n = ((t && t.function && t.function.name) || '').toLowerCase();
                        const d = ((t && t.function && t.function.description) || '').toLowerCase();
                        return n.includes('docx') || n.includes('word') || d.includes('docx') || d.includes('word');
                    });
                    toolsForUse = toolsForUse.filter(t => {
                        const n = ((t && t.function && t.function.name) || '').toLowerCase();
                        const bare = n.split('__').pop() || '';
                        return bare !== 'read';
                    });
                    // 若不存在具备 docx 能力的工具，则默认不强制选择工具，让模型先计划并给出安装建议
                    // （避免错误地调用通用 Read）
                }
            } catch {}
            // 根据用户最新消息尝试强制选择工具，避免模型在重复请求中不再调用 MCP
            let toolChoice: any = "auto";
            const preferredToolName = this.extractPreferredToolName(messages, toolsForUse);
            if (preferredToolName) {
                toolChoice = { type: "function", function: { name: preferredToolName } };
            } else if (decisionCfg && decisionCfg.mode === 'gate') {
                // gate 模式：根据自定义关键词与信号禁用工具（可配置）
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

            // 处理OpenAI的响应
            await this.handleOpenAIToolCalls(completion, messages, availableTools);
        } catch (error) {
            logger.error("Failed to call OpenAI API:", error);
            try {
                this.pushProgress('tool_decision_failed', { message: (error && (error.message || error.toString())) || 'unknown error' });
            } catch {}
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

            // 注入“工具决策”系统提示（配置驱动），让模型自己判断对话/工具
            const decisionCfg = this.getToolDecisionConfig();
            const sysMsg = this.buildDecisionSystemMessage(availableTools, decisionCfg);
            if (sysMsg) {
                messages = [sysMsg, ...messages];
            }

            // 可选的“无模型回退”：受配置控制，避免硬编码流程
            if (decisionCfg?.docx?.directFallback) {
            // 若用户消息显式包含 docx/Word 创建意图且可解析到 .docx 路径与内容，
            // 则直接调用 “claude code” 的 Write 工具尝试创建/写入（让其内部技能接管），无需等待模型生成 tool_calls。
            try {
                const lastUser = this.getLastUserText(messages) || "";
                const userHasDocxIntent = /\bdocx\b|\bword\b|\.docx\b/i.test(lastUser);
                const { path: docxPath, content: docxText } = this.extractDocxPathAndContent({}, "", messages);
                const shouldCallDirect = !!docxPath && !!docxText && userHasDocxIntent;
                // 严格判断：工具未被 gate 模式禁用，且当前会话存在“claude code”服务器
                const toolsDisabled = (decisionCfg && decisionCfg.mode === 'gate') ? this.shouldDisableToolsForMessageWithCfg(messages, decisionCfg) : false;
                const claudeSession = this.sessions.get(this.enPunycode('claude code')) || this.sessions.get('claude code');

                if (shouldCallDirect && !toolsDisabled && claudeSession) {
                    // 构造 Write 调用参数，让 Claude Code 的技能根据扩展名接管
                    let writeArgs: any = { file_path: docxPath, content: docxText };
                    const fullWriteFuncName = `${this.enPunycode('claude code')}__Write`;
                    writeArgs = this.ensureGenericPathArg(fullWriteFuncName, 'Write', writeArgs, "", messages);
                    writeArgs = this.ensureArgsBySchema(fullWriteFuncName, writeArgs, /*wantWrite*/ true);
                    MCPCompat.fsEnsureParentDir(writeArgs.file_path || writeArgs.path);

                    try { this.pushProgress('direct_docx_write_started', { server: 'claude code', tool: 'Write', args: writeArgs }); } catch {}
                    // 执行工具调用
                    const result = await this.executeToolCall(claudeSession, 'Write', writeArgs);
                    const pushObj = this.createToolResultPush('claude code', 'Write', writeArgs, result.content);
                    this.pushMessage(pushObj);

                    // 更新消息（模拟一次工具调用）
                    const fakeToolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall = {
                        id: `direct-docx-write-${Date.now()}`,
                        type: 'function',
                        function: { name: fullWriteFuncName, arguments: JSON.stringify(writeArgs) }
                    } as any;
                    const toolResultContent = this.processToolResult(result);
                    messages = this.updateMessages(messages, fakeToolCall, '直接调用：使用 claude code 的 Write 工具写入 docx（无模型回退）', toolResultContent);

                    // 若检测到成功文本，则标记并跳过后续模型调用，直接结束
                    const wTxt = this.extractTextFromContentJson(toolResultContent);
                    if (wTxt && !this.isErrorText(wTxt)) {
                        (this as any)._mcpHasSuccess = true;
                        const chunk = {
                            created_at: Date.now(),
                            index: 0,
                            choices: [ { finish_reason: 'stop', delta: { content: wTxt } } ]
                        };
                        this.callback(chunk);
                        try { this.pushProgress('direct_docx_write_finished', { server: 'claude code', tool: 'Write', status: 'success' }); } catch {}
                        return '';
                    }
                    // 若失败但错误文本提示“请用 docx 技能/只能纯文本”等，则进入桥接流程（复用 callTools 中已有逻辑）：
                    const errTxt = wTxt || '';
                    if (errTxt && this.isDocxSkillHint(errTxt)) {
                        try {
                            try { this.pushProgress('docx_bridge_started', { from_server: 'claude code', from_tool: 'Write' }); } catch {}
                            const docxTargets = await this.findDocxToolsAcrossSessions();
                            if (docxTargets) {
                                const docxSession = this.sessions.get(docxTargets.serverName);
                                if (docxSession) {
                                    // 可选先创建
                                    if (docxTargets.createToolName) {
                                        let createArgs: any = { file_path: docxPath };
                                        const fullCreateName = `${this.enPunycode(docxTargets.serverName)}__${docxTargets.createToolName}`;
                                        createArgs = this.ensureGenericPathArg(fullCreateName, docxTargets.createToolName!, createArgs, "", messages);
                                        createArgs = this.ensureArgsBySchema(fullCreateName, createArgs, true);
                                        MCPCompat.fsEnsureParentDir(createArgs.file_path || createArgs.path);
                                        try { this.pushProgress('docx_bridge_step_started', { step: 'create', server: docxTargets.serverName, tool: docxTargets.createToolName }); } catch {}
                                        const createRes = await this.executeToolCall(docxSession, docxTargets.createToolName!, createArgs);
                                        const createPush = this.createToolResultPush(docxTargets.serverName, docxTargets.createToolName!, createArgs, createRes.content);
                                        this.pushMessage(createPush);
                                        try { this.pushProgress('docx_bridge_step_finished', { step: 'create', server: docxTargets.serverName, tool: docxTargets.createToolName, status: 'success' }); } catch {}
                                        const fakeCreateCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall = {
                                            id: `direct-docx-create-${Date.now()}`,
                                            type: 'function',
                                            function: { name: fullCreateName, arguments: JSON.stringify(createArgs) }
                                        } as any;
                                        const createContent = this.processToolResult(createRes);
                                        messages = this.updateMessages(messages, fakeCreateCall, `自动桥接：使用 ${docxTargets.serverName} 的 ${docxTargets.createToolName} 创建 docx`, createContent);
                                    }
                                    // 再写入
                                    if (docxTargets.writeToolName) {
                                        let wArgs: any = { file_path: docxPath, content: docxText };
                                        const fullName = `${this.enPunycode(docxTargets.serverName)}__${docxTargets.writeToolName}`;
                                        wArgs = this.ensureGenericPathArg(fullName, docxTargets.writeToolName!, wArgs, "", messages);
                                        wArgs = this.ensureArgsBySchema(fullName, wArgs, true);
                                        MCPCompat.fsEnsureParentDir(wArgs.file_path || wArgs.path);
                                        try { this.pushProgress('docx_bridge_step_started', { step: 'write', server: docxTargets.serverName, tool: docxTargets.writeToolName }); } catch {}
                                        const wRes = await this.executeToolCall(docxSession, docxTargets.writeToolName!, wArgs);
                                        const wPush = this.createToolResultPush(docxTargets.serverName, docxTargets.writeToolName!, wArgs, wRes.content);
                                        this.pushMessage(wPush);
                                        try { this.pushProgress('docx_bridge_step_finished', { step: 'write', server: docxTargets.serverName, tool: docxTargets.writeToolName, status: 'success' }); } catch {}
                                        const fakeCall2: OpenAI.Chat.Completions.ChatCompletionMessageToolCall = {
                                            id: `direct-docx-bridge-write-${Date.now()}`,
                                            type: 'function',
                                            function: { name: fullName, arguments: JSON.stringify(wArgs) }
                                        } as any;
                                        const wContent = this.processToolResult(wRes);
                                        messages = this.updateMessages(messages, fakeCall2, `自动桥接：使用 ${docxTargets.serverName} 的 ${docxTargets.writeToolName} 写入 docx 内容`, wContent);

                                        const wTxt2 = this.extractTextFromContentJson(wContent);
                                        if (wTxt2 && !this.isErrorText(wTxt2)) {
                                            (this as any)._mcpHasSuccess = true;
                                            const chunk = {
                                                created_at: Date.now(),
                                                index: 0,
                                                choices: [ { finish_reason: 'stop', delta: { content: wTxt2 } } ]
                                            };
                                            this.callback(chunk);
                                            return '';
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            try { logger.warn('[MCP Docx] direct bridge flow failed:', e as any); } catch {}
                        }
                    }
                }
            } catch (e) {
                try { logger.warn('[MCP Docx] direct docx write fallback error:', e as any); } catch {}
                // 不中断主流程
            }
            }

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
     * 带配置的“是否禁用工具”判断（关键词可由用户配置）
     */
    private shouldDisableToolsForMessageWithCfg(messages: ChatCompletionMessageParam[], decisionCfg: any): boolean {
        const lastUser = this.getLastUserText(messages) || "";
        const text = lastUser.toLowerCase();

        const explicitToolHints = (decisionCfg && decisionCfg.keywords && Array.isArray(decisionCfg.keywords.explicitToolHints))
            ? decisionCfg.keywords.explicitToolHints
            : [
                "使用mcp工具", "使用 mcp 工具", "mcp", "调用工具", "用工具",
                "claude code", "claude-code", "excel-mcp-server", "excel mcp server",
            ];
        if (explicitToolHints.some((k: string) => text.includes(k))) return false;

        const hasWindowsPath = /[a-z]:\\/i.test(text) || /[a-z]:\//i.test(text) || /[a-z]:\\/i.test(text);
        const hasUrl = /https?:\/\//i.test(text);
        const fileKeywordsList = (decisionCfg && decisionCfg.keywords && Array.isArray(decisionCfg.keywords.fileKeywords))
            ? decisionCfg.keywords.fileKeywords
            : ["读取","读","写入","追加","覆盖","保存","打开","目录","路径","文件","excel","工作簿","工作表","sheet"];
        const fileKeywordsRegex = new RegExp(fileKeywordsList.map((k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
        const hasFileKeywords = fileKeywordsRegex.test(lastUser);
        if (hasWindowsPath || hasUrl || hasFileKeywords) return false;

        return true;
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
            try { this.toolsSchemaByName.clear(); } catch {}
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
