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
var base_parser_exports = {};
__export(base_parser_exports, {
  BaseDocumentParser: () => BaseDocumentParser
});
module.exports = __toCommonJS(base_parser_exports);
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_utils = require("../utils");
class BaseDocumentParser {
  filename;
  baseDocName;
  content = "";
  imageIndex = 0;
  /**
   * 构造函数
   * @param filename 文件路径
   */
  constructor(filename) {
    this.filename = filename;
    this.baseDocName = path.basename(filename);
  }
  /**
   * 验证文件是否存在且可访问
   * @returns 是否可访问
   */
  validateFile() {
    try {
      fs.accessSync(this.filename, fs.constants.R_OK);
      return true;
    } catch (error) {
      console.error(`\u6587\u4EF6\u8BBF\u95EE\u5931\u8D25: ${this.filename}`, error);
      return false;
    }
  }
  /**
   * 确保图片保存目录存在
   * @param subDir 子目录名
   * @returns 完整的输出目录路径
   */
  ensureImageDirectory(subDir) {
    const outputDir = path.join((0, import_utils.get_image_save_path)(), subDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    return outputDir;
  }
  /**
   * 生成唯一的图片名称
   * @param prefix 前缀
   * @param ext 扩展名
   * @returns 唯一的图片名称
   */
  generateUniqueImageName(prefix, ext = ".png") {
    const timestamp = Date.now();
    return `${prefix}_${timestamp}_${this.imageIndex++}${ext}`;
  }
  /**
   * 保存图片并返回URL
   * @param imageData 图片数据
   * @param subDir 子目录名
   * @param prefix 文件名前缀
   * @param ext 文件扩展名
   * @returns 图片URL
   */
  saveImage(imageData, subDir, prefix, ext = ".png") {
    const outputDir = this.ensureImageDirectory(subDir);
    const imageName = this.generateUniqueImageName(prefix, ext);
    const imagePath = path.join(outputDir, imageName);
    fs.writeFileSync(imagePath, Buffer.from(imageData));
    return `${import_utils.IMAGE_URL_LAST}/${subDir}/${imageName}`;
  }
  /**
   * 清理资源
   */
  dispose() {
    this.content = "";
    this.imageIndex = 0;
  }
  /**
   * 转义Markdown特殊字符
   * @param text 需要转义的文本
   * @returns 转义后的文本
   */
  escapeMarkdown(text) {
    return text.replace(/[\\`*_{}\[\]()#+\-.!]/g, "\\$&").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  }
  /**
   * 格式化错误信息
   * @param error 错误对象
   * @returns 格式化的错误信息
   */
  formatError(error) {
    return `# \u89E3\u6790\u5931\u8D25

\u65E0\u6CD5\u89E3\u6790\u6587\u4EF6 ${this.baseDocName}\u3002\u9519\u8BEF: ${error?.message || "\u672A\u77E5\u9519\u8BEF"}`;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BaseDocumentParser
});
