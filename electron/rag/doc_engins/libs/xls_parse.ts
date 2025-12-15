import * as XLSX from 'xlsx';
import * as path from 'path';
import { spawn } from 'child_process';

// 类型定义
interface SheetData {
  name: string;
  rows: any[][];
  isEmpty: boolean;
}

interface WorkbookData {
  filename: string;
  basename: string;
  sheets: SheetData[];
}

/**
 * Excel解析器类
 */
export class ExcelParser {
  private filename: string;
  private ragName:string;
  private baseDocName: string;
  private workbook: XLSX.WorkBook | null = null;
  private workbookData: WorkbookData | null = null;
  
  /**
   * 构造函数
   * @param filename Excel文件路径
   */
  constructor(filename: string,ragName:string) {
    this.ragName = ragName;
    this.filename = filename;
    this.baseDocName = path.basename(filename, path.extname(filename));
  }
  
  /**
   * 读取Excel文件并解析工作簿
   * @returns 是否成功读取
   */
  private readWorkbook(): boolean {
    try {
      this.workbook = XLSX.readFile(this.filename);
      
      if (!this.workbook || !this.workbook.SheetNames || this.workbook.SheetNames.length === 0) {
        console.error('无效的Excel文件或不包含工作表');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('读取Excel文件失败:', error);
      return false;
    }
  }
  
  /**
   * 解析工作簿数据
   * @returns 工作簿数据对象
   */
  private parseWorkbookData(): WorkbookData {
    const workbookData: WorkbookData = {
      filename: this.filename,
      basename: this.baseDocName,
      sheets: []
    };
    
    if (!this.workbook) {
      return workbookData;
    }
    
    // 遍历所有工作表
    for (const sheetName of this.workbook.SheetNames) {
      const worksheet = this.workbook.Sheets[sheetName];
      
      // 将工作表转换为JSON格式数据
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      const sheetData: SheetData = {
        name: sheetName,
        rows: jsonData as any[][],
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
  private escapeCellValue(value: any): string {
    if (value === undefined || value === null) {
      return '';
    }
    
    // 转换为字符串并转义 | 字符
    return String(value)
      .replace(/\|/g, '\\|')
      .replace(/\n/g, '<br>'); // 处理多行文本
  }
  
  /**
   * 将工作表数据转换为Markdown表格
   * @param sheet 工作表数据
   * @returns Markdown表格字符串
   */
  private sheetToMarkdown(sheet: SheetData): string {
    if (sheet.isEmpty || sheet.rows.length === 0) {
      return `## 工作表: ${sheet.name}\n\n*此工作表为空*\n\n`;
    }
    
    let result = `## 工作表: ${sheet.name}\n\n`;
    
    // 获取表头（第一行）
    const headers = sheet.rows[0].map(header => this.escapeCellValue(header));
    
    // 生成Markdown表格表头
    let markdownTable = '| ' + headers.join(' | ') + ' |\n';
    markdownTable += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
    // 添加表格数据行
    for (let i = 1; i < sheet.rows.length; i++) {
      const row = sheet.rows[i];
      if (row && row.length > 0) {
        // 确保每行单元格数量与表头一致
        const cells:any[] = [];
        for (let j = 0; j < headers.length; j++) {
          cells.push(this.escapeCellValue(row[j]));
        }
        markdownTable += '| ' + cells.join(' | ') + ' |\n';
      }
    }
    
    result += markdownTable + '\n\n';
    
    // 添加表格统计信息
    result += `*共 ${sheet.rows.length - 1} 行数据*\n\n`;
    
    return result;
  }
  
  /**
   * 检查并提取工作表中的图表或图片
   * 注意：此功能需要更高级的库支持，目前仅作为占位符
   * @param sheet 工作表对象
   * @returns 相关的Markdown字符串（如有）
   */
  private extractSheetCharts(sheetName: string): string {
    // 注意: XLSX库对图表支持有限
    // 这里作为扩展功能的占位符
    if (!sheetName) {
      return '';
    }
    return '';
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
  private generateMarkdown(): string {
    if (!this.workbookData) return '';
    
    const parts: string[] = [];
    
    // 添加文档标题
    parts.push(`# ${this.baseDocName}\n`);
    
    // 添加文档属性
    // const properties = this.extractDocumentProperties();
    // if (properties) {
    //   parts.push(properties);
    // }
    
    // 添加工作表概述
    parts.push(`## 工作表概述\n\n`);
    parts.push(`此Excel文档包含 ${this.workbookData.sheets.length} 个工作表：\n\n`);
    
    const sheetList = this.workbookData.sheets.map((sheet, index) => {
      const rowCount = sheet.isEmpty ? 0 : sheet.rows.length - 1;
      return `${index + 1}. **${sheet.name}**${sheet.isEmpty ? ' (空)' : ` (${rowCount} 行数据)`}`;
    });
    
    parts.push(sheetList.join('\n') + '\n\n');
    
    // 添加每个工作表的内容
    this.workbookData.sheets.forEach(sheet => {
      parts.push(this.sheetToMarkdown(sheet));
      
      // 添加工作表中的图表（如果有）
      const charts = this.extractSheetCharts(sheet.name);
      if (charts) {
        parts.push(charts);
      }
    });
    
    return parts.join('\n');
  }
  
  /**
   * 解析Excel文件
   * @returns Markdown格式的内容
   */
  public async parse(): Promise<string> {
    try {
      if (!this.readWorkbook() || !this.workbook) {
        return `# 解析失败\n\n无法读取Excel文件: ${this.baseDocName}`;
      }
      
      this.workbookData = this.parseWorkbookData();
      return this.generateMarkdown();
    } catch (error: any) {
      console.error('解析Excel文件失败:', error);
      return `# 解析失败\n\n解析Excel文件时出错: ${error.message || '未知错误'}`;
    }
  }
  
  /**
   * 清理资源
   */
  public dispose(): void {
    this.workbook = null;
    this.workbookData = null;
  }
}

/**
 * 将 Excel 文件解析并转换为 Markdown 格式
 * @param filename Excel 文件路径
 * @param ragName 名称
 * @returns Markdown 格式的字符串
 */
export async function parse(filename: string, ragName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 开启子进程进行解析，避免阻塞主线程
    let scriptPath = __filename;
    if (path.extname(scriptPath) === '.ts') {
        // Dev environment: map .ts source to compiled .js in public/electron
        scriptPath = path.join(process.cwd(), 'public', 'electron', 'rag', 'doc_engins', 'libs', 'xls_parse.js');
    }
    
    const child = spawn(process.execPath, [scriptPath, filename, ragName], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`[XlsParse] Worker exited with code ${code}: ${stderr}`);
        resolve(`# 解析失败\n\nExcel解析进程异常退出 (Code ${code})`);
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        if (result.success) {
          resolve(result.data);
        } else {
          resolve(`# 解析失败\n\n${result.error}`);
        }
      } catch (error: any) {
        console.error(`[XlsParse] Failed to parse worker output: ${stdout}`);
        resolve(`# 解析失败\n\n解析结果格式错误: ${error.message}`);
      }
    });

    child.on('error', (error) => {
      console.error(`[XlsParse] Failed to spawn worker: ${error}`);
      resolve(`# 解析失败\n\n无法启动解析进程: ${error.message}`);
    });
  });
}

// Worker Entry Point
if (require.main === module) {
  (async () => {
    const filename = process.argv[2];
    const ragName = process.argv[3];

    if (!filename || !ragName) {
      console.error('Usage: node xls_parse.js <filename> <ragName>');
      process.exit(1);
    }

    try {
      const parser = new ExcelParser(filename, ragName);
      // @ts-ignore - access private/public method if needed, but parse is public in class
      const markdown = await parser.parse();
      parser.dispose();
      process.stdout.write(JSON.stringify({ success: true, data: markdown }));
    } catch (error: any) {
      process.stdout.write(JSON.stringify({ success: false, error: error.message || '未知错误' }));
    }
  })();
}