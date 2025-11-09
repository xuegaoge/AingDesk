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
var pdf_parse_exports = {};
__export(pdf_parse_exports, {
  PdfParser: () => PdfParser,
  parse: () => parse
});
module.exports = __toCommonJS(pdf_parse_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_public = require("../../../class/public");
var import_log = require("ee-core/log");
var import_axios = __toESM(require("axios"));
var import_child_process = require("child_process");
var import_image_parse = require("./image_parse");
const logError = (message, error) => {
  console.error(`${message}:`, error);
};
class PdfParser {
  filename;
  pdfDocument;
  /**
   * 构造函数
   * @param filename PDF文件路径
   */
  constructor(filename, ragName) {
    this.filename = filename;
  }
  /**
   * 初始化PDF.js和加载文档
   * @returns 是否成功初始化
   */
  async initPdfDocument() {
    try {
      if (!import_fs.default.existsSync(this.filename)) {
        logError(`\u6587\u4EF6\u4E0D\u5B58\u5728`, this.filename);
        return false;
      }
      const pdfjsLib = await import("pdfjs-dist");
      const data = new Uint8Array(import_fs.default.readFileSync(this.filename));
      const loadingTask = pdfjsLib.getDocument({ data });
      this.pdfDocument = await loadingTask.promise;
      return true;
    } catch (error) {
      logError("\u521D\u59CB\u5316PDF\u6587\u6863\u5931\u8D25", error);
      return false;
    }
  }
  /**
   * 解析PDF文件
   * @returns Markdown格式的内容
   */
  async parse() {
    if (!await this.initPdfDocument() || !this.pdfDocument) {
      return "";
    }
    let text = "";
    for (let i = 1; i <= this.pdfDocument.numPages; i++) {
      const page = await this.pdfDocument.getPage(i);
      const textContent = await page.getTextContent({ includeMarkedContent: true });
      let items = textContent.items;
      let isEndMarkedContent = false;
      let endMarkedContent = 0;
      let isStart = true;
      for (let item of items) {
        if (item.type == "endMarkedContent") {
          endMarkedContent++;
        }
        if (item.fontName) {
          text += item.str;
          endMarkedContent = 0;
        }
        if (endMarkedContent == 2) {
          text += "\n";
          endMarkedContent = 0;
          isEndMarkedContent = true;
        }
        if (item.hasEOL && isStart || !isEndMarkedContent && item.hasEOL) {
          text += "\n";
          isStart = false;
        }
      }
      text += "\n";
    }
    text = text.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "");
    text = text.replace(/[]/g, "");
    return text.trim();
  }
  async download_file(url, saveFile) {
    let abort = new AbortController();
    let headers = {
      "User-Agent": "AingDesk/" + import_public.pub.version()
    };
    let downloadBytes = 0;
    if (import_public.pub.file_exists(saveFile)) {
      const stats = import_public.pub.stat(saveFile);
      downloadBytes = stats.size;
    }
    if (downloadBytes > 0) {
      headers["Range"] = `bytes=${downloadBytes}-`;
    }
    try {
      const response = await (0, import_axios.default)({
        url,
        method: "GET",
        headers,
        responseType: "stream",
        signal: abort.signal,
        // 禁止使用代理
        proxy: false
      });
      const contentLength = response.headers["content-length"];
      if (contentLength && downloadBytes >= parseInt(contentLength) || response.status === 416) {
        import_log.logger.info(`\u6587\u4EF6 ${saveFile} \u5DF2\u7ECF\u4E0B\u8F7D\u5B8C\u6210\uFF0C\u8DF3\u8FC7\u4E0B\u8F7D`);
        return true;
      }
      if (response.status !== 200 && response.status !== 206) {
        import_log.logger.error(`\u4E0B\u8F7D\u6587\u4EF6\u5931\u8D25\uFF0C\u72B6\u6001\u7801: ${response.status}`);
        return false;
      }
      const writer = import_fs.default.createWriteStream(saveFile, { flags: "a" });
      response.data.pipe(writer);
      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          resolve(true);
        });
        writer.on("error", (error) => {
          reject(error);
        });
      });
    } catch (e) {
      if (e.message.indexOf("status code 416") !== -1) {
        import_log.logger.info(`\u6587\u4EF6 ${saveFile} \u5DF2\u7ECF\u4E0B\u8F7D\u5B8C\u6210\uFF0C\u8DF3\u8FC7\u4E0B\u8F7D`);
        return true;
      }
      return false;
    }
  }
  /**
   * 获取当前操作系统的路径
   * @returns {string} - 返回当前操作系统的路径
   */
  get_os_path() {
    let os_path = "win-";
    if (import_public.pub.is_mac()) {
      os_path = "darwin-";
    } else if (import_public.pub.is_linux()) {
      os_path = "linux-";
    }
    os_path += process.arch;
    return os_path;
  }
  async install_poppler() {
    let popplerFile = this.get_poppler_bin();
    if (import_public.pub.file_exists(popplerFile)) {
      return import_public.pub.return_success(import_public.pub.lang("\u5DF2\u5B89\u88C5"));
    }
    global.popplerInstall = true;
    let binPath = import_path.default.dirname(this.get_poppler_path());
    let os_path = this.get_os_path();
    let downloadUrl = `https://aingdesk.bt.cn/bin/${os_path}/poppler.zip`;
    let popplerzipFile = import_path.default.resolve(binPath, "poppler.zip");
    await this.download_file(downloadUrl, popplerzipFile).then(async () => {
      let unzip = require("unzipper");
      let unzipStream = import_fs.default.createReadStream(popplerzipFile).pipe(unzip.Extract({ path: binPath }));
      return new Promise((resolve, reject) => {
        unzipStream.on("close", () => {
          import_public.pub.delete_file(popplerzipFile);
          if (import_public.pub.file_exists(popplerFile)) {
            if (import_public.pub.is_linux() || import_public.pub.is_mac()) {
              import_fs.default.chmodSync(popplerFile, 493);
            }
            resolve(import_public.pub.lang("\u5B89\u88C5\u6210\u529F"));
          } else {
            console.log(popplerFile);
            reject("\u5B89\u88C5\u5931\u8D25");
          }
        });
        unzipStream.on("error", (error) => {
          reject(error);
        });
      });
    });
  }
  get_poppler_path() {
    let binPath = import_path.default.resolve(import_public.pub.get_user_data_path(), "bin", "poppler");
    if (!import_public.pub.file_exists(binPath)) {
      import_public.pub.mkdir(binPath);
    }
    return binPath;
  }
  get_poppler_bin() {
    if (import_public.pub.is_windows()) {
      let binPath = this.get_poppler_path();
      return import_path.default.resolve(binPath, "pdfimages.exe");
    }
    return import_public.pub.exec_shell("which pdfimages").trim();
  }
  async pdf2Image() {
    let popplerBin = this.get_poppler_bin();
    if (!import_public.pub.file_exists(popplerBin)) {
      if (!import_public.pub.is_windows()) {
        return "";
      }
      await this.install_poppler();
    }
    if (!import_public.pub.file_exists(popplerBin)) {
      console.log("popplerBin", popplerBin);
      return "";
    }
    let imageTmpPath = import_path.default.resolve(import_public.pub.get_user_data_path(), "tmp", "pdf2image", import_public.pub.md5(this.filename));
    if (!import_public.pub.file_exists(imageTmpPath)) {
      import_public.pub.mkdir(imageTmpPath);
    }
    let command = `${popplerBin} ${this.filename} ${imageTmpPath}/tmp`;
    let result = "";
    await new Promise((resolve, reject) => {
      (0, import_child_process.exec)(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`pdf to images error: ${error.message}`);
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
    let imageList = import_public.pub.readdir(imageTmpPath);
    let worker = await (0, import_image_parse.initializeWorker)();
    for (let imageFile of imageList) {
      try {
        const { data } = await worker.recognize(imageFile);
        let cleanText = (0, import_image_parse.postProcessText)(data.text);
        const lines = data.blocks || [];
        const filteredText = (0, import_image_parse.filterLowConfidenceLines)(lines, import_image_parse.CONFIDENCE_THRESHOLD);
        if (filteredText.trim().length > 0) {
          cleanText = filteredText;
        }
        result += cleanText + "\n";
      } catch (error) {
        logError("\u89E3\u6790\u56FE\u7247\u5931\u8D25", error);
      }
    }
    await worker.terminate();
    if (import_public.pub.file_exists(imageTmpPath)) {
      import_public.pub.rmdir(imageTmpPath);
    }
    return result;
  }
  /**
   * 清理资源
   */
  dispose() {
    if (this.pdfDocument) {
      this.pdfDocument.destroy();
      this.pdfDocument = null;
    }
  }
}
async function parse(filename, ragName) {
  try {
    const parser = new PdfParser(filename, ragName);
    let markdown = await parser.parse();
    if (markdown.trim() == "") {
      markdown = await parser.pdf2Image();
    }
    return markdown;
  } catch (error) {
    logError("\u89E3\u6790 PDF \u6587\u4EF6\u5931\u8D25", error);
    return "";
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PdfParser,
  parse
});
