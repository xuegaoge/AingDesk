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
    // 缓存：完整工具名 -> JSON Schema（输入参数）
    private toolsSchemaByName: Map<string, any> = new Map();
    private supplierName: string = "";
    private model: string = "";
    private openai: OpenAI | null = null;
    private push: Function | null = null;
    private callback: Function | null = null;

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
        // Excel 兜底偏好：若用户暗示 Excel，但未显式读/写意图
        if (hintExcel) {
            const excelDefaultRead = pickBy(e => /read/i.test(e.tool) && /excel|sheet|workbook/i.test(e.tool));
            if (excelDefaultRead) return excelDefaultRead;
            const anyExcel = pickBy(e => /excel|sheet|workbook/i.test(e.tool));
            if (anyExcel) return anyExcel;
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
                // 建立 schema 映射缓存，键为完整工具名
                try {
                    for (const tool of response.tools) {
                        const full = `${this.enPunycode(serverName)}__${tool.name}`;
                        this.toolsSchemaByName.set(full, tool.inputSchema);
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
        if (Array.isArray(raw)) {
            const first = raw[0];
            if (first && typeof first === 'object' && 'text' in first && typeof first.text === 'string') {
                raw = first.text;
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

        // 若解析成功但非 Excel 结构，则原样返回结构化 JSON 字符串
        if (parsed !== null && typeof parsed !== 'undefined') {
            return JSON.stringify(parsed);
        }

        // 二进制内容阻断：提示使用 Excel 相关工具
        if (typeof raw === 'string' && this.isLikelyBinaryText(raw)) {
            const msg = "检测到可能的二进制内容（例如 Excel 工作簿或压缩包）。请使用 Excel 相关 MCP 工具读取，如 `excel-mcp-server__read_data_from_excel`。";
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

            // 先纠正 Excel 工具的 filename 绝对路径
            toolArgs = this.ensureExcelFileArg(toolName, toolArgs, toolsContent, messages);
            // 再规范化并纠正 FileSystem 路径参数
            toolArgs = this.ensureFilePathArg(toolName, toolArgs, toolsContent, messages);
            // 规范化读取选项，避免 head/tail 冲突
            toolArgs = this.normalizeReadOptionsArg(toolName, toolArgs);
            // 基于实际工具 schema 做通用归一化与剔除非声明字段
            const fullToolName = `${this.enPunycode(serverName)}__${toolName}`;
            const wantWrite = (/write|append/i.test(toolName));
            toolArgs = this.ensureArgsBySchema(fullToolName, toolArgs, wantWrite);

            let toolResult: MCPToolResult;
            try {
                toolResult = await this.executeToolCall(session, toolName, toolArgs);
            } catch (err: any) {
                // Excel 专用容错：工作表未找到时回退为 Sheet1 再重试一次
                const isExcelTool = /excel|sheet|workbook/i.test(toolName) || toolName === 'read_data_from_excel';
                const msg = (err && (err.message || err.toString())) || '';
                const sheetNotFound = /sheet|worksheet/i.test(msg) && /(not\s*found|不存在|no\s*such|missing)/i.test(msg);
                if (isExcelTool && sheetNotFound) {
                    try {
                        const before = toolArgs.sheet_name || toolArgs.sheet || toolArgs.worksheet || '';
                        toolArgs.sheet_name = 'Sheet1';
                        delete toolArgs.sheet; delete toolArgs.worksheet;
                        logger.warn(`[MCP Excel] sheet not found: "${before}", fallback to "Sheet1" and retry`);
                        toolResult = await this.executeToolCall(session, toolName, toolArgs);
                    } catch (err2) {
                        logger.error(`[MCP Excel] retry with Sheet1 failed for ${toolName}:`, err2);
                        throw err2;
                    }
                } else {
                    throw err;
                }
            }
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

        // 整理可用工具列表
        const entries: { server: string, tool: string, full: string }[] = [];
        for (const t of (availableTools || [])) {
            const n = t && t.function && typeof t.function.name === 'string' ? t.function.name : '';
            if (!n) continue;
            const parts = n.split('__');
            const server = parts[0] || '';
            const tool = parts.slice(1).join('__');
            entries.push({ server, tool, full: n });
        }

        // 优先在指定服务器（excel）中选择
        let pool = entries;
        if (hintExcel) {
            const excelPool = entries.filter(e => /excel/i.test(e.server) || /excel|sheet|workbook/i.test(e.tool));
            if (excelPool.length > 0) pool = excelPool;
        }

        // 选择策略：按意图与扩展名偏好
        const pickBy = (predicate: (e: {server:string,tool:string,full:string}) => boolean): string | null => {
            const found = pool.find(predicate) || entries.find(predicate);
            return found ? found.full : null;
        };

        if (wantRead) {
            // Excel 优先：read + (excel/sheet/workbook)
            if (hintExcel) {
                const excelRead = pickBy(e => /read/i.test(e.tool) && /excel|sheet|workbook/i.test(e.tool));
                if (excelRead) return excelRead;
            }
            // JSON 优先
            if (wantJson) {
                const jsonRead = pickBy(e => /read_?json_?file$/i.test(e.tool) || (/read/i.test(e.tool) && /json/i.test(e.tool)));
                if (jsonRead) return jsonRead;
            }
            // 文本文件读取
            const textRead = pickBy(e => /read_?text_?file$/i.test(e.tool));
            if (textRead) return textRead;
            // 兜底：任意包含 read 且与 file 相关
            const anyRead = pickBy(e => /read/i.test(e.tool) && /file|text|content/i.test(e.tool));
            if (anyRead) return anyRead;
        } else if (wantWrite) {
            if (hintExcel) {
                const excelWrite = pickBy(e => /write|append/i.test(e.tool) && /excel|sheet|workbook/i.test(e.tool));
                if (excelWrite) return excelWrite;
            }
            const writeFile = pickBy(e => /write_?file$/i.test(e.tool));
            if (writeFile) return writeFile;
            const appendFile = pickBy(e => /append_?text_?file$/i.test(e.tool) || /append_?file$/i.test(e.tool));
            if (appendFile) return appendFile;
            const anyWrite = pickBy(e => /write|append/i.test(e.tool) && /file|text|content/i.test(e.tool));
            if (anyWrite) return anyWrite;
        }

        return null;
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
