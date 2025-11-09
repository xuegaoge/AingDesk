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
var share_exports = {};
__export(share_exports, {
  default: () => share_default
});
module.exports = __toCommonJS(share_exports);
var import_public = require("../class/public");
var import_log = require("ee-core/log");
var import_path = __toESM(require("path"));
const SHARE_URL = "https://share.aingdesk.com";
class ShareController {
  /**
   * 获取指定分享配置文件的完整路径
   * @param {string} shareId - 分享ID
   * @returns {string} - 分享配置文件的完整路径
   */
  getShareConfigFilePath(shareId) {
    return import_path.default.resolve(import_public.pub.get_data_path(), "share", shareId, "config.json");
  }
  /**
   * 获取分享上下文目录的完整路径
   * @param {string} shareId - 分享ID
   * @returns {string} - 分享上下文目录的完整路径
   */
  getShareContextPath(shareId) {
    return import_path.default.resolve(import_public.pub.get_data_path(), "share", shareId, "context");
  }
  /**
   * 读取指定路径的文件内容并解析为 JSON 对象
   * @param {string} filePath - 文件的完整路径
   * @returns {object|null} - 解析后的 JSON 对象，如果文件不存在或解析失败则返回 null
   */
  readJsonFile(filePath) {
    try {
      if (!import_public.pub.is_file(filePath)) {
        return null;
      }
      const fileContent = import_public.pub.read_file(filePath);
      return JSON.parse(fileContent);
    } catch (error) {
      import_log.logger.error(`\u8BFB\u53D6\u5E76\u89E3\u6790 JSON \u6587\u4EF6 ${filePath} \u65F6\u51FA\u9519:`, error);
      return null;
    }
  }
  /**
   * 将数据保存为 JSON 文件到指定路径
   * @param {string} filePath - 文件的完整路径
   * @param {object} data - 要保存的数据
   */
  saveJsonFile(filePath, data) {
    try {
      import_public.pub.write_file(filePath, JSON.stringify(data));
    } catch (error) {
      import_log.logger.error(`\u4FDD\u5B58 JSON \u6587\u4EF6 ${filePath} \u65F6\u51FA\u9519:`, error);
    }
  }
  /**
   * 获取指定分享配置
   * @param {string} shareId - 分享ID
   * @returns {object|null} - 分享配置对象，如果不存在则返回 null
   */
  read_share_config(shareId) {
    const shareFilePath = this.getShareConfigFilePath(shareId);
    return this.readJsonFile(shareFilePath);
  }
  /**
   * 获取分享列表
   * @returns {Promise<any>} - 包含分享列表的成功响应对象
   */
  async get_share_list() {
    const sharePath = import_path.default.resolve(import_public.pub.get_data_path(), "share");
    const shareIdList = import_public.pub.readdir(sharePath);
    const shareList = [];
    const shareIdPrefix = import_public.pub.C("shareIdPrefix") || "none";
    for (const shareIdPath of shareIdList) {
      const shareId = import_path.default.basename(shareIdPath);
      const shareConfig = this.read_share_config(shareId);
      shareConfig.url = `${SHARE_URL}/${shareIdPrefix}/${shareId}`;
      if (shareConfig) {
        let historys = await this.get_share_chat_history({ share_id: shareId });
        shareConfig["chats"] = historys.message;
        if (!shareConfig.rag_list) {
          shareConfig.rag_list = [];
        }
        if (!shareConfig.supplierName) {
          shareConfig.supplierName = "ollama";
        }
        shareList.push(shareConfig);
      }
    }
    shareList.sort((a, b) => b.create_time - a.create_time);
    return import_public.pub.return_success(import_public.pub.lang("\u5206\u4EAB\u5217\u8868\u83B7\u53D6\u6210\u529F"), shareList);
  }
  /**
   * 删除指定分享
   * @param {object} args - 包含分享ID的对象
   * @param {string} args.share_id - 分享ID
   * @returns {Promise<any>} - 表示删除成功的响应对象
   */
  async remove_share(args) {
    const sharePath = import_path.default.resolve(import_public.pub.get_data_path(), "share", args.share_id);
    if (import_public.pub.file_exists(sharePath)) {
      try {
        import_public.pub.rmdir(sharePath);
      } catch (error) {
        import_log.logger.error(`\u5220\u9664\u5206\u4EAB ${args.share_id} \u65F6\u51FA\u9519:`, error);
      }
    }
    return import_public.pub.return_success(import_public.pub.lang("\u5220\u9664\u6210\u529F"));
  }
  /**
   * 创建分享
   * @param {object} args - 创建分享所需的参数对象
   * @param {string} [args.supplierName] - 供应商名称
   * @param {string} args.model - 模型名称
   * @param {string} args.parameters - 模型参数
   * @param {string} args.title - 分享标题
   * @param {string} [args.password] - 分享密码（可选）
   * @param {string} [args.rag_list] - 分享权限列表（可选）
   * @param {string} [args.agent_name] - 代理名称（可选）
   * @returns {Promise<any>} - 表示创建成功的响应对象
   */
  async create_share(args) {
    const shareId = import_public.pub.uuid();
    const sharePath = import_path.default.resolve(import_public.pub.get_data_path(), "share", shareId);
    try {
      import_public.pub.mkdir(sharePath);
    } catch (error) {
      import_log.logger.error(`\u521B\u5EFA\u5206\u4EAB\u76EE\u5F55 ${sharePath} \u65F6\u51FA\u9519:`, error);
      return import_public.pub.return_error(import_public.pub.lang("\u521B\u5EFA\u5206\u4EAB\u76EE\u5F55\u5931\u8D25"), null);
    }
    let supplierName = args.supplierName || "ollama";
    let rag_list = args.rag_list ? JSON.parse(args.rag_list) : "";
    let agent_name = args.agent_name || "";
    const shareConfig = {
      supplierName,
      rag_list,
      share_id: shareId,
      model: args.model,
      parameters: args.parameters,
      title: args.title,
      agent_name,
      password: args.password,
      mcp_servers: args.mcp_servers || [],
      create_time: import_public.pub.time()
    };
    const shareConfigPath = this.getShareConfigFilePath(shareId);
    this.saveJsonFile(shareConfigPath, shareConfig);
    let shareIdPrefix = import_public.pub.C("shareIdPrefix") || "none";
    let url = `${SHARE_URL}/${shareIdPrefix}/${shareId}`;
    return import_public.pub.return_success(import_public.pub.lang("\u521B\u5EFA\u6210\u529F"), { url, password: args.password });
  }
  /**
   * 修改分享
   * @param {object} args - 修改分享所需的参数对象
   * @param {string} args.share_id - 分享ID
   * @param {string} args.model - 模型名称
   * @param {string} args.parameters - 模型参数
   * @param {string} args.title - 分享标题
   * @param {string} [args.password] - 分享密码（可选）
   * @param {string} [args.rag_list] - 分享权限列表（可选）
   * @param {string} [args.supplierName] - 供应商名称（可选）
   * @param {string} [args.agent_name] - 代理名称（可选）
   * @returns {Promise<any>} - 表示修改成功的响应对象，如果分享不存在则返回错误响应
   */
  async modify_share(args) {
    const sharePath = import_path.default.resolve(import_public.pub.get_data_path(), "share", args.share_id);
    if (!import_public.pub.file_exists(sharePath)) {
      return import_public.pub.return_error(import_public.pub.lang("\u5206\u4EAB\u4E0D\u5B58\u5728"), null);
    }
    let supplierName = args.supplierName || "ollama";
    let rag_list = args.rag_list ? JSON.parse(args.rag_list) : "";
    let agent_name = args.agent_name || "";
    const shareConfigPath = this.getShareConfigFilePath(args.share_id);
    let shareConfig = this.read_share_config(args.share_id);
    if (!shareConfig) {
      return import_public.pub.return_error(import_public.pub.lang("\u83B7\u53D6\u5206\u4EAB\u914D\u7F6E\u5931\u8D25"), null);
    }
    shareConfig["supplierName"] = supplierName;
    shareConfig["rag_list"] = rag_list;
    shareConfig["model"] = args.model;
    shareConfig["parameters"] = args.parameters;
    shareConfig["title"] = args.title;
    shareConfig["password"] = args.password;
    shareConfig["agent_name"] = agent_name;
    shareConfig["mcp_servers"] = args.mcp_servers || [];
    this.saveJsonFile(shareConfigPath, shareConfig);
    return import_public.pub.return_success(import_public.pub.lang("\u4FEE\u6539\u6210\u529F"));
  }
  /**
   * 获取分享对话历史
   * @param {object} args - 包含分享ID的对象
   * @param {string} args.share_id - 分享ID
   * @returns {Promise<any>} - 包含分享聊天历史记录的成功响应对象
   */
  async get_share_chat_history(args) {
    const historyPath = this.getShareContextPath(args.share_id);
    const historyList = import_public.pub.readdir(historyPath);
    const historyData = [];
    for (const contextId of historyList) {
      const contextPath = import_path.default.resolve(historyPath, contextId);
      const contextConfigFile = import_path.default.resolve(contextPath, "config.json");
      const contextConfig = this.readJsonFile(contextConfigFile);
      if (contextConfig) {
        const chatHistoryFile = import_path.default.resolve(contextPath, "history.json");
        const chatHistory = this.readJsonFile(chatHistoryFile);
        contextConfig["history"] = chatHistory || [];
        historyData.push(contextConfig);
      }
    }
    return import_public.pub.return_success("\u83B7\u53D6\u6210\u529F", historyData);
  }
  /**
   * 获取分享服务状态
   * @param {object} args - 参数对象
   * @param {string} args.status - 分享服务状态 true/false
   * @returns {Promise<any>} - 包含分享服务状态的成功响应对象
   */
  async set_share_service_status(args) {
    let status = args.status;
    import_public.pub.C("shareServiceStatus", status == "true");
    return import_public.pub.return_success("\u8BBE\u7F6E\u6210\u529F");
  }
}
ShareController.toString = () => "[class ShareController]";
var share_default = ShareController;
