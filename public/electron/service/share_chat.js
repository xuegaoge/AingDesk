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
var share_chat_exports = {};
__export(share_chat_exports, {
  ShareChatService: () => ShareChatService,
  shareChatService: () => shareChatService
});
module.exports = __toCommonJS(share_chat_exports);
var import_log = require("ee-core/log");
var import_public = require("../class/public");
var path = __toESM(require("path"));
class ShareChatService {
  /**
   * 获取对话的上下文路径
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @returns {string} - 上下文路径
   */
  getContextPath(shareId, contextId) {
    return import_public.pub.get_share_context_path(shareId, contextId);
  }
  /**
   * 读取指定路径的 JSON 文件并解析为对象
   * @param {string} filePath - 文件的完整路径
   * @returns {any} - 解析后的 JSON 对象，如果文件不存在或解析失败则返回空数组
   */
  readJsonFile(filePath) {
    try {
      if (!import_public.pub.file_exists(filePath)) {
        return [];
      }
      const fileContent = import_public.pub.read_file(filePath);
      if (fileContent.length === 0) {
        return [];
      }
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
   * 根据 UUID 获取对话配置文件的完整路径
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @returns {string} - 配置文件的完整路径
   */
  getConfigFilePath(shareId, contextId) {
    const contextPath = this.getContextPath(shareId, contextId);
    return path.resolve(contextPath, "config.json");
  }
  /**
   * 获取对话历史记录文件的完整路径
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @returns {string} - 历史记录文件的完整路径
   */
  getHistoryFilePath(shareId, contextId) {
    const contextPath = this.getContextPath(shareId, contextId);
    return path.resolve(contextPath, "history.json");
  }
  // 获取分享配置
  get_share_info(shareId) {
    const sharePath = this.getContextPath(shareId, "");
    const shareConfigPath = path.resolve(sharePath, "config.json");
    const shareConfig = this.readJsonFile(shareConfigPath);
    return shareConfig.length > 0 ? shareConfig : null;
  }
  /**
   * 创建一个新的聊天对话
   * @param {string} shareId - 分享ID
   * @param {string} [title=""] - 对话的标题，默认为空字符串
   * @returns {object} - 包含对话配置信息的对象
   */
  create_chat(shareId, title = "") {
    const shareInfo = this.get_share_info(shareId);
    import_log.logger.info("create_chat", { shareId, title });
    const contextId = import_public.pub.uuid();
    const trimmedTitle = title.length > 18 ? title.substring(0, 18) : title;
    const contextConfig = {
      model: shareInfo?.model,
      title: trimmedTitle,
      parameters: shareInfo?.parameters,
      contextPath: this.getContextPath(shareId, contextId),
      context_id: contextId,
      create_time: import_public.pub.time()
    };
    this.saveJsonFile(this.getConfigFilePath(shareId, contextId), contextConfig);
    return contextConfig;
  }
  /**
   * 更新指定对话的模型信息
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @param {string} model - 新的模型名称
   * @param {string} parameters - 新的模型参数
   * @param {string} supplierName - 供应商名称
   * @returns {boolean} - 如果更新成功返回 true，否则返回 false
   */
  update_chat_model(shareId, contextId, model, parameters, supplierName) {
    const contextConfigObj = this.readJsonFile(this.getConfigFilePath(shareId, contextId));
    if (Object.keys(contextConfigObj).length === 0) {
      return false;
    }
    contextConfigObj.model = model;
    contextConfigObj.parameters = parameters;
    contextConfigObj.supplierName = supplierName;
    this.saveJsonFile(this.getConfigFilePath(shareId, contextId), contextConfigObj);
    return true;
  }
  /**
   * 更新指定对话的配置项
   * @param {string} shareId - 对话的唯一标识符
   * @param {string} key - 配置项的键
   * @param {any} value - 配置项的值
   * @returns {boolean} - 如果更新成功返回 true，否则返回 false
   */
  update_chat_config(shareId, contextId, key, value) {
    const contextConfigObj = this.readJsonFile(this.getConfigFilePath(shareId, contextId));
    if (Object.keys(contextConfigObj).length === 0) {
      return false;
    }
    contextConfigObj[key] = value;
    this.saveJsonFile(this.getConfigFilePath(shareId, contextId), contextConfigObj);
    return true;
  }
  /**
   * 读取指定对话的配置信息
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @returns {any} - 对话的配置信息对象，如果不存在则返回空数组
   */
  read_chat(shareId, contextId) {
    return this.readJsonFile(this.getConfigFilePath(shareId, contextId));
  }
  /**
   * 保存指定对话的配置信息
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @param {object} chatConfig - 要保存的对话配置信息对象
   */
  save_chat(shareId, contextId, chatConfig) {
    this.saveJsonFile(this.getConfigFilePath(shareId, contextId), chatConfig);
  }
  /**
   * 读取指定对话的历史记录
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @returns {any[]} - 对话的历史记录数组，如果不存在则返回空数组
   */
  read_history(shareId, contextId) {
    return this.readJsonFile(this.getHistoryFilePath(shareId, contextId));
  }
  /**
   * 保存指定对话的历史记录
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @param {any[]} history - 要保存的历史记录数组
   */
  save_history(shareId, contextId, history) {
    this.saveJsonFile(this.getHistoryFilePath(shareId, contextId), history);
  }
  /**
   * 获取所有对话的列表，并按创建时间降序排序
   * @param {string} shareId - 分享ID
   * @returns {object[]} - 包含所有对话配置信息的数组
   */
  get_chat_list(shareId) {
    const contextPath = this.getContextPath(shareId, "");
    const contextDirList = import_public.pub.readdir(contextPath);
    const contextList = [];
    for (const dir of contextDirList) {
      const configFilePath = path.resolve(dir, "config.json");
      const contextConfigObj = this.readJsonFile(configFilePath);
      if (Object.keys(contextConfigObj).length === 0) {
        continue;
      }
      if (contextConfigObj.create_time === void 0) {
        const stat = import_public.pub.stat(configFilePath);
        contextConfigObj.create_time = stat ? Math.floor(stat.birthtime.getTime() / 1e3) : 0;
      }
      contextList.push(contextConfigObj);
    }
    contextList.sort((a, b) => b.create_time - a.create_time);
    return contextList;
  }
  /**
   * 获取指定对话的历史记录
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @returns {object[]} - 对话的历史记录数组
   */
  get_chat_history(shareId, contextId) {
    return this.read_history(shareId, contextId);
  }
  /**
   * 构造传递给模型的历史对话记录，根据上下文长度进行截断
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @param {ChatContext} chatContext - 当前的聊天上下文
   * @param {number} contextLength - 上下文的最大长度
   * @returns {object[]} - 构造后的历史对话记录数组
   */
  build_chat_history(shareId, contextId, chatContext, contextLength) {
    let contextList = this.read_history(shareId, contextId);
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
    const historyList = contextList.map((item) => ({ role: item.role, content: item.content }));
    historyList.push(chatContext);
    return historyList;
  }
  /**
   * 保存对话的历史记录，并根据上下文长度进行截断
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @param {ChatHistory} history - 要保存的聊天历史记录
   * @param {ChatHistory} historyRes - 聊天历史记录响应
   * @param {number} contextLength - 上下文的最大长度
   */
  save_chat_history(shareId, contextId, history, historyRes, contextLength, regenerate_id) {
    history.id = import_public.pub.uuid();
    history.tokens = history.content ? history.content.length : 0;
    let historyList = this.read_history(shareId, contextId);
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
    this.save_history(shareId, contextId, historyList);
  }
  /**
   * 修正对话的历史记录
   * @param shareId <string> 分享ID
   * @param contextId <string> 对话的唯一标识符
   * @param id <string> 要修正的历史记录的唯一标识符
   * @param history <ChatHistory> 修正后的聊天历史记录
   */
  set_chat_history(shareId, contextId, id, history) {
    const key = "\n</think>\n";
    if (history.content.indexOf(key) !== -1) {
      const spArr = history.content.split(key);
      history.reasoning = spArr[0] + key;
      history.content = spArr[1];
    }
    let historyList = this.read_history(shareId, contextId);
    let index = historyList.findIndex((item) => item.id == id);
    historyList[index] = history;
    this.save_history(shareId, contextId, historyList);
  }
  /**
   * 删除指定对话及其相关文件
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   */
  delete_chat(shareId, contextId) {
    const contextPath = this.getContextPath(shareId, contextId);
    try {
      import_public.pub.rmdir(contextPath);
    } catch (error) {
      import_log.logger.error(`\u5220\u9664\u5BF9\u8BDD ${contextId} \u65F6\u51FA\u9519:`, error);
    }
  }
  /**
   * 更新指定对话的标题
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @param {string} title - 新的对话标题
   * @returns {boolean} - 如果更新成功返回 true，否则返回 false
   */
  update_chat_title(shareId, contextId, title) {
    const contextConfigObj = this.read_chat(shareId, contextId);
    if (Object.keys(contextConfigObj).length === 0) {
      return false;
    }
    contextConfigObj.title = title;
    this.save_chat(shareId, contextId, contextConfigObj);
    return true;
  }
  /**
   * 删除指定对话中的某条历史记录
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @param {string} id - 要删除的历史记录的唯一标识符
   */
  delete_chat_history(shareId, contextId, id) {
    const historyList = this.read_history(shareId, contextId);
    const newHistoryList = historyList.filter((item) => item.id !== id);
    this.save_history(shareId, contextId, newHistoryList);
  }
  /**
   * 获取指定对话的最后一条历史记录
   * @param {string} shareId - 分享ID
   * @param {string} contextId - 对话的唯一标识符
   * @returns {object} - 最后一条历史记录对象，如果不存在则返回空对象
   */
  get_last_chat_history(shareId, contextId) {
    const historyList = this.read_history(shareId, contextId);
    return historyList[historyList.length - 1] || {};
  }
}
ShareChatService.toString = () => "[class ShareChatService]";
const shareChatService = new ShareChatService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ShareChatService,
  shareChatService
});
