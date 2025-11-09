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
var search_exports = {};
__export(search_exports, {
  default: () => search_default
});
module.exports = __toCommonJS(search_exports);
var import_search = require("../search_engines/search");
var import_public = require("../class/public");
class SearchController {
  async search(args) {
    let { query, searchProvider } = args;
    if (!query) {
      return import_public.pub.return_error(import_public.pub.lang("\u8BF7\u8F93\u5165\u641C\u7D22\u5185\u5BB9"));
    }
    if (!searchProvider) {
      searchProvider = "baidu";
    }
    const result = await (0, import_search.search)(query, searchProvider);
    return import_public.pub.return_success(import_public.pub.lang("\u641C\u7D22\u6210\u529F"), result);
  }
}
SearchController.toString = () => "[class SearchController]";
var search_default = SearchController;
