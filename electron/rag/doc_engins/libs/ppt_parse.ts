import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * PPT解析器类
 */
export class PptxParser {
  // 读取PPT文件，按格式提取文本和图片，返回Markdown格式的字符串
  async ppt2md(filename: string): Promise<string> {
    try {
      // 动态导入pptxjs库
      const { default: JSZip } = await import('jszip');

      // 读取文件内容
      const fileData = await fs.readFile(filename);
      const zip = await JSZip.loadAsync(fileData);

      // 获取幻灯片数量和关系信息
      const presentationXml = await this.getPresentationXml(zip);
      const slideIds = this.extractSlideIds(presentationXml);

      // 存储内容数组
      const documentContent: any[] = [];

      // 处理每个幻灯片
      for (let i = 0; i < slideIds.length; i++) {
        const slideIndex = i + 1;
        await this.processSlide(zip, slideIndex, documentContent);
      }

      // 生成 Markdown 格式的文本
      const markdownText = this.formatToMarkdown(documentContent);

      return markdownText;
    } catch (error) {
      console.error('PPT解析错误:', error);
      return '';
    }
  }


  // 获取presentation.xml文件内容
  private async getPresentationXml(zip: any): Promise<string> {
    const presentationXml = await zip.file("ppt/presentation.xml")?.async("text");
    if (!presentationXml) {
      throw new Error("Invalid PPT file: missing presentation.xml");
    }
    return presentationXml;
  }

  // 从presentation.xml中提取幻灯片ID
  private extractSlideIds(presentationXml: string): string[] {
    const slideCountMatch = presentationXml.match(/<p:sldIdLst>([^]*?)<\/p:sldIdLst>/);
    return slideCountMatch ? slideCountMatch[1].match(/id="(\d+)"/g) || [] : [];
  }

  // 处理单个幻灯片
  private async processSlide(zip: any, slideIndex: number, documentContent: any[]): Promise<void> {
    try {
      const slideXml = await zip.file(`ppt/slides/slide${slideIndex}.xml`)?.async("text");
      if (!slideXml) return;

      // 提取文本内容
      const paragraphs = this.extractParagraphsFromSlide(slideXml);

      // 添加幻灯片文本到内容数组
      if (paragraphs.length > 0) {
        documentContent.push({
          type: 'text',
          content: paragraphs.join('\n'),
          slide: slideIndex
        });
      }
    } catch (err:any) {
      console.warn(`Error processing slide ${slideIndex}:`, err.message);
    }
  }

  // 从幻灯片XML中提取段落文本
  extractParagraphsFromSlide(slideXml: string): string[] {
    const paragraphs: string[] = [];
    const paragraphElements = slideXml.match(/<a:p>.*?<\/a:p>/g) || [];

    for (const paragraph of paragraphElements) {
      const textElementsInParagraph = paragraph.match(/<a:t>(.+?)<\/a:t>/g) || [];
      if (textElementsInParagraph.length > 0) {
        const paragraphText = textElementsInParagraph
          .map(t => t.replace(/<a:t>|<\/a:t>/g, ''))
          .join(' ');

        if (paragraphText.trim()) {
          paragraphs.push(paragraphText);
        }
      }
    }

    return paragraphs;
  }

  // 格式化内容为 Markdown 文本
  formatToMarkdown(documentContent: any[]): string {
    return documentContent
      .map((item) => {
        if (item.type === 'text') {
          return `## Slide ${item.slide}\n${item.content}`;
        }
        return '';
      })
      .join('\n\n');
  }
}

/**
 * 将PPT文件解析并转换为md格式
 * @param filename PPT文件路径
 * @returns Markdown格式的字符串
 */
export async function parse(filename: string, ragName: string): Promise<string> {
  let scriptPath = __filename;
  if (path.extname(scriptPath) === '.ts') {
      // 开发环境：指向编译后的 JS 文件
      scriptPath = path.join(process.cwd(), 'public', 'electron', 'rag', 'doc_engins', 'libs', 'ppt_parse.js');
  }

  return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [scriptPath, filename, ragName], {
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
              console.error(`[PptParse] Process exited with code ${code}`);
              console.error(`[PptParse] Stderr: ${stderrData}`);
              resolve(''); 
              return;
          }

          try {
              const result = JSON.parse(stdoutData);
              if (result.success) {
                  resolve(result.data);
              } else {
                  console.error(`[PptParse] Worker reported error: ${result.error}`);
                  resolve('');
              }
          } catch (error: any) {
              console.error(`[PptParse] Failed to parse worker output: ${stdoutData}`);
              resolve('');
          }
      });

      child.on('error', (error) => {
          console.error(`[PptParse] Failed to spawn worker: ${error}`);
          resolve('');
      });
  });
}

if (require.main === module) {
  (async () => {
      const filename = process.argv[2];
      const ragName = process.argv[3];

      if (!filename) {
          console.error('Usage: node ppt_parse.js <filename> [ragName]');
          process.exit(1);
      }

      try {
        // 检查文件扩展名
        const ext = path.extname(filename).toLowerCase();
        let result = '';

        if (ext === '.pptx') {
          const parser = new PptxParser();
          result = await parser.ppt2md(filename);
        } else if (ext === '.ppt') {
          result = `# 不支持的文件格式\n\n很抱歉，目前仅支持.pptx格式的PowerPoint文件解析。`;
        } else {
          result = `# 不支持的文件格式\n\n文件 ${path.basename(filename)} 不是有效的PowerPoint文件。`;
        }
        process.stdout.write(JSON.stringify({ success: true, data: result }));
      } catch (error: any) {
          process.stdout.write(JSON.stringify({ success: false, error: error.message || '未知错误' }));
      }
  })();
}