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
var model_exports = {};
__export(model_exports, {
  GetSupplierEmbeddingModels: () => GetSupplierEmbeddingModels,
  GetSupplierModels: () => GetSupplierModels,
  ModelService: () => ModelService,
  getModelContextLength: () => getModelContextLength,
  getModelUsedTotal: () => getModelUsedTotal,
  getModelUsedTotalList: () => getModelUsedTotalList,
  setModelUsedTotal: () => setModelUsedTotal
});
module.exports = __toCommonJS(model_exports);
var import_openai = __toESM(require("openai"));
var import_path = __toESM(require("path"));
var import_public = require("../class/public");
class ModelService {
  baseUrl = "";
  apiKey = "";
  client = null;
  error = null;
  apiConfigPath = "";
  apiConfigFile = "";
  embeddingFile = "";
  modelsFile = "";
  apiConfig = {};
  models = [];
  supplierName;
  constructor(supplierName) {
    this.supplierName = supplierName;
    if (this.supplierName === "ollama") {
      this.baseUrl = `${import_public.pub.get_ollama_host()}/v1`;
      this.apiKey = supplierName;
    } else {
      this.readApiConfig();
    }
  }
  // 设置 API 密钥
  setApiKey(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }
  // 流式对话
  async chat(options) {
    if (!this.connect()) {
      throw new Error("Failed to connect to the API");
    }
    try {
      return await this.client.chat.completions.create(options);
    } catch (error) {
      this.error = error;
      throw error;
    }
  }
  // 嵌入模型调用
  async embedding(model, input) {
    if (!this.connect()) {
      return [];
    }
    try {
      const res = await this.client.embeddings.create({
        model,
        input,
        encoding_format: "float"
      });
      return res.data[0] || [];
    } catch (error) {
      this.error = error;
      return [];
    }
  }
  // 释放资源
  destroy() {
    this.client = null;
  }
  // 读取 API 配置
  readApiConfig() {
    this.apiConfigPath = import_path.default.resolve(import_public.pub.get_data_path(), "models", this.supplierName);
    this.apiConfigFile = import_path.default.resolve(this.apiConfigPath, "config.json");
    this.modelsFile = import_path.default.resolve(this.apiConfigPath, "models.json");
    this.embeddingFile = import_path.default.resolve(this.apiConfigPath, "embedding.json");
    if (!import_public.pub.file_exists(this.apiConfigFile)) {
      return null;
    }
    try {
      const apiConfigBody = import_public.pub.read_file(this.apiConfigFile);
      this.apiConfig = JSON.parse(apiConfigBody);
      this.setApiKey(this.apiConfig.baseUrl, this.apiConfig.apiKey);
      return this.apiConfig;
    } catch (error) {
      this.error = error;
      return null;
    }
  }
  // 读取模型列表
  readModels() {
    if (!import_public.pub.file_exists(this.modelsFile)) {
      return null;
    }
    try {
      const modelsBody = import_public.pub.read_file(this.modelsFile);
      this.models = JSON.parse(modelsBody);
      return this.models;
    } catch (error) {
      this.error = error;
      return null;
    }
  }
  // 读取嵌套模型列表
  readEmbeddingModels() {
    if (!import_public.pub.file_exists(this.embeddingFile)) {
      return null;
    }
    try {
      const modelsBody = import_public.pub.read_file(this.embeddingFile);
      this.models = JSON.parse(modelsBody);
      return this.models;
    } catch (error) {
      this.error = error;
      return null;
    }
  }
  // 保存模型列表
  saveModels(models) {
    let modelsList = this.readModels() || [];
    for (const model of models) {
      if (!modelsList.some((item) => item.modelName === model.id)) {
        const modelInfo = {
          title: "",
          supplierName: this.supplierName,
          modelName: model.id,
          capability: ["llm"],
          status: true
        };
        modelsList.push(modelInfo);
      }
    }
    const modelsBody = JSON.stringify(modelsList, null, 4);
    import_public.pub.write_file(this.modelsFile, modelsBody);
    this.models = modelsList;
    return modelsList;
  }
  // 获取线上模型列表
  async getOnlineModels() {
    if (!this.connect()) {
      return null;
    }
    try {
      const res = await this.client.models.list({
        query: {
          sub_type: "chat"
        }
      });
      const models = res.body.data;
      if (this.supplierName == "SiliconFlow") {
        await this.getOnlineEmbeddingModels();
      }
      return this.saveModels(models);
    } catch (error) {
      this.error = error;
      return null;
    }
  }
  // 保存嵌套模型列表
  saveEmbeddingModels(models) {
    let modelsList = this.readEmbeddingModels() || [];
    for (const model of models) {
      if (!modelsList.some((item) => item.modelName === model.id)) {
        const modelInfo = {
          title: "",
          supplierName: this.supplierName,
          modelName: model.id,
          capability: ["embedding"],
          status: true
        };
        modelsList.push(modelInfo);
      }
    }
    const modelsBody = JSON.stringify(modelsList, null, 4);
    import_public.pub.write_file(this.embeddingFile, modelsBody);
    this.models = modelsList;
    return modelsList;
  }
  // 获取线上嵌套模型列表
  async getOnlineEmbeddingModels() {
    if (!this.connect()) {
      return null;
    }
    try {
      const res = await this.client.models.list({
        query: {
          sub_type: "embedding"
        }
      });
      const models = res.body.data;
      return this.saveEmbeddingModels(models);
    } catch (error) {
      this.error = error;
      return null;
    }
  }
  // 连接 API
  connect() {
    if (this.client) {
      return true;
    }
    if (!this.apiKey || !this.baseUrl) {
      this.readApiConfig();
    }
    if (!this.apiKey || !this.baseUrl) {
      this.error = "API \u914D\u7F6E\u9519\u8BEF";
      return false;
    }
    try {
      this.client = new import_openai.default({
        apiKey: this.apiKey,
        baseURL: this.baseUrl
      });
      return true;
    } catch (error) {
      this.error = error;
      return false;
    }
  }
  // 测试 API 接口是否可用
  async testApi() {
    if (!this.connect()) {
      return false;
    }
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      this.error = error;
      return false;
    }
  }
}
function getModelContextLength(model) {
  const modelContextObj = {
    "qwq": 32768,
    "qwen2.5": 32768,
    "qwen": 32768,
    "deepseek": 32768,
    "phi": 16384,
    "gemma2": 8192,
    "smollm": 8192,
    "llama": 32768,
    "glm": 32768,
    "qvq": 32768
  };
  const modelStrLower = model.toLowerCase();
  for (const key in modelContextObj) {
    if (modelStrLower.includes(key)) {
      return modelContextObj[key];
    }
  }
  return 32768;
}
function isTools(model) {
  let notTools = ["deepseek-r1", "deepseek-v3", "deepseek-reasoner", "lite", "gemma2", "smollm", "llama", "glm", "qvq"];
  if (notTools.some((item) => model.toLowerCase().indexOf(item) > -1)) {
    return false;
  }
  return true;
}
function getCapability(model, capability) {
  if (capability.length == 0) {
    capability.push("llm");
  }
  const modelStrLower = model.toLowerCase();
  if (capability.includes("embedding")) {
    return capability;
  }
  if (capability.includes("llm")) {
    if (capability.includes("tools")) {
      return capability;
    }
    if (isTools(modelStrLower)) {
      capability.push("tools");
    }
    return capability;
  }
  return capability;
}
async function readSupplierModels(fileName, contextLengthFunc) {
  const supplierPath = import_path.default.resolve(import_public.pub.get_data_path(), "models");
  const suppliers = import_public.pub.readdir(supplierPath);
  const result = {};
  for (const supplier of suppliers) {
    const supplierConfigFile = import_path.default.resolve(supplier, "config.json");
    const modelConfigFile = import_path.default.resolve(supplier, fileName);
    if (!import_public.pub.file_exists(supplierConfigFile) || !import_public.pub.file_exists(modelConfigFile)) {
      continue;
    }
    try {
      const supplierConfigBody = import_public.pub.read_file(supplierConfigFile);
      const supplierConfig = JSON.parse(supplierConfigBody);
      const modelConfigBody = import_public.pub.read_file(modelConfigFile);
      const models = JSON.parse(modelConfigBody);
      if (!supplierConfig.supplierName || models.length === 0) {
        continue;
      }
      if (!supplierConfig.apiKey || !supplierConfig.baseUrl || supplierConfig.status === false) {
        continue;
      }
      const newModels = [];
      for (const model of models) {
        const modelInfo = {
          title: model.title || `${supplierConfig.supplierTitle || supplierConfig.supplierName}/${model.modelName}`,
          supplierName: supplierConfig.supplierName,
          supplierTitle: supplierConfig.supplierTitle || supplierConfig.supplierName,
          model: model.modelName,
          size: 0,
          contextLength: contextLengthFunc(model.modelName),
          capability: getCapability(model.modelName, model.capability || [])
        };
        newModels.push(modelInfo);
      }
      result[supplierConfig.supplierTitle] = newModels;
    } catch (error) {
      console.error(`Error reading models for supplier ${supplier}:`, error);
    }
  }
  return result;
}
async function GetSupplierModels() {
  return readSupplierModels("models.json", getModelContextLength);
}
async function GetSupplierEmbeddingModels() {
  return readSupplierModels("embedding.json", () => 512);
}
function setModelUsedTotal(supplierName, modelName) {
  let totalFile = import_path.default.resolve(import_public.pub.get_data_path(), "modelTotal.json");
  if (!import_public.pub.file_exists(totalFile)) {
    import_public.pub.write_file(totalFile, "{}");
  }
  let models = {};
  try {
    models = import_public.pub.read_json(totalFile);
  } catch (e) {
    import_public.pub.write_file(totalFile, "{}");
    models = {};
  }
  let key = `${supplierName}/${modelName}`;
  if (!models[key]) {
    models[key] = 0;
  }
  models[key]++;
  import_public.pub.write_json(totalFile, models);
}
function getModelUsedTotalList() {
  let totalFile = import_path.default.resolve(import_public.pub.get_data_path(), "modelTotal.json");
  if (!import_public.pub.file_exists(totalFile)) {
    return {};
  }
  try {
    let models = import_public.pub.read_json(totalFile);
    return models;
  } catch (e) {
    return {};
  }
}
function getModelUsedTotal(supplierName, modelName) {
  let totalObj = getModelUsedTotalList();
  let key = `${supplierName}/${modelName}`;
  if (!totalObj[key]) {
    return 0;
  }
  return totalObj[key];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GetSupplierEmbeddingModels,
  GetSupplierModels,
  ModelService,
  getModelContextLength,
  getModelUsedTotal,
  getModelUsedTotalList,
  setModelUsedTotal
});
