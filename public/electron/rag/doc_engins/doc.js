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
var doc_exports = {};
__export(doc_exports, {
  DocumentParser: () => DocumentParser,
  getSupportedFileExtensions: () => getSupportedFileExtensions,
  isSupportedFileType: () => isSupportedFileType,
  parseDocument: () => parseDocument
});
module.exports = __toCommonJS(doc_exports);
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_docx_parse = require("./libs/docx_parse");
var import_doc_parse = require("./libs/doc_parse");
var import_xls_parse = require("./libs/xls_parse");
var import_pdf_parse = require("./libs/pdf_parse");
var import_csv_parse = require("./libs/csv_parse");
var import_html_parse = require("./libs/html_parse");
var import_image_parse = require("./libs/image_parse");
var import_ppt_parse = require("./libs/ppt_parse");
var import_txt_parse = require("./libs/txt_parse");
var import_http_parse = require("./libs/http_parse");
var import_utils = require("./utils");
class DocumentParser {
  /**
   * 支持的文件类型映射
   * 将文件扩展名映射到相应的解析函数
   */
  static FILE_TYPE_MAP = {
    // 文档类型
    ".docx": import_docx_parse.parse,
    ".doc": import_doc_parse.parse,
    // 表格类型
    ".xlsx": import_xls_parse.parse,
    ".xls": import_xls_parse.parse,
    ".csv": import_csv_parse.parse,
    // 演示文稿类型
    ".pptx": import_ppt_parse.parse,
    ".ppt": import_ppt_parse.parse,
    // PDF文件
    ".pdf": import_pdf_parse.parse,
    // 网页文件
    ".html": import_html_parse.parse,
    ".htm": import_html_parse.parse,
    // URL地址
    "http": import_http_parse.parse,
    "https": import_http_parse.parse,
    // 图片类型
    ".jpg": import_image_parse.parse,
    ".jpeg": import_image_parse.parse,
    ".png": import_image_parse.parse,
    ".gif": import_image_parse.parse,
    ".bmp": import_image_parse.parse,
    ".webp": import_image_parse.parse,
    ".ppm": import_image_parse.parse,
    ".tiff": import_image_parse.parse,
    // Markdown文件
    ".md": import_txt_parse.parse,
    ".markdown": import_txt_parse.parse,
    // 纯文本文件
    ".txt": import_txt_parse.parse,
    ".log": import_txt_parse.parse,
    ".text": import_txt_parse.parse,
    ".conf": import_txt_parse.parse,
    ".cfg": import_txt_parse.parse,
    ".ini": import_txt_parse.parse,
    ".json": import_txt_parse.parse
  };
  /**
   * 检查文件是否存在并可访问
   * @param filename 文件路径
   * @returns 检查结果
   */
  static async checkFile(filename) {
    try {
      await fs.promises.access(filename, fs.constants.R_OK);
      return { exists: true };
    } catch (error) {
      return {
        exists: false,
        error: `\u65E0\u6CD5\u8BBF\u95EE\u6587\u4EF6: ${error.message}`
      };
    }
  }
  /**
   * 确保输出目录存在
   */
  static ensureOutputDirectory() {
    let docSavePath = (0, import_utils.get_doc_save_path)();
    if (!fs.existsSync(docSavePath)) {
      fs.mkdirSync(docSavePath, { recursive: true });
    }
  }
  /**
   * 获取文件的扩展名（小写）
   * @param filename 文件路径
   * @returns 文件扩展名
   */
  static getFileExtension(filename) {
    if (filename.startsWith("http://") || filename.startsWith("https://")) {
      return "http";
    }
    return path.extname(filename).toLowerCase();
  }
  /**
   * 检查文件是否为支持的类型
   * @param filename 文件路径
   * @returns 是否支持
   */
  static isSupported(filename) {
    const extension = this.getFileExtension(filename);
    return extension in this.FILE_TYPE_MAP;
  }
  /**
   * 获取所有支持的文件扩展名
   * @returns 支持的文件扩展名数组
   */
  static getSupportedExtensions() {
    return Object.keys(this.FILE_TYPE_MAP);
  }
  /**
   * 解析文档
   * @param filename 文件路径
   * @returns 解析结果
   */
  static async parseDocument(filename, ragName) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      const extension = this.getFileExtension(filename);
      if (extension != "http") {
        const fileCheck = await this.checkFile(filename);
        if (!fileCheck.exists) {
          return {
            success: false,
            content: ``
          };
        }
      }
      this.ensureOutputDirectory();
      if (!this.isSupported(filename)) {
        return {
          success: false,
          content: ``
        };
      }
      const parseFunction = this.FILE_TYPE_MAP[extension];
      const content = await parseFunction(filename, ragName);
      if (!content || content.trim().length === 0) {
        return {
          success: false,
          content: ``
        };
      }
      return {
        success: true,
        content
      };
    } catch (error) {
      console.error("\u89E3\u6790\u6587\u6863\u65F6\u53D1\u751F\u9519\u8BEF:", error);
      return {
        success: false,
        content: ``,
        error: error.message || "\u672A\u77E5\u9519\u8BEF"
      };
    }
  }
  /**
   * 将解析结果保存到文件
   * @param filename 原始文件路径
   * @param content 解析内容
   * @param ragName 知识库名称
   * @param customOutputFilename 自定义输出文件名（不含扩展名）
   * @returns 保存的文件路径
   */
  static async saveToFile(filename, content, ragName, customOutputFilename) {
    try {
      const outputDir = path.join((0, import_utils.get_doc_save_path)(), ragName, "markdown");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      let outputFilename;
      if (customOutputFilename) {
        outputFilename = customOutputFilename.endsWith(".md") ? customOutputFilename : `${customOutputFilename}.md`;
      } else {
        const basename = path.basename(filename);
        outputFilename = `${basename}.md`;
      }
      const outputPath = path.join(outputDir, outputFilename);
      await fs.promises.writeFile(outputPath, content, "utf-8");
      console.log(`\u89E3\u6790\u7ED3\u679C\u5DF2\u4FDD\u5B58\u81F3: ${outputPath}`);
      return {
        parsedPath: outputPath
      };
    } catch (error) {
      console.error("\u4FDD\u5B58\u6587\u4EF6\u65F6\u53D1\u751F\u9519\u8BEF:", error);
      throw new Error(`\u4FDD\u5B58\u6587\u4EF6\u5931\u8D25: ${error.message}`);
    }
  }
}
async function parseDocument(filename, ragName = "", saveToFile = false, customOutputFilename) {
  try {
    const result = await DocumentParser.parseDocument(filename, ragName);
    let savedPath;
    if (saveToFile && result.success && ragName) {
      const saveResult = await DocumentParser.saveToFile(filename, result.content, ragName, customOutputFilename);
      savedPath = saveResult.parsedPath;
    }
    return {
      content: result.content,
      savedPath
    };
  } catch (error) {
    console.error("\u89E3\u6790\u6587\u6863\u8FC7\u7A0B\u4E2D\u51FA\u9519:", error);
    return {
      content: `# \u89E3\u6790\u5931\u8D25

\u5904\u7406\u6587\u4EF6 "${path.basename(filename)}" \u65F6\u51FA\u9519: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`
    };
  }
}
function isSupportedFileType(filename) {
  return DocumentParser.isSupported(filename);
}
function getSupportedFileExtensions() {
  return DocumentParser.getSupportedExtensions();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DocumentParser,
  getSupportedFileExtensions,
  isSupportedFileType,
  parseDocument
});
