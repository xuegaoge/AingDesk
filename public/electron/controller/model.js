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
  default: () => model_default
});
module.exports = __toCommonJS(model_exports);
var import_public = require("../class/public");
var import_path = __toESM(require("path"));
var import_model = require("../service/model");
class ModelController {
  // 模型资源根路径
  modelsPath;
  constructor() {
    this.modelsPath = import_path.default.resolve(import_public.pub.get_data_path(), "models");
  }
  // 封装文件读取和 JSON 解析操作
  async readJsonFile(filePath) {
    try {
      const fileContent = import_public.pub.read_file(filePath);
      return JSON.parse(fileContent);
    } catch (error) {
      console.error(`\u8BFB\u53D6\u5E76\u89E3\u6790\u6587\u4EF6 ${filePath} \u65F6\u51FA\u9519:`, error);
      throw new Error(import_public.pub.lang("\u6587\u4EF6\u8BFB\u53D6\u6216\u89E3\u6790\u5931\u8D25"));
    }
  }
  // 封装文件写入操作
  async writeJsonFile(filePath, data) {
    try {
      const jsonData = JSON.stringify(data, null, 4);
      import_public.pub.write_file(filePath, jsonData);
    } catch (error) {
      console.error(`\u5199\u5165\u6587\u4EF6 ${filePath} \u65F6\u51FA\u9519:`, error);
      throw new Error(import_public.pub.lang("\u6587\u4EF6\u5199\u5165\u5931\u8D25"));
    }
  }
  // 统一返回结果处理
  handleResult(success, message, data) {
    if (success) {
      return import_public.pub.return_success(message, data);
    } else {
      return import_public.pub.return_error(message);
    }
  }
  // 获取供应商路径
  getSupplierPath(supplierName) {
    return import_path.default.resolve(this.modelsPath, supplierName);
  }
  // 获取供应商配置文件路径
  getSupplierConfigPath(supplierName) {
    return import_path.default.resolve(this.getSupplierPath(supplierName), "config.json");
  }
  // 获取模型文件路径
  getModelsFilePath(supplierName) {
    return import_path.default.resolve(this.getSupplierPath(supplierName), "models.json");
  }
  /**
   * 同步模型供应商模板信息
   * @returns
   */
  async sync_supplier_template() {
    const supplierTemplatesPath = import_path.default.resolve(import_public.pub.get_resource_path(), "models");
    if (!import_public.pub.file_exists(supplierTemplatesPath)) {
      return;
    }
    const supplierTemplates = import_public.pub.readdir(supplierTemplatesPath);
    const dstPath = this.modelsPath;
    if (!import_public.pub.file_exists(dstPath)) {
      import_public.pub.mkdir(dstPath);
    }
    for (const supplier of supplierTemplates) {
      let supplierName = import_path.default.basename(supplier);
      if (!supplierName) {
        continue;
      }
      let dstSupplierPath = import_path.default.resolve(dstPath, supplierName);
      if (!import_public.pub.file_exists(dstSupplierPath)) {
        import_public.pub.mkdir(dstSupplierPath);
      }
      let srcConfigFile = import_path.default.resolve(supplier, "config.json");
      let dstConfigFile = import_path.default.resolve(dstSupplierPath, "config.json");
      if (!import_public.pub.file_exists(dstConfigFile)) {
        import_public.pub.write_file(dstConfigFile, import_public.pub.read_file(srcConfigFile));
      } else {
        let srcConfigJson = await this.readJsonFile(srcConfigFile);
        let dstConfigJson = await this.readJsonFile(dstConfigFile);
        let isWrite = false;
        for (let key in srcConfigJson) {
          if (key === "status" || key === "baseUrl" || key === "apiKey") {
            continue;
          }
          if (!dstConfigJson[key] || dstConfigJson[key] !== srcConfigJson[key]) {
            isWrite = true;
            dstConfigJson[key] = srcConfigJson[key];
          }
        }
        if (isWrite) {
          await this.writeJsonFile(dstConfigFile, dstConfigJson);
        }
      }
      let srcModelsFile = import_path.default.resolve(supplier, "models.json");
      let dstModelsFile = import_path.default.resolve(dstSupplierPath, "models.json");
      if (!import_public.pub.file_exists(dstModelsFile)) {
        import_public.pub.write_file(dstModelsFile, import_public.pub.read_file(srcModelsFile));
      } else {
        let srcModels = await this.readJsonFile(srcModelsFile);
        let dstModels = await this.readJsonFile(dstModelsFile);
        let isWrite = false;
        for (let srcModel of srcModels) {
          let isExist = false;
          for (let dstModel of dstModels) {
            if (dstModel.modelName === srcModel.modelName) {
              isExist = true;
            }
          }
          if (!isExist) {
            isWrite = true;
            dstModels.push(srcModel);
          }
        }
        if (isWrite) {
          await this.writeJsonFile(dstModelsFile, dstModels);
        }
      }
      let srcEmbeddingFile = import_path.default.resolve(supplier, "embedding.json");
      let dstEmbeddingFile = import_path.default.resolve(dstSupplierPath, "embedding.json");
      if (!import_public.pub.file_exists(dstEmbeddingFile)) {
        import_public.pub.write_file(dstEmbeddingFile, import_public.pub.read_file(srcEmbeddingFile));
      } else {
        let srcEmbedding = await this.readJsonFile(srcEmbeddingFile);
        let dstEmbedding = await this.readJsonFile(dstEmbeddingFile);
        let isWrite = false;
        for (let srcEmbed of srcEmbedding) {
          let isExist = false;
          for (let dstEmbed of dstEmbedding) {
            if (dstEmbed.modelName === srcEmbed.modelName) {
              isExist = true;
            }
          }
          if (!isExist) {
            isWrite = true;
            dstEmbedding.push(srcEmbed);
          }
        }
        if (isWrite) {
          await this.writeJsonFile(dstEmbeddingFile, dstEmbedding);
        }
      }
    }
  }
  /**
   * 获取模型供应商列表
   * @param args 
   * @returns
   */
  async get_supplier_list(args) {
    await this.sync_supplier_template();
    const suppliers = import_public.pub.readdir(this.modelsPath);
    const supplierList = [];
    for (const supplier of suppliers) {
      const configFile = this.getSupplierConfigPath(supplier);
      if (import_public.pub.file_exists(configFile)) {
        try {
          const supplierInfo = await this.readJsonFile(configFile);
          supplierList.push(supplierInfo);
        } catch (error) {
          console.error(`\u83B7\u53D6\u4F9B\u5E94\u5546 ${supplier} \u4FE1\u606F\u65F6\u51FA\u9519:`, error);
        }
      }
    }
    supplierList.sort((a, b) => {
      return (a.sort || 0) - (b.sort || 0);
    });
    return this.handleResult(true, import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), supplierList);
  }
  /**
   * 获取模型列表
   * @param args 
   * @param args.supplierName - 模型供应商名称
   * @returns
   */
  async get_models_list(args) {
    const supplierFile = this.getSupplierConfigPath(args.supplierName);
    const modelsFile = this.getModelsFilePath(args.supplierName);
    let supplierInfo;
    if (import_public.pub.file_exists(supplierFile)) {
      try {
        supplierInfo = await this.readJsonFile(supplierFile);
      } catch (error) {
        console.error(`\u83B7\u53D6\u4F9B\u5E94\u5546 ${args.supplierName} \u4FE1\u606F\u65F6\u51FA\u9519:`, error);
        return this.handleResult(false, import_public.pub.lang("\u83B7\u53D6\u4F9B\u5E94\u5546\u4FE1\u606F\u5931\u8D25"));
      }
    } else {
      return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4F9B\u5E94\u5546\u4E0D\u5B58\u5728"));
    }
    let models = [];
    if (import_public.pub.file_exists(modelsFile)) {
      try {
        models = await this.readJsonFile(modelsFile);
        for (const model of models) {
          model.title = model.title || supplierInfo.supplierTitle + "/" + model.modelName;
        }
      } catch (error) {
        console.error(`\u83B7\u53D6\u6A21\u578B\u5217\u8868\u65F6\u51FA\u9519:`, error);
      }
    }
    let embeddingFile = import_path.default.resolve(this.getSupplierPath(args.supplierName), "embedding.json");
    if (import_public.pub.file_exists(embeddingFile)) {
      let embeddingModels = await this.readJsonFile(embeddingFile);
      for (let embeddingModel of embeddingModels) {
        let model = models.find((model2) => model2.modelName === embeddingModel.modelName);
        if (!model) {
          embeddingModel.title = supplierInfo.supplierTitle + "/" + embeddingModel.modelName;
          models.push(embeddingModel);
        }
      }
    }
    return this.handleResult(true, import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), models);
  }
  /**
   * 添加模型
   * @param args 
   * @param args.supplierName - 模型供应商名称
   * @param args.modelName - 模型名称
   * @param args.capability - 模型能力
   * @returns
   */
  async add_models(args) {
    try {
      const model = {
        title: args.title,
        modelName: args.modelName,
        supplierName: args.supplierName,
        capability: JSON.parse(args.capability),
        status: true
      };
      let modelsFile = this.getModelsFilePath(args.supplierName);
      if (model.capability.find((c) => c === "embedding")) {
        modelsFile = import_path.default.resolve(this.getSupplierPath(args.supplierName), "embedding.json");
      }
      if (!import_public.pub.file_exists(modelsFile)) {
        let supplierPath = import_path.default.dirname(modelsFile);
        if (!import_public.pub.file_exists(supplierPath)) {
          return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4F9B\u5E94\u5546\u4E0D\u5B58\u5728"));
        }
        import_public.pub.write_file(modelsFile, "[]");
      }
      const models = await this.readJsonFile(modelsFile);
      if (models.some((model2) => model2.modelName === args.modelName)) {
        return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u5DF2\u5B58\u5728"));
      }
      models.push(model);
      await this.writeJsonFile(modelsFile, models);
      return this.handleResult(true, import_public.pub.lang("\u6DFB\u52A0\u6210\u529F"));
    } catch (error) {
      return this.handleResult(false, error.message);
    }
  }
  /**
   * 删除模型
   * @param args 
   * @param args.supplierName - 模型供应商名称
   * @param args.modelName - 模型名称
   * @returns
   */
  async remove_models(args) {
    const modelsFile = this.getModelsFilePath(args.supplierName);
    if (!import_public.pub.file_exists(modelsFile)) {
      return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4F9B\u5E94\u5546\u4E0D\u5B58\u5728"));
    }
    try {
      const models = await this.readJsonFile(modelsFile);
      if (!models.some((model) => model.modelName === args.modelName)) {
        return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4E0D\u5B58\u5728"));
      }
      const newModels = models.filter((model) => model.modelName !== args.modelName);
      await this.writeJsonFile(modelsFile, newModels);
      return this.handleResult(true, import_public.pub.lang("\u5220\u9664\u6210\u529F"));
    } catch (error) {
      return this.handleResult(false, error.message);
    }
  }
  /**
   * 设置模型配置
   * @param args
   * @param args.supplierName - 模型供应商名称
   * @param args.baseUrl - 模型供应商接口地址
   * @param args.apiKey - 模型供应商接口密钥
   * @returns
   */
  async set_supplier_config(args) {
    const configFile = this.getSupplierConfigPath(args.supplierName);
    if (!import_public.pub.file_exists(configFile)) {
      return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4F9B\u5E94\u5546\u4E0D\u5B58\u5728"));
    }
    try {
      const supplierInfo = await this.readJsonFile(configFile);
      supplierInfo.baseUrl = args.baseUrl;
      supplierInfo.apiKey = args.apiKey;
      await this.writeJsonFile(configFile, supplierInfo);
      await this.get_online_models({ supplierName: args.supplierName });
      return this.handleResult(true, import_public.pub.lang("\u8BBE\u7F6E\u6210\u529F"));
    } catch (error) {
      return this.handleResult(false, error.message);
    }
  }
  /**
   * 检查模型供应商API配置
   * @param args
   * @param args.supplierName - 模型供应商名称
   * @param args.baseUrl - 模型供应商接口地址
   * @param args.apiKey - 模型供应商接口密钥
   * @returns
   */
  async check_supplier_config(args) {
    const configFile = this.getSupplierConfigPath(args.supplierName);
    if (!import_public.pub.file_exists(configFile)) {
      return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4F9B\u5E94\u5546\u4E0D\u5B58\u5728"));
    }
    try {
      return this.handleResult(true, import_public.pub.lang("API\u914D\u7F6E\u6B63\u786E"));
    } catch (error) {
      return this.handleResult(false, import_public.pub.lang("\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5") + ", " + error.message);
    }
  }
  /**
   * 获取模型供应商API配置
   * @param args
   * @param args.supplierName - 模型供应商名称
   * @returns
   */
  async get_supplier_config(args) {
    const configFile = this.getSupplierConfigPath(args.supplierName);
    if (!import_public.pub.file_exists(configFile)) {
      return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4F9B\u5E94\u5546\u4E0D\u5B58\u5728"));
    }
    try {
      const supplierInfo = await this.readJsonFile(configFile);
      return this.handleResult(true, import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), supplierInfo);
    } catch (error) {
      return this.handleResult(false, error.message);
    }
  }
  /**
   * 设置模型服务商状态
   * @param args
   * @param args.supplierName - 模型供应商名称
   * @param args.status - 模型供应商状态
   * @returns
   */
  async set_supplier_status(args) {
    const configFile = this.getSupplierConfigPath(args.supplierName);
    if (!import_public.pub.file_exists(configFile)) {
      return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4F9B\u5E94\u5546\u4E0D\u5B58\u5728"));
    }
    try {
      const supplierInfo = await this.readJsonFile(configFile);
      supplierInfo.status = args.status === "true";
      await this.writeJsonFile(configFile, supplierInfo);
      return this.handleResult(true, import_public.pub.lang("\u8BBE\u7F6E\u6210\u529F"));
    } catch (error) {
      return this.handleResult(false, error.message);
    }
  }
  /**
   * 设置指定模型状态
   * @param args
   * @param args.supplierName - 模型供应商名称
   * @param args.modelName - 模型名称,多个用逗号分隔
   * @param args.status - 模型状态
   * @returns
   */
  async set_model_status(args) {
    const modelsFile = this.getModelsFilePath(args.supplierName);
    if (!import_public.pub.file_exists(modelsFile)) {
      return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4F9B\u5E94\u5546\u4E0D\u5B58\u5728"));
    }
    try {
      const models = await this.readJsonFile(modelsFile);
      let modelNameList = args.modelName.split(",");
      for (let modelName of modelNameList) {
        const model = models.find((model2) => model2.modelName === modelName);
        if (!model) {
          continue;
        }
        model.status = args.status === "true";
      }
      await this.writeJsonFile(modelsFile, models);
      let embeddingFile = import_path.default.resolve(this.getSupplierPath(args.supplierName), "embedding.json");
      if (import_public.pub.file_exists(embeddingFile)) {
        let embeddingModels = await this.readJsonFile(embeddingFile);
        for (let embeddingModel of embeddingModels) {
          if (modelNameList.includes(embeddingModel.modelName)) {
            embeddingModel.status = args.status === "true";
          }
        }
        await this.writeJsonFile(embeddingFile, embeddingModels);
      }
      return this.handleResult(true, import_public.pub.lang("\u8BBE\u7F6E\u6210\u529F"));
    } catch (error) {
      return this.handleResult(false, error.message);
    }
  }
  /**
   * 添加新的模型供应商
   * @param args 
   * @param args.supplierName - 模型供应商名称(英文名)
   * @param args.supplierTitle - 模型供应商标题
   * @param args.baseUrl - 模型供应商接口地址
   * @param args.apiKey - 模型供应商接口密钥
   * @return {Promise<Result>} - 返回添加结果
   */
  async add_supplier(args) {
    const supplierPath = this.getSupplierPath(args.supplierName);
    const configFile = this.getSupplierConfigPath(args.supplierName);
    if (import_public.pub.file_exists(supplierPath) || import_public.pub.file_exists(configFile)) {
      return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4F9B\u5E94\u5546\u5DF2\u5B58\u5728"));
    }
    try {
      const supplierInfo = {
        supplierTitle: args.supplierTitle,
        supplierName: args.supplierName,
        baseUrl: args.baseUrl,
        baseUrlExample: "",
        isUseUrlExample: false,
        apiKey: args.apiKey,
        home: "",
        help: "",
        status: true,
        sort: 9999,
        icon: "data:image/gif;base64,R0lGODlhGAAYAPecALq6us/PzwcHBzExMVZWVjQ0NDc3NyoqKvf397u7uwwMDPz8/M7OzlFRUUlJSevr6/b29k5OToSEhA8PD01NTTw8PDU1NeTk5BwcHAYGBnt7eykpKV1dXVhYWCMjI+Hh4efn5wsLC6Ojo0VFRbKysqKiom5ubu/v73h4eJmZmcXFxcLCwnNzc66urrGxsXJycre3t/r6+mFhYZiYmOXl5UhISAEBAVRUVHBwcKioqEJCQmVlZaurq1tbW+zs7NXV1d3d3ePj42xsbGlpac3NzWZmZkBAQJ2dnZubm1lZWX5+fj8/P/39/Ts7Oz4+PoGBgYaGhiQkJHR0dBkZGby8vCwsLHd3d4uLiw0NDRgYGBcXF46OjicnJ09PT319ffHx8aSkpK2trbCwsCsrKwkJCczMzMjIyLi4uNzc3FNTUwgICAoKCsnJyZycnKenpwQEBHl5eVVVVWRkZIqKiuDg4FpaWiIiInZ2dkxMTHx8fB4eHjY2NkRERJOTk5GRkcTExKmpqdTU1OLi4gMDAxMTE2hoaEpKSurq6pWVlRYWFvPz8z09PQICAvDw8MPDw7m5ucbGxoeHhyAgINPT05eXl3V1db+/vygoKKamppaWlqCgoAAAAP///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH/C1hNUCBEYXRhWE1QPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS41LWMwMTQgNzkuMTUxNDgxLCAyMDEzLzAzLzEzLTEyOjA5OjE1ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjVjYzU4ZjlkLTU5MTctYWU0Ny05ZDM2LTJlZmVhNDE0M2FmOSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFNUU5RDExMUZFNTgxMUVGQTY5NkFDNUQwMjVCNUVFNSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFNUU5RDExMEZFNTgxMUVGQTY5NkFDNUQwMjVCNUVFNSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgKFdpbmRvd3MpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6NWNjNThmOWQtNTkxNy1hZTQ3LTlkMzYtMmVmZWE0MTQzYWY5IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjVjYzU4ZjlkLTU5MTctYWU0Ny05ZDM2LTJlZmVhNDE0M2FmOSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgH//v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmFgX15dXFtaWVhXVlVUU1JRUE9OTUxLSklIR0ZFRENCQUA/Pj08Ozo5ODc2NTQzMjEwLy4tLCsqKSgnJiUkIyIhIB8eHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgEAACH5BAEAAJwALAAAAAAYABgAAAj/ADkJHMgphgYymzYdSECwoUNODARsStRhSUICnBRBeEjwQ0IqBI0kTIgBBkdOeDaVGXgozSYFHTQQYLRpiEMiETZxGMgioYwFBAls8kLQxMgcnFRIHHBBIJovAxdtoiPwxSYWLTYB4NRg0yOBIDZsIrRCIIBNczhN2mSIUwKtnAbc4MQEzqYGM9RsaoKA0yYHnAptCsSJBFwDOxwlHCFwgZyEVhtwshNCoOGtMhIiMpNhAgOBggok3MIpixaBLuDqmECwi0IaAsFsMsAp5wNOMDZl4mRh7sBIGGpsUiLQz6Y2YTZBEYhiU48NOwhKOcBJxKYSBWdzqrAJKScgHjZRwyBYYQynAJtmCLSwiVOJhE5uc/qjYNAPSBLHo08hcIANTs31kBAOAyWR0BVWFHDeJvydsAljQmyCAAIDbBKCGBLY4ABslXCx4BGc3LGJC5wgsQkPAp2hwCYZMMRJEG/ssSAgmGxSg0A+bKKgQI2ssBEnHCSkSVIj6UCQBJvU0VAfCfEh3xObeOCGQ0VssoYJlORxySZRsDFQjpKcxAMWI21SBVACXaDHJpacBBYDJwglQBw4iLaJCG461MIUIznwwUMBAQA7"
      };
      import_public.pub.mkdir(supplierPath);
      await this.writeJsonFile(configFile, supplierInfo);
      const modelsFile = this.getModelsFilePath(args.supplierName);
      await this.writeJsonFile(modelsFile, []);
      await this.get_online_models({ supplierName: args.supplierName });
      return this.handleResult(true, import_public.pub.lang("\u6DFB\u52A0\u6210\u529F"));
    } catch (error) {
      return this.handleResult(false, error.message);
    }
  }
  /**
   * 删除模型供应商
   * @param args 
   * @param args.supplierName - 模型供应商名称
   * @returns
   */
  async remove_supplier(args) {
    const supplierPath = this.getSupplierPath(args.supplierName);
    if (!import_public.pub.file_exists(supplierPath)) {
      return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4F9B\u5E94\u5546\u4E0D\u5B58\u5728"));
    }
    try {
      import_public.pub.rmdir(supplierPath);
      return this.handleResult(true, import_public.pub.lang("\u5220\u9664\u6210\u529F"));
    } catch (error) {
      return this.handleResult(false, error.message);
    }
  }
  /**
   * 重新获取在线模型列表
   * @param args
   * @param args.supplierName - 模型供应商名称
   * @returns {Promise<Result>} 
   */
  async get_online_models(args) {
    let modelService = new import_model.ModelService(args.supplierName);
    let models = await modelService.getOnlineModels();
    if (!models) {
      console.error(modelService.error);
    }
    modelService.destroy();
    return this.handleResult(true, import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), models);
  }
  /**
   * 设置模型标题
   * @param args
   * @param args.supplierName - 模型供应商名称
   * @param args.modelName - 模型名称
   * @param args.title - 模型标题
   * @return {Promise<Result>} - 返回设置结果
   */
  async set_model_title(args) {
    const modelsFile = this.getModelsFilePath(args.supplierName);
    if (!import_public.pub.file_exists(modelsFile)) {
      return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4F9B\u5E94\u5546\u4E0D\u5B58\u5728"));
    }
    try {
      const models = await this.readJsonFile(modelsFile);
      const model = models.find((model2) => model2.modelName === args.modelName);
      if (!model) {
        return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4E0D\u5B58\u5728"));
      }
      model.title = args.title;
      await this.writeJsonFile(modelsFile, models);
      return this.handleResult(true, import_public.pub.lang("\u8BBE\u7F6E\u6210\u529F"));
    } catch (error) {
      return this.handleResult(false, error.message);
    }
  }
  /**
   * 修改模型能力
   * @param args
   * @param args.supplierName - 模型供应商名称
   * @param args.modelName - 模型名称
   * @param args.capability - 模型能力
   * @return {Promise<Result>} - 返回修改结果
   */
  async set_model_capability(args) {
    const modelsFile = this.getModelsFilePath(args.supplierName);
    if (!import_public.pub.file_exists(modelsFile)) {
      return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4F9B\u5E94\u5546\u4E0D\u5B58\u5728"));
    }
    try {
      const models = await this.readJsonFile(modelsFile);
      const model = models.find((model2) => model2.modelName === args.modelName);
      if (!model) {
        return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4E0D\u5B58\u5728"));
      }
      model.capability = JSON.parse(args.capability);
      await this.writeJsonFile(modelsFile, models);
      return this.handleResult(true, import_public.pub.lang("\u4FEE\u6539\u6210\u529F"));
    } catch (error) {
      return this.handleResult(false, error.message);
    }
  }
  /**
   * 修改模型信息
   * @param args
   * @param args.supplierName - 模型供应商名称
   * @param args.modelName - 模型名称
   * @param args.capability - 模型能力
   * @param args.title - 模型标题
   * @return {Promise<Result>} - 返回修改结果
   */
  async modify_model(args) {
    const modelsFile = this.getModelsFilePath(args.supplierName);
    if (!import_public.pub.file_exists(modelsFile)) {
      return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4F9B\u5E94\u5546\u4E0D\u5B58\u5728"));
    }
    try {
      const models = await this.readJsonFile(modelsFile);
      const model = models.find((model2) => model2.modelName === args.modelName);
      if (!model) {
        return this.handleResult(false, import_public.pub.lang("\u6A21\u578B\u4E0D\u5B58\u5728"));
      }
      model.capability = JSON.parse(args.capability);
      model.title = args.title;
      await this.writeJsonFile(modelsFile, models);
      return this.handleResult(true, import_public.pub.lang("\u4FEE\u6539\u6210\u529F"));
    } catch (error) {
      return this.handleResult(false, error.message);
    }
  }
}
ModelController.toString = () => "[class ModelController]";
var model_default = ModelController;
