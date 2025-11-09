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
var chat_exports = {};
__export(chat_exports, {
  ChatService: () => ChatService,
  chatService: () => chatService
});
module.exports = __toCommonJS(chat_exports);
var import_log = require("ee-core/log");
var import_public = require("../class/public");
var path = __toESM(require("path"));
var import_doc = require("../rag/doc_engins/doc");
var import_agent = require("./agent");
class ChatService {
  /**
   * 根据 UUID 获取上下文路径
   * @param {string} uuid - 对话的唯一标识符
   * @returns {string} - 上下文路径
   */
  getContextPath(uuid) {
    return import_public.pub.get_context_path(uuid);
  }
  /**
   * 根据 UUID 获取对话配置文件的完整路径
   * @param {string} uuid - 对话的唯一标识符
   * @returns {string} - 配置文件的完整路径
   */
  getConfigFilePath(uuid) {
    const contextPath = this.getContextPath(uuid);
    return path.resolve(contextPath, "config.json");
  }
  /**
   * 根据 UUID 获取对话历史记录文件的完整路径
   * @param {string} uuid - 对话的唯一标识符
   * @returns {string} - 历史记录文件的完整路径
   */
  getHistoryFilePath(uuid) {
    const contextPath = this.getContextPath(uuid);
    return path.resolve(contextPath, "history.json");
  }
  /**
   * 读取指定路径的 JSON 文件并解析为对象
   * @param {string} filePath - 文件的完整路径
   * @returns {any} - 解析后的 JSON 对象，如果文件不存在或解析失败则返回空数组
   */
  readJsonFile(filePath) {
    if (!import_public.pub.file_exists(filePath)) {
      return [];
    }
    const fileContent = import_public.pub.read_file(filePath);
    if (fileContent.length === 0) {
      return [];
    }
    try {
      return JSON.parse(fileContent);
    } catch (error) {
      import_log.logger.error(`\u89E3\u6790 JSON \u6587\u4EF6 ${filePath} \u65F6\u51FA\u9519:`, error);
      return [];
    }
  }
  /**
   * 将数据保存为 JSON 文件到指定路径
   * @param {string} filePath - 文件的完整路径
   * @param {any} data - 要保存的数据
   */
  saveJsonFile(filePath, data) {
    try {
      import_public.pub.write_file(filePath, JSON.stringify(data));
    } catch (error) {
      import_log.logger.error(`\u4FDD\u5B58 JSON \u6587\u4EF6 ${filePath} \u65F6\u51FA\u9519:`, error);
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
  create_chat(model, parameters, title = "", supplierName, agent_name) {
    import_log.logger.info("create_chat", `${model}:${parameters}`);
    const uuid = import_public.pub.uuid();
    if (title.length > 18) {
      title = title.substring(0, 18);
    }
    const contextConfig = {
      supplierName,
      model,
      title,
      parameters,
      contextPath: this.getContextPath(uuid),
      context_id: uuid,
      agent_name,
      create_time: import_public.pub.time()
    };
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
  update_chat_model(uuid, model, parameters, supplierName) {
    const contextConfigObj = this.readJsonFile(this.getConfigFilePath(uuid));
    if (Object.keys(contextConfigObj).length === 0) {
      return false;
    }
    contextConfigObj.model = model;
    contextConfigObj.parameters = parameters;
    contextConfigObj.supplierName = supplierName;
    this.saveJsonFile(this.getConfigFilePath(uuid), contextConfigObj);
    return true;
  }
  /**
   * 读取指定对话的配置信息
   * @param {string} uuid - 对话的唯一标识符
   * @returns {any} - 对话的配置信息对象，如果不存在则返回空数组
   */
  read_chat(uuid) {
    return this.readJsonFile(this.getConfigFilePath(uuid));
  }
  /**
   * 保存指定对话的配置信息
   * @param {string} uuid - 对话的唯一标识符
   * @param {object} chatConfig - 要保存的对话配置信息对象
   */
  save_chat(uuid, chatConfig) {
    this.saveJsonFile(this.getConfigFilePath(uuid), chatConfig);
  }
  /**
   * 合并聊天历史记录
   * @param {ChatHistory[]} chatHistory - 聊天历史记录数组
   * @returns {ChatHistory[]} - 合并后的聊天历史记录数组
   */
  mergeHistory(chatHistory) {
    let mergedHistory = [];
    for (let history of chatHistory) {
      if (history.compare_id == void 0) {
        mergedHistory.push(history);
        continue;
      }
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
      index = mergedHistory.findIndex((item) => item.compare_id == history.compare_id && item.role == "assistant");
      if (index > -1 && history.role == "assistant") {
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
  checkHistory(chatHistory) {
    let newChatHistory = [];
    let userNumber = 0;
    let assistantNumber = 0;
    for (let history of chatHistory) {
      if (history.role == "user") {
        if (userNumber == 0) {
          newChatHistory.push(history);
          userNumber++;
          assistantNumber = 0;
        } else {
          continue;
        }
      }
      if (history.role == "assistant") {
        if (assistantNumber == 0) {
          newChatHistory.push(history);
          assistantNumber++;
          userNumber = 0;
        } else {
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
  formatHistory(chatHistory) {
    let mergedHistory = this.mergeHistory(chatHistory);
    let newChatHistory = this.checkHistory(mergedHistory);
    return newChatHistory;
  }
  /**
   * 读取指定对话的历史记录
   * @param {string} uuid - 对话的唯一标识符
   * @returns {any[]} - 对话的历史记录数组，如果不存在则返回空数组
   */
  read_history(uuid) {
    let chatHistory = this.readJsonFile(this.getHistoryFilePath(uuid));
    return chatHistory;
  }
  /**
   * 保存指定对话的历史记录
   * @param {string} uuid - 对话的唯一标识符
   * @param {any[]} history - 要保存的历史记录数组
   */
  save_history(uuid, history) {
    this.saveJsonFile(this.getHistoryFilePath(uuid), history);
  }
  /**
   * 获取所有对话的列表，并按创建时间降序排序
   * @returns {object[]} - 包含所有对话配置信息的数组
   */
  get_chat_list() {
    const contextPath = this.getContextPath("");
    const contextDirList = import_public.pub.readdir(contextPath);
    const contextList = [];
    const ragPath = import_public.pub.get_data_path() + "/rag";
    for (const dir of contextDirList) {
      const configFilePath = path.resolve(dir, "config.json");
      const contextConfigObj = this.readJsonFile(configFilePath);
      if (Object.keys(contextConfigObj).length === 0) {
        continue;
      }
      if (contextConfigObj.create_time === void 0) {
        const stat = import_public.pub.stat(configFilePath);
        if (stat) {
          contextConfigObj.create_time = Math.floor(stat.birthtime.getTime() / 1e3);
        } else {
          contextConfigObj.create_time = 0;
        }
      }
      if (contextConfigObj.supplierName == void 0) {
        contextConfigObj.supplierName = "ollama";
      }
      if (!contextConfigObj.rag_list) {
        contextConfigObj.rag_list = [];
      }
      let rag_list = [];
      for (let ragName of contextConfigObj.rag_list) {
        const ragDir = ragPath + "/" + ragName;
        const ragConfigFilePath = path.resolve(ragDir, "config.json");
        if (!import_public.pub.file_exists(ragConfigFilePath)) {
          continue;
        }
        rag_list.push(ragName);
      }
      contextConfigObj.rag_list = rag_list;
      contextConfigObj.agent_info = null;
      if (contextConfigObj.agent_name) {
        contextConfigObj.agent_info = import_agent.agentService.get_agent_config(contextConfigObj.agent_name);
      }
      contextList.push(contextConfigObj);
    }
    contextList.sort((a, b) => b.create_time - a.create_time);
    return contextList;
  }
  /**
   * 获取指定对话的历史记录
   * @param {string} uuid - 对话的唯一标识符
   * @returns {object[]} - 对话的历史记录数组
   */
  get_chat_history(uuid) {
    return this.formatHistory(this.read_history(uuid));
  }
  /**
   * 处理文档和图片文件
   * @param chatContext <ChatContext> 聊天上下文
   * @param isVision <boolean> 是否是视觉模型
   * @param uuid <string> 对话的唯一标识符
   */
  async handle_files(chatContext, isVision) {
    let images = [];
    for (let image of chatContext.images) {
      if (isVision) {
        let base64 = import_public.pub.imageToBase64(image);
        images.push(base64);
      } else {
        let imageOcr = await (0, import_doc.parseDocument)(image, "temp", false);
        if (imageOcr.content) {
          images.push(imageOcr.content);
        }
      }
    }
    chatContext.images = images;
    let doc_files = [];
    for (let doc_file of chatContext.doc_files) {
      let parseDocBody = await (0, import_doc.parseDocument)(doc_file, "temp", false);
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
  async build_chat_history(uuid, chatContext, contextLength, isTempChat, isVision) {
    let contextList = this.checkHistory(this.read_history(uuid));
    let totalTokens = chatContext.content.length;
    for (const item of contextList) {
      totalTokens += item.content.length;
    }
    const historyMaxContextLength = Math.round(contextLength * 0.5);
    while (totalTokens > historyMaxContextLength && contextList.length > 0) {
      const firstHistory = contextList.shift();
      if (firstHistory) {
        totalTokens -= firstHistory.content.length;
      }
    }
    let historyList = contextList.map((item) => ({ role: item.role, content: item.content }));
    chatContext = await this.handle_files(chatContext, isVision);
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
  save_chat_history(uuid, history, historyRes, contextLength, regenerate_id) {
    history.id = import_public.pub.uuid();
    history.tokens = history.content ? history.content.length : 0;
    let historyList = this.checkHistory(this.read_history(uuid));
    let totalTokens = history.tokens;
    const historyMaxContextLength = Math.round(contextLength * 0.5);
    historyRes.content = import_public.pub.lang("\u610F\u5916\u4E2D\u65AD");
    if (regenerate_id) {
      let index = historyList.findIndex((item) => item.id == regenerate_id);
      if (index > -1) {
        historyList = historyList.slice(0, index);
      }
    } else {
      historyList.push(history);
    }
    historyList.push(historyRes);
    while (totalTokens > historyMaxContextLength && historyList.length > 0) {
      const firstHistory = historyList.shift();
      if (firstHistory) {
        totalTokens -= firstHistory.tokens;
      }
    }
    this.save_history(uuid, historyList);
  }
  /**
   * 修正对话的历史记录
   * @param uuid <string> 对话的唯一标识符
   * @param id <string> 要修正的历史记录的唯一标识符
   * @param history <ChatHistory> 修正后的聊天历史记录
   */
  set_chat_history(uuid, id, history) {
    let historyList = this.checkHistory(this.read_history(uuid));
    let index = historyList.findIndex((item) => item.id == id);
    historyList[index] = history;
    this.save_history(uuid, historyList);
  }
  /**
   * 删除指定对话及其相关文件
   * @param {string} uuid - 对话的唯一标识符
   */
  delete_chat(uuid) {
    const contextPath = this.getContextPath(uuid);
    try {
      import_public.pub.rmdir(contextPath);
    } catch (error) {
      import_log.logger.error(`\u5220\u9664\u5BF9\u8BDD ${uuid} \u65F6\u51FA\u9519:`, error);
    }
  }
  /**
   * 更新指定对话的标题
   * @param {string} uuid - 对话的唯一标识符
   * @param {string} title - 新的对话标题
   * @returns {boolean} - 如果更新成功返回 true，否则返回 false
   */
  update_chat_title(uuid, title) {
    const contextConfigObj = this.read_chat(uuid);
    if (Object.keys(contextConfigObj).length === 0) {
      return false;
    }
    contextConfigObj.title = title;
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
  update_chat_config(uuid, key, value) {
    const contextConfigObj = this.read_chat(uuid);
    if (Object.keys(contextConfigObj).length === 0) {
      return false;
    }
    contextConfigObj[key] = value;
    this.save_chat(uuid, contextConfigObj);
    return true;
  }
  /**
   * 删除指定对话中的某条历史记录
   * @param {string} uuid - 对话的唯一标识符
   * @param {string} id - 要删除的历史记录的唯一标识符
   */
  delete_chat_history(uuid, id) {
    const historyList = this.read_history(uuid);
    const newHistoryList = historyList.filter((item) => item.id !== id);
    this.save_history(uuid, newHistoryList);
  }
  /**
   * 获取指定对话的最后一条历史记录
   * @param {string} uuid - 对话的唯一标识符
   * @returns {object} - 最后一条历史记录对象，如果不存在则返回空对象
   */
  get_last_chat_history(uuid) {
    const historyList = this.formatHistory(this.read_history(uuid));
    return historyList[historyList.length - 1] || {};
  }
}
ChatService.toString = () => "[class ChatService]";
const chatService = new ChatService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ChatService,
  chatService
});
