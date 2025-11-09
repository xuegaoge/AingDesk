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
var duckduckgo_exports = {};
__export(duckduckgo_exports, {
  localDuckDuckGoSearch: () => localDuckDuckGoSearch
});
module.exports = __toCommonJS(duckduckgo_exports);
var cheerio = __toESM(require("cheerio"));
var import_utils = require("./utils");
const buildDuckDuckGoUrl = (query) => {
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
};
const processLink = (link) => {
  if (!link) {
    return "";
  }
  return decodeURIComponent(link.replace("//duckduckgo.com/l/?uddg=", "").replace(/&rut=.*/, ""));
};
const localDuckDuckGoSearch = async (query) => {
  try {
    const url = buildDuckDuckGoUrl(query);
    const response = await (0, import_utils.withTimeout)(fetch(url, { signal: new AbortController().signal, headers: import_utils.FETCH_HEADERS }), 1e4);
    const htmlString = await response.text();
    const $ = cheerio.load(htmlString);
    const searchResults = Array.from($("div.results_links_deep")).map((result) => {
      const title = $(result).find("a.result__a").text();
      const link = processLink($(result).find("a.result__snippet").attr("href"));
      const content = $(result).find("a.result__snippet").text();
      return { title, link, content };
    });
    return (0, import_utils.getUrlsContent)(searchResults);
  } catch (error) {
    console.error("Search request failed:", error);
    return [];
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  localDuckDuckGoSearch
});
