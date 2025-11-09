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
var csv_parse_exports = {};
__export(csv_parse_exports, {
  CsvParser: () => CsvParser,
  parse: () => parse
});
module.exports = __toCommonJS(csv_parse_exports);
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
class CsvParser {
  filename;
  ragName;
  baseDocName;
  content = "";
  records = [];
  headers = [];
  statistics = null;
  /**
   * 构造函数
   * @param filename CSV文件路径
   */
  constructor(filename, ragName) {
    this.filename = filename;
    this.ragName = ragName;
    this.baseDocName = path.basename(filename);
  }
  /**
   * 读取CSV文件内容
   * @returns 是否读取成功
   */
  readFile() {
    try {
      let content;
      const encodings = ["utf8", "gbk", "gb2312", "latin1"];
      const buffer = fs.readFileSync(this.filename);
      if (buffer.length >= 3 && buffer[0] === 239 && buffer[1] === 187 && buffer[2] === 191) {
        content = buffer.toString("utf8").slice(1);
      } else {
        for (const encoding of encodings) {
          try {
            content = buffer.toString(encoding);
            if (!content.includes("\uFFFD") && !content.includes("\u951F\uFFFD") && !content.includes("\u9229\uFFFD")) {
              break;
            }
          } catch (e) {
            console.warn(`\u5C1D\u8BD5\u4F7F\u7528 ${encoding} \u7F16\u7801\u5931\u8D25`);
          }
        }
      }
      if (!content) {
        throw new Error("\u65E0\u6CD5\u68C0\u6D4B\u5230\u6B63\u786E\u7684\u6587\u4EF6\u7F16\u7801");
      }
      this.content = content;
      return true;
    } catch (error) {
      console.error("\u8BFB\u53D6CSV\u6587\u4EF6\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 解析CSV内容
   */
  parseContent() {
    try {
      if (!this.content || this.content.trim() === "") {
        console.warn("CSV\u5185\u5BB9\u4E3A\u7A7A");
        this.records = [];
        this.headers = [];
        return;
      }
      const parseCSV = (text) => {
        const result = [];
        let row = [];
        let inQuotes = false;
        let currentValue = "";
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChar = text[i + 1];
          if (char === '"') {
            if (!inQuotes) {
              inQuotes = true;
            } else if (nextChar === '"') {
              currentValue += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else if (char === "," && !inQuotes) {
            row.push(currentValue);
            currentValue = "";
          } else if ((char === "\n" || char === "\r" && nextChar === "\n") && !inQuotes) {
            row.push(currentValue);
            result.push(row);
            row = [];
            currentValue = "";
            if (char === "\r") i++;
          } else {
            if (char !== "\r") {
              currentValue += char;
            }
          }
        }
        if (currentValue !== "" || row.length > 0) {
          row.push(currentValue);
          result.push(row);
        }
        return result;
      };
      const parsedData = parseCSV(this.content);
      if (parsedData.length <= 1) {
        this.records = [];
        this.headers = [];
        return;
      }
      this.headers = parsedData[0].map((header) => {
        return header.replace(/^\uFEFF/, "").trim();
      });
      this.records = [];
      for (let i = 1; i < parsedData.length; i++) {
        const values = parsedData[i];
        if (values.length === 0 || values.length === 1 && !values[0]) continue;
        const row = {};
        for (let j = 0; j < this.headers.length; j++) {
          const headerName = this.headers[j] ? this.headers[j] : `Column${j + 1}`;
          row[headerName] = j < values.length ? values[j] : "";
        }
        this.records.push(row);
      }
    } catch (error) {
      console.error("\u89E3\u6790CSV\u5185\u5BB9\u5931\u8D25:", error);
      this.records = [];
      this.headers = [];
    }
  }
  /**
   * 计算CSV统计信息
   */
  calculateStatistics() {
    const uniqueValues = /* @__PURE__ */ new Map();
    let emptyRows = 0;
    this.headers.forEach((header) => {
      uniqueValues.set(header, /* @__PURE__ */ new Set());
    });
    for (const record of this.records) {
      let isEmpty = true;
      for (const header of this.headers) {
        const value = record[header];
        if (value !== void 0 && value !== null && value !== "") {
          isEmpty = false;
          uniqueValues.get(header)?.add(value);
        }
      }
      if (isEmpty) {
        emptyRows++;
      }
    }
    this.statistics = {
      rowCount: this.records.length,
      columnCount: this.headers.length,
      headers: this.headers,
      emptyRows,
      uniqueValues
    };
  }
  /**
   * 转义单元格内容以适应Markdown表格格式
   * @param value 单元格值
   * @returns 转义后的字符串
   */
  escapeCellValue(value) {
    if (value === void 0 || value === null) {
      return "";
    }
    return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  }
  /**
   * 生成Markdown表格表示
   * @returns Markdown表格字符串
   */
  generateTable() {
    if (!this.headers.length) {
      return "*CSV\u6587\u4EF6\u4E0D\u5305\u542B\u6709\u6548\u6570\u636E*";
    }
    let table = "| " + this.headers.map((h) => this.escapeCellValue(h)).join(" | ") + " |\n";
    table += "| " + this.headers.map(() => "---").join(" | ") + " |\n";
    for (const record of this.records) {
      const row = this.headers.map((header) => this.escapeCellValue(record[header]));
      table += "| " + row.join(" | ") + " |\n";
    }
    return table;
  }
  /**
   * 生成数据摘要
   * @returns Markdown格式的摘要信息
   */
  generateSummary() {
    if (!this.statistics) {
      return "";
    }
    let summary = `## \u6587\u4EF6\u6458\u8981

`;
    summary += `- **\u6587\u4EF6\u540D**: ${this.baseDocName}
`;
    summary += `- **\u603B\u884C\u6570**: ${this.statistics.rowCount}
`;
    summary += `- **\u603B\u5217\u6570**: ${this.statistics.columnCount}
`;
    summary += `- **\u7A7A\u884C\u6570**: ${this.statistics.emptyRows}
`;
    if (this.statistics.columnCount > 0) {
      summary += `
### \u5217\u4FE1\u606F

`;
      summary += "| \u5217\u540D | \u552F\u4E00\u503C\u6570\u91CF | \u6837\u4F8B\u503C |\n";
      summary += "| --- | --- | --- |\n";
      this.headers.forEach((header) => {
        const uniqueSet = this.statistics.uniqueValues.get(header);
        const uniqueCount = uniqueSet ? uniqueSet.size : 0;
        let sampleValues = "";
        if (uniqueSet && uniqueSet.size > 0) {
          const samples = Array.from(uniqueSet).slice(0, 3);
          sampleValues = samples.map((v) => this.escapeCellValue(v).substr(0, 30)).join(", ");
        }
        summary += `| ${this.escapeCellValue(header)} | ${uniqueCount} | ${sampleValues} |
`;
      });
    }
    return summary;
  }
  /**
   * 将CSV数据转换为Markdown格式
   * @returns Markdown表示
   */
  generateMarkdown() {
    if (this.records.length === 0) {
      return `# CSV\u6587\u4EF6: ${this.baseDocName}

*CSV\u6587\u4EF6\u4E3A\u7A7A\u6216\u683C\u5F0F\u4E0D\u6B63\u786E*`;
    }
    let markdown = `# CSV\u6587\u4EF6: ${this.baseDocName}

`;
    markdown += this.generateTable() + "\n\n";
    markdown += this.generateSummary();
    return markdown;
  }
  /**
   * 解析CSV文件
   * @returns Markdown格式的内容
   */
  async parse() {
    try {
      if (!this.readFile()) {
        return `# CSV\u89E3\u6790\u5931\u8D25

\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6: ${this.baseDocName}`;
      }
      this.parseContent();
      if (this.records.length === 0) {
        return `# CSV\u6587\u4EF6: ${this.baseDocName}

*CSV\u6587\u4EF6\u4E3A\u7A7A\u6216\u683C\u5F0F\u4E0D\u6B63\u786E*`;
      }
      this.calculateStatistics();
      return this.generateMarkdown();
    } catch (error) {
      console.error("\u89E3\u6790CSV\u6587\u4EF6\u5931\u8D25:", error);
      return `# CSV\u89E3\u6790\u5931\u8D25

\u65E0\u6CD5\u89E3\u6790CSV\u6587\u4EF6\u3002\u9519\u8BEF: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`;
    } finally {
      this.dispose();
    }
  }
  /**
   * 清理资源
   */
  dispose() {
    this.content = "";
    this.records = [];
    this.headers = [];
    this.statistics = null;
  }
}
async function parse(filename, ragName) {
  try {
    const parser = new CsvParser(filename, ragName);
    return await parser.parse();
  } catch (error) {
    console.error("\u89E3\u6790CSV\u6587\u4EF6\u5931\u8D25:", error);
    return `# CSV\u89E3\u6790\u5931\u8D25

\u65E0\u6CD5\u89E3\u6790CSV\u6587\u4EF6\u3002\u9519\u8BEF: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CsvParser,
  parse
});
