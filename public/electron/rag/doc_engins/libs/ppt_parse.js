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
var ppt_parse_exports = {};
__export(ppt_parse_exports, {
  PptxParser: () => PptxParser,
  parse: () => parse
});
module.exports = __toCommonJS(ppt_parse_exports);
var fs = __toESM(require("fs/promises"));
var path = __toESM(require("path"));
var import_child_process = require("child_process");
class PptxParser {
  // 读取PPT文件，按格式提取文本和图片，返回Markdown格式的字符串
  async ppt2md(filename) {
    try {
      const { default: JSZip } = await import("jszip");
      const fileData = await fs.readFile(filename);
      const zip = await JSZip.loadAsync(fileData);
      const presentationXml = await this.getPresentationXml(zip);
      const slideIds = this.extractSlideIds(presentationXml);
      const documentContent = [];
      for (let i = 0; i < slideIds.length; i++) {
        const slideIndex = i + 1;
        await this.processSlide(zip, slideIndex, documentContent);
      }
      const markdownText = this.formatToMarkdown(documentContent);
      return markdownText;
    } catch (error) {
      console.error("PPT\u89E3\u6790\u9519\u8BEF:", error);
      return "";
    }
  }
  // 获取presentation.xml文件内容
  async getPresentationXml(zip) {
    const presentationXml = await zip.file("ppt/presentation.xml")?.async("text");
    if (!presentationXml) {
      throw new Error("Invalid PPT file: missing presentation.xml");
    }
    return presentationXml;
  }
  // 从presentation.xml中提取幻灯片ID
  extractSlideIds(presentationXml) {
    const slideCountMatch = presentationXml.match(/<p:sldIdLst>([^]*?)<\/p:sldIdLst>/);
    return slideCountMatch ? slideCountMatch[1].match(/id="(\d+)"/g) || [] : [];
  }
  // 处理单个幻灯片
  async processSlide(zip, slideIndex, documentContent) {
    try {
      const slideXml = await zip.file(`ppt/slides/slide${slideIndex}.xml`)?.async("text");
      if (!slideXml) return;
      const paragraphs = this.extractParagraphsFromSlide(slideXml);
      if (paragraphs.length > 0) {
        documentContent.push({
          type: "text",
          content: paragraphs.join("\n"),
          slide: slideIndex
        });
      }
    } catch (err) {
      console.warn(`Error processing slide ${slideIndex}:`, err.message);
    }
  }
  // 从幻灯片XML中提取段落文本
  extractParagraphsFromSlide(slideXml) {
    const paragraphs = [];
    const paragraphElements = slideXml.match(/<a:p>.*?<\/a:p>/g) || [];
    for (const paragraph of paragraphElements) {
      const textElementsInParagraph = paragraph.match(/<a:t>(.+?)<\/a:t>/g) || [];
      if (textElementsInParagraph.length > 0) {
        const paragraphText = textElementsInParagraph.map((t) => t.replace(/<a:t>|<\/a:t>/g, "")).join(" ");
        if (paragraphText.trim()) {
          paragraphs.push(paragraphText);
        }
      }
    }
    return paragraphs;
  }
  // 格式化内容为 Markdown 文本
  formatToMarkdown(documentContent) {
    return documentContent.map((item) => {
      if (item.type === "text") {
        return `## Slide ${item.slide}
${item.content}`;
      }
      return "";
    }).join("\n\n");
  }
}
async function parse(filename, ragName) {
  let scriptPath = __filename;
  if (path.extname(scriptPath) === ".ts") {
    scriptPath = path.join(process.cwd(), "public", "electron", "rag", "doc_engins", "libs", "ppt_parse.js");
  }
  return new Promise((resolve, reject) => {
    const child = (0, import_child_process.spawn)(process.execPath, [scriptPath, filename, ragName], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
    });
    let stdoutData = "";
    let stderrData = "";
    child.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderrData += data.toString();
    });
    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`[PptParse] Process exited with code ${code}`);
        console.error(`[PptParse] Stderr: ${stderrData}`);
        resolve("");
        return;
      }
      try {
        const result = JSON.parse(stdoutData);
        if (result.success) {
          resolve(result.data);
        } else {
          console.error(`[PptParse] Worker reported error: ${result.error}`);
          resolve("");
        }
      } catch (error) {
        console.error(`[PptParse] Failed to parse worker output: ${stdoutData}`);
        resolve("");
      }
    });
    child.on("error", (error) => {
      console.error(`[PptParse] Failed to spawn worker: ${error}`);
      resolve("");
    });
  });
}
if (require.main === module) {
  (async () => {
    const filename = process.argv[2];
    const ragName = process.argv[3];
    if (!filename) {
      console.error("Usage: node ppt_parse.js <filename> [ragName]");
      process.exit(1);
    }
    try {
      const ext = path.extname(filename).toLowerCase();
      let result = "";
      if (ext === ".pptx") {
        const parser = new PptxParser();
        result = await parser.ppt2md(filename);
      } else if (ext === ".ppt") {
        result = `# \u4E0D\u652F\u6301\u7684\u6587\u4EF6\u683C\u5F0F

\u5F88\u62B1\u6B49\uFF0C\u76EE\u524D\u4EC5\u652F\u6301.pptx\u683C\u5F0F\u7684PowerPoint\u6587\u4EF6\u89E3\u6790\u3002`;
      } else {
        result = `# \u4E0D\u652F\u6301\u7684\u6587\u4EF6\u683C\u5F0F

\u6587\u4EF6 ${path.basename(filename)} \u4E0D\u662F\u6709\u6548\u7684PowerPoint\u6587\u4EF6\u3002`;
      }
      process.stdout.write(JSON.stringify({ success: true, data: result }));
    } catch (error) {
      process.stdout.write(JSON.stringify({ success: false, error: error.message || "\u672A\u77E5\u9519\u8BEF" }));
    }
  })();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PptxParser,
  parse
});
