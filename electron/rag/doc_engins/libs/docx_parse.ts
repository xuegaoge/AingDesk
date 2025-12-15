import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { spawn } from 'child_process';
import { get_image_save_path, IMAGE_URL_LAST } from '../utils';
import { pub } from '../../../class/public';

// 类型定义
interface ImageRelationship {
  [key: string]: string;
}

interface DocumentItem {
  type: 'text' | 'image';
  content?: string;
  name?: string;
  path?: string;
  url?: string;
  data?: Uint8Array;
}

interface DocxParseResult {
  plainText: string;
  documentContent: DocumentItem[];
}

/**
 * Word文档解析器类
 */
export class DocxParser {
  private filename: string;
  private baseDocName: string;
  private ragName: string;
  private zip: PizZip | null = null;
  private documentContent: DocumentItem[] = [];
  private imageIndex: number = 0;
  private outputDir: string | null = null;

  /**
   * 构造函数
   * @param filename 要解析的文件路径
   */
  constructor(filename: string, ragName: string, outputDir?: string) {
    this.filename = filename;
    this.ragName = ragName;
    this.baseDocName = path.basename(filename, path.extname(filename));
    if (outputDir) this.outputDir = outputDir;
  }

  /**
   * 初始化PizZip对象
   * @returns 是否成功初始化
   */
  private initZip(): boolean {
    try {
      const body = fs.readFileSync(this.filename, 'binary');
      this.zip = new PizZip(body);
      return !!this.zip;
    } catch (error) {
      console.error('初始化zip对象失败:', error);
      return false;
    }
  }

  /**
   * 将图片保存到指定目录
   * @param imageData 图片二进制数据
   * @param imageName 图片名称
   * @returns 图片保存路径和URL
   */
  private saveImage(imageData: Uint8Array, imageName: string): { path: string; url: string } {
    try{
      // 创建图片保存目录
      const outputDir = this.outputDir || get_image_save_path();
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // 获取图片扩展名
      const ext = path.extname(imageName);

      // 创建唯一图片名
      const uniqueImageName = `${pub.md5(`${this.baseDocName}_${this.ragName}_${this.imageIndex++}`)}${ext}`;
      const imagePath = path.join(outputDir, this.ragName, 'images');
      const imageFile = path.resolve(imagePath, uniqueImageName);
      if(!pub.file_exists(imagePath)) pub.mkdir(imagePath);
      const imageUrl = `${IMAGE_URL_LAST}/images?r=${this.ragName}&n=${uniqueImageName}`;

      // 保存图片
      fs.writeFileSync(imageFile, Buffer.from(imageData));

      return { path: imageFile, url: imageUrl };
    } catch (error) {
      console.error('保存图片失败:', error);
      return { path: '', url: '' };
    }
  }

  /**
   * 解析文档XML中的图片关系
   * @param relationshipsXml 关系XML内容
   * @returns 图片ID与路径的映射
   */
  private parseImageRelationships(relationshipsXml: string): ImageRelationship {
    const imageRelationships: ImageRelationship = {};

    const relMatches:RegExpMatchArray = relationshipsXml.match(/<Relationship[^>]*>/g)

    if(!relMatches) return imageRelationships;
    relMatches.forEach(rel => {
      const idMatch = rel.match(/Id="([^"]+)"/);
      const targetMatch = rel.match(/Target="([^"]+)"/);
      const typeMatch = rel.match(/Type="[^"]*image[^"]*"/);

      if (idMatch && targetMatch && typeMatch) {
        imageRelationships[idMatch[1]] = targetMatch[1];
      }
    });

    return imageRelationships;
  }

  /**
   * 解析段落内容
   * @param paragraph 段落XML
   * @returns 提取的文本内容
   */
  private parseParagraphText(paragraph: string): string {
    const textMatches = paragraph.match(/<w:t.*?>(.*?)<\/w:t>/g) || [];
    return textMatches.map(t => t.replace(/<.*?>/g, '')).join('');
  }

  /**
   * 处理文档中的图片
   * @param paragraph 段落XML
   * @param imageRelationships 图片关系映射
   */
  private processImages(paragraph: string, imageRelationships: ImageRelationship): void {
    if(this.ragName == 'temp') return;
    if (!this.zip) return;

    const imageMatch = paragraph.match(/<a:blip r:embed="([^"]+)"/);
    if (!imageMatch || !imageRelationships[imageMatch[1]]) return;

    const imageId = imageMatch[1];
    const imagePath = imageRelationships[imageId];
    const imageName = imagePath.split('/').pop() || "";

    // 获取图片数据
    const imageFile = this.zip.file(`word/${imagePath.replace(/^\.\.\//, '')}`);
    if (!imageFile) return;

    const imageData = imageFile.asUint8Array();

    // 保存图片并获取路径和URL
    const { path: savedPath, url: imageUrl } = this.saveImage(imageData, imageName);

    // 将图片信息添加到文档内容中
    if(imageUrl){
      this.documentContent.push({
        type: 'image',
        name: imageName,
        path: savedPath,
        url: imageUrl,
        data: imageData
      });
    }
  }

  /**
   * 解析文档并生成结果
   * @returns 解析结果
   */
  public async parse(): Promise<DocxParseResult> {
    // 初始化zip对象
    if (!this.initZip() || !this.zip) {
      return { plainText: "", documentContent: [] };
    }

    // 读取document.xml内容
    const documentXmlFile = this.zip.file('word/document.xml');
    if (!documentXmlFile) {
      return { plainText: "", documentContent: [] };
    }
    const documentXml = documentXmlFile.asText();

    // 获取图片关系
    const relationshipsXmlFile = this.zip.file('word/_rels/document.xml.rels');
    const relationshipsXml = relationshipsXmlFile?.asText() || "";
    const imageRelationships = this.parseImageRelationships(relationshipsXml);

    // 解析文档结构
    this.documentContent = [];
    const paragraphs = documentXml.match(/<w:p.*?<\/w:p>/g) || [];

    for (const paragraph of paragraphs) {
      // 处理图片
      this.processImages(paragraph, imageRelationships);

      // 提取段落文本
      const textContent = this.parseParagraphText(paragraph);

      // 只有当文本不为空时才添加
      if (textContent.trim()) {
        this.documentContent.push({
          type: 'text',
          content: textContent
        });
      }
    }

    // 生成包含位置信息的纯文本
    const plainText = this.documentContent
      .map(item => {
        if (item.type === 'text') {
          return item.content;
        } else if (item.url) {
          return `![IMG](${item.url})`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');

    return {
      plainText,
      documentContent: this.documentContent
    };
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.zip = null;
    this.documentContent = [];
  }
}

/**
 * 开始解析(此函数为统一入口，其它同类模块也使用此函数名作为入口)
 * @param filename 文件名
 * @returns 解析后的文本
 */
export async function parse(filename: string, ragName: string): Promise<string> {
  let scriptPath = __filename;
  if (path.extname(scriptPath) === '.ts') {
      // 开发环境：指向编译后的 JS 文件
      scriptPath = path.join(process.cwd(), 'public', 'electron', 'rag', 'doc_engins', 'libs', 'docx_parse.js');
  }

  // 获取图片保存路径，传递给子进程
  const outputDir = get_image_save_path();

  return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [scriptPath, filename, ragName, outputDir], {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
      });

      let stdoutData = '';
      let stderrData = '';

      child.stdout.on('data', (data) => {
          stdoutData += data.toString();
      });

      child.stderr.on('data', (data) => {
          stderrData += data.toString();
      });

      child.on('close', (code) => {
          if (code !== 0) {
              console.error(`[DocxParse] Process exited with code ${code}`);
              console.error(`[DocxParse] Stderr: ${stderrData}`);
              resolve(''); // 失败返回空字符串，避免抛出异常中断流程
              return;
          }

          try {
              const result = JSON.parse(stdoutData);
              if (result.success) {
                  resolve(result.data);
              } else {
                  console.error(`[DocxParse] Worker reported error: ${result.error}`);
                  resolve('');
              }
          } catch (error: any) {
              console.error(`[DocxParse] Failed to parse worker output: ${stdoutData}`);
              resolve('');
          }
      });

      child.on('error', (error) => {
          console.error(`[DocxParse] Failed to spawn worker: ${error}`);
          resolve('');
      });
  });
}

if (require.main === module) {
  (async () => {
      const filename = process.argv[2];
      const ragName = process.argv[3];
      const outputDir = process.argv[4];

      if (!filename || !ragName) {
          console.error('Usage: node docx_parse.js <filename> <ragName> [outputDir]');
          process.exit(1);
      }

      try {
          const parser = new DocxParser(filename, ragName, outputDir);
          const result = await parser.parse();
          parser.dispose();
          process.stdout.write(JSON.stringify({ success: true, data: result.plainText }));
      } catch (error: any) {
          process.stdout.write(JSON.stringify({ success: false, error: error.message || '未知错误' }));
      }
  })();
}