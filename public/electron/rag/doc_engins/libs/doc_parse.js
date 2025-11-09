var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var doc_parse_exports = {};
__export(doc_parse_exports, {
  parse: () => parse
});
module.exports = __toCommonJS(doc_parse_exports);
const WordExtractor = require("word-extractor");
async function parse(filename, ragName) {
  try {
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(filename);
    let result = extracted.getBody();
    return result;
  } catch (error) {
    console.error("\u89E3\u6790\u6587\u6863\u5931\u8D25:", error);
    return "";
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  parse
});
