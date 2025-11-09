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
var md_parse_exports = {};
__export(md_parse_exports, {
  MdParser: () => MdParser,
  parse: () => parse
});
module.exports = __toCommonJS(md_parse_exports);
var import_utils = require("../utils");
var import_public = require("../../../class/public");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_node_fetch = __toESM(require("node-fetch"));
class MdParser {
  filename;
  ragName;
  baseDocName;
  imageIndex = 0;
  content = "";
  images = [];
  /**
   * 构造函数
   * @param filename Markdown文件路径
   */
  constructor(filename, ragName) {
    this.filename = filename;
    this.ragName = ragName;
    this.baseDocName = path.basename(filename, path.extname(filename));
  }
  /**
   * 读取Markdown文件内容
   * @returns 是否成功读取
   */
  readFile() {
    try {
      this.content = fs.readFileSync(this.filename, "utf8");
      return true;
    } catch (error) {
      console.error("\u8BFB\u53D6Markdown\u6587\u4EF6\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 保存图片
   * @param src 图片URL或本地路径
   * @returns 保存后的图片路径和URL
   */
  async saveImage(src) {
    try {
      const outputDir = path.join((0, import_utils.get_image_save_path)(), "md");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      let imageData;
      let ext = ".png";
      if (src.startsWith("data:")) {
        const matches = src.match(/^data:image\/([a-zA-Z0-9]+);base64,(.*)$/);
        if (!matches) return null;
        const imageType = matches[1];
        const base64Data = matches[2];
        ext = `.${imageType}`;
        imageData = Buffer.from(base64Data, "base64");
      } else if (src.startsWith("http")) {
        const response = await (0, import_node_fetch.default)(src);
        if (!response.ok) return null;
        imageData = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get("content-type");
        if (contentType) {
          const imageType = contentType.split("/")[1];
          ext = `.${imageType}`;
        }
      } else {
        const imagePath2 = path.isAbsolute(src) ? src : path.join(path.dirname(this.filename), src);
        if (!fs.existsSync(imagePath2)) return null;
        imageData = fs.readFileSync(imagePath2);
        ext = path.extname(imagePath2);
      }
      const uniqueImageName = `${import_public.pub.md5(`${this.baseDocName}_${this.imageIndex++}`)}${ext}`;
      const imagePath = path.join(outputDir, this.ragName, "images");
      const imageFile = path.resolve(imagePath, uniqueImageName);
      if (import_public.pub.file_exists(imagePath)) import_public.pub.mkdir(imagePath);
      const imageUrl = `${import_utils.IMAGE_URL_LAST}/images?r=${this.ragName}&n=${uniqueImageName}`;
      fs.writeFileSync(imageFile, imageData);
      return {
        originalSrc: src,
        newPath: imageFile,
        newUrl: imageUrl
      };
    } catch (error) {
      console.error("\u4FDD\u5B58\u56FE\u7247\u5931\u8D25:", error);
      return null;
    }
  }
  /**
   * 处理Markdown中的图片引用
   */
  async processImages() {
    if (this.ragName == "temp") return;
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    const imagesToProcess = [];
    while ((match = imageRegex.exec(this.content)) !== null) {
      const alt = match[1];
      const src = match[2];
      imagesToProcess.push({
        alt,
        src,
        fullMatch: match[0],
        index: match.index
      });
    }
    for (const img of imagesToProcess) {
      const savedImage = await this.saveImage(img.src);
      if (savedImage) {
        this.images.push(savedImage);
        const newImageMarkdown = `![${img.alt}](${savedImage.newUrl})`;
        this.content = this.content.replace(img.fullMatch, newImageMarkdown);
      }
    }
  }
  /**
   * 解析Markdown文件
   * @returns 处理后的Markdown内容
   */
  async parse() {
    if (!this.readFile()) {
      return "";
    }
    await this.processImages();
    return this.content;
  }
  /**
   * 清理资源
   */
  dispose() {
    this.content = "";
    this.images = [];
  }
}
async function parse(filename, ragName) {
  try {
    const parser = new MdParser(filename, ragName);
    const markdown = await parser.parse();
    parser.dispose();
    return markdown;
  } catch (error) {
    console.error("\u89E3\u6790Markdown\u5931\u8D25:", error);
    return "";
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MdParser,
  parse
});
