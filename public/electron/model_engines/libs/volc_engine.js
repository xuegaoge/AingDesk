var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var import_public = require("../../class/public");
var import_path = __toESM(require("path"));
const supplierName = "VolcEngine";
const supplierPath = import_path.default.resolve(import_public.pub.get_data_path(), "models", supplierName);
class VolcEngine {
  baseUrl;
  apiKey;
  configFile;
  modelFile;
  embeddingFile;
  config;
  constructor() {
    this.baseUrl = "";
    this.apiKey = "";
    this.configFile = import_path.default.resolve(supplierPath, "config.json");
    this.modelFile = import_path.default.resolve(supplierPath, "models.json");
    this.embeddingFile = import_path.default.resolve(supplierPath, "embedding.json");
    this.getConfig();
  }
  /**
   * 获取配置信息
   * @returns {Promise<any>} 包含配置信息的对象，封装在成功响应中返回
   * @memberof VolcEngine
   */
  getConfig() {
    this.config = import_public.pub.read_json(this.configFile);
    this.baseUrl = this.config.baseUrl;
    this.apiKey = this.config.apiKey;
    return this.config;
  }
  /**
   * 获取线上模型列表
   * @returns {Promise<any>} 包含模型列表的对象，封装在成功响应中返回
   * @memberof VolcEngine
   */
  async getOnlineModels() {
    let url = `${this.baseUrl}/models?Action=ListFoundationModels&Version=2024-01-01`;
    let res = await import_public.pub.httpRequest(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      }
    });
    return res;
  }
}
