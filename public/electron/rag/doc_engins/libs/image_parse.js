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
var image_parse_exports = {};
__export(image_parse_exports, {
  CONFIDENCE_THRESHOLD: () => CONFIDENCE_THRESHOLD,
  filterLowConfidenceLines: () => filterLowConfidenceLines,
  initializeWorker: () => initializeWorker,
  parse: () => parse,
  postProcessText: () => postProcessText
});
module.exports = __toCommonJS(image_parse_exports);
var import_public = require("../../../class/public");
var import_tesseract = require("tesseract.js");
const LANG = "eng+chi_sim";
const WORKER_THREADS = 3;
const CONFIDENCE_THRESHOLD = 40;
const handleError = (error, message) => {
  console.log(`${message}:`, error);
  return "";
};
const initializeWorker = async () => {
  const worker = await (0, import_tesseract.createWorker)(LANG, WORKER_THREADS, {
    langPath: import_public.pub.get_resource_path() + "/traineddata"
  });
  await worker.reinitialize(LANG, WORKER_THREADS);
  await worker.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: import_tesseract.PSM.AUTO,
    tessedit_ocr_engine_mode: "2"
  });
  return worker;
};
const postProcessText = (text) => {
  return text.replace(/\s{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
};
const filterLowConfidenceLines = (lines, threshold) => {
  return lines.filter((line) => line.confidence > threshold).map((line) => line.text).join("\n");
};
async function parse(filename, ragName) {
  try {
    const worker = await initializeWorker();
    const { data } = await worker.recognize(filename);
    let cleanText = postProcessText(data.text);
    const lines = data.blocks || [];
    const filteredText = filterLowConfidenceLines(lines, CONFIDENCE_THRESHOLD);
    if (filteredText.trim().length > 0) {
      cleanText = filteredText;
    }
    await worker.terminate();
    return cleanText;
  } catch (error) {
    return handleError(error, "image error");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CONFIDENCE_THRESHOLD,
  filterLowConfidenceLines,
  initializeWorker,
  parse,
  postProcessText
});
