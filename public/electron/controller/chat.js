var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var chat_exports = {};
__export(chat_exports, {
  default: () => chat_default
});
module.exports = __toCommonJS(chat_exports);
var import_chat = require("../service/chat");
var import_public = require("../class/public");
var import_log = require("ee-core/log");
var import_model = require("../service/model");
var import_ollama = require("../service/ollama");
var import_tochat = require("../service/tochat");
let MODEL_LIST_RETRY = 0;
class ChatController {
  /**
   * 获取对话列表
   * @returns {Promise<any>} - 包含对话列表的成功响应
   */
  async get_chat_list() {
    const chatService = new import_chat.ChatService();
    const chatList = chatService.get_chat_list();
    return import_public.pub.return_success(import_public.pub.lang("\u5BF9\u8BDD\u5217\u8868\u83B7\u53D6\u6210\u529F"), chatList);
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
  async create_chat(args) {
    let { model, parameters, title, supplierName, agent_name } = args;
    if (!agent_name) agent_name = "";
    const data = new import_chat.ChatService().create_chat(model, parameters, title, supplierName, agent_name);
    return import_public.pub.return_success(import_public.pub.lang("\u5BF9\u8BDD\u521B\u5EFA\u6210\u529F"), data);
  }
  /**
   * 获取常用模型TOP5
   * @param result 
   * @returns 
   */
  get_model_top5(result) {
    let commonModels = [];
    let modelsTotal = (0, import_model.getModelUsedTotalList)();
    for (let key of Object.keys(result)) {
      let modelList = result[key];
      for (let model of modelList) {
        let index = `${model.supplierName}/${model.model}`;
        if (modelsTotal[index]) {
          model.total = modelsTotal[index];
          commonModels.push(model);
        }
      }
    }
    commonModels = commonModels.sort((a, b) => {
      return b.total - a.total;
    });
    commonModels = commonModels.slice(0, 5);
    if (commonModels.length > 0) {
      result["commonModelList"] = commonModels;
    }
    return result;
  }
  /**
   * 获取模型列表
   * @returns {Promise<any>} - 包含模型列表信息的成功响应
   */
  async get_model_list() {
    (0, import_tochat.clearModelListInfo)();
    let ollamaModelList = await import_ollama.ollamaService.model_list();
    try {
      MODEL_LIST_RETRY++;
      const ollama = import_public.pub.init_ollama();
      const res = await ollama.list();
      res.models.forEach((modelInfo) => {
        if (modelInfo.name.indexOf("embed") == -1 && modelInfo.name.indexOf("bge-m3") == -1 && modelInfo.name.indexOf("all-minilm") == -1 && modelInfo.name.indexOf("multilingual") == -1 && modelInfo.name.indexOf("r1-1776") == -1) {
          let capability = ["llm"];
          let lastName = modelInfo.name.split(":")[0].toLocaleLowerCase();
          for (let mod of ollamaModelList) {
            if (mod.model == lastName) {
              capability = mod.capability;
              break;
            }
          }
          import_tochat.ModelListInfo.push({
            title: "Ollama/" + modelInfo.name,
            supplierName: "ollama",
            model: modelInfo.name,
            size: modelInfo.size,
            contextLength: 0,
            capability
          });
        }
      });
    } catch (error) {
      if (MODEL_LIST_RETRY < 4) {
        await import_public.pub.sleep(1e3);
        return this.get_model_list();
      }
      import_log.logger.error(import_public.pub.lang("\u83B7\u53D6\u6A21\u578B\u5217\u8868\u65F6\u51FA\u9519:"), error);
    }
    let result = await (0, import_model.GetSupplierModels)();
    result["ollama"] = import_tochat.ModelListInfo;
    result = this.get_model_top5(result);
    return import_public.pub.return_success(import_public.pub.lang("\u5927\u6A21\u578B\u5217\u8868\u83B7\u53D6\u6210\u529F"), result);
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
  async chat(args, event) {
    let toChatService = new import_tochat.ToChatService();
    return await toChatService.chat(args, event);
  }
  /**
   * 获取指定对话信息
   * @param {Object} args - 获取对话信息所需的参数
   * @param {string} args.context_id - 对话的唯一标识符
   * @returns {Promise<any>} - 包含对话信息的成功响应
   */
  async get_chat_info(args) {
    const { context_id: uuid } = args;
    let chatService = new import_chat.ChatService();
    const data = chatService.get_chat_history(uuid);
    return import_public.pub.return_success(import_public.pub.lang("\u5BF9\u8BDD\u4FE1\u606F\u83B7\u53D6\u6210\u529F"), data);
  }
  /**
   * 删除指定对话
   * @param {Object} args - 删除对话所需的参数
   * @param {string} args.context_id - 对话的唯一标识符,多个用逗号分隔
   * @returns {Promise<any>} - 删除成功的响应
   */
  async remove_chat(args) {
    let { context_id } = args;
    const chatService = new import_chat.ChatService();
    let uuids = context_id.split(",");
    for (let uuid of uuids) {
      chatService.delete_chat(uuid);
      if (import_tochat.ContextStatusMap.has(uuid)) {
        import_tochat.ContextStatusMap.delete(uuid);
      }
    }
    return import_public.pub.return_success(import_public.pub.lang("\u5BF9\u8BDD\u5220\u9664\u6210\u529F"), null);
  }
  /**
   * 修改对话标题
   * @param {Object} args - 修改对话标题所需的参数
   * @param {string} args.context_id - 对话的唯一标识符
   * @param {string} args.title - 新的对话标题
   * @returns {Promise<any>} - 修改结果的响应
   */
  async modify_chat_title(args) {
    const { context_id: uuid, title } = args;
    const chatService = new import_chat.ChatService();
    if (chatService.update_chat_title(uuid, title)) {
      return import_public.pub.return_success(import_public.pub.lang("\u6807\u9898\u4FEE\u6539\u6210\u529F"), null);
    } else {
      return import_public.pub.return_error(import_public.pub.lang("\u6807\u9898\u4FEE\u6539\u5931\u8D25"), import_public.pub.lang("\u6307\u5B9A\u5BF9\u8BDD\u4E0D\u53EF\u7528"));
    }
  }
  /**
   * 删除指定对话历史
   * @param {Object} args - 删除对话历史所需的参数
   * @param {string} args.context_id - 对话的唯一标识符
   * @param {string} args.id - 要删除的历史记录的唯一标识符
   * @returns {Promise<any>} - 删除成功的响应
   */
  async delete_chat_history(args) {
    const { context_id: uuid, id: history_id } = args;
    const chatService = new import_chat.ChatService();
    chatService.delete_chat_history(uuid, history_id);
    return import_public.pub.return_success(import_public.pub.lang("\u5BF9\u8BDD\u5386\u53F2\u5220\u9664\u6210\u529F"), null);
  }
  /**
   * 中断生成
   * @param {Object} args - 中断生成所需的参数
   * @param {string} args.context_id - 对话的唯一标识符
   * @returns {Promise<any>} - 中断成功的响应
   */
  async stop_generate(args) {
    const { context_id: uuid } = args;
    import_tochat.ContextStatusMap.set(uuid, false);
    return import_public.pub.return_success(import_public.pub.lang("\u5DF2\u963B\u6B62\u5927\u6A21\u578B\u7EE7\u7EED\u751F\u6210\u5185\u5BB9"), null);
  }
  /**
   * 获取指定对话的最后一条历史记录
   * @param {Object} args - 获取最后一条历史记录所需的参数
   * @param {string} args.context_id - 对话的唯一标识符
   * @returns {Promise<any>} - 包含最后一条历史记录的成功响应
   */
  async get_last_chat_history(args) {
    const { context_id: uuid } = args;
    const chatService = new import_chat.ChatService();
    const data = chatService.get_last_chat_history(uuid);
    return import_public.pub.return_success(import_public.pub.lang("\u6700\u540E\u4E00\u6761\u5386\u53F2\u5BF9\u8BDD\u8BB0\u5F55\u83B7\u53D6\u6210\u529F"), data);
  }
}
ChatController.toString = () => "[class ChatController]";
var chat_default = ChatController;
