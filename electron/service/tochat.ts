import { logger } from 'ee-core/log';
import { pub } from '../class/public';
import * as path from 'path';
import { agentService } from './agent';
import { ModelService, GetSupplierModels, getModelContextLength, setModelUsedTotal, getModelUsedTotalList } from '../service/model';
import { getPromptForWeb } from '../search_engines/search';
import { Rag } from '../rag/rag';
import { Stream } from 'stream';
import { MCPClient } from './mcp_client';
import { ChatContext, ChatHistory, ChatService, ModelInfo } from './chat';

/**
 * 存储所有模型信息的数组
 * @type {ModelInfo[]}
 */
export let ModelListInfo: ModelInfo[] = [];
/**
 * 存储对话上下文状态的映射，键为对话ID，值为是否继续生成的布尔值
 * @type {Map<string, boolean>}
 */
export let ContextStatusMap = new Map<string, boolean>();
export const clearModelListInfo = () => {
    ModelListInfo = [];
}

// 提取获取模型信息的函数
const getModelInfo = (model: string): ModelInfo => {
    const foundInfo = ModelListInfo.find((info) => info.model === model);
    return foundInfo || {
        title: model,
        supplierName: 'ollama',
        model,
        size: 0,
        contextLength: getModelContextLength(model),
    };
}

// 提取判断是否为视觉模型的函数
const checkIsVisionModel = async (supplierName: string, model: string): Promise<boolean> => {
    const modelLower = model.toLocaleLowerCase();
    if (modelLower.indexOf('vision') !== -1) {
        return true;
    }
    if (supplierName !== 'ollama') {
        if (modelLower.indexOf('-vl') !== -1) return true;
        return false;
    }
    try {
        const modelListFile = path.resolve(pub.get_resource_path(), 'ollama_model.json');
        if (!pub.file_exists(modelListFile)) {
            logger.warn('模型列表文件不存在:', modelListFile);
            return false;
        }
        const modelList = pub.read_json(modelListFile);
        if (!Array.isArray(modelList)) {
            logger.warn('模型列表格式不正确');
            return false;
        }
        return modelList.some(modelInfo => {
            return (modelInfo.name === model || modelInfo.full_name === model) &&
                modelInfo.capability && Array.isArray(modelInfo.capability) &&
                modelInfo.capability.includes('vision');
        });
    } catch (error) {
        logger.error('检查模型视觉能力时出错:', error);
        return false;
    }
}

// 提取保存对话内容的函数
const saveChatHistory = async (uuid: string, resUUID: string, chatHistoryRes: ChatHistory) => {
    const key = "\n</think>\n";
    if (chatHistoryRes.content.indexOf(key) !== -1) {
        const spArr = chatHistoryRes.content.split(key);
        chatHistoryRes.reasoning = spArr[0] + key;
        chatHistoryRes.content = spArr[1];
    }
    const chatService = new ChatService();
    await chatService.set_chat_history(uuid, resUUID, chatHistoryRes);
}

// 提取处理RAG的函数
const handleRag = async (args: any, chatService: ChatService, history: any[], chatHistoryRes: ChatHistory, contextInfo: any, supplierName: string, modelStr: string, user_content: string, rag_results: any[]) => {
    if (args.rag_list) {
        const ragList = JSON.parse(args.rag_list);
        await chatService.update_chat_config(args.context_id, "rag_list", ragList);
        if (ragList.length > 0) {
            const { userPrompt, systemPrompt, searchResultList, query } = await new Rag().searchAndSuggest(supplierName, modelStr, user_content, history[history.length - 1].doc_files, contextInfo.agent_name, rag_results, ragList);
            chatHistoryRes.search_query = query;
            chatHistoryRes.search_type = "[RAG]:" + ragList.join(",");
            chatHistoryRes.search_result = searchResultList;
            if (searchResultList.length > 0 && systemPrompt) {
                history.unshift({
                    role: 'system',
                    content: systemPrompt
                });
            }
            if (userPrompt) {
                history[history.length - 1].content = userPrompt;
            }
            if (searchResultList.length > 0) {
                args.search = '';
            }
        }
    }
    return args.search;
}

// 提取处理搜索的函数
const handleSearch = async (args: any, chatService: ChatService, history: any[], chatHistoryRes: ChatHistory, contextInfo: any, supplierName: string, modelStr: string, user_content: string, search_results: any[]) => {
    if (args.search) {
        let lastHistory = "";
        if (history.length > 2) {
            lastHistory += pub.lang("问题: ") + history[history.length - 3].content + "\n";
            lastHistory += pub.lang("回答: ") + history[history.length - 2].content + "\n";
        }
        const { userPrompt, systemPrompt, searchResultList, query } = await getPromptForWeb(user_content, modelStr, lastHistory, history[history.length - 1].doc_files, contextInfo.agent_name, search_results, args.search);
        chatHistoryRes.search_query = query;
        chatHistoryRes.search_type = args.search;
        chatHistoryRes.search_result = searchResultList;
        if (systemPrompt && searchResultList.length > 0) {
            history.unshift({
                role: 'system',
                content: systemPrompt
            });
        }
        if (userPrompt) {
            history[history.length - 1].content = userPrompt;
        }
    }
}

// 提取处理文档的函数
const handleDocuments = (letHistory: any, modelName: string, user_content: string) => {
    if (letHistory.content === user_content && letHistory.doc_files.length > 0) {
        if (modelName.toLocaleLowerCase().indexOf('qwen') === -1) {
            const doc_files_str = letHistory.doc_files.map(
                (doc_file, idx) => {
                    if (!doc_file) return '';
                    return `[${pub.lang('用户文档')} ${idx + 1} begin]
            ${pub.lang('内容')}: ${doc_file}
            [${pub.lang('用户文档')} ${idx} end]`
                }
            ).join("\n");
            letHistory.content = `## ${pub.lang('以下是用户上传的文档内容，每个文档内容都是[用户文档 X begin]...[用户文档 X end]格式的，你可以根据需要选择其中的内容。')}
<doc_files>
${doc_files_str}
</doc_files>
## ${pub.lang('用户输入的内容')}:
${user_content}`;
        } else {
            const doc_files_str = letHistory.doc_files.map(
                (doc_file, idx) => {
                    if (!doc_file) return '';
                    return `${pub.lang('用户文档')} ${idx + 1} begin
${doc_file}
${pub.lang('用户文档')} ${idx + 1} end
`
                }).join("\n");
            letHistory.content += "\n\n" + doc_files_str;
        }
    }
}

// 提取处理图片的函数
const handleImages = (letHistory: any, isVision: boolean) => {
    if (!isVision && letHistory.images.length > 0) {
        const ocrContent = letHistory.images.map((image, idx) => {
            if (!image) return '';
            return `${pub.lang('图片')} ${idx + 1} ${pub.lang('OCR解析结果')} begin
${image}
${pub.lang('图片')} ${idx + 1} ${pub.lang('OCR解析结果')} end
`}).join("\n");
        letHistory.content += "\n\n" + ocrContent;
    }
}

// 提取处理非Ollama模型图片的函数
const handleNonOllamaImages = (letHistory: any) => {
    if (letHistory.images && letHistory.images.length > 0) {
        const content = [];
        content.push({ type: "text", text: letHistory.content });
        for (const image of letHistory.images) {
            content.push({ type: "image_url", image_url: { url: image } });
        }
        letHistory.content = content;
    }
    if (letHistory.images) delete letHistory.images;
}

// 提取处理Ollama模型图片的函数
const handleOllamaImages = (letHistory: any) => {
    if (letHistory.images && letHistory.images.length > 0) {
        const images = [];
        for (const image of letHistory.images) {
            const imgArr = image.split(',');
            if (imgArr.length > 1) {
                images.push(imgArr[1]);
            }
        }
        letHistory.images = images;
    }
}

// 提取计算上下文长度的函数
const calculateContextLength = (history: any[]) => {
    let contextLength = 0;
    for (const message of history) {
        contextLength += message.content.length;
    }
    return contextLength;
}

// 时间戳转2025-04-18T03:49:41.0108203Z格式
const formatDate = (timestamp: number) => {
    if(typeof timestamp !== 'number'){
        return timestamp;
    }
    const date = new Date(timestamp * 1000);
    return date.toISOString();
}

// 提取获取响应信息的函数
const getResponseInfo = (chunk: any, isOllama: boolean, modelStr: string, resTimeMs: number) => {
    if (isOllama) {
        return {
            model: chunk.model,
            created_at: chunk.created_at.toString(),
            total_duration: chunk.total_duration / 1000000000,
            load_duration: chunk.load_duration / 1000000,
            prompt_eval_count: chunk.prompt_eval_count,
            prompt_eval_duration: chunk.prompt_eval_duration / 1000000,
            eval_count: chunk.eval_count,
            eval_duration: chunk.eval_duration / 1000000000,
        };
    } else {
        const nowTime = pub.time();
        return {
            model: modelStr,
            created_at: formatDate(chunk.created),
            total_duration: nowTime - chunk.created,
            load_duration: 0,
            prompt_eval_count: chunk.usage?.prompt_tokens || 0,
            prompt_eval_duration: chunk.created * 1000 - resTimeMs,
            eval_count: chunk.usage?.completion_tokens || 0,
            eval_duration: nowTime - resTimeMs / 1000,
        };
    }
}

export class ToChatService {
    /**
     * 获取指定模型的信息
     * @param {string} model - 模型名称
     * @returns {ModelInfo} - 模型信息对象
     */
    get_model_info(model: string): ModelInfo {
        return getModelInfo(model);
    }

    /**
     * 判断是否为视觉模型
     * @param {string} supplierName - 供应商名称
     * @param {string} model - 模型名称
     * @returns {Promise<boolean>} - 是否为视觉模型
     */
    async isVisionModel(supplierName: string, model: string): Promise<boolean> {
        return checkIsVisionModel(supplierName, model);
    }

    /**
     * 保存对话内容
     * @param {string} uuid - 对话的唯一标识符
     * @param {string} resUUID - 对话的唯一标识符
     * @param {ChatHistory} chatHistoryRes - 对话历史记录
     */
    async set_chat_history(uuid: string, resUUID: string, chatHistoryRes: ChatHistory) {
        await saveChatHistory(uuid, resUUID, chatHistoryRes);
    }

    /**
     * 确保消息格式正确
     * @param {any} messages - 消息内容
     * @returns 
     */
    formatMessage(messages: any[]): any[] {
        // 确保system消息在最前面，且不重复，若有多个system消息，则只保留第一个，其它的删除
        const systemMessages = messages.filter((msg: any) => msg.role === 'system');
        if (systemMessages.length > 0) {
            messages = messages.filter((msg: any) => msg.role !== 'system');
            messages.unshift(systemMessages[0]);
        }
        // 确保system在第一位，且user消息和assistant交替出现
        const userMessages = messages.filter((msg: any) => msg.role === 'user');
        const assistantMessages = messages.filter((msg: any) => msg.role === 'assistant');
        const systemMessage = messages.filter((msg: any) => msg.role === 'system')[0];
        messages = [];
        if (systemMessage) {
            messages.push(systemMessage);
        }
        let i = 0;
        while (i < userMessages.length || i < assistantMessages.length) {
            if (i < userMessages.length) {
                messages.push(userMessages[i]);
            }
            if (i < assistantMessages.length) {
                messages.push(assistantMessages[i]);
            }
            i++;
        }
        return messages
    }

    /**
     * 开始对话
     * @param {Object} args - 对话所需的参数
     * @param {string} args.context_id - 对话的唯一标识符
     * @param {string} args.supplierName - 供应商名称
     * @param {string} args.model - 模型名称
     * @param {string} args.parameters - 模型参数
     * @param {string} args.user_content - 用户输入的内容
     * @param {string} args.search - 搜索类型
     * @param {string} args.rag_list - RAG列表
     * @param {string} args.regenerate_id - 重新生成的ID
     * @param {string} args.images - 图片列表
     * @param {string} args.doc_files - 文件列表
     * @param {string} args.temp_chat - 临时对话标志
     * @param {any} args.rag_results - RAG结果列表
     * @param {any} args.search_results - 搜索结果列表
     * @param {string} args.compare_id - 对比ID
     * @param {any} event - 事件对象，用于处理HTTP响应
     * @returns {Promise<any>} - 可读流，用于流式响应对话结果
     */
    async chat(args: {
        context_id: string;
        supplierName?: string;
        model: string;
        parameters?: string;
        user_content: string,
        rag_results: any[],
        search_results?: any[],
        search?: string,
        rag_list?: string,
        regenerate_id?: string,
        images?: string,
        doc_files?: string,
        temp_chat?: string,
        compare_id?: string,
        mcp_servers?: string[],
    }, event: any): Promise<any> {
        let { context_id: uuid, model: modelName, parameters, user_content, search, regenerate_id, supplierName, images, doc_files, temp_chat, rag_results, search_results, compare_id, mcp_servers } = args;
        if (!supplierName) {
            supplierName = 'ollama';
        }
        const isTempChat = temp_chat === 'true';
        let isOllama = supplierName === 'ollama';
        let modelStr = modelName;
        if (isOllama) {
            modelStr = `${modelName}:${parameters}`;
        } else {
            parameters = supplierName;
        }
        const images_list = images ? images.split(',') : [];
        const doc_files_list = doc_files ? doc_files.split(',') : [];
        setModelUsedTotal(supplierName, modelStr);
        const chatService = new ChatService();
        const contextInfo = await chatService.read_chat(uuid);
        const chatContext: ChatContext = {
            role: 'user',
            content: user_content,
            images: images_list,
            doc_files: doc_files_list,
            tool_calls: ''
        };
        ContextStatusMap.set(uuid, true);
        let modelInfo: ModelInfo = {
            title: modelName,
            supplierName: supplierName,
            model: modelName,
            size: 0,
            contextLength: getModelContextLength(modelName),
        };
        if (isOllama) {
            modelInfo = this.get_model_info(modelStr);
            if (modelInfo.contextLength === 0) {
                modelInfo.contextLength = getModelContextLength(modelName);
            }
        }

        if(compare_id && regenerate_id){
            regenerate_id = '';
        }
        
        await chatService.update_chat_model(uuid, modelName, parameters as string, supplierName as string);
        const isVision = await this.isVisionModel(supplierName, modelName);
        let history = await chatService.build_chat_history(uuid, chatContext, modelInfo.contextLength, isTempChat, isVision);
        const chatHistory: ChatHistory = {
            id: "",
            compare_id: compare_id,
            role: "user",
            reasoning: "",
            stat: {},
            content: user_content,
            images: images_list,
            doc_files: doc_files_list,
            tool_calls: "",
            created_at: "",
            create_time: pub.time(),
            tokens: 0,
            search_result: [],
            search_type: search,
            search_query: "",
            tools_result: [],
        };
        const resUUID = pub.uuid();
        const chatHistoryRes: ChatHistory = {
            id: resUUID,
            compare_id: compare_id,
            role: "assistant",
            reasoning: "",
            stat: {
                model: modelStr,
                created_at: '',
                total_duration: 0,
                load_duration: 0,
                prompt_eval_count: 0,
                prompt_eval_duration: 0,
                eval_count: 0,
                eval_duration: 0,
            },
            content: "",
            images: [],
            doc_files: [],
            tool_calls: "",
            created_at: "",
            create_time: pub.time(),
            tokens: 0,
            search_result: [],
            search_type: search,
            search_query: "",
            tools_result: [],
        };
        await chatService.save_chat_history(uuid, chatHistory, chatHistoryRes, modelInfo.contextLength, regenerate_id);
        await chatService.update_chat_config(uuid, "search_type", search);
        let isSystemPrompt = false;
        search = await handleRag(args, chatService, history, chatHistoryRes, contextInfo, supplierName, modelStr, user_content, rag_results);
        await handleSearch(args, chatService, history, chatHistoryRes, contextInfo, supplierName, modelStr, user_content, search_results);
        const letHistory = history[history.length - 1];
        if (!isSystemPrompt && history[0].role !== 'system' && letHistory.content === user_content) {
            if (contextInfo.agent_name) {
                const agentConfig = agentService.get_agent_config(contextInfo.agent_name);
                if (agentConfig && agentConfig.prompt) {
                    history.unshift({
                        role: 'system',
                        content: agentConfig.prompt
                    });
                }
            }
        }
        handleDocuments(letHistory, modelName, user_content);
        handleImages(letHistory, isVision);
        if (letHistory.tool_calls !== undefined) {
            delete letHistory.tool_calls;
        }
        if (letHistory.doc_files !== undefined) {
            delete letHistory.doc_files;
        }
        if(isVision){
            if (!isOllama) {
                handleNonOllamaImages(letHistory);
            } else {
                handleOllamaImages(letHistory);
            }
        }
        if (letHistory.images && letHistory.images.length === 0) {
            delete letHistory.images;
        }

        if(!isVision && letHistory.images){
            delete letHistory.images;
        }

        history = this.formatMessage(history);

        const requestOption: any = {
            model: modelStr,
            messages: history,
            stream: true,
        };
        if (isOllama) {
            const contextLength = calculateContextLength(history);
            let max_ctx = 4096;
            let min_ctx = 2048;
            const parametersNumber = Number(parameters?.replace('b', '')) || 4;
            if (parametersNumber && parametersNumber <= 4) max_ctx = 8192;
            let num_ctx = Math.max(min_ctx, Math.min(max_ctx, contextLength / 2));
            num_ctx = Math.ceil(num_ctx / min_ctx) * min_ctx;
            requestOption.options = {
                num_ctx
            };
        }
        if (modelName.indexOf('deepseek') !== -1) {
            if (isOllama) {
                requestOption.options.temperature = 0.6;
            } else {
                requestOption.temperature = 0.6;
            }
        }
        // 若前端未明确传入 mcp_servers，但本地存在已启用的MCP服务器，则默认启用，避免“有时不调用”的不一致
        if (!mcp_servers || mcp_servers.length === 0) {
            try {
                const activeServers = await MCPClient.getActiveServers();
                if (activeServers && activeServers.length > 0) {
                    mcp_servers = activeServers.map(s => s.name);
                }
            } catch (e) {
                // 忽略自动启用失败，保持原逻辑
            }
        }
        if (mcp_servers.length > 0) {
            isOllama = false;
        }
        event.response.set("Content-Type", "text/event-stream;charset=utf-8");
        event.response.set("Connection", "keep-alive");
        event.response.status = 200;
        const s = new Stream.Readable({
            read() { }
        });
        const PushOther = async (msg) => {
            if (msg) {
                s.push(msg);
                if (msg.indexOf('<mcptool>') !== -1) {
                    chatHistoryRes.tools_result.push(msg);
                }
            }
        };
        let res: any;
        chatHistoryRes.content = "";
        let resTimeMs = 0;
        let isThinking = false;
        let isThinkingEnd = false;
        const ResEvent = async (chunk) => {
            
            if (!isOllama) resTimeMs = new Date().getTime();
            if(chunk.choices && chunk.choices.length === 0){
                return;
            }
            if ((isOllama && chunk.done) ||
                (!isOllama && (['stop', 'normal', 'length', 'content_filter'].includes(chunk.choices[0]?.finish_reason)))) {
                const resInfo = getResponseInfo(chunk, isOllama, modelStr, resTimeMs);
                chatHistoryRes.created_at = chunk.created_at ? chunk.created_at.toString() : chunk.created;
                chatHistoryRes.create_time = chunk.created ? chunk.created : pub.time();
                chatHistoryRes.stat = resInfo;
                if (!isOllama) {
                    chatHistoryRes.content += chunk.choices[0]?.delta?.content || '';
                    s.push(chunk.choices[0]?.delta?.content || '');
                }
                s.push(null);
                await this.set_chat_history(uuid, resUUID, chatHistoryRes);
                return false;
            }
            if (isOllama) {
                s.push(chunk.message.content);
                chatHistoryRes.content += chunk.message.content;
            } else {
                if (chunk.choices[0]?.delta?.reasoning_content) {
                    let reasoningContent = chunk.choices[0]?.delta?.reasoning_content || '';
                    if (!isThinking) {
                        isThinking = true;
                        if (reasoningContent.indexOf('<think>') === -1) {
                            s.push('\n<think>\n');
                            chatHistoryRes.content += '\n<think>\n';
                        }
                    }
                    s.push(reasoningContent);
                    chatHistoryRes.content += reasoningContent;
                    if (reasoningContent.indexOf('</think>') !== -1) {
                        isThinkingEnd = true;
                    }
                } else {
                    if (isThinking) {
                        isThinking = false;
                        if (!isThinkingEnd) {
                            s.push('\n</think>\n');
                            chatHistoryRes.content += '\n</think>\n';
                            isThinkingEnd = true;
                        }
                    }
                    s.push(chunk.choices[0]?.delta?.content || '');
                    chatHistoryRes.content += chunk.choices[0]?.delta?.content || '';
                }
            }
            if (!ContextStatusMap.get(uuid)) {
                try{
                    if (isOllama) res.abort();
                }catch (error){
                    logger.error('Abort error:', error.message);
                }

                const endContent = pub.lang("\n\n---\n**内容不完整:** 用户手动停止生成");
                chatHistoryRes.content += endContent;
                s.push(endContent);
                s.push(null);
                await this.set_chat_history(uuid, resUUID, chatHistoryRes);
                return false;
            }
            return true;
        };
        
        if (mcp_servers.length > 0) {
            try {
                isOllama = false;
                const modelService = new ModelService(supplierName);
                if (modelService.connect()) {
                    const openaiObj = modelService.client;
                    const mcpServers = await MCPClient.getActiveServers(mcp_servers);
                    const mcpClient = new MCPClient();
                    await mcpClient.connectToServer(mcpServers);
                    mcpClient.processQuery(openaiObj, supplierName, modelStr, history, ResEvent, PushOther);
                } else {
                    return pub.lang("模型连接失败:{}", modelService.error);
                }
            } catch (error: any) {
                return pub.lang("出错了: {}", error.message);
            }
        } else {
            if (isOllama) {
                try {
                    const ollama = pub.init_ollama();
                    res = await ollama.chat(requestOption);
                } catch (error: any) {
                    return pub.lang('调用模型接口时出错了: {}', error.message);
                }
            } else {
                const modelService = new ModelService(supplierName);
                try {
                    res = await modelService.chat(requestOption);
                } catch (error: any) {
                    if (error.error && error.error.message) {
                        return pub.lang('调用模型接口时出错了: {}', error.error.message);
                    }
                    return error;
                }
            }
            (async () => {
                for await (const chunk of res) {
                    await ResEvent(chunk);
                }
            })();
        }
        return s;
    }
}    
