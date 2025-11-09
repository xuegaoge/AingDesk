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
var so360_exports = {};
__export(so360_exports, {
  local360Search: () => local360Search
});
module.exports = __toCommonJS(so360_exports);
var cheerio = __toESM(require("cheerio"));
var import_utils = require("./utils");
const local360Search = async (query) => {
  try {
    const url = `https://www.so.com/s?q=${encodeURIComponent(query)}`;
    const response = await (0, import_utils.withTimeout)(fetch(url, {
      signal: new AbortController().signal,
      headers: import_utils.FETCH_HEADERS
    }), 1e4);
    const htmlString = await response.text();
    const $ = cheerio.load(htmlString);
    const items = $(".res-list");
    const searchResults = [];
    items.each(function(index, item) {
      var link = $(item).find("a").attr("data-mdurl");
      var title = $(item).find("a").text();
      var content = $(item).find(".res-desc").text();
      searchResults.push({ title, link, content });
    });
    let searchResultList = searchResults.filter((result) => result.link && result.title && result.content);
    return (0, import_utils.getUrlsContent)(searchResultList);
  } catch (error) {
    console.error("Search request failed:", error);
    return [];
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  local360Search
});
