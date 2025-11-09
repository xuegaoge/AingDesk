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
var sogou_exports = {};
__export(sogou_exports, {
  localSogouSearch: () => localSogouSearch
});
module.exports = __toCommonJS(sogou_exports);
var cheerio = __toESM(require("cheerio"));
var import_utils = require("./utils");
const getCorrectTargeUrl = async (url) => {
  if (!url) return "";
  try {
    const res = await fetch(url, { headers: import_utils.FETCH_HEADERS });
    const $ = cheerio.load(await res.text());
    const link = $("script").text();
    const matches = link.match(/"(.*?)"/);
    return matches?.[1] || "";
  } catch (error) {
    console.error("Error getting correct target URL:", error);
    return "";
  }
};
const processSearchResultNode = async ($el) => {
  const title = $el.find(".vr-title").text().replace(/\n/g, "").trim();
  let link = $el.find(".vr-title > a").attr("href");
  [".text-lightgray", ".zan-box", ".tag-website"].forEach((cls) => {
    $el.find(cls).remove();
  });
  const content = [".star-wiki", ".fz-mid", ".attribute-centent"].map((selector) => $el.find(selector).text().trim()).join(" ");
  if (link && link.startsWith("/")) {
    link = await getCorrectTargeUrl(`https://www.sogou.com${link}`);
  }
  return { title, link: link || "", content };
};
const localSogouSearch = async (query) => {
  try {
    const url = `https://www.sogou.com/web?query=${encodeURIComponent(query)}`;
    const response = await (0, import_utils.withTimeout)(fetch(url, {
      signal: new AbortController().signal
    }), 1e4);
    const htmlString = await response.text();
    const $ = cheerio.load(htmlString);
    const $result = $("#main .results");
    const nodes = $result.children().toArray();
    const searchResultsPromises = nodes.map((node) => processSearchResultNode($(node)));
    const searchResults = await Promise.all(searchResultsPromises);
    let searchResultList = searchResults.filter((result) => result.link && result.title && result.content);
    return (0, import_utils.getUrlsContent)(searchResultList);
  } catch (error) {
    console.error("Search request failed:", error);
    return [];
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  localSogouSearch
});
