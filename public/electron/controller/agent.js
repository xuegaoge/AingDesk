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
var agent_exports = {};
__export(agent_exports, {
  default: () => agent_default
});
module.exports = __toCommonJS(agent_exports);
var import_public = require("../class/public");
var import_log = require("ee-core/log");
var import_path = __toESM(require("path"));
class AgentController {
  agentPath = import_path.default.resolve(import_public.pub.get_data_path(), "agent");
  systemAgentPath = import_path.default.resolve(import_public.pub.get_resource_path(), "agent");
  constructor() {
    if (!import_public.pub.file_exists(this.agentPath)) {
      import_public.pub.mkdir(this.agentPath);
    }
  }
  /**
   * 读取指定知能体配置文件
   * @returns object
   */
  read_agent_config(agent_name) {
    let agentConfigFile = import_path.default.resolve(this.agentPath, agent_name + ".json");
    if (import_public.pub.file_exists(agentConfigFile)) {
      try {
        let agentConfig = import_public.pub.read_json(agentConfigFile);
        return agentConfig;
      } catch (e) {
        import_log.logger.error(import_public.pub.lang("\u8BFB\u53D6\u667A\u80FD\u4F53\u914D\u7F6E\u6587\u4EF6\u5931\u8D25"), e);
        return null;
      }
    }
    let systemAgentConfigFile = import_path.default.resolve(this.systemAgentPath, agent_name + ".json");
    if (import_public.pub.file_exists(systemAgentConfigFile)) {
      try {
        let agentConfig = import_public.pub.read_json(systemAgentConfigFile);
        return agentConfig;
      } catch (e) {
        import_log.logger.error(import_public.pub.lang("\u8BFB\u53D6\u667A\u80FD\u4F53\u914D\u7F6E\u6587\u4EF6\u5931\u8D25"), e);
        return null;
      }
    }
    return null;
  }
  /**
   * 写入指定知能体配置文件
   * @param agent_name - 智能体名称
   * @param config - 配置信息
   * @returns 
   */
  write_agent_config(agent_name, config) {
    let agentConfigFile = import_path.default.resolve(this.agentPath, agent_name + ".json");
    import_public.pub.write_json(agentConfigFile, config);
  }
  /**
   * 创建智能体
   * @param args
   * @param args.agent_type - 智能体分类
   * @param args.agent_name - 智能体名称
   * @param args.agent_title - 智能体标题
   * @param args.prompt - 智能体提示
   * @param args.icon - 智能体图标
   * @returns {Promise<any>}
   */
  async create_agent(args) {
    let { agent_type, agent_name, agent_title, prompt, icon } = args;
    if (!agent_name) {
      while (true) {
        agent_name = import_public.pub.randomString(8);
        let agentConfigFile = import_path.default.resolve(this.agentPath, agent_name + ".json");
        if (!import_public.pub.file_exists(agentConfigFile)) {
          break;
        }
      }
    }
    if (!agent_type) {
      agent_type = "default";
    }
    if (!icon) {
      icon = "";
    }
    let agentConfig = {
      agent_name,
      agent_title,
      prompt,
      msg: "",
      agent_type,
      icon,
      create_time: import_public.pub.time(),
      is_system: false
    };
    this.write_agent_config(agent_name, agentConfig);
    return import_public.pub.return_success(import_public.pub.lang("\u521B\u5EFA\u6210\u529F"));
  }
  /**
   * 获取智能体列表
   * @param args
   * @param args.agent_type - 智能体分类
   * @returns {Promise<any>}
   */
  async get_agent_list(args) {
    let agentList = [];
    let systemAgentDirList = import_public.pub.readdir(this.systemAgentPath);
    for (let agentDir of systemAgentDirList) {
      let agentName = import_path.default.basename(agentDir, ".json");
      let agentConfig = this.read_agent_config(agentName);
      if (agentConfig) {
        agentList.push(agentConfig);
      }
    }
    let agentDirList = import_public.pub.readdir(this.agentPath);
    for (let agentDir of agentDirList) {
      let agentName = import_path.default.basename(agentDir, ".json");
      let agentConfig = this.read_agent_config(agentName);
      if (agentConfig) {
        agentList.push(agentConfig);
      }
    }
    agentList = agentList.sort((a, b) => {
      return b.create_time - a.create_time;
    });
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), agentList);
  }
  /**
   * 修改智能体
   * @param args
   * @param args.agent_type - 智能体分类 
   * @param args.agent_name - 智能体名称
   * @param args.agent_title - 智能体标题
   * @param args.prompt - 智能体提示
   * @param args.icon - 智能体图标
   * @returns {Promise<any>}
   */
  async modify_agent(args) {
    let { agent_type, agent_name, agent_title, prompt, icon } = args;
    let agentConfig = this.read_agent_config(agent_name);
    if (!agentConfig) {
      return import_public.pub.return_error(import_public.pub.lang("\u667A\u80FD\u4F53\u4E0D\u5B58\u5728"));
    }
    if (agentConfig.is_system) {
      return import_public.pub.return_error(import_public.pub.lang("\u7CFB\u7EDF\u667A\u80FD\u4F53\u4E0D\u53EF\u4FEE\u6539"));
    }
    if (agent_type) {
      agentConfig.agent_type = agent_type;
    }
    agentConfig.agent_title = agent_title;
    agentConfig.prompt = prompt;
    if (icon) {
      agentConfig.icon = icon;
    }
    this.write_agent_config(agent_name, agentConfig);
    return import_public.pub.return_success(import_public.pub.lang("\u4FEE\u6539\u6210\u529F"));
  }
  /**
   * 删除智能体
   * @param args
   * @param args.agent_name - 智能体名称
   * @returns {Promise<void>}
   */
  async remove_agent(args) {
    let { agent_name } = args;
    let agentConfig = this.read_agent_config(agent_name);
    if (!agentConfig) {
      return import_public.pub.return_error(import_public.pub.lang("\u667A\u80FD\u4F53\u4E0D\u5B58\u5728"));
    }
    if (agentConfig.is_system) {
      return import_public.pub.return_error(import_public.pub.lang("\u7CFB\u7EDF\u667A\u80FD\u4F53\u4E0D\u53EF\u5220\u9664"));
    }
    let agentConfigFile = import_path.default.resolve(this.agentPath, agent_name + ".json");
    import_public.pub.delete_file(agentConfigFile);
    return import_public.pub.return_success(import_public.pub.lang("\u5220\u9664\u6210\u529F"));
  }
  /**
   * 获取指定一条智能体信息
   * @param args
   * @param args.agent_name - 智能体名称
   * @returns {Promise<void>}
   */
  async get_agent_info(args) {
    let { agent_name } = args;
    let agentConfig = this.read_agent_config(agent_name);
    if (!agentConfig) {
      return import_public.pub.return_error(import_public.pub.lang("\u667A\u80FD\u4F53\u4E0D\u5B58\u5728"));
    }
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), agentConfig);
  }
}
AgentController.toString = () => "[class AgentController]";
var agent_default = AgentController;
