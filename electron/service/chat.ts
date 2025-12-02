import { logger } from 'ee-core/log';
import { pub } from '../class/public';
import * as path from 'path';
import { parseDocument } from '../rag/doc_engins/doc';
import { agentService } from './agent';
import { ModelService, GetSupplierModels, getModelContextLength, setModelUsedTotal, getModelUsedTotalList } from '../service/model';

import { getPromptForWeb } from '../search_engines/search';
import { Rag } from '../rag/rag';
import { Stream } from 'stream';
import { MCPClient } from './mcp_client';

/**
 * 定义聊天历史记录的类型
 * @property {string} id - 唯一标识
 * @property {string} reasoning - 推理信息
 * @property {string} role - 角色
 * @property {string} content - 聊天内容
 * @property {string[]} images - 图片数组
 * @property {string} tool_calls - 工具调用信息
 * @property {string} created_at - 创建时间字符串
 * @property {number} create_time - 创建时间戳
 * @property {object} stat - 统计信息
 * @property {number} tokens - tokens 数量
 */
export type ChatHistory = {
    id: string;
    compare_id: string,
    reasoning: any;
    role: string;
    content: any;
    images: string[];
    doc_files: string[];
    tool_calls: string;
    created_at: string;
    create_time: number;
    stat: any;
    tokens: number;
    search_result: any[];
    search_type: string | undefined | null;
    search_query: string | undefined | null;
    tools_result?: any[];
    // MCP 进度事件（流式）
    mcp_progress?: any[];
};

/**
 * 定义聊天上下文的类型
 * @property {string} role - 角色
 * @property {string} content - 聊天内容
 * @property {string[]} images - 图片数组
 * @property {string[]} doc_files - 文档文件数组
 * @property {string} tool_calls - 工具调用信息
 */
export type ChatContext = {
    role: string;
    content: string;
    images?: string[];
    doc_files?: string[];
    tool_calls?: string;
};

/**
 * 定义模型信息的类型
 * @typedef {Object} ModelInfo
 * @property {string} model - 模型名称
 * @property {number} size - 模型大小
 * @property {number} contextLength - 模型的上下文长度
 */
export type ModelInfo = {
    title: string,
    supplierName: string,
    model: string;
    size: number;
    capability?: string[];
    contextLength: number;
};


/**
 * 聊天服务类，提供与聊天对话相关的各种操作
 */
export class ChatService {
    /**
     * 根据 UUID 获取上下文路径
     * @param {string} uuid - 对话的唯一标识符
     * @returns {string} - 上下文路径
     */
    private getContextPath(uuid: string): string {
        return pub.get_context_path(uuid);
    }

    /**
     * 根据 UUID 获取对话配置文件的完整路径
     * @param {string} uuid - 对话的唯一标识符
     * @returns {string} - 配置文件的完整路径
     */
    private getConfigFilePath(uuid: string): string {
        const contextPath = this.getContextPath(uuid);
        return path.resolve(contextPath, 'config.json');
    }

    /**
     * 根据 UUID 获取对话历史记录文件的完整路径
     * @param {string} uuid - 对话的唯一标识符
     * @returns {string} - 历史记录文件的完整路径
     */
    private getHistoryFilePath(uuid: string): string {
        const contextPath = this.getContextPath(uuid);
        return path.resolve(contextPath, 'history.json');
    }

    /**
     * 读取指定路径的 JSON 文件并解析为对象
     * @param {string} filePath - 文件的完整路径
     * @returns {any} - 解析后的 JSON 对象，如果文件不存在或解析失败则返回空数组
     */
    private readJsonFile(filePath: string): any {
        // 检查文件是否存在
        if (!pub.file_exists(filePath)) {
            return [];
        }
        // 读取文件内容
        const fileContent = pub.read_file(filePath);
        // 检查文件内容是否为空
        if (fileContent.length === 0) {
            return [];
        }
        try {
            // 尝试解析 JSON 内容
            return JSON.parse(fileContent);
        } catch (error) {
            // 记录解析错误信息
            logger.error(`解析 JSON 文件 ${filePath} 时出错:`, error);
            return [];
        }
    }

    /**
     * 将数据保存为 JSON 文件到指定路径
     * @param {string} filePath - 文件的完整路径
     * @param {any} data - 要保存的数据
     */
    private saveJsonFile(filePath: string, data: any): void {
        try {
            // 将数据转换为 JSON 字符串并写入文件
            pub.write_file(filePath, JSON.stringify(data));
        } catch (error) {
            // 记录保存文件时的错误信息
            logger.error(`保存 JSON 文件 ${filePath} 时出错:`, error);
        }
    }

    /**
     * 创建一个新的聊天对话
     * @param {string} model - 使用的模型名称
     * @param {string} parameters - 模型的参数
     * @param {string} [title=""] - 对话的标题，默认为空字符串
     * @param {string} supplierName - 供应商名称
     * @returns {object} - 包含对话配置信息的对象
     */
    create_chat(model: string, parameters: string, title: string = "", supplierName: string, agent_name: string): object {
        // 记录创建对话的日志信息
        logger.info('create_chat', `${model}:${parameters}`);
        // 生成对话的唯一标识符
        const uuid = pub.uuid();
        // 限制标题长度不超过 18 个字符
        if (title.length > 18) {
            title = title.substring(0, 18);
        }
        // 构建对话配置对象
        const contextConfig = {
            supplierName,
            model,
            title,
            parameters,
            contextPath: this.getContextPath(uuid),
            context_id: uuid,
            agent_name: agent_name,
            create_time: pub.time()
        };
        // 保存对话配置信息到文件
        this.saveJsonFile(this.getConfigFilePath(uuid), contextConfig);
        return contextConfig;
    }

    /**
     * 更新指定对话的模型信息
     * @param {string} uuid - 对话的唯一标识符
     * @param {string} model - 新的模型名称
     * @param {string} parameters - 新的模型参数
     * @param {string} supplierName - 供应商名称
     * @returns {boolean} - 如果更新成功返回 true，否则返回 false
     */
    update_chat_model(uuid: string, model: string, parameters: string, supplierName: string): boolean {
        // 读取对话配置信息
        const contextConfigObj = this.readJsonFile(this.getConfigFilePath(uuid));
        // 检查配置信息是否为空
        if (Object.keys(contextConfigObj).length === 0) {
            return false;
        }
        // 更新模型和参数信息
        contextConfigObj.model = model;
        contextConfigObj.parameters = parameters;
        contextConfigObj.supplierName = supplierName;
        // 保存更新后的配置信息到文件
        this.saveJsonFile(this.getConfigFilePath(uuid), contextConfigObj);
        return true;
    }

    /**
     * 读取指定对话的配置信息
     * @param {string} uuid - 对话的唯一标识符
     * @returns {any} - 对话的配置信息对象，如果不存在则返回空数组
     */
    read_chat(uuid: string): any {
        return this.readJsonFile(this.getConfigFilePath(uuid));
    }

    /**
     * 保存指定对话的配置信息
     * @param {string} uuid - 对话的唯一标识符
     * @param {object} chatConfig - 要保存的对话配置信息对象
     */
    save_chat(uuid: string, chatConfig: object): void {
        this.saveJsonFile(this.getConfigFilePath(uuid), chatConfig);
    }


    /**
     * 合并聊天历史记录
     * @param {ChatHistory[]} chatHistory - 聊天历史记录数组
     * @returns {ChatHistory[]} - 合并后的聊天历史记录数组
     */
    mergeHistory(chatHistory: ChatHistory[]): ChatHistory[] {
        // 合并同一个compare_id的历史记录，注意：不合并compare_id==undefined的记录，只合并role=="assistant"的记录
        let mergedHistory: ChatHistory[] = [];
        for (let history of chatHistory) {
            if (history.compare_id == undefined) {
                mergedHistory.push(history);
                continue;
            }

            // 相同compare_id只保留一条user记录
            let index = mergedHistory.findIndex((item) => item.compare_id == history.compare_id && item.role == "user");
            if (index > -1 && history.role == "user") {
                mergedHistory[index].content = history.content;
                mergedHistory[index].stat = history.stat;
                mergedHistory[index].reasoning = history.reasoning;
                mergedHistory[index].tool_calls = history.tool_calls;
                mergedHistory[index].images = history.images;
                mergedHistory[index].doc_files = history.doc_files;
                mergedHistory[index].created_at = history.created_at;
                mergedHistory[index].create_time = history.create_time;
                mergedHistory[index].tokens = history.tokens;
                mergedHistory[index].search_result = history.search_result;
                mergedHistory[index].search_type = history.search_type;
                mergedHistory[index].search_query = history.search_query;
                continue;
            }

            // 合并assistant
            index = mergedHistory.findIndex((item) => item.compare_id == history.compare_id && item.role == "assistant");
            if (index > -1 && history.role == "assistant") {
                // 是否为数组
                if (Array.isArray(mergedHistory[index].content)) {
                    mergedHistory[index].content.push(history.content);
                    mergedHistory[index].stat.push(history.stat);
                    mergedHistory[index].reasoning.push(history.reasoning);
                } else {
                    mergedHistory[index].content = [mergedHistory[index].content, history.content];
                    mergedHistory[index].stat = [mergedHistory[index].stat, history.stat];
                    mergedHistory[index].reasoning = [mergedHistory[index].reasoning, history.reasoning];

                }

            } else {
                mergedHistory.push(history);
            }
        }
        return mergedHistory;
    }

    /**
     * 检查聊天历史记录，确保顺序正确
     * @param {ChatHistory[]} chatHistory - 聊天历史记录数组
     * @returns {ChatHistory[]} - 检查后的聊天历史记录数组
     */
    checkHistory(chatHistory: ChatHistory[]): ChatHistory[] {

        // 确保历史记录的顺序是user在前，assistant在后，不能同时出现两个user或assistant
        let newChatHistory: ChatHistory[] = [];
        let userNumber = 0;
        let assistantNumber = 0;
        for (let history of chatHistory) {
            if (history.role == "user") {
                if (userNumber == 0) {
                    newChatHistory.push(history);
                    userNumber++
                    assistantNumber = 0; // 重置assistantNumber
                } else {
                    // 如果已经有一个user了，就不再添加了
                    continue;
                }
            }

            if (history.role == "assistant") {
                if (assistantNumber == 0) {
                    newChatHistory.push(history);
                    assistantNumber++
                    userNumber = 0; // 重置userNumber
                } else {
                    // 如果已经有一个assistant了，就不再添加了
                    continue;
                }
            }
        }
        return newChatHistory;
    }



    /**
     * 格式化聊天历史记录，将同一对话的历史记录合并
     * @param {ChatHistory[]} chatHistory - 聊天历史记录数组
     * @returns {any} - 格式化后的聊天历史记录数组
     */
    formatHistory(chatHistory: ChatHistory[]): any {
        let mergedHistory = this.mergeHistory(chatHistory);
        let newChatHistory = this.checkHistory(mergedHistory);
        return newChatHistory
    }


    /**
     * 读取指定对话的历史记录
     * @param {string} uuid - 对话的唯一标识符
     * @returns {any[]} - 对话的历史记录数组，如果不存在则返回空数组
     */
    read_history(uuid: string): any[] {
        let chatHistory = this.readJsonFile(this.getHistoryFilePath(uuid));
        return chatHistory;
    }

    /**
     * 保存指定对话的历史记录
     * @param {string} uuid - 对话的唯一标识符
     * @param {any[]} history - 要保存的历史记录数组
     */
    save_history(uuid: string, history: any[]): void {
        this.saveJsonFile(this.getHistoryFilePath(uuid), history);
    }

    /**
     * 获取所有对话的列表，并按创建时间降序排序
     * @returns {object[]} - 包含所有对话配置信息的数组
     */
    get_chat_list(): object[] {
        // 获取根上下文路径
        const contextPath = this.getContextPath("");
        // 读取上下文目录下的所有子目录
        const contextDirList = pub.readdir(contextPath);
        const contextList: object[] = [];
        const ragPath = pub.get_data_path() + "/rag";
        // 遍历每个子目录
        for (const dir of contextDirList) {
            // 获取配置文件的完整路径
            const configFilePath = path.resolve(dir, 'config.json');
            // 读取配置信息
            const contextConfigObj = this.readJsonFile(configFilePath);
            // 检查配置信息是否为空
            if (Object.keys(contextConfigObj).length === 0) {
                continue;
            }
            // 如果配置信息中没有创建时间，尝试从文件创建时间获取
            if (contextConfigObj.create_time === undefined) {
                const stat = pub.stat(configFilePath);
                if (stat) {
                    // 将文件创建时间转换为秒级时间戳
                    contextConfigObj.create_time = Math.floor(stat.birthtime.getTime() / 1000);
                } else {
                    contextConfigObj.create_time = 0;
                }
            }

            if (contextConfigObj.supplierName == undefined) {
                contextConfigObj.supplierName = "ollama";
            }

            if (!contextConfigObj.rag_list) {
                contextConfigObj.rag_list = [];
            }

            // 遍历知识库，移除不存在的知识库配置
            let rag_list: string[] = [];
            for (let ragName of contextConfigObj.rag_list) {
                const ragDir = ragPath + "/" + ragName;
                const ragConfigFilePath = path.resolve(ragDir, 'config.json');
                if (!pub.file_exists(ragConfigFilePath)) {
                    continue;
                }
                rag_list.push(ragName);
            }
            contextConfigObj.rag_list = rag_list;
            contextConfigObj.agent_info = null;
            if (contextConfigObj.agent_name) {
                contextConfigObj.agent_info = agentService.get_agent_config(contextConfigObj.agent_name);
            }

            // 将配置信息添加到对话列表中
            contextList.push(contextConfigObj);
        }
        // 按创建时间降序排序
        contextList.sort((a: any, b: any) => b.create_time - a.create_time);
        return contextList;
    }

    /**
     * 获取指定对话的历史记录
     * @param {string} uuid - 对话的唯一标识符
     * @returns {object[]} - 对话的历史记录数组
     */
    get_chat_history(uuid: string): object[] {
        return this.formatHistory(this.read_history(uuid));
    }


    /**
     * 处理文档和图片文件
     * @param chatContext <ChatContext> 聊天上下文
     * @param isVision <boolean> 是否是视觉模型
     * @param uuid <string> 对话的唯一标识符
     */
    async handle_files(chatContext: ChatContext, isVision: boolean): Promise<ChatContext> {

        // 将图片转换为base64格式
        let images: string[] = []
        for (let image of chatContext.images) {
            if (isVision) {
                let base64 = pub.imageToBase64(image);
                images.push(base64);
            } else {
                let imageOcr = await parseDocument(image, "temp", false);
                if (imageOcr.content) {
                    images.push(imageOcr.content);
                }
            }
        }
        chatContext.images = images;

        // 处理文档文件
        let doc_files: string[] = []
        for (let doc_file of chatContext.doc_files) {
            let parseDocBody = await parseDocument(doc_file, "temp", false);
            doc_files.push(parseDocBody.content);
        }

        chatContext.doc_files = doc_files;

        return chatContext;
    }


    /**
     * 构造传递给模型的历史对话记录，根据上下文长度进行截断
     * @param {string} uuid - 对话的唯一标识符
     * @param {ChatContext} chatContext - 当前的聊天上下文
     * @param {number} contextLength - 上下文的最大长度
     * @param {boolean} isTempChat - 是否是临时聊天
     * @param {boolean} isVision - 是否是视觉模型
     * @returns {object[]} - 构造后的历史对话记录数组
     */
    async build_chat_history(uuid: string, chatContext: ChatContext, contextLength: number, isTempChat: boolean, isVision: boolean): Promise<any[]> {
        // 读取对话的历史记录
        let contextList = this.checkHistory(this.read_history(uuid));
        // 计算当前聊天上下文和历史记录的总 tokens 数量
        let totalTokens = chatContext.content.length;
        for (const item of contextList) {
            totalTokens += item.content.length;
        }
        // 计算历史记录的最大上下文长度
        const historyMaxContextLength = Math.round(contextLength * 0.5);
        // 如果总 tokens 数量超过最大上下文长度，逐步移除最早的历史记录
        while (totalTokens > historyMaxContextLength && contextList.length > 0) {
            const firstHistory = contextList.shift();
            if (firstHistory) {
                totalTokens -= firstHistory.content.length;
            }
        }
        // 提取历史记录中的角色和内容信息
        let historyList = contextList.map(item => ({ role: item.role, content: item.content }));

        chatContext = await this.handle_files(chatContext, isVision);

        // 添加当前聊天上下文到历史记录中
        // 如果有images或doc_files的情况下，不引用上下文
        if (chatContext.images.length > 0 || chatContext.doc_files.length > 0 || isTempChat) {
            historyList = [];
        }
        historyList.push(chatContext);
        return historyList;
    }

    /**
     * 保存对话的历史记录，并根据上下文长度进行截断
     * @param {string} uuid - 对话的唯一标识符
     * @param {ChatHistory} history - 要保存的聊天历史记录
     * @param {number} contextLength - 上下文的最大长度
     */
    save_chat_history(uuid: string, history: ChatHistory, historyRes: ChatHistory, contextLength: number, regenerate_id: string | undefined): void {
        // 为历史记录生成唯一标识符
        history.id = pub.uuid();
        // 计算历史记录的 tokens 数量
        history.tokens = history.content ? history.content.length : 0;
        // 读取对话的历史记录
        let historyList = this.checkHistory(this.read_history(uuid));
        // 计算总 tokens 数量
        let totalTokens = history.tokens;
        // 计算历史记录的最大上下文长度
        const historyMaxContextLength = Math.round(contextLength * 0.5);

        historyRes.content = pub.lang("意外中断");

        if (regenerate_id) {
            let index = historyList.findIndex((item) => item.id == regenerate_id);
            if (index > -1) {
                // 移除指定ID之后的所有历史记录
                historyList = historyList.slice(0, index);
            }
        } else {
            // 添加新的提问记录到列表中
            historyList.push(history);
        }

        historyList.push(historyRes);
        // 如果总 tokens 数量超过最大上下文长度，逐步移除最早的历史记录
        while (totalTokens > historyMaxContextLength && historyList.length > 0) {
            const firstHistory = historyList.shift();
            if (firstHistory) {
                totalTokens -= firstHistory.tokens;
            }
        }
        // 保存更新后的历史记录到文件
        this.save_history(uuid, historyList);
    }

    /**
     * 修正对话的历史记录
     * @param uuid <string> 对话的唯一标识符
     * @param id <string> 要修正的历史记录的唯一标识符
     * @param history <ChatHistory> 修正后的聊天历史记录
     */
    set_chat_history(uuid: string, id: string, history: ChatHistory): void {
        let historyList = this.checkHistory(this.read_history(uuid));
        let index = historyList.findIndex((item) => item.id == id);
        historyList[index] = history;
        this.save_history(uuid, historyList);
    }




    /**
     * 删除指定对话及其相关文件
     * @param {string} uuid - 对话的唯一标识符
     */
    delete_chat(uuid: string): void {
        // 获取对话的上下文路径
        const contextPath = this.getContextPath(uuid);
        try {
            // 删除上下文目录
            pub.rmdir(contextPath);
        } catch (error) {
            // 记录删除对话时的错误信息
            logger.error(`删除对话 ${uuid} 时出错:`, error);
        }
    }

    /**
     * 更新指定对话的标题
     * @param {string} uuid - 对话的唯一标识符
     * @param {string} title - 新的对话标题
     * @returns {boolean} - 如果更新成功返回 true，否则返回 false
     */
    update_chat_title(uuid: string, title: string): boolean {
        // 读取对话的配置信息
        const contextConfigObj = this.read_chat(uuid);
        // 检查配置信息是否为空
        if (Object.keys(contextConfigObj).length === 0) {
            return false;
        }
        // 更新对话标题
        contextConfigObj.title = title;
        // 保存更新后的配置信息到文件
        this.save_chat(uuid, contextConfigObj);
        return true;
    }


    /**
     * 更新指定对话的配置项
     * @param {string} uuid - 对话的唯一标识符
     * @param {string} key - 配置项的键
     * @param {any} value - 配置项的值
     * @returns {boolean} - 如果更新成功返回 true，否则返回 false
     */
    update_chat_config(uuid: string, key: string, value: any): boolean {
        // 读取对话的配置信息
        const contextConfigObj = this.read_chat(uuid);
        // 检查配置信息是否为空
        if (Object.keys(contextConfigObj).length === 0) {
            return false;
        }
        // 更新指定配置项
        contextConfigObj[key] = value;
        // 保存更新后的配置信息到文件
        this.save_chat(uuid, contextConfigObj);
        return true;
    }


    /**
     * 删除指定对话中的某条历史记录
     * @param {string} uuid - 对话的唯一标识符
     * @param {string} id - 要删除的历史记录的唯一标识符
     */
    delete_chat_history(uuid: string, id: string): void {
        // 读取对话的历史记录
        const historyList = this.read_history(uuid);
        // 过滤掉要删除的历史记录
        const newHistoryList = historyList.filter(item => item.id !== id);
        // 保存更新后的历史记录到文件
        this.save_history(uuid, newHistoryList);
    }

    /**
     * 获取指定对话的最后一条历史记录
     * @param {string} uuid - 对话的唯一标识符
     * @returns {object} - 最后一条历史记录对象，如果不存在则返回空对象
     */
    get_last_chat_history(uuid: string): object {
        // 读取对话的历史记录
        const historyList = this.formatHistory(this.read_history(uuid));
        return historyList[historyList.length - 1] || {};
    }

    




}

/**
 * 重写 ChatService 类的 toString 方法，方便调试和日志输出
 * @returns {string} - 类的字符串表示
 */
ChatService.toString = () => '[class ChatService]';

/**
 * 导出 ChatService 类的单例实例
 */
export const chatService = new ChatService();
