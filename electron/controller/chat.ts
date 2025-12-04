import Stream from 'stream';
import { ChatService, ChatContext, ChatHistory,ModelInfo } from '../service/chat';
import { pub } from '../class/public';
import { logger } from 'ee-core/log';
import { getPromptForWeb } from '../search_engines/search';
import { Rag } from '../rag/rag';
import { ModelService, GetSupplierModels, getModelContextLength ,setModelUsedTotal,getModelUsedTotalList} from '../service/model';
import path from 'path';
import { agentService } from '../service/agent';
import { ollamaService } from '../service/ollama';
import { MCPClient } from '../service/mcp_client';
import { ContextStatusMap, ModelListInfo,ToChatService,clearModelListInfo} from '../service/tochat';


// 模型列表获取重试次数
let MODEL_LIST_RETRY = 0;

/**
 * chat controller 类，处理与聊天相关的各种操作
 * @class
 */
class ChatController {
    /**
     * 获取对话列表
     * @returns {Promise<any>} - 包含对话列表的成功响应
     */
    async get_chat_list(): Promise<any> {
        // 创建 ChatService 实例
        const chatService = new ChatService();
        // 获取对话列表
        const chatList = chatService.get_chat_list();
        // 返回成功响应
        return pub.return_success(pub.lang("对话列表获取成功"), chatList);
    }

    /**
     * 创建新的对话
     * @param {Object} args - 创建对话所需的参数
     * @param {string} args.model - 模型名称
     * @param {string} args.parameters - 模型参数
     * @param {string} args.title - 对话标题
     * @param {string} args.supplierName - 供应商名称
     * @returns {Promise<any>} - 包含新对话信息的成功响应
     */
    async create_chat(args: { model: string; parameters: string; title: string, supplierName?: string, agent_name?: string }): Promise<any> {
        let { model, parameters, title, supplierName, agent_name } = args;
        if (!agent_name) agent_name = '';
        // 创建新对话并获取相关数据
        const data = new ChatService().create_chat(model, parameters, title, supplierName as string, agent_name as string);
        // 返回成功响应
        return pub.return_success(pub.lang("对话创建成功"), data);
    }

    /**
     * 获取常用模型TOP5
     * @param result 
     * @returns 
     */
    get_model_top5(result:any){
        // 增加常用模型
        let commonModels = [];
        let modelsTotal = getModelUsedTotalList();
        for (let key of Object.keys(result)) {
            let modelList = result[key];
            for (let model of modelList) {
                let index = `${model.supplierName}/${model.model}`;
                if(modelsTotal[index]){
                    model.total = modelsTotal[index];
                    commonModels.push(model);
                }
            }
        }

        // 按照使用次数排序
        commonModels = commonModels.sort((a, b) => {
            return b.total - a.total;
        });

        // 取前5个模型
        commonModels = commonModels.slice(0, 5);
        if(commonModels.length > 0){
            result['commonModelList'] = commonModels;
        }
        return result;
    }


    /**
     * 获取模型列表
     * @returns {Promise<any>} - 包含模型列表信息的成功响应
     */
    async get_model_list(): Promise<any> {
        // 清空模型信息列表
        clearModelListInfo();
        let ollamaModelList: any[] = [];
        try{
            ollamaModelList = await ollamaService.model_list();
        }catch(e){
            logger.error(pub.lang('获取模型能力失败'), e);
            ollamaModelList = [];
        }
        try {
            // 获取所有模型信息
            MODEL_LIST_RETRY++;
            const ollama = pub.init_ollama();
            const res = await ollama.list();
            // 遍历模型信息，将其添加到 ModelListInfo 中
            res.models.forEach((modelInfo) => {
                if (modelInfo.name.indexOf('embed') == -1
                    && modelInfo.name.indexOf('bge-m3') == -1
                    && modelInfo.name.indexOf('all-minilm') == -1
                    && modelInfo.name.indexOf('multilingual') == -1
                    && modelInfo.name.indexOf('r1-1776') == -1) {
                    let capability = ['llm'];
                    let lastName = modelInfo.name.split(':')[0].toLocaleLowerCase();
                    for(let mod of ollamaModelList){
                        if (mod.model == lastName) {
                            capability = mod.capability;
                            break;
                        }
                    }
                    
                    ModelListInfo.push({
                        title: "Ollama/" + modelInfo.name,
                        supplierName: 'ollama',
                        model: modelInfo.name,
                        size: modelInfo.size,
                        contextLength: 0,
                        capability: capability
                    });
                }
            });
        } catch (error) {
            // 重试3次
            if (MODEL_LIST_RETRY < 4) {
                await pub.sleep(1000);
                return this.get_model_list();
            }
            // 记录错误信息
            logger.error(pub.lang('获取模型列表时出错:'), error);
        }

        let result = await GetSupplierModels();
        result['ollama'] = ModelListInfo;

        // 计算常用模型
        result = this.get_model_top5(result);


        // 返回成功响应
        return pub.return_success(pub.lang("大模型列表获取成功"), result);
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
        let toChatService = new ToChatService();
        return await toChatService.chat(args, event);
    }

    /**
     * 获取指定对话信息
     * @param {Object} args - 获取对话信息所需的参数
     * @param {string} args.context_id - 对话的唯一标识符
     * @returns {Promise<any>} - 包含对话信息的成功响应
     */
    async get_chat_info(args: { context_id: string }): Promise<any> {
        const { context_id: uuid } = args;
        let chatService = new ChatService();
        // 获取对话历史
        const data = chatService.get_chat_history(uuid);
        // 返回成功响应
        return pub.return_success(pub.lang("对话信息获取成功"), data);
    }

    /**
     * 删除指定对话
     * @param {Object} args - 删除对话所需的参数
     * @param {string} args.context_id - 对话的唯一标识符,多个用逗号分隔
     * @returns {Promise<any>} - 删除成功的响应
     */
    async remove_chat(args: { context_id: string }): Promise<any> {
        let { context_id } = args;
        const chatService = new ChatService();
        // 删除对话
        let uuids = context_id.split(',');
        for(let uuid of uuids){
            chatService.delete_chat(uuid);
            // 删除对话状态
            if (ContextStatusMap.has(uuid)) {
                ContextStatusMap.delete(uuid);
            }
        }
        // 返回成功响应
        return pub.return_success(pub.lang("对话删除成功"), null);
    }

    /**
     * 修改对话标题
     * @param {Object} args - 修改对话标题所需的参数
     * @param {string} args.context_id - 对话的唯一标识符
     * @param {string} args.title - 新的对话标题
     * @returns {Promise<any>} - 修改结果的响应
     */
    async modify_chat_title(args: { context_id: string; title: string }): Promise<any> {
        const { context_id: uuid, title } = args;
        const chatService = new ChatService();
        // 更新对话标题
        if (chatService.update_chat_title(uuid, title)) {
            return pub.return_success(pub.lang("标题修改成功"), null);
        } else {
            return pub.return_error(pub.lang("标题修改失败"), pub.lang("指定对话不可用"));
        }
    }

    /**
     * 删除指定对话历史
     * @param {Object} args - 删除对话历史所需的参数
     * @param {string} args.context_id - 对话的唯一标识符
     * @param {string} args.id - 要删除的历史记录的唯一标识符
     * @returns {Promise<any>} - 删除成功的响应
     */
    async delete_chat_history(args: { context_id: string; id: string }): Promise<any> {
        const { context_id: uuid, id: history_id } = args;
        const chatService = new ChatService();
        // 删除对话历史记录
        chatService.delete_chat_history(uuid, history_id);
        // 返回成功响应
        return pub.return_success(pub.lang("对话历史删除成功"), null);
    }

    /**
     * 中断生成
     * @param {Object} args - 中断生成所需的参数
     * @param {string} args.context_id - 对话的唯一标识符
     * @returns {Promise<any>} - 中断成功的响应
     */
    async stop_generate(args: { context_id: string }): Promise<any> {
        const { context_id: uuid } = args;
        // 设置对话状态为中断
        ContextStatusMap.set(uuid, false);
        // 返回成功响应
        return pub.return_success(pub.lang("已阻止大模型继续生成内容"), null);
    }

    /**
     * 获取指定对话的最后一条历史记录
     * @param {Object} args - 获取最后一条历史记录所需的参数
     * @param {string} args.context_id - 对话的唯一标识符
     * @returns {Promise<any>} - 包含最后一条历史记录的成功响应
     */
    async get_last_chat_history(args: { context_id: string }): Promise<any> {
        const { context_id: uuid } = args;
        const chatService = new ChatService();
        // 获取最后一条历史记录
        const data = chatService.get_last_chat_history(uuid);
        // 返回成功响应
        return pub.return_success(pub.lang("最后一条历史对话记录获取成功"), data);
    }
}

/**
 * 重写 ChatController 类的 toString 方法，方便调试和日志输出
 * @returns {string} - 类的字符串表示
 */
ChatController.toString = () => '[class ChatController]';

export default ChatController;
