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
var rag_task_exports = {};
__export(rag_task_exports, {
  RagTask: () => RagTask
});
module.exports = __toCommonJS(rag_task_exports);
var import_vector_lancedb = require("./vector_database/vector_lancedb");
var import_public = require("../class/public");
var import_rag = require("./rag");
var import_service = require("../service/index");
var import_log = require("ee-core/log");
var import_path = __toESM(require("path"));
class RagTask {
  docTable = "doc_table";
  /**
   * 获取未解析文档
   * @returns Promise<any>
   */
  async getNotParseDocument() {
    let result = await import_vector_lancedb.LanceDBManager.queryRecord(this.docTable, "is_parsed=0");
    return result;
  }
  async getNotEmbeddingDocument() {
    let result = await import_vector_lancedb.LanceDBManager.queryRecord(this.docTable, "is_parsed=2");
    return result;
  }
  /**
   * 文档分割 - 将长文本分割成小块，尊重Markdown文档结构
   * @param docBody 待分割的文档内容
   * @returns 分割后的文本块数组
   */
  docChunk(docBody, chunkSize, overlapSize) {
    if (!chunkSize || chunkSize < 100) {
      chunkSize = 1e3;
    }
    if (!overlapSize) {
      overlapSize = 100;
    }
    const minSizeForOverlap = overlapSize;
    if (!docBody || docBody.trim().length === 0) {
      return [];
    }
    const chunks = [];
    const headingRegex = /^#{1,6}\s+.+$/gm;
    const headingMatches = [...docBody.matchAll(headingRegex)];
    if (headingMatches.length > 1) {
      const sections = [];
      for (let i = 0; i < headingMatches.length; i++) {
        const currentMatch = headingMatches[i];
        const nextMatch = headingMatches[i + 1];
        const startIdx = currentMatch.index;
        const endIdx = nextMatch ? nextMatch.index : docBody.length;
        sections.push(docBody.substring(startIdx, endIdx));
      }
      for (const section of sections) {
        if (section.length <= chunkSize) {
          chunks.push(section.trim());
        } else {
          const subChunks = this.splitTextBySize(section, chunkSize, overlapSize, minSizeForOverlap);
          chunks.push(...subChunks);
        }
      }
    } else {
      const textChunks = this.splitTextBySize(docBody, chunkSize, overlapSize, minSizeForOverlap);
      chunks.push(...textChunks);
    }
    return chunks;
  }
  /**
   * 辅助方法：按大小分割文本
   */
  splitTextBySize(text, chunkSize, overlapSize, minSizeForOverlap) {
    const chunks = [];
    const paragraphs = text.split("\n\n");
    let currentChunk = "";
    for (const paragraph of paragraphs) {
      if (paragraph.length > chunkSize) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        const lines = paragraph.split("\n");
        for (const line of lines) {
          if (currentChunk.length + line.length > chunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            if (currentChunk.length >= minSizeForOverlap) {
              currentChunk = currentChunk.slice(-overlapSize);
            } else {
              currentChunk = "";
            }
          }
          currentChunk += line + "\n";
        }
      } else {
        if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          if (currentChunk.length >= minSizeForOverlap) {
            currentChunk = currentChunk.slice(-overlapSize);
          } else {
            currentChunk = "";
          }
        }
        currentChunk += paragraph + "\n\n";
      }
    }
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  }
  // 递归分割
  recursionSplit(chunkList, separators, chunkSize, currentSep, overlapSize) {
    let chunks = [];
    let currentSepIsString = typeof currentSep == "string";
    for (let chunk of chunkList) {
      if (chunk.length == 0) {
        continue;
      }
      if (chunk.length <= chunkSize) {
        if (currentSepIsString) {
          chunks.push(chunk.trim() + currentSep);
        } else {
          chunks.push(chunk.trim());
        }
        continue;
      }
      if (separators.length > 0) {
        let sep = separators[0];
        let chunkList2 = this.split(chunk, sep);
        chunks.push(...this.recursionSplit(chunkList2, separators.slice(1), chunkSize, sep, overlapSize));
      } else {
        chunks.push(...this.docChunk(chunk, chunkSize, overlapSize));
      }
    }
    return chunks;
  }
  // 使用分隔符分割文本
  // 这里的分隔符可以是字符串或正则表达式
  split(text, sep) {
    let chunkList = [];
    if (typeof sep == "string") {
      chunkList = text.split(sep);
    } else {
      let keys = text.match(sep);
      if (keys == null) {
        return [text];
      }
      for (let key of keys) {
        let splitArr = text.split(key);
        let arrLen = splitArr.length;
        if (arrLen > 1) {
          for (let i = 0; i < arrLen; i++) {
            let chunk = splitArr[i];
            if (i > 0) {
              chunk = key + chunk;
            }
            if (i == arrLen - 1) {
              text = chunk;
              continue;
            }
            if (chunk.length > 0) {
              chunkList.push(chunk);
            }
          }
        }
      }
      if (text.length > 0) {
        chunkList.push(text);
      }
    }
    return chunkList;
  }
  // 自动识别分隔符
  defaultSeparators(separators, filename, text) {
    if (separators.length == 0) {
      separators = [];
      if (filename.endsWith(".xlsx") || filename.endsWith(".xls") || filename.endsWith(".csv")) {
        separators = ["\n"];
        return separators;
      }
      let patt_list = [
        /(第.{1,10}章[\s\:\.：])/g,
        /(第.{1,10}条[\s\:\.：])/g,
        /(第.{1,10}节[\s\:\.：])/g,
        /(第.{1,10}款[\s\:\.：])/g,
        /(\s[一二三四五六七八九十]{1,5}[\s:\.：、])/g,
        /(\s\([一二三四五六七八九十]{1,5}\)[\s:\.：、])/g,
        /(Slide\s+\d+)/g,
        /(\s\d{1,4}\.\d{1,4}[\s:\.\：、])/g,
        /(\s\(\d{1,4}\)[\s:\.\：、])/g
      ];
      for (let patt of patt_list) {
        let keys = text.match(patt);
        if (keys && keys.length > 3) {
          separators.push("/" + patt.source + "/");
        }
      }
    }
    return separators;
  }
  // 格式化分割符
  formatSep(sep) {
    let sepList = [];
    for (let s of sep) {
      if (s.length > 3 && s.startsWith("/") && (s.endsWith("/") || s.endsWith("/g"))) {
        if (s.endsWith("/g")) {
          s = s.slice(1, -2);
        } else {
          s = s.slice(1, -1);
        }
        if (!s.startsWith("(") || !s.endsWith(")")) {
          s = "(" + s + ")";
        }
        sepList.push(new RegExp(s, "g"));
      } else {
        sepList.push(s);
      }
    }
    return sepList;
  }
  // 获取文档名称
  getDocName(filename) {
    let docName = import_path.default.basename(filename);
    if (docName.includes(".")) {
      docName = docName.replace(".md", "").split(".").slice(0, -1).join(".");
    }
    return docName;
  }
  /**
   * 
   * @param text <string> 文本内容
   * @param separators <string[]> 分隔符列表
   * @param chunkSize <number> 每个块的大小
   * @returns 
   */
  splitText(filename, text, separators, chunkSize, overlapSize) {
    let chunks = [];
    let i = 0;
    if (separators.length == 0) {
      separators = this.defaultSeparators(separators, filename, text);
      if (separators.length == 0) {
        return this.docChunk(text, chunkSize, overlapSize);
      }
    }
    let docName = this.getDocName(filename);
    let sepList = this.formatSep(separators);
    let sep = sepList[i];
    let chunkList = this.split(text, sep);
    chunks = this.recursionSplit(chunkList, sepList.slice(1), chunkSize, sep, overlapSize);
    for (let i2 = 0; i2 < chunks.length; i2++) {
      let chunk = chunks[i2].trim();
      if (chunk.length > 0) {
        let startPos = text.indexOf(chunk);
        let endPos = startPos + chunk.length;
        chunks[i2] = `[${docName}]#${i2 + 1} POS[${startPos}-${endPos}]
` + chunk;
      }
    }
    return chunks;
  }
  // 后台解析任务
  async parseTask() {
    const sleep = 5 * 1e3;
    let self = this;
    setTimeout(async () => {
      if (global.changePath) {
        global.changePath = false;
        import_service.indexService.copyDataPath();
      }
      await self.parse();
      await self.embed();
      self.parseTask();
    }, sleep);
  }
  // 当向量数据足够多时，切换到余弦相似度索引
  async switchToCosineIndex() {
    let tableList = import_public.pub.readdir(import_public.pub.get_data_path() + "/rag/vector_db");
    let indexTipsPath = import_public.pub.get_data_path() + "/rag/index_tips";
    if (!import_public.pub.file_exists(indexTipsPath)) {
      import_public.pub.mkdir(indexTipsPath);
    }
    for (let tablePath of tableList) {
      let tableName = tablePath.split("/").pop()?.replace(".lance", "");
      if (tableName?.length !== 32) {
        continue;
      }
      await import_vector_lancedb.LanceDBManager.createDocFtsIndex(tableName);
      let indexTipFile = indexTipsPath + "/" + tableName + ".pl";
      if (import_public.pub.file_exists(indexTipFile)) {
        continue;
      }
      if (await import_vector_lancedb.LanceDBManager.tableCount(tableName) > 256) {
        await import_vector_lancedb.LanceDBManager.addIndex(tableName, [{ type: "ivfPq", key: "vector" }]);
        import_public.pub.write_file(indexTipFile, "1");
      }
    }
  }
  /**
   * 解析文档
   * @returns Promise<void>
   */
  async parse() {
    let notParseDocument = await this.getNotParseDocument();
    let dataDir = import_public.pub.get_data_path();
    let repDataDir = "{DATA_DIR}";
    let ragObj = new import_rag.Rag();
    for (let doc of notParseDocument) {
      try {
        let filename = doc.doc_file.replace(repDataDir, dataDir);
        let parseDoc = await ragObj.parseDocument(filename, doc.doc_rag, true);
        if (!parseDoc.content) {
          await import_vector_lancedb.LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: { is_parsed: -1 } });
          continue;
        }
        let pdata = {
          md_file: parseDoc.savedPath?.replace(dataDir, repDataDir),
          doc_abstract: await ragObj.generateAbstract(parseDoc.content),
          doc_keywords: await ragObj.generateKeywords(parseDoc.content, 5),
          is_parsed: 2,
          update_time: import_public.pub.time()
        };
        await import_vector_lancedb.LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: pdata });
      } catch (e) {
        import_log.logger.error(import_public.pub.lang("[parseDocument]\u89E3\u6790\u6587\u6863\u5931\u8D25"), e);
        await import_vector_lancedb.LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: { is_parsed: -1 } });
      }
    }
  }
  /**
   * 开始嵌入文档
   * @returns Promise<string>
   */
  async embed() {
    try {
      let notEmbeddingDocument = await this.getNotEmbeddingDocument();
      let dataDir = import_public.pub.get_data_path();
      let repDataDir = "{DATA_DIR}";
      let ragObj = new import_rag.Rag();
      let ragNameList = [];
      for (let doc of notEmbeddingDocument) {
        let md_file = doc.md_file.replace(repDataDir, dataDir);
        if (!import_public.pub.file_exists(md_file)) {
          continue;
        }
        let md_body = import_public.pub.read_file(md_file);
        let chunks = this.splitText(doc.doc_file, md_body, doc.separators, doc.chunk_size, doc.overlap_size);
        let chunkList = [];
        for (let chunk of chunks) {
          let chunkInfo = {
            text: chunk,
            docId: doc.doc_id,
            tokens: import_public.pub.cutForSearch(chunk).join(" "),
            keywords: await ragObj.generateKeywords(chunk, 5)
          };
          chunkList.push(chunkInfo);
        }
        let table = import_public.pub.md5(doc.doc_rag);
        let ragInfo = await ragObj.getRagInfo(doc.doc_rag);
        for (let checkInfo of chunkList) {
          try {
            await import_vector_lancedb.LanceDBManager.addDocument(table, ragInfo.supplierName, ragInfo.embeddingModel, checkInfo.text, checkInfo.keywords, checkInfo.docId, checkInfo.tokens);
          } catch (e) {
            import_log.logger.error(import_public.pub.lang("[addDocument]\u63D2\u5165\u6570\u636E\u5931\u8D25"), e);
            await import_vector_lancedb.LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: { is_parsed: -1 } });
          }
        }
        await import_vector_lancedb.LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: { is_parsed: 3 } });
        if (!ragNameList.includes(doc.doc_rag)) {
          ragNameList.push(doc.doc_rag);
        }
      }
      for (let ragName of ragNameList) {
        let encryptTableName = import_public.pub.md5(ragName);
        await import_vector_lancedb.LanceDBManager.createDocFtsIndex(encryptTableName);
        await import_vector_lancedb.LanceDBManager.optimizeTable(encryptTableName);
      }
    } catch (e) {
      import_log.logger.error(import_public.pub.lang("[embed]\u5D4C\u5165\u6587\u6863\u5931\u8D25"), e);
      return e;
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RagTask
});
