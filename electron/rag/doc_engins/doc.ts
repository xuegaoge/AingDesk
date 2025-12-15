import * as fs from 'fs';
import * as path from 'path';
import { parse as docxParse } from './libs/docx_parse';
import { parse as docParse } from './libs/doc_parse';
import { parse as xlsParse } from './libs/xls_parse';
import { parse as pdfParse } from './libs/pdf_parse';
import { parse as csvParse } from './libs/csv_parse';
import { parse as htmlParse } from './libs/html_parse';
import { parse as imageParse } from './libs/image_parse';
import { parse as pptParse } from './libs/ppt_parse';
// import { parse as mdParse } from './libs/md_parse';
import { parse as txtParse } from './libs/txt_parse';
import { parse as httpParse } from './libs/http_parse';
import { get_doc_save_path } from './utils';

// 类型定义
interface ParseResult {
    success: boolean;
    content: string;
    error?: string;
}


/**
 * 文档解析器类
 */
export class DocumentParser {
    /**
     * 支持的文件类型映射
     * 将文件扩展名映射到相应的解析函数
     */
    private static FILE_TYPE_MAP: Record<string, (filename: string, ragName: string) => Promise<string>> = {
        // 文档类型
        '.docx': docxParse,
        '.doc': docParse,

        // 表格类型
        '.xlsx': xlsParse,
        '.xls': xlsParse,
        '.csv': csvParse,

        // 演示文稿类型
        '.pptx': pptParse,
        '.ppt': pptParse,

        // PDF文件
        '.pdf': pdfParse,

        // 网页文件
        '.html': htmlParse,
        '.htm': htmlParse,

        // URL地址
        'http': httpParse,
        'https': httpParse,

        // 图片类型
        '.jpg': imageParse,
        '.jpeg': imageParse,
        '.png': imageParse,
        '.gif': imageParse,
        '.bmp': imageParse,
        '.webp': imageParse,
        '.ppm': imageParse,
        '.tiff': imageParse,

        // Markdown文件
        '.md': txtParse,
        '.markdown': txtParse,

        // 纯文本文件
        '.txt': txtParse,
        '.log': txtParse,
        '.text': txtParse,
        '.conf': txtParse,
        '.cfg': txtParse,
        '.ini': txtParse,
        '.json': txtParse,
    };

    /**
     * 检查文件是否存在并可访问
     * @param filename 文件路径
     * @returns 检查结果
     */
    private static async checkFile(filename: string): Promise<{ exists: boolean; error?: string }> {
        try {
            await fs.promises.access(filename, fs.constants.R_OK);
            return { exists: true };
        } catch (error: any) {
            return {
                exists: false,
                error: `无法访问文件: ${error.message}`
            };
        }
    }

    /**
     * 确保输出目录存在
     */
    private static ensureOutputDirectory(): void {
        let docSavePath = get_doc_save_path()
        if (!fs.existsSync(docSavePath)) {
            fs.mkdirSync(docSavePath, { recursive: true });
        }
    }

    /**
     * 获取文件的扩展名（小写）
     * @param filename 文件路径
     * @returns 文件扩展名
     */
    private static getFileExtension(filename: string): string {
        // 判断是否为http或https地址
        if (filename.startsWith('http://') || filename.startsWith('https://')) {
            return 'http';
        }
        return path.extname(filename).toLowerCase();
    }

    /**
     * 检查文件是否为支持的类型
     * @param filename 文件路径
     * @returns 是否支持
     */
    public static isSupported(filename: string): boolean {
        const extension = this.getFileExtension(filename);
        return extension in this.FILE_TYPE_MAP;
    }

    /**
     * 获取所有支持的文件扩展名
     * @returns 支持的文件扩展名数组
     */
    public static getSupportedExtensions(): string[] {
        return Object.keys(this.FILE_TYPE_MAP);
    }

    /**
     * 解析文档
     * @param filename 文件路径
     * @returns 解析结果
     */
    public static async parseDocument(filename: string, ragName: string): Promise<ParseResult> {
        // 给主线程喘息机会
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
            // 获取文件扩展名
            const extension = this.getFileExtension(filename);
            if(extension != 'http'){
                // 检查文件是否可访问
                const fileCheck = await this.checkFile(filename);
                if (!fileCheck.exists) {
                    return {
                        success: false,
                        content: ``
                    };
                }
            }

            // 确保输出目录存在
            this.ensureOutputDirectory();

            // 检查类型是否支持
            if (!this.isSupported(filename)) {
                return {
                    success: false,
                    content: ``
                };
            }

            // 获取相应的解析函数并执行
            const parseFunction = this.FILE_TYPE_MAP[extension];
            const content = await parseFunction(filename, ragName);

            // 如果解析结果为空，返回错误信息
            if (!content || content.trim().length === 0) {
                return {
                    success: false,
                    content: ``
                };
            }

            return {
                success: true,
                content
            };
        } catch (error: any) {
            console.error('解析文档时发生错误:', error);
            return {
                success: false,
                content: ``,
                error: error.message || '未知错误'
            };
        }
    }

    /**
     * 将解析结果保存到文件
     * @param filename 原始文件路径
     * @param content 解析内容
     * @param ragName 知识库名称
     * @param customOutputFilename 自定义输出文件名（不含扩展名）
     * @returns 保存的文件路径
     */
    public static async saveToFile(
        filename: string,
        content: string,
        ragName: string,
        customOutputFilename?: string
    ): Promise<{ parsedPath: string }> {
        try {
            // 确保输出目录存在
            const outputDir = path.join(get_doc_save_path(), ragName, 'markdown');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // 为解析结果生成保存路径
            let outputFilename: string;
            if (customOutputFilename) {
                // 如果提供了自定义文件名，直接使用（确保有.md后缀）
                outputFilename = customOutputFilename.endsWith('.md') ? customOutputFilename : `${customOutputFilename}.md`;
            } else {
                // 否则使用原文件名
                const basename = path.basename(filename);
                outputFilename = `${basename}.md`;
            }
            
            const outputPath = path.join(outputDir, outputFilename);

            // 保存解析内容
            await fs.promises.writeFile(outputPath, content, 'utf-8');
            console.log(`解析结果已保存至: ${outputPath}`);

            return {
                parsedPath: outputPath
            };
        } catch (error: any) {
            console.error('保存文件时发生错误:', error);
            throw new Error(`保存文件失败: ${error.message}`);
        }
    }
}

/**
 * 解析文档
 * @param filename 文件路径
 * @param ragName 知识库名称
 * @param saveToFile 是否保存到文件
 * @param customOutputFilename 自定义输出文件名
 * @returns 解析结果和保存路径
 */
export async function parseDocument(
    filename: string,
    ragName: string = '',
    saveToFile: boolean = false,
    customOutputFilename?: string
): Promise<{ content: string; savedPath?: string }> {
    try {
        // 解析文档
        const result = await DocumentParser.parseDocument(filename, ragName);

        // 如果指定了要保存到文件
        let savedPath: string | undefined;
        if (saveToFile && result.success && ragName) {
            const saveResult = await DocumentParser.saveToFile(filename, result.content, ragName, customOutputFilename);
            savedPath = saveResult.parsedPath;
        }

        return {
            content: result.content,
            savedPath
        };
    } catch (error: any) {
        console.error('解析文档过程中出错:', error);
        return {
            content: `# 解析失败\n\n处理文件 "${path.basename(filename)}" 时出错: ${error.message || '未知错误'}`
        };
    }
}

/**
 * 检查文件类型是否受支持
 * @param filename 文件路径
 * @returns 是否支持
 */
export function isSupportedFileType(filename: string): boolean {
    return DocumentParser.isSupported(filename);
}

/**
 * 获取所有支持的文件扩展名
 * @returns 支持的文件扩展名数组
 */
export function getSupportedFileExtensions(): string[] {
    return DocumentParser.getSupportedExtensions();
}