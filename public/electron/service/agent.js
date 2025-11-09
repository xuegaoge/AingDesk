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
  AgentService: () => AgentService,
  agentService: () => agentService
});
module.exports = __toCommonJS(agent_exports);
var import_public = require("../class/public");
var import_path = __toESM(require("path"));
var import_log = require("ee-core/log");
class AgentService {
  // 读取智能体配置
  get_agent_config(agent_name) {
    let agentPath = import_path.default.resolve(import_public.pub.get_data_path(), "agent");
    let systemAgentPath = import_path.default.resolve(import_public.pub.get_resource_path(), "agent");
    let agentConfigFile = import_path.default.resolve(agentPath, agent_name + ".json");
    if (import_public.pub.file_exists(agentConfigFile)) {
      try {
        let agentConfig = import_public.pub.read_json(agentConfigFile);
        return agentConfig;
      } catch (e) {
        import_log.logger.error(import_public.pub.lang("\u8BFB\u53D6\u667A\u80FD\u4F53\u914D\u7F6E\u6587\u4EF6\u5931\u8D25"), e);
        return null;
      }
    }
    let systemAgentConfigFile = import_path.default.resolve(systemAgentPath, agent_name + ".json");
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
}
AgentService.toString = () => "[class AgentService]";
const agentService = new AgentService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgentService,
  agentService
});
