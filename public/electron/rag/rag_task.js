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
var import_child_process = require("child_process");
var import_iconv_lite = __toESM(require("iconv-lite"));
var import_fs = __toESM(require("fs"));
class RagTask {
  docTable = "doc_table";
  initialized = false;
  consoleEncoding = null;
  /**
   * 重置卡住的任务
   * 启动时调用，将所有状态为1 (处理中) 的任务重置为 0 (待处理)，以便重新尝试
   */
  async resetStuckTasks() {
    import_log.logger.info("[RagTask] Checking for stuck tasks (is_parsed=1)...");
    try {
      const stuckDocs = await import_vector_lancedb.LanceDBManager.queryRecord(this.docTable, "is_parsed=1");
      if (stuckDocs && stuckDocs.length > 0) {
        import_log.logger.warn(`[RagTask] Found ${stuckDocs.length} stuck tasks. Resetting to pending state.`);
        for (const doc of stuckDocs) {
          import_log.logger.warn(`[RagTask] Resetting stuck task: ${import_path.default.basename(doc.doc_file || "unknown")} (${doc.doc_id})`);
          await import_vector_lancedb.LanceDBManager.updateRecord(this.docTable, {
            where: `doc_id='${doc.doc_id}'`,
            values: { is_parsed: 0 }
          }, import_path.default.basename(doc.doc_file || "unknown"));
        }
      } else {
        import_log.logger.info("[RagTask] No stuck tasks found.");
      }
    } catch (error) {
      import_log.logger.error("[RagTask] Error resetting stuck tasks:", error);
    }
  }
  /**
   * 清除未完成的任务队列
   */
  async clearTaskQueue() {
    import_log.logger.info("[RagTask] Clearing task queue (is_parsed != 3)...");
    try {
      await import_vector_lancedb.LanceDBManager.deleteRecord(this.docTable, "is_parsed != 3");
      import_log.logger.info("[RagTask] Task queue cleared.");
      return true;
    } catch (error) {
      import_log.logger.error("[RagTask] Error clearing task queue:", error);
      return false;
    }
  }
  /**
   * 获取未解析文档
   * @returns Promise<any>
   */
  async getNotParseDocument() {
    let result = await import_vector_lancedb.LanceDBManager.queryRecord(this.docTable, "is_parsed=0");
    if (result && result.length > 0) {
      const dataDir = import_public.pub.get_data_path();
      const repDataDir = "{DATA_DIR}";
      result.sort((a, b) => {
        let aSize = 0;
        let bSize = 0;
        try {
          const aFile = a.doc_file.replace(repDataDir, dataDir);
          aSize = import_fs.default.statSync(aFile).size / (1024 * 1024);
        } catch (e) {
          aSize = 0;
        }
        try {
          const bFile = b.doc_file.replace(repDataDir, dataDir);
          bSize = import_fs.default.statSync(bFile).size / (1024 * 1024);
        } catch (e) {
          bSize = 0;
        }
        const aIsLarge = aSize > 50;
        const bIsLarge = bSize > 50;
        if (aIsLarge && !bIsLarge) return 1;
        if (!aIsLarge && bIsLarge) return -1;
        return aSize - bSize;
      });
    }
    return result;
  }
  async getNotEmbeddingDocument() {
    let result = await import_vector_lancedb.LanceDBManager.queryRecord(this.docTable, "is_parsed=2");
    if (result && result.length > 0) {
      const dataDir = import_public.pub.get_data_path();
      const repDataDir = "{DATA_DIR}";
      result.sort((a, b) => {
        let aSize = 0;
        let bSize = 0;
        try {
          const aFile = a.md_file ? a.md_file.replace(repDataDir, dataDir) : "";
          if (aFile && import_fs.default.existsSync(aFile)) {
            aSize = import_fs.default.statSync(aFile).size / (1024 * 1024);
          }
        } catch (e) {
          aSize = 0;
        }
        try {
          const bFile = b.md_file ? b.md_file.replace(repDataDir, dataDir) : "";
          if (bFile && import_fs.default.existsSync(bFile)) {
            bSize = import_fs.default.statSync(bFile).size / (1024 * 1024);
          }
        } catch (e) {
          bSize = 0;
        }
        const aIsLarge = aSize > 50;
        const bIsLarge = bSize > 50;
        if (aIsLarge && !bIsLarge) return 1;
        if (!aIsLarge && bIsLarge) return -1;
        return aSize - bSize;
      });
    }
    return result;
  }
  getConsoleEncoding() {
    if (this.consoleEncoding) return this.consoleEncoding;
    if (process.platform === "win32") {
      try {
        const output = (0, import_child_process.execSync)("chcp").toString();
        if (output.includes("936")) {
          this.consoleEncoding = "gbk";
        } else {
          this.consoleEncoding = "utf-8";
        }
      } catch (e) {
        this.consoleEncoding = "utf-8";
      }
    } else {
      this.consoleEncoding = "utf-8";
    }
    return this.consoleEncoding;
  }
  logToTerminal(msg) {
    const encoding = this.getConsoleEncoding();
    if (encoding === "gbk") {
      try {
        const buf = import_iconv_lite.default.encode(msg + "\n", "gbk");
        process.stdout.write(buf);
      } catch (e) {
        console.log(msg);
      }
    } else {
      console.log(msg);
    }
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
  defaultSeparators(separators, filename2, text) {
    if (separators.length == 0) {
      separators = [];
      if (filename2.endsWith(".xlsx") || filename2.endsWith(".xls") || filename2.endsWith(".csv")) {
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
  getDocName(filename2) {
    let docName = import_path.default.basename(filename2);
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
  splitText(filename2, text, separators, chunkSize, overlapSize) {
    let chunks = [];
    let i = 0;
    if (separators.length == 0) {
      separators = this.defaultSeparators(separators, filename2, text);
      if (separators.length == 0) {
        return this.docChunk(text, chunkSize, overlapSize);
      }
    }
    let docName = this.getDocName(filename2);
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
  parseTask() {
    import_log.logger.info("[RagTask] Starting parallel processing loops...");
    this.runParseLoop();
    this.runEmbedLoop();
  }
  async runParseLoop() {
    const sleep = 5e3;
    while (true) {
      try {
        if (!this.initialized) {
          await this.resetStuckTasks();
          this.initialized = true;
        }
        if (global.changePath) {
          import_log.logger.info("[RagTask] Detected changePath, copying data path...");
          global.changePath = false;
          import_service.indexService.copyDataPath();
        }
        await this.parse();
      } catch (e) {
        import_log.logger.error("[RagTask] Parse loop error:", e);
      }
      await new Promise((r) => setTimeout(r, sleep));
    }
  }
  async runEmbedLoop() {
    const sleep = 5e3;
    while (true) {
      try {
        await this.embed();
      } catch (e) {
        import_log.logger.error("[RagTask] Embed loop error:", e);
      }
      await new Promise((r) => setTimeout(r, sleep));
    }
  }
  // 当向量数据足够多时，切换到余弦相似度索引
  async switchToCosineIndex() {
    this.logToTerminal("[RagTask] switchToCosineIndex called.");
    let tableList = import_public.pub.readdir(import_public.pub.get_data_path() + "/rag/vector_db");
    let indexTipsPath = import_public.pub.get_data_path() + "/rag/index_tips";
    if (!import_public.pub.file_exists(indexTipsPath)) {
      import_public.pub.mkdir(indexTipsPath);
    }
    for (let tablePath of tableList) {
      await new Promise((resolve) => setTimeout(resolve, 100));
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
    if (!notParseDocument || notParseDocument.length === 0) {
      return;
    }
    this.logToTerminal("[RagTask] parse() started.");
    this.logToTerminal(`[RagTask] Found ${notParseDocument.length} unparsed documents.`);
    if (notParseDocument && notParseDocument.length > 10) {
      notParseDocument = notParseDocument.slice(0, 10);
    }
    let dataDir = import_public.pub.get_data_path();
    let repDataDir = "{DATA_DIR}";
    let ragObj = new import_rag.Rag();
    const concurrency = 6;
    for (let i = 0; i < notParseDocument.length; i += concurrency) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const batch = notParseDocument.slice(i, i + concurrency);
      await Promise.all(batch.map(async (doc) => {
        try {
          let filename2 = doc.doc_file.replace(repDataDir, dataDir);
          const baseName = import_path.default.basename(filename2);
          const displayName = doc.doc_name || baseName;
          this.logToTerminal(`[RagTask] Marking file as processing: ${displayName} (${doc.doc_id})`);
          import_log.logger.info(`[RagTask] Marking file as processing: ${displayName} (${doc.doc_id})`);
          try {
            await Promise.race([
              import_vector_lancedb.LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: { is_parsed: 1 } }, displayName),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Update status timeout")), 6e4))
            ]);
          } catch (err) {
            this.logToTerminal(`[RagTask] Failed to mark processing status for ${doc.doc_id}, skipping.`);
            import_log.logger.error(`[RagTask] Failed to mark processing status for ${doc.doc_id}, skipping.`, err);
            return;
          }
          this.logToTerminal(`[RagTask] Start parsing file: ${displayName} (ID: ${doc.doc_id})`);
          import_log.logger.info(`[RagTask] Start parsing file: ${displayName} (ID: ${doc.doc_id})`);
          let timeoutMs = 300 * 1e3;
          try {
            const stats = import_fs.default.statSync(filename2);
            const fileSizeMB = stats.size / (1024 * 1024);
            if (fileSizeMB > 50) {
              this.logToTerminal(`[RagTask] WARNING: File ${displayName} is large (${fileSizeMB.toFixed(2)} MB). Increasing timeout.`);
              import_log.logger.warn(`[RagTask] File ${displayName} is large (${fileSizeMB.toFixed(2)} MB).`);
              timeoutMs = 1800 * 1e3;
            }
          } catch (e) {
          }
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`Parse timeout after ${timeoutMs}ms`)), timeoutMs));
          let fileExt = import_path.default.extname(doc.doc_name);
          let fileNameNoExt = import_path.default.basename(doc.doc_name, fileExt);
          let customOutputName = `${fileNameNoExt}_${doc.doc_id}${fileExt}.md`;
          const progressInterval = setInterval(() => {
            this.logToTerminal(`[RagTask] Still parsing ${displayName} (${doc.doc_id})...`);
          }, 3e4);
          let parseDoc;
          try {
            parseDoc = await Promise.race([
              ragObj.parseDocument(filename2, doc.doc_rag, true, customOutputName),
              timeout
            ]);
          } finally {
            clearInterval(progressInterval);
          }
          this.logToTerminal(`[RagTask] Finished parsing file: ${displayName}`);
          import_log.logger.info(`[RagTask] Finished parsing file: ${displayName}`);
          if (parseDoc) {
            this.logToTerminal(`[RagTask] Parse result for ${displayName}: Success=${parseDoc.content ? "Yes" : "No"}, ContentLength=${parseDoc.content ? parseDoc.content.length : 0}, SavedPath=${parseDoc.savedPath || "None"}`);
          } else {
            this.logToTerminal(`[RagTask] Parse result for ${displayName}: NULL`);
          }
          if (!parseDoc.content) {
            this.logToTerminal(`[RagTask] No content parsed for ${displayName} (${doc.doc_id})`);
            import_log.logger.warn(`[RagTask] No content parsed for ${displayName} (${doc.doc_id})`);
            await import_vector_lancedb.LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: { is_parsed: -1 } }, displayName);
            return;
          }
          if (parseDoc.savedPath) {
            this.logToTerminal(`[RagTask] \u89E3\u6790\u4EA7\u51FA MD \u6587\u4EF6: ${parseDoc.savedPath}`);
            import_log.logger.info(`[RagTask] \u89E3\u6790\u4EA7\u51FA MD \u6587\u4EF6: ${parseDoc.savedPath}`);
          }
          const postProcessPromise = (async () => {
            this.logToTerminal(`[RagTask] Start generating abstract for ${displayName}`);
            import_log.logger.info(`[RagTask] Start generating abstract for ${displayName}`);
            const abstract = await Promise.race([
              ragObj.generateAbstract(parseDoc.content),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Generate abstract timeout")), 12e4))
            ]);
            this.logToTerminal(`[RagTask] Skip full-doc keywords for ${displayName}`);
            import_log.logger.info(`[RagTask] Skip full-doc keywords for ${displayName}`);
            const keywords = [];
            const pdata = {
              md_file: parseDoc.savedPath?.replace(dataDir, repDataDir),
              doc_abstract: abstract,
              is_parsed: 2,
              update_time: import_public.pub.time()
            };
            this.logToTerminal(`[RagTask] Start updating record for ${displayName}`);
            import_log.logger.info(`[RagTask] Start updating record for ${displayName}`);
            await Promise.race([
              import_vector_lancedb.LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: pdata }, displayName),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Update success status timeout")), 6e4))
            ]);
            this.logToTerminal(`[RagTask] Successfully updated record for ${displayName}`);
            import_log.logger.info(`[RagTask] Successfully updated record for ${displayName}`);
            return true;
          })();
          await Promise.race([
            postProcessPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Post-processing timeout")), 18e4))
          ]);
        } catch (e) {
          this.logToTerminal(`[RagTask] [parseDocument]\u89E3\u6790\u6587\u6863\u5931\u8D25: ${e}`);
          import_log.logger.error(import_public.pub.lang("[parseDocument]\u89E3\u6790\u6587\u6863\u5931\u8D25"), e);
          try {
            await Promise.race([
              import_vector_lancedb.LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: { is_parsed: -1 } }, doc.doc_name || import_path.default.basename(filename)),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Update failed status timeout")), 6e4))
            ]);
          } catch (updateErr) {
            import_log.logger.error(`[RagTask] Failed to mark failed status for ${doc.doc_id}`, updateErr);
          }
        }
      }));
    }
  }
  async processDocument(doc, dataDir, repDataDir, ragObj, ragNameList) {
    let md_file = doc.md_file.replace(repDataDir, dataDir);
    let fileName = doc.doc_name || import_path.default.basename(md_file);
    try {
      import_log.logger.info(`[RagTask] [${fileName}] 1. Start processing (${doc.doc_id})`);
      if (!import_public.pub.file_exists(md_file)) {
        import_log.logger.warn(`[RagTask] MD file not found for ${fileName} (${doc.doc_id}): ${md_file}`);
        await Promise.race([
          import_vector_lancedb.LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: { is_parsed: -1 } }, fileName),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Update not found status timeout")), 6e4))
        ]);
        return;
      }
      this.logToTerminal(`[RagTask] [${fileName}] 2. Reading file...`);
      let md_body = import_public.pub.read_file(md_file);
      const chunkSize = doc.chunk_size || 1e3;
      const overlap = 100;
      this.logToTerminal(`[RagTask] [${fileName}] 3. Splitting text...`);
      let chunks = this.splitText(doc.doc_file, md_body, doc.separators, chunkSize, overlap);
      this.logToTerminal(`[RagTask] [${fileName}] Split into ${chunks.length} chunks.`);
      let chunkList = [];
      const logInterval = chunks.length > 1e3 ? 100 : chunks.length > 100 ? 20 : 5;
      for (let j = 0; j < chunks.length; j++) {
        let chunk = chunks[j];
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (j % logInterval === 0 || j === chunks.length - 1) {
          this.logToTerminal(`[RagTask] [${fileName}] 4. Generating keywords: ${j + 1}/${chunks.length}`);
        }
        let chunkInfo = {
          text: chunk,
          docId: doc.doc_id,
          tokens: import_public.pub.cutForSearch(chunk).join(" "),
          keywords: await Promise.race([
            ragObj.generateKeywords(chunk, 3),
            new Promise((resolve) => setTimeout(() => resolve([]), 3e4))
          ])
        };
        chunkList.push(chunkInfo);
      }
      this.logToTerminal(`[RagTask] [${fileName}] 5. Adding to LanceDB (chunks: ${chunkList.length})...`);
      let table = import_public.pub.md5(doc.doc_rag);
      let ragInfo = await Promise.race([
        ragObj.getRagInfo(doc.doc_rag),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Get RagInfo timeout")), 1e4))
      ]);
      try {
        const texts = chunkList.map((i) => i.text);
        const keywordsArr = chunkList.map((i) => i.keywords);
        this.logToTerminal(`[RagTask] [${fileName}] Invoking LanceDBManager.addDocuments...`);
        await Promise.race([
          import_vector_lancedb.LanceDBManager.addDocuments(table, ragInfo.supplierName, ragInfo.embeddingModel, texts, keywordsArr, doc.doc_id),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Add documents timeout")), 3e5))
        ]);
        this.logToTerminal(`[RagTask] [${fileName}] LanceDBManager.addDocuments completed.`);
      } catch (e) {
        import_log.logger.error(import_public.pub.lang("[addDocuments]\u6279\u91CF\u63D2\u5165\u6570\u636E\u5931\u8D25"), e);
        const msg = String(e?.message || e);
        if (msg.includes("Commit conflict") || msg.includes("concurrent commit")) {
          return;
        }
        throw e;
      }
      this.logToTerminal(`[RagTask] [${fileName}] 6. Updating status...`);
      await Promise.race([
        import_vector_lancedb.LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: { is_parsed: 3 } }, fileName),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Update success status timeout")), 6e4))
      ]);
      if (!ragNameList.includes(doc.doc_rag)) {
        ragNameList.push(doc.doc_rag);
      }
      this.logToTerminal(`[RagTask] [${fileName}] Done.`);
      import_log.logger.info(`[RagTask] [${fileName}] (${doc.doc_id}) Done.`);
    } catch (error) {
      import_log.logger.error(`[RagTask] Error processing document ${fileName} (${doc.doc_id})`, error);
      try {
        await Promise.race([
          import_vector_lancedb.LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: { is_parsed: -1 } }, fileName),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Update failed status timeout")), 6e4))
        ]);
      } catch (updateErr) {
        import_log.logger.error(`[RagTask] Failed to update status to -1 for ${doc.doc_id}`, updateErr);
      }
    }
  }
  /**
   * 开始嵌入文档
   * @returns Promise<string>
   */
  async embed() {
    try {
      import_log.logger.info("[RagTask] Checking for embedding tasks...");
      let notEmbeddingDocument = await this.getNotEmbeddingDocument();
      if (notEmbeddingDocument && notEmbeddingDocument.length > 0) {
        import_log.logger.info(`[RagTask] Found ${notEmbeddingDocument.length} tasks in getNotEmbeddingDocument`);
        notEmbeddingDocument.sort((a, b) => {
          if (a.doc_rag === "PDF" && b.doc_rag !== "PDF") return -1;
          if (a.doc_rag !== "PDF" && b.doc_rag === "PDF") return 1;
          return 0;
        });
      }
      if (!notEmbeddingDocument || notEmbeddingDocument.length === 0) {
        return;
      }
      this.logToTerminal("[RagTask] embed() started.");
      this.logToTerminal(`[RagTask] Found ${notEmbeddingDocument.length} unembedded documents.`);
      if (notEmbeddingDocument && notEmbeddingDocument.length > 50) {
        notEmbeddingDocument = notEmbeddingDocument.slice(0, 50);
      }
      let dataDir = import_public.pub.get_data_path();
      let repDataDir = "{DATA_DIR}";
      let ragObj = new import_rag.Rag();
      let ragNameList = [];
      const embedConcurrency = 1;
      const executing = [];
      for (const doc of notEmbeddingDocument) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        const p = this.processDocument(doc, dataDir, repDataDir, ragObj, ragNameList).then(() => {
          const index = executing.indexOf(p);
          if (index > -1) {
            executing.splice(index, 1);
          }
        });
        executing.push(p);
        if (executing.length >= embedConcurrency) {
          await Promise.race(executing);
        }
      }
      await Promise.all(executing);
      if (ragNameList.length > 0) {
        this.logToTerminal("[RagTask] Starting FTS index update for: " + ragNameList.join(", "));
        import_log.logger.info("[RagTask] Starting FTS index update for: " + ragNameList.join(", "));
        for (let ragName of ragNameList) {
          try {
            await new Promise((resolve) => setTimeout(resolve, 100));
            let encryptTableName = import_public.pub.md5(ragName);
            this.logToTerminal(`[RagTask] Creating index for ${ragName}...`);
            import_log.logger.info(`[RagTask] Creating index for ${ragName}...`);
            await Promise.race([
              import_vector_lancedb.LanceDBManager.createDocFtsIndex(encryptTableName),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Create FTS Index timeout")), 3e5))
            ]);
            this.logToTerminal(`[RagTask] Optimizing table ${ragName}...`);
            import_log.logger.info(`[RagTask] Optimizing table ${ragName}...`);
            await Promise.race([
              import_vector_lancedb.LanceDBManager.optimizeTable(encryptTableName),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Optimize Table timeout")), 3e5))
            ]);
            this.logToTerminal(`[RagTask] Finished index update for ${ragName}`);
            import_log.logger.info(`[RagTask] Finished index update for ${ragName}`);
          } catch (err) {
            this.logToTerminal(`[RagTask] Failed to update index for ${ragName}: ${err}`);
            import_log.logger.error(`[RagTask] Failed to update index for ${ragName}`, err);
          }
        }
        this.logToTerminal("[RagTask] All index updates completed.");
        import_log.logger.info("[RagTask] All index updates completed.");
      }
    } catch (e) {
      this.logToTerminal(`[RagTask] [embed]\u5D4C\u5165\u6587\u6863\u5931\u8D25: ${e}`);
      import_log.logger.error(import_public.pub.lang("[embed]\u5D4C\u5165\u6587\u6863\u5931\u8D25"), e);
      return e;
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RagTask
});
