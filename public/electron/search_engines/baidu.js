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
var baidu_exports = {};
__export(baidu_exports, {
  localBaiduSearch: () => localBaiduSearch
});
module.exports = __toCommonJS(baidu_exports);
var import_utils = require("./utils");
const localBaiduSearch = async (query) => {
  const TOTAL_SEARCH_RESULTS = 10;
  const url = `http://www.baidu.com/s?wd=${encodeURIComponent(query)}&tn=json&rn=${TOTAL_SEARCH_RESULTS}`;
  try {
    const response = await (0, import_utils.withTimeout)(fetch(url, { signal: new AbortController().signal, headers: import_utils.FETCH_HEADERS }), 1e4);
    const jsonRes = await response.json();
    const data = jsonRes?.feed?.entry || [];
    const searchResults = data.map((result) => {
      const title = result?.title || "";
      let link = result?.url;
      const content = result?.abs || "";
      return { title, link, content };
    });
    let resultList = [];
    for (const result of searchResults) {
      if (result.link && result.title) {
        resultList.push(result);
      }
    }
    resultList = await (0, import_utils.getUrlsContent)(resultList);
    return resultList;
  } catch (error) {
    console.error("Search request failed:", error);
    return [];
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  localBaiduSearch
});
