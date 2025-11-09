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
var docx_parse_exports = {};
__export(docx_parse_exports, {
  DocxParser: () => DocxParser,
  parse: () => parse
});
module.exports = __toCommonJS(docx_parse_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_pizzip = __toESM(require("pizzip"));
var import_utils = require("../utils");
var import_public = require("../../../class/public");
class DocxParser {
  filename;
  baseDocName;
  ragName;
  zip = null;
  documentContent = [];
  imageIndex = 0;
  /**
   * 构造函数
   * @param filename 要解析的文件路径
   */
  constructor(filename, ragName) {
    this.filename = filename;
    this.ragName = ragName;
    this.baseDocName = import_path.default.basename(filename, import_path.default.extname(filename));
  }
  /**
   * 初始化PizZip对象
   * @returns 是否成功初始化
   */
  initZip() {
    try {
      const body = import_fs.default.readFileSync(this.filename, "binary");
      this.zip = new import_pizzip.default(body);
      return !!this.zip;
    } catch (error) {
      console.error("\u521D\u59CB\u5316zip\u5BF9\u8C61\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 将图片保存到指定目录
   * @param imageData 图片二进制数据
   * @param imageName 图片名称
   * @returns 图片保存路径和URL
   */
  saveImage(imageData, imageName) {
    try {
      const outputDir = (0, import_utils.get_image_save_path)();
      if (!import_fs.default.existsSync(outputDir)) {
        import_fs.default.mkdirSync(outputDir, { recursive: true });
      }
      const ext = import_path.default.extname(imageName);
      const uniqueImageName = `${import_public.pub.md5(`${this.baseDocName}_${this.ragName}_${this.imageIndex++}`)}${ext}`;
      const imagePath = import_path.default.join(outputDir, this.ragName, "images");
      const imageFile = import_path.default.resolve(imagePath, uniqueImageName);
      if (!import_public.pub.file_exists(imagePath)) import_public.pub.mkdir(imagePath);
      const imageUrl = `${import_utils.IMAGE_URL_LAST}/images?r=${this.ragName}&n=${uniqueImageName}`;
      import_fs.default.writeFileSync(imageFile, Buffer.from(imageData));
      return { path: imageFile, url: imageUrl };
    } catch (error) {
      console.error("\u4FDD\u5B58\u56FE\u7247\u5931\u8D25:", error);
      return { path: "", url: "" };
    }
  }
  /**
   * 解析文档XML中的图片关系
   * @param relationshipsXml 关系XML内容
   * @returns 图片ID与路径的映射
   */
  parseImageRelationships(relationshipsXml) {
    const imageRelationships = {};
    const relMatches = relationshipsXml.match(/<Relationship[^>]*>/g);
    if (!relMatches) return imageRelationships;
    relMatches.forEach((rel) => {
      const idMatch = rel.match(/Id="([^"]+)"/);
      const targetMatch = rel.match(/Target="([^"]+)"/);
      const typeMatch = rel.match(/Type="[^"]*image[^"]*"/);
      if (idMatch && targetMatch && typeMatch) {
        imageRelationships[idMatch[1]] = targetMatch[1];
      }
    });
    return imageRelationships;
  }
  /**
   * 解析段落内容
   * @param paragraph 段落XML
   * @returns 提取的文本内容
   */
  parseParagraphText(paragraph) {
    const textMatches = paragraph.match(/<w:t.*?>(.*?)<\/w:t>/g) || [];
    return textMatches.map((t) => t.replace(/<.*?>/g, "")).join("");
  }
  /**
   * 处理文档中的图片
   * @param paragraph 段落XML
   * @param imageRelationships 图片关系映射
   */
  processImages(paragraph, imageRelationships) {
    if (this.ragName == "temp") return;
    if (!this.zip) return;
    const imageMatch = paragraph.match(/<a:blip r:embed="([^"]+)"/);
    if (!imageMatch || !imageRelationships[imageMatch[1]]) return;
    const imageId = imageMatch[1];
    const imagePath = imageRelationships[imageId];
    const imageName = imagePath.split("/").pop() || "";
    const imageFile = this.zip.file(`word/${imagePath.replace(/^\.\.\//, "")}`);
    if (!imageFile) return;
    const imageData = imageFile.asUint8Array();
    const { path: savedPath, url: imageUrl } = this.saveImage(imageData, imageName);
    if (imageUrl) {
      this.documentContent.push({
        type: "image",
        name: imageName,
        path: savedPath,
        url: imageUrl,
        data: imageData
      });
    }
  }
  /**
   * 解析文档并生成结果
   * @returns 解析结果
   */
  async parse() {
    if (!this.initZip() || !this.zip) {
      return { plainText: "", documentContent: [] };
    }
    const documentXmlFile = this.zip.file("word/document.xml");
    if (!documentXmlFile) {
      return { plainText: "", documentContent: [] };
    }
    const documentXml = documentXmlFile.asText();
    const relationshipsXmlFile = this.zip.file("word/_rels/document.xml.rels");
    const relationshipsXml = relationshipsXmlFile?.asText() || "";
    const imageRelationships = this.parseImageRelationships(relationshipsXml);
    this.documentContent = [];
    const paragraphs = documentXml.match(/<w:p.*?<\/w:p>/g) || [];
    for (const paragraph of paragraphs) {
      this.processImages(paragraph, imageRelationships);
      const textContent = this.parseParagraphText(paragraph);
      if (textContent.trim()) {
        this.documentContent.push({
          type: "text",
          content: textContent
        });
      }
    }
    const plainText = this.documentContent.map((item) => {
      if (item.type === "text") {
        return item.content;
      } else if (item.url) {
        return `![IMG](${item.url})`;
      }
      return "";
    }).filter(Boolean).join("\n\n");
    return {
      plainText,
      documentContent: this.documentContent
    };
  }
  /**
   * 清理资源
   */
  dispose() {
    this.zip = null;
    this.documentContent = [];
  }
}
async function parse(filename, ragName) {
  try {
    const parser = new DocxParser(filename, ragName);
    const result = await parser.parse();
    parser.dispose();
    return result.plainText;
  } catch (error) {
    console.error("\u89E3\u6790\u6587\u6863\u5931\u8D25:", error);
    return "";
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DocxParser,
  parse
});
