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
var html_parse_exports = {};
__export(html_parse_exports, {
  HtmlParser: () => HtmlParser,
  parse: () => parse
});
module.exports = __toCommonJS(html_parse_exports);
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var cheerio = __toESM(require("cheerio"));
var import_public = require("../../../class/public");
class HtmlParser {
  filename;
  ragName;
  baseDocName;
  $ = null;
  /**
   * 构造函数
   * @param filename HTML文件路径
   */
  constructor(filename, ragName) {
    this.filename = filename;
    this.ragName = ragName;
    this.baseDocName = path.basename(filename, path.extname(filename));
  }
  /**
   * 初始化Cheerio对象
   * @returns 是否成功初始化
   */
  async initCheerio() {
    try {
      let html = "";
      if (this.filename.startsWith("http://") || this.filename.startsWith("https://")) {
        let httpRes = await import_public.pub.httpRequest(this.filename);
        if (httpRes.statusCode != 200) {
          return false;
        }
        html = httpRes.body;
      } else {
        html = fs.readFileSync(this.filename, "utf8");
      }
      if (!html) {
        return false;
      }
      this.$ = cheerio.load(html);
      return true;
    } catch (error) {
      console.error("\u521D\u59CB\u5316Cheerio\u5BF9\u8C61\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 清理干扰元素
   */
  cleanInterferenceElements() {
    if (!this.$) return;
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
      this.$(selector).remove();
    });
    this.$('[class*="Header"], [class*="Footer"], [class*="Sidebar"], [class*="Ads"], [class*="Banner"], [class*="Advertisement"], [class*="Copyright"], [class*="topToolsWrap"]').remove();
  }
  /**
   * 将HTML转换为Markdown
   * @returns Markdown文本
   */
  convertToMarkdown() {
    if (!this.$) return "";
    let markdown = "";
    const title = this.$("title").text().replace("icon_voice_onicon_voice", "").trim();
    if (title) {
      markdown += `# ${title}

`;
    }
    const targetElements = this.$('article, [class="article"], [id="article"], [class="content_text"], [id="content_text"], [data-testid="article"]');
    if (targetElements.length > 0) {
      this.$ = cheerio.load(targetElements.html() || "");
      this.cleanInterferenceElements();
    } else {
      this.cleanInterferenceElements();
    }
    this.$("p").each((_, element) => {
      const text = this.$(element).text().trim();
      if (text) {
        markdown += `${text}

`;
      }
    });
    this.$("div").each((_, element) => {
      const $el = this.$(element);
      const hasBlockElements = $el.find("p, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote").length > 0;
      if (!hasBlockElements) {
        const text = $el.text().trim();
        if (text) {
          markdown += `${text}

`;
        }
      }
    });
    for (let i = 1; i <= 6; i++) {
      this.$(`h${i}`).each((_, element) => {
        const text = this.$(element).text().trim();
        if (text) {
          markdown += `${"#".repeat(i)} ${text}

`;
        }
      });
    }
    this.$("ul, ol").each((_, listElement) => {
      const isList = this.$(listElement).is("ul");
      this.$("li", listElement).each((index, item) => {
        const text = this.$(item).text().trim();
        if (text) {
          markdown += isList ? `* ${text}
` : `${index + 1}. ${text}
`;
        }
      });
      markdown += "\n";
    });
    this.$("table").each((_, table) => {
      let tableMarkdown = "";
      this.$("thead tr", table).each((_2, row) => {
        const headers = this.$("th", row).map((_3, cell) => this.$(cell).text().trim()).get();
        tableMarkdown += `| ${headers.join(" | ")} |
`;
        tableMarkdown += `| ${headers.map(() => "---").join(" | ")} |
`;
      });
      this.$("tbody tr", table).each((_2, row) => {
        const cells = this.$("td", row).map((_3, cell) => this.$(cell).text().trim()).get();
        tableMarkdown += `| ${cells.join(" | ")} |
`;
      });
      markdown += tableMarkdown + "\n";
    });
    this.$("pre, code").each((_, element) => {
      const code = this.$(element).text().trim();
      if (code) {
        markdown += "```\n" + code + "\n```\n\n";
      }
    });
    return markdown.trim();
  }
  /**
   * 解析HTML文件并转换为Markdown
   * @returns Markdown文本
   */
  async parse() {
    if (!await this.initCheerio()) {
      return "";
    }
    return this.convertToMarkdown();
  }
  /**
   * 清理资源
   */
  dispose() {
    this.$ = null;
  }
}
async function parse(filename, ragName) {
  try {
    const parser = new HtmlParser(filename, ragName);
    const markdown = await parser.parse();
    parser.dispose();
    return markdown;
  } catch (error) {
    console.error("\u89E3\u6790HTML\u5931\u8D25:", error);
    return "";
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  HtmlParser,
  parse
});
