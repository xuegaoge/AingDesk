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
var utils_exports = {};
__export(utils_exports, {
  IMAGE_URL_LAST: () => IMAGE_URL_LAST,
  get_doc_save_path: () => get_doc_save_path,
  get_image_save_path: () => get_image_save_path
});
module.exports = __toCommonJS(utils_exports);
var import_public = require("../../class/public");
const IMAGE_URL_LAST = "{URL}/rag";
function get_image_save_path() {
  return import_public.pub.get_data_path() + "/rag/";
}
function get_doc_save_path() {
  return import_public.pub.get_data_path() + "/rag/";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  IMAGE_URL_LAST,
  get_doc_save_path,
  get_image_save_path
});
