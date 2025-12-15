import * as fs from 'fs';

/**
 * 清理Markdown/文本内容，移除无用信息
 * @param content 原始内容
 * @returns 清理后的内容
 */
function cleanContent(content: string): string {
  let cleaned = content;
  
  // 1. 简化图片链接 - 将完整的图片URL替换为简短标记
  // 匹配 ![xxx](https://...) 格式的图片链接
  cleaned = cleaned.replace(/!\[([^\]]*)\]\(https?:\/\/[^\)]+\)/g, (match, alt) => {
    return alt ? `[图片:${alt}]` : '[图片]';
  });
  
  // 2. 移除常见的广告和推广内容
  const adPatterns = [
    /广告投放\s*[:：]?\s*请加\s*QQ\s*[:：]?\s*\d+/gi,
    /长按下方图片.*?订阅微信公众号/gi,
    /识别二维码.*?订阅/gi,
    /扫码关注.*?公众号/gi,
    /点击.*?关注我们/gi,
    /更多内容请访问\s*www\.[^\s]+/gi,
  ];
  
  for (const pattern of adPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // 3. 移除版权信息（保留核心内容）
  cleaned = cleaned.replace(/Copyright\s*©?\s*[\w\s®]+\s*\d{4}(-\d{4})?/gi, '');
  
  // 4. 移除多余的markdown格式标记
  // 移除连续的星号（如 **** 或 ******）
  cleaned = cleaned.replace(/\*{3,}/g, '');
  // 移除连续的下划线
  cleaned = cleaned.replace(/_{3,}/g, '');
  // 移除连续的等号分隔线
  cleaned = cleaned.replace(/={3,}/g, '---');
  
  // 5. 移除微信公众号特有的格式
  cleaned = cleaned.replace(/预览时标签不可点/g, '');
  cleaned = cleaned.replace(/阅读\s*微信扫一扫/g, '');
  cleaned = cleaned.replace(/在小说阅读器中沉浸阅读/g, '');
  
  // 6. 移除javascript链接，保留链接文字
  cleaned = cleaned.replace(/\[([^\]]+)\]\(javascript:void\\?\(0\\?\);?\)/g, '$1');
  
  // 7. 清理多余的空行（超过2个连续空行变成2个）
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
  
  // 8. 清理行首行尾空白
  cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
  
  // 9. 移除空的markdown链接
  cleaned = cleaned.replace(/\[\s*\]\([^\)]*\)/g, '');
  
  return cleaned.trim();
}

/**
 * 开始解析(此函数为统一入口，其它同类模块也使用此函数名作为入口)
 * @param filename txt文件路径
 * @returns 处理后的txt内容
 */
export async function parse(filename: string,ragName:string): Promise<string> {
  try {
    let body = fs.readFileSync(filename);
    let content = body.toString();
    
    // 对markdown文件进行内容清理
    if (filename.endsWith('.md') || filename.endsWith('.markdown')) {
      content = cleanContent(content);
    }
    
    return content;
  } catch (error) {
    console.error('解析Markdown失败:', error);
    return '';
  }
}