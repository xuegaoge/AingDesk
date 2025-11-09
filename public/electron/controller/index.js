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
var controller_exports = {};
__export(controller_exports, {
  default: () => controller_default
});
module.exports = __toCommonJS(controller_exports);
var import_public = require("../class/public");
var path = __toESM(require("path"));
var import_log = require("ee-core/log");
const { dialog } = require("electron");
class IndexController {
  async get_version() {
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), { version: import_public.pub.version() });
  }
  /**
   * 获取当前语言和支持的语言列表
   * @returns {Promise<Object>} 包含语言列表和当前语言的对象，封装在成功响应中返回
   */
  async get_languages() {
    try {
      const settingsFilePath = path.resolve(import_public.pub.get_language_path(), "settings.json");
      let fileContent = import_public.pub.read_file(settingsFilePath);
      if (!fileContent) {
        fileContent = `[
                    {
                        "name": "zh",
                        "google": "zh-cn",
                        "title": "\u7B80\u4F53\u4E2D\u6587",
                        "cn": "\u7B80\u4F53\u4E2D\u6587"
                    },
                    {
                        "name": "en",
                        "google": "en",
                        "title": "English",
                        "cn": "\u82F1\u8BED"
                    }
                ]`;
      }
      const currentLanguage = import_public.pub.get_language();
      const languages = JSON.parse(fileContent);
      const data = {
        languages,
        current: currentLanguage
      };
      return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), data);
    } catch (error) {
      import_log.logger.error(import_public.pub.lang("\u83B7\u53D6\u8BED\u8A00\u5217\u8868\u65F6\u51FA\u9519:"), error);
      return import_public.pub.return_error(import_public.pub.lang("\u83B7\u53D6\u5931\u8D25"), error);
    }
  }
  /**
   * 设置当前语言
   * @param {Object} args - 参数对象
   * @param {string} args.language - 要设置的语言
   * @returns {Promise<Object>} 封装了设置成功信息的响应对象
   */
  async set_language(args) {
    try {
      const { language } = args;
      import_public.pub.C("language", language);
      import_log.logger.info(import_public.pub.lang("\u8BBE\u7F6E\u8BED\u8A00\u4E3A: {}", language));
      const cacheKeysToDelete = ["language", "languages", "lang_data", "client_lang"];
      cacheKeysToDelete.forEach((key) => import_public.pub.cache_del(key));
      return import_public.pub.return_success(import_public.pub.lang("\u8BBE\u7F6E\u6210\u529F"), null);
    } catch (error) {
      import_log.logger.error(import_public.pub.lang("\u8BBE\u7F6E\u8BED\u8A00\u65F6\u51FA\u9519:"), error);
      return import_public.pub.return_error(import_public.pub.lang("\u8BBE\u7F6E\u5931\u8D25"), error);
    }
  }
  /**
   * 获取客户端语言包
   * @returns {Promise<Object>} 包含客户端语言包内容的对象，封装在成功响应中返回
   */
  async get_client_language() {
    try {
      return this.getLanguagePack("client");
    } catch (error) {
      import_log.logger.error(import_public.pub.lang("\u83B7\u53D6\u5BA2\u6237\u7AEF\u8BED\u8A00\u5305\u65F6\u51FA\u9519:"), error);
      return import_public.pub.return_error(import_public.pub.lang("\u83B7\u53D6\u5BA2\u6237\u7AEF\u8BED\u8A00\u5305\u5931\u8D25"), error);
    }
  }
  /**
   * 获取服务端语言包
   * @returns {Promise<Object>} 包含服务端语言包内容的对象，封装在成功响应中返回
   */
  async get_server_language() {
    try {
      return this.getLanguagePack("server");
    } catch (error) {
      import_log.logger.error(import_public.pub.lang("\u83B7\u53D6\u670D\u52A1\u7AEF\u8BED\u8A00\u5305\u65F6\u51FA\u9519:"), error);
      return import_public.pub.return_error(import_public.pub.lang("\u83B7\u53D6\u670D\u52A1\u7AEF\u8BED\u8A00\u5305\u5931\u8D25"), error);
    }
  }
  /**
   * 通用的获取语言包方法
   * @param {string} type - 语言包类型，如 'client' 或 'server'
   * @returns {Promise<Object>} 包含指定类型语言包内容的对象，封装在成功响应中返回
   */
  async getLanguagePack(type) {
    const currentLanguage = import_public.pub.get_language();
    const languageFilePath = path.resolve(import_public.pub.get_language_path(), `${currentLanguage}/${type}.json`);
    const filePath = import_public.pub.is_file(languageFilePath) ? languageFilePath : path.resolve(import_public.pub.get_language_path(), `zh/${type}.json`);
    let fileContent = import_public.pub.read_file(filePath);
    if (!fileContent) {
      fileContent = "{}";
    }
    const languagePack = JSON.parse(fileContent);
    return import_public.pub.return_success(languagePack, null);
  }
  /**
   * 选择目录
   * @param args - 参数
   * @param event - 事件
   */
  async select_folder(args, event) {
    let result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: import_public.pub.lang("\u9009\u62E9\u76EE\u5F55"),
      message: import_public.pub.lang("\u8BF7\u9009\u62E9\u4E00\u4E2A\u76EE\u5F55")
    });
    if (!result.canceled) {
      return import_public.pub.return_success(import_public.pub.lang("\u9009\u62E9\u6210\u529F"), {
        folder: result.filePaths[0]
      });
    }
    return import_public.pub.return_error(import_public.pub.lang("\u672A\u9009\u62E9\u76EE\u5F55"));
  }
  /**
   * 接收前端错误日志，并写入到日志文件
   * @param args 
   * @returns 
   */
  async write_logs(args) {
    const { logs } = args;
    import_log.logger.error(logs);
    return import_public.pub.return_success(import_public.pub.lang("\u5199\u5165\u6210\u529F"));
  }
  /**
   * 获取数据保存路径
   * @returns {Promise<any>} 返回成功响应，包含数据保存路径
   */
  async get_data_save_path() {
    let savePathConfigFile = path.resolve(import_public.pub.get_system_data_path(), "save_path.json");
    if (!import_public.pub.file_exists(savePathConfigFile)) {
      let currentPath = import_public.pub.get_data_path();
      let config = {
        oldPath: "",
        currentPath,
        isMove: false,
        // 是否要移动数据到新路径
        isMoveSuccess: false,
        // 是否移动成功
        isClearOldPath: false,
        // 是否已清除旧数据
        dataSize: 0,
        // 数据大小
        copyStatus: {
          status: 0,
          // 0:未开始,1:正在复制,2:复制完成,-1:复制失败
          speed: 0,
          // 复制速度
          total: 0,
          // 总大小
          current: 0,
          // 已复制大小
          percent: 0,
          // 复制进度
          startTime: 0,
          // 复制开始时间
          endTime: 0,
          // 复制结束时间
          fileTotal: 0,
          // 复制文件总数
          fileCurrent: 0,
          // 复制文件当前数量
          message: "",
          // 复制信息
          error: ""
          // 复制错误信息
        }
      };
      import_public.pub.write_json(savePathConfigFile, config);
    }
    let savePathConfig = import_public.pub.read_json(savePathConfigFile);
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), savePathConfig);
  }
  /**
   * 设置数据保存路径
   * @param args - 参数对象
   * @returns {Promise<any>} 返回成功响应，包含设置结果
   */
  async set_data_save_path(args) {
    if (global.isOptimizeAllTable) {
      return import_public.pub.return_error(import_public.pub.lang("\u5F53\u524D\u6B63\u5728\u6267\u884C\u5411\u91CF\u6570\u636E\u4F18\u5316\u64CD\u4F5C\uFF0C\u8BF7\u7B49\u5F85\u51E0\u5206\u949F\u540E\u518D\u8BD5"));
    }
    if (global.isCopyDataPath) {
      return import_public.pub.return_error(import_public.pub.lang("\u6B63\u5728\u590D\u5236\u6570\u636E\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5"));
    }
    let { newPath } = args;
    if (!newPath) {
      return import_public.pub.return_error(import_public.pub.lang("\u8BF7\u9009\u62E9\u76EE\u5F55"));
    }
    if (!import_public.pub.file_exists(newPath)) {
      return import_public.pub.return_error(import_public.pub.lang("\u6307\u5B9A\u7684\u76EE\u5F55\u4E0D\u5B58\u5728"));
    }
    let files = import_public.pub.readdir(newPath);
    if (files.length > 0) {
      return import_public.pub.return_error(import_public.pub.lang("\u6307\u5B9A\u7684\u76EE\u5F55\u4E0D\u662F\u7A7A\u76EE\u5F55"));
    }
    let savePathConfigFile = path.resolve(import_public.pub.get_system_data_path(), "save_path.json");
    if (!import_public.pub.file_exists(savePathConfigFile)) {
      return import_public.pub.return_error(import_public.pub.lang("\u914D\u7F6E\u6587\u4EF6\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5148\u8C03\u7528\u83B7\u53D6\u6570\u636E\u4FDD\u5B58\u8DEF\u5F84\u63A5\u53E3"));
    }
    let savePathConfig = import_public.pub.read_json(savePathConfigFile);
    savePathConfig.oldPath = savePathConfig.currentPath;
    savePathConfig.currentPath = newPath;
    savePathConfig.isMove = true;
    savePathConfig.isMoveSuccess = false;
    savePathConfig.copyStatus.status = 0;
    savePathConfig.copyStatus.speed = 0;
    savePathConfig.copyStatus.total = 0;
    savePathConfig.copyStatus.current = 0;
    savePathConfig.copyStatus.percent = 0;
    savePathConfig.copyStatus.startTime = 0;
    savePathConfig.copyStatus.endTime = 0;
    savePathConfig.copyStatus.fileTotal = 0;
    savePathConfig.copyStatus.fileCurrent = 0;
    savePathConfig.copyStatus.message = "";
    savePathConfig.copyStatus.error = "";
    import_public.pub.write_json(savePathConfigFile, savePathConfig);
    global.changePath = true;
    return import_public.pub.return_success(import_public.pub.lang("\u8BBE\u7F6E\u6210\u529F,\u6B63\u5728\u590D\u5236\u6570\u636E\uFF0C\u8BF7\u7A0D\u540E\u67E5\u770B\u8FDB\u5EA6"));
  }
}
IndexController.toString = () => "[class IndexController]";
var controller_default = new IndexController();
