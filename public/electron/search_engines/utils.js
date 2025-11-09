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
var utils_exports = {};
__export(utils_exports, {
  FETCH_HEADERS: () => FETCH_HEADERS,
  getUrlsContent: () => getUrlsContent,
  withTimeout: () => withTimeout
});
module.exports = __toCommonJS(utils_exports);
var cheerio = __toESM(require("cheerio"));
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  "DNT": "1",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1"
};
const withTimeout = (promise, timeout) => {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeout);
  return promise.finally(() => clearTimeout(timeoutId)).catch((error) => {
    if (error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  });
};
const extractContentFromHtml = (html) => {
  try {
    let htmlObj = cheerio.load(html);
    htmlObj("script").remove();
    htmlObj("style").remove();
    htmlObj("nav,footer,aside,header,script").remove();
    const interferenceSelectors = [
      "nav",
      "footer",
      "script",
      "style",
      "aside",
      "header",
      ".advertisement",
      ".sidebar",
      ".ads",
      ".banner",
      ".copyright",
      "page-footer-content",
      "xcp-list"
    ];
    interferenceSelectors.forEach((selector) => {
      htmlObj(selector).remove();
    });
    htmlObj('[class*="Header"], [class*="Footer"], [class*="Sidebar"], [class*="Ads"], [class*="Banner"], [class*="Advertisement"], [class*="Copyright"], [class*="topToolsWrap"], [class*="w_tq_box"], [class*="footerseo"],[class*="recommend"], [class*="footer"],[class*="mod-statement"],[class*="floor"],[class*="knowledge"],[id*="footer"],[class*="nav"]').remove();
    const targetElements = htmlObj('article, [class="article"], [id="article"], [class="content_text"], [id="content_text"], [data-testid="article"],[class="detail-answer-item"]');
    let text = "";
    if (targetElements.length > 0) {
      htmlObj = cheerio.load(targetElements.html() || "");
      text = htmlObj.text().trim();
    } else {
      text = htmlObj("body").text().trim();
    }
    let result = [];
    text.split("\n").filter((line) => {
      line = line.trim();
      if (line.length > 30) {
        result.push(line);
        return true;
      }
      return false;
    });
    return result.join("\n");
  } catch (e) {
    console.error("Error extracting content from HTML:", e, cheerio);
    return "";
  }
};
const getUrlsContent = async (searchResult) => {
  console.log("Fetching URLs content...", searchResult);
  const fetchPromises = searchResult.map(async (result) => {
    if (!result.link) {
      return result;
    }
    try {
      const response = await withTimeout(fetch(result.link, { signal: new AbortController().signal }), 1e3);
      const html = await response.text();
      const content = extractContentFromHtml(html);
      if (content.length > result.content.length) {
        result.content = content;
      }
      return result;
    } catch (error) {
      console.error(`Failed to fetch content from ${result.link}:`, error);
      return result;
    }
  });
  return Promise.all(fetchPromises);
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FETCH_HEADERS,
  getUrlsContent,
  withTimeout
});
