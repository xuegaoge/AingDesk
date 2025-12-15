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
var txt_parse_exports = {};
__export(txt_parse_exports, {
  parse: () => parse
});
module.exports = __toCommonJS(txt_parse_exports);
var fs = __toESM(require("fs"));
function cleanContent(content) {
  let cleaned = content;
  cleaned = cleaned.replace(/!\[([^\]]*)\]\(https?:\/\/[^\)]+\)/g, (match, alt) => {
    return alt ? `[\u56FE\u7247:${alt}]` : "[\u56FE\u7247]";
  });
  const adPatterns = [
    /广告投放\s*[:：]?\s*请加\s*QQ\s*[:：]?\s*\d+/gi,
    /长按下方图片.*?订阅微信公众号/gi,
    /识别二维码.*?订阅/gi,
    /扫码关注.*?公众号/gi,
    /点击.*?关注我们/gi,
    /更多内容请访问\s*www\.[^\s]+/gi
  ];
  for (const pattern of adPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned.replace(/Copyright\s*©?\s*[\w\s®]+\s*\d{4}(-\d{4})?/gi, "");
  cleaned = cleaned.replace(/\*{3,}/g, "");
  cleaned = cleaned.replace(/_{3,}/g, "");
  cleaned = cleaned.replace(/={3,}/g, "---");
  cleaned = cleaned.replace(/预览时标签不可点/g, "");
  cleaned = cleaned.replace(/阅读\s*微信扫一扫/g, "");
  cleaned = cleaned.replace(/在小说阅读器中沉浸阅读/g, "");
  cleaned = cleaned.replace(/\[([^\]]+)\]\(javascript:void\\?\(0\\?\);?\)/g, "$1");
  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");
  cleaned = cleaned.split("\n").map((line) => line.trim()).join("\n");
  cleaned = cleaned.replace(/\[\s*\]\([^\)]*\)/g, "");
  return cleaned.trim();
}
async function parse(filename, ragName) {
  try {
    let body = fs.readFileSync(filename);
    let content = body.toString();
    if (filename.endsWith(".md") || filename.endsWith(".markdown")) {
      content = cleanContent(content);
    }
    return content;
  } catch (error) {
    console.error("\u89E3\u6790Markdown\u5931\u8D25:", error);
    return "";
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  parse
});
