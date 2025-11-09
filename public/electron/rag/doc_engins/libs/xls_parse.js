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
var xls_parse_exports = {};
__export(xls_parse_exports, {
  ExcelParser: () => ExcelParser,
  parse: () => parse
});
module.exports = __toCommonJS(xls_parse_exports);
var XLSX = __toESM(require("xlsx"));
var path = __toESM(require("path"));
class ExcelParser {
  filename;
  ragName;
  baseDocName;
  workbook = null;
  workbookData = null;
  /**
   * 构造函数
   * @param filename Excel文件路径
   */
  constructor(filename, ragName) {
    this.ragName = ragName;
    this.filename = filename;
    this.baseDocName = path.basename(filename, path.extname(filename));
  }
  /**
   * 读取Excel文件并解析工作簿
   * @returns 是否成功读取
   */
  readWorkbook() {
    try {
      this.workbook = XLSX.readFile(this.filename);
      if (!this.workbook || !this.workbook.SheetNames || this.workbook.SheetNames.length === 0) {
        console.error("\u65E0\u6548\u7684Excel\u6587\u4EF6\u6216\u4E0D\u5305\u542B\u5DE5\u4F5C\u8868");
        return false;
      }
      return true;
    } catch (error) {
      console.error("\u8BFB\u53D6Excel\u6587\u4EF6\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 解析工作簿数据
   * @returns 工作簿数据对象
   */
  parseWorkbookData() {
    const workbookData = {
      filename: this.filename,
      basename: this.baseDocName,
      sheets: []
    };
    if (!this.workbook) {
      return workbookData;
    }
    for (const sheetName of this.workbook.SheetNames) {
      const worksheet = this.workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const sheetData = {
        name: sheetName,
        rows: jsonData,
        isEmpty: jsonData.length === 0
      };
      workbookData.sheets.push(sheetData);
    }
    return workbookData;
  }
  /**
   * 将单元格值转换为安全的Markdown字符串
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
   * 将工作表数据转换为Markdown表格
   * @param sheet 工作表数据
   * @returns Markdown表格字符串
   */
  sheetToMarkdown(sheet) {
    if (sheet.isEmpty || sheet.rows.length === 0) {
      return `## \u5DE5\u4F5C\u8868: ${sheet.name}

*\u6B64\u5DE5\u4F5C\u8868\u4E3A\u7A7A*

`;
    }
    let result = `## \u5DE5\u4F5C\u8868: ${sheet.name}

`;
    const headers = sheet.rows[0].map((header) => this.escapeCellValue(header));
    let markdownTable = "| " + headers.join(" | ") + " |\n";
    markdownTable += "| " + headers.map(() => "---").join(" | ") + " |\n";
    for (let i = 1; i < sheet.rows.length; i++) {
      const row = sheet.rows[i];
      if (row && row.length > 0) {
        const cells = [];
        for (let j = 0; j < headers.length; j++) {
          cells.push(this.escapeCellValue(row[j]));
        }
        markdownTable += "| " + cells.join(" | ") + " |\n";
      }
    }
    result += markdownTable + "\n\n";
    result += `*\u5171 ${sheet.rows.length - 1} \u884C\u6570\u636E*

`;
    return result;
  }
  /**
   * 检查并提取工作表中的图表或图片
   * 注意：此功能需要更高级的库支持，目前仅作为占位符
   * @param sheet 工作表对象
   * @returns 相关的Markdown字符串（如有）
   */
  extractSheetCharts(sheetName) {
    if (!sheetName) {
      return "";
    }
    return "";
  }
  // /**
  //  * 提取Excel文档属性
  //  * @returns 表示文档属性的Markdown字符串
  //  */
  // private extractDocumentProperties(): string {
  //   if (!this.workbook || !this.workbook.Props) {
  //     return '';
  //   }
  //   const props = this.workbook.Props;
  //   let result = '## 文档属性\n\n';
  //   if (props.Title) result += `- **标题**: ${props.Title}\n`;
  //   if (props.Subject) result += `- **主题**: ${props.Subject}\n`;
  //   if (props.Author) result += `- **作者**: ${props.Author}\n`;
  //   if (props.Manager) result += `- **管理者**: ${props.Manager}\n`;
  //   if (props.Company) result += `- **公司**: ${props.Company}\n`;
  //   if (props.LastAuthor) result += `- **最后修改人**: ${props.LastAuthor}\n`;
  //   if (props.CreatedDate) result += `- **创建日期**: ${new Date(props.CreatedDate).toLocaleString()}\n`;
  //   if (props.ModifiedDate) result += `- **修改日期**: ${new Date(props.ModifiedDate).toLocaleString()}\n`;
  //   return result.length > 17 ? result + '\n' : '';
  // }
  /**
   * 生成完整的Markdown文档
   * @returns Markdown格式的字符串
   */
  generateMarkdown() {
    if (!this.workbookData) return "";
    const parts = [];
    parts.push(`# ${this.baseDocName}
`);
    parts.push(`## \u5DE5\u4F5C\u8868\u6982\u8FF0

`);
    parts.push(`\u6B64Excel\u6587\u6863\u5305\u542B ${this.workbookData.sheets.length} \u4E2A\u5DE5\u4F5C\u8868\uFF1A

`);
    const sheetList = this.workbookData.sheets.map((sheet, index) => {
      const rowCount = sheet.isEmpty ? 0 : sheet.rows.length - 1;
      return `${index + 1}. **${sheet.name}**${sheet.isEmpty ? " (\u7A7A)" : ` (${rowCount} \u884C\u6570\u636E)`}`;
    });
    parts.push(sheetList.join("\n") + "\n\n");
    this.workbookData.sheets.forEach((sheet) => {
      parts.push(this.sheetToMarkdown(sheet));
      const charts = this.extractSheetCharts(sheet.name);
      if (charts) {
        parts.push(charts);
      }
    });
    return parts.join("\n");
  }
  /**
   * 解析Excel文件
   * @returns Markdown格式的内容
   */
  async parse() {
    try {
      if (!this.readWorkbook() || !this.workbook) {
        return `# \u89E3\u6790\u5931\u8D25

\u65E0\u6CD5\u8BFB\u53D6Excel\u6587\u4EF6: ${this.baseDocName}`;
      }
      this.workbookData = this.parseWorkbookData();
      return this.generateMarkdown();
    } catch (error) {
      console.error("\u89E3\u6790Excel\u6587\u4EF6\u5931\u8D25:", error);
      return `# \u89E3\u6790\u5931\u8D25

\u89E3\u6790Excel\u6587\u4EF6\u65F6\u51FA\u9519: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`;
    }
  }
  /**
   * 清理资源
   */
  dispose() {
    this.workbook = null;
    this.workbookData = null;
  }
}
async function parse(filename, ragName) {
  try {
    const parser = new ExcelParser(filename, ragName);
    const markdown = await parser.parse();
    parser.dispose();
    return markdown;
  } catch (error) {
    console.error("\u89E3\u6790 Excel \u6587\u4EF6\u5931\u8D25:", error);
    return `# Excel\u89E3\u6790\u5931\u8D25

\u65E0\u6CD5\u89E3\u6790Excel\u6587\u4EF6\u3002\u9519\u8BEF: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ExcelParser,
  parse
});
