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
var vector_lancedb_exports = {};
__export(vector_lancedb_exports, {
  LanceDBManager: () => LanceDBManager
});
module.exports = __toCommonJS(vector_lancedb_exports);
var lancedb = __toESM(require("@lancedb/lancedb"));
var import_public = require("../../class/public");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_log = require("ee-core/log");
var import_model = require("../../service/model");
class LanceDBManager {
  // 向量维度
  static DIMENSION = 1024;
  // 是否启用性能监控
  static ENABLE_METRICS = false;
  static async connect(dbPath) {
    if (!dbPath) {
      dbPath = import_public.pub.get_db_path();
    }
    const db = await lancedb.connect(dbPath);
    return db;
  }
  // 优化指定表
  static async optimizeTable(tableName) {
    try {
      let dbPath = import_public.pub.get_db_path();
      let dataPath = path.resolve(dbPath, tableName + ".lance");
      if (!fs.existsSync(dataPath)) {
        return import_public.pub.lang("\u6307\u5B9A\u8868\u4E0D\u5B58\u5728");
      }
      let oldSize = import_public.pub.getDirSize(dataPath);
      const db = await lancedb.connect(import_public.pub.get_db_path());
      const tableObj = await db.openTable(tableName);
      await tableObj.optimize({
        deleteUnverified: true,
        cleanupOlderThan: /* @__PURE__ */ new Date()
      });
      tableObj.close();
      db.close();
      let newSize = import_public.pub.getDirSize(dataPath);
      let size = oldSize - newSize;
      if (size < 0) size = 0;
      return import_public.pub.lang("\u4F18\u5316\u6210\u529F,\u91CA\u653E\u7A7A\u95F4: {}", import_public.pub.bytesChange(size));
    } catch (e) {
      import_log.logger.error("\u4F18\u5316\u8868\u5931\u8D25", e);
      return import_public.pub.lang("\u4F18\u5316\u5931\u8D25: {}", e.message);
    }
  }
  // 优化所有表
  static async optimizeAllTable() {
    try {
      if (global.isOptimizeAllTable) {
        return;
      }
      global.isOptimizeAllTable = true;
      let tipPath = path.join(import_public.pub.get_data_path(), "rag", "index_tips");
      let tipFile = path.join(tipPath, `optimize-${import_public.pub.getCurrentDate()}.pl`);
      if (fs.existsSync(tipFile)) {
        global.isOptimizeAllTable = false;
        return;
      }
      const db = await lancedb.connect(import_public.pub.get_db_path());
      const tables = await db.tableNames();
      let optimizedTables = [];
      let startTime = import_public.pub.time();
      for (let table of tables) {
        const tableObj = await db.openTable(table);
        await tableObj.optimize({ deleteUnverified: true, cleanupOlderThan: /* @__PURE__ */ new Date() });
        tableObj.close();
        optimizedTables.push(table);
      }
      let endTime = import_public.pub.time();
      db.close();
      if (!fs.existsSync(tipPath)) {
        fs.mkdirSync(tipPath, { recursive: true });
      }
      import_public.pub.write_file(tipFile, `optimizedTables: ${optimizedTables.join(",")}
time: ${endTime - startTime}s`);
    } catch (e) {
      import_log.logger.error("\u4F18\u5316\u8868\u5931\u8D25", e);
    } finally {
      global.isOptimizeAllTable = false;
    }
  }
  /**
   * 确保数据库目录存在
   */
  static ensureDatabaseDirectory() {
    let dbPath = import_public.pub.get_db_path();
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }
  }
  /**
   * 开始性能监控
   * @param operation 操作名称
   * @returns 性能指标对象
   */
  static startMetrics(operation) {
    return this.ENABLE_METRICS ? { operation, startTime: performance.now() } : { operation, startTime: 0 };
  }
  /**
   * 结束性能监控并输出结果
   * @param metrics 性能指标对象
   */
  static endMetrics(metrics) {
    if (!this.ENABLE_METRICS) return;
    metrics.endTime = performance.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    import_log.logger.info(`[\u6027\u80FD] ${metrics.operation}: ${metrics.duration.toFixed(2)}ms`);
  }
  static getEmbeddingCachePath() {
    return path.join(import_public.pub.get_data_path(), "embedding_cache");
  }
  /**
   * 清理过期的向量缓存
   */
  static async clearExpiredCache() {
    if (global.isClearExpiredCache) {
      return;
    }
    let cache_path = this.getEmbeddingCachePath();
    let files = import_public.pub.readdir(cache_path);
    let now = /* @__PURE__ */ new Date();
    let nowTime = now.getTime();
    let week = 1e3 * 60 * 60 * 24 * 7;
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      let stat = fs.statSync(file);
      let atime = stat.atime.getTime();
      if (nowTime - atime > week) {
        fs.unlinkSync(file);
      }
    }
    global.isClearExpiredCache = true;
  }
  /**
   * 获取向量缓存
   * @param key 缓存键
   * @returns number[] 
   */
  static async getEmbeddingCache(key) {
    let cache_path = this.getEmbeddingCachePath();
    if (!fs.existsSync(cache_path)) {
      fs.mkdirSync(cache_path, { recursive: true });
    }
    let cache_file = path.join(cache_path, `${key}.json`);
    if (fs.existsSync(cache_file)) {
      let cache = import_public.pub.read_json(cache_file);
      let now = /* @__PURE__ */ new Date();
      fs.utimesSync(cache_file, now, now);
      return cache;
    }
    return [];
  }
  /**
   * 设置向量缓存
   * @param key <string> 缓存键
   * @param embedding <number[]> 向量嵌入
   * @returns void
   */
  static async setEmbeddingCache(key, embedding) {
    let cache_path = this.getEmbeddingCachePath();
    if (!fs.existsSync(cache_path)) {
      fs.mkdirSync(cache_path, { recursive: true });
    }
    if (!embedding || embedding.length == 0) {
      return;
    }
    let cache_file = path.join(cache_path, `${key}.json`);
    import_public.pub.write_file(cache_file, JSON.stringify(embedding));
    this.clearExpiredCache();
  }
  /**
   * 获取文本的向量嵌入
   * @param supplierName 供应商名称
   * @param model 使用的模型名称
   * @param text 需要嵌入的文本
   * @returns 向量嵌入
   * @throws 如果嵌入生成失败或维度不匹配
   */
  static async getEmbedding(supplierName, model, text) {
    const metrics = this.startMetrics(`\u751F\u6210\u5D4C\u5165 (${text.substring(0, 30)}...)`);
    let key = import_public.pub.md5(`${supplierName}-${model}-${text}`);
    let embedding = await this.getEmbeddingCache(key);
    if (embedding.length > 0) {
      return embedding;
    }
    try {
      let res;
      if (supplierName == "ollama") {
        const ollama = import_public.pub.init_ollama();
        res = await ollama.embeddings({
          model,
          prompt: text
        });
      } else {
        let modelService = new import_model.ModelService(supplierName);
        res = await modelService.embedding(model, text);
        modelService.destroy();
        if (!res) {
          throw new Error(modelService.error);
        }
      }
      if (!res.embedding || res.embedding.length !== this.DIMENSION) {
        if (!res.embedding) {
          throw new Error(`\u5D4C\u5165\u7EF4\u5EA6\u9519\u8BEF: \u671F\u671B ${this.DIMENSION}, \u5B9E\u9645 ${res.embedding ? res.embedding.length : 0}, \u6A21\u578B: ${model}, \u6587\u672C: ${text}`);
        }
        if (res.embedding && res.embedding.length < this.DIMENSION) {
          const padding = new Array(this.DIMENSION - res.embedding.length).fill(0);
          res.embedding = res.embedding.concat(padding);
        }
      }
      await this.setEmbeddingCache(key, res.embedding);
      return res.embedding;
    } catch (error) {
      throw new Error(`\u751F\u6210\u5D4C\u5165\u65F6\u51FA\u9519: ${error.message}`);
    } finally {
      this.endMetrics(metrics);
    }
  }
  /**
   * 检查表是否存在
   * @param db LanceDB连接
   * @param table 表名
   * @returns 表是否存在
   */
  static async tableExists(db, table) {
    try {
      const tables = await db.tableNames();
      return tables.includes(table);
    } catch {
      return false;
    }
  }
  /**
   * 创建表
   * @param tableName 表名
   * @param model 使用的模型名称
   * @param initialText 初始文本
   * @returns 成功创建的表名
   */
  static async createTable(tableName, supplierName, model, initialText) {
    const metrics = this.startMetrics(`\u521B\u5EFA\u8868 ${tableName}`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (await this.tableExists(db, tableName)) {
        throw new Error(`\u8868 "${tableName}" \u5DF2\u5B58\u5728`);
      }
      const embedding = await this.getEmbedding(supplierName, model, initialText);
      const tableObj = await db.createTable(tableName, [{
        id: "1",
        doc: initialText,
        vector: embedding,
        docId: "0",
        tokens: initialText,
        keywords: ["keyword1", "keyword2"]
      }]);
      try {
        await tableObj.createIndex("docId", {
          config: lancedb.Index.btree()
        });
      } catch (e) {
        import_log.logger.error("\u521B\u5EFAdocId\u7D22\u5F15\u5931\u8D25", e);
      }
      try {
        await tableObj.createIndex("tokens", {
          config: lancedb.Index.fts()
          // 全文搜索
        });
      } catch (e) {
        import_log.logger.error("\u521B\u5EFAdoc\u7D22\u5F15\u5931\u8D25", e);
      }
      try {
        await tableObj.createIndex("keywords", {
          config: lancedb.Index.labelList()
          // 
        });
      } catch (e) {
        import_log.logger.error("\u521B\u5EFAkeywords\u7D22\u5F15\u5931\u8D25", e);
      }
      await tableObj.delete(`id='1'`);
      return tableName;
    } catch (error) {
      throw new Error(`\u521B\u5EFA\u8868\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  /**
   * 自定义创建表
   * @param tableName 表名
   * @param tableStruct 表结构
   * @param indexKeys 索引 示例：[{key:'msg',type:'ivfPq'},{key:'docId',type:'btree'}]
   * @returns boolean
   */
  static async createTableAt(tableName, tableStruct, indexKeys) {
    const metrics = this.startMetrics(`\u521B\u5EFA\u8868 ${tableName}`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (await this.tableExists(db, tableName)) {
        throw new Error(`\u8868 "${tableName}" \u5DF2\u5B58\u5728`);
      }
      const tableObj = await db.createTable(tableName, tableStruct);
      for (const indexKey of indexKeys) {
        let indexConfig = null;
        switch (indexKey.type) {
          case "ivfPq":
            indexConfig = lancedb.Index.ivfPq({
              distanceType: "cosine"
              // 余弦距离
            });
            break;
          case "btree":
            indexConfig = lancedb.Index.btree();
            break;
          case "bitmap":
            indexConfig = lancedb.Index.bitmap();
            break;
          case "labelList":
            indexConfig = lancedb.Index.labelList();
            break;
          case "fts":
            indexConfig = lancedb.Index.fts();
            break;
          case "hnswPq":
            indexConfig = lancedb.Index.hnswPq();
            break;
          case "hnswSq":
            indexConfig = lancedb.Index.hnswSq();
            break;
          default:
            indexConfig = lancedb.Index.btree();
            break;
        }
        await tableObj.createIndex(indexKey.key, {
          config: indexConfig
        });
      }
      return true;
    } catch (error) {
      throw new Error(`\u521B\u5EFA\u8868\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  /**
   * 创建FTS索引
   * @param tableName 表名
   * @returns boolean
   */
  static async createDocFtsIndex(tableName) {
    try {
      const db = await lancedb.connect(import_public.pub.get_db_path());
      const tableObj = await db.openTable(tableName);
      let indexName = "doc_idx";
      let indexStats = await tableObj.indexStats(indexName);
      if (indexStats) {
        await tableObj.dropIndex(indexName);
      }
      let shcema = await tableObj.schema();
      let tokensColumn = shcema.fields.find((col) => col.name === "tokens");
      if (!tokensColumn) {
        await tableObj.addColumns([{
          name: "tokens",
          valueSql: "cast(doc as string)"
        }]);
        let data = await tableObj.query().select(["id", "doc"]).limit(1e6).toArray();
        for (let i = 0; i < data.length; i++) {
          let doc = data[i].doc;
          let id = data[i].id;
          let result = import_public.pub.cutForSearch(doc);
          let tokens = result.join(" ");
          await tableObj.update({ where: `id='${id}'`, values: { tokens } });
        }
        await tableObj.optimize();
      }
      indexName = "tokens_idx";
      indexStats = await tableObj.indexStats(indexName);
      if (!indexStats) {
        await tableObj.createIndex("tokens", {
          config: lancedb.Index.fts()
        });
      }
      tableObj.close();
      db.close();
    } catch (e) {
      import_log.logger.error("\u521B\u5EFAFTS\u7D22\u5F15\u5931\u8D25", e);
    }
  }
  /**
   * 添加索引
   * @param tableName 表名
   * @param indexKeys 索引 示例：[{key:'msg',type:'ivfPq'},{key:'docId',type:'btree'}]
   * @returns boolean
   */
  static async addIndex(tableName, indexKeys) {
    const metrics = this.startMetrics(`\u6DFB\u52A0\u7D22\u5F15\u5230\u8868 ${tableName}`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        throw new Error(`\u8868 "${tableName}" \u4E0D\u5B58\u5728`);
      }
      const tableObj = await db.openTable(tableName);
      for (const indexKey of indexKeys) {
        let indexName = indexKey.key + "_idx";
        const indexStats = await tableObj.indexStats(indexName);
        if (indexStats) {
          import_log.logger.error(`\u7D22\u5F15 "${indexName}" \u5DF2\u5B58\u5728\uFF0C\u8DF3\u8FC7\u521B\u5EFA`);
          continue;
        }
        let indexConfig = null;
        switch (indexKey.type) {
          case "ivfPq":
            indexConfig = lancedb.Index.ivfPq({
              distanceType: "cosine"
              // 余弦距离
            });
            break;
          case "btree":
            indexConfig = lancedb.Index.btree();
            break;
          case "bitmap":
            indexConfig = lancedb.Index.bitmap();
            break;
          case "labelList":
            indexConfig = lancedb.Index.labelList();
            break;
          case "fts":
            indexConfig = lancedb.Index.fts();
            break;
          case "hnswPq":
            indexConfig = lancedb.Index.hnswPq();
            break;
          case "hnswSq":
            indexConfig = lancedb.Index.hnswSq();
            break;
          default:
            indexConfig = lancedb.Index.btree();
            break;
        }
        await tableObj.createIndex(indexKey.key, {
          config: indexConfig
        });
      }
      return true;
    } catch (e) {
      import_log.logger.error("\u6DFB\u52A0\u7D22\u5F15\u5931\u8D25", e);
      return false;
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  /**
   * 删除索引
   * @param tableName 表名
   * @param indexKey <string> 索引 key
   * @returns boolean
   */
  static async deleteIndex(tableName, indexKey) {
    const metrics = this.startMetrics(`\u5220\u9664\u7D22\u5F15\u5230\u8868 ${tableName}`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        throw new Error(`\u8868 "${tableName}" \u4E0D\u5B58\u5728`);
      }
      const tableObj = await db.openTable(tableName);
      await tableObj.dropIndex(indexKey);
      return true;
    } catch (e) {
      import_log.logger.error("\u5220\u9664\u7D22\u5F15\u5931\u8D25", e);
      return false;
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  /**
   * 向表中添加文档
   * @param tableName 表名
   * @param model 使用的模型名称
   * @param text 要添加的文本
   * @returns 添加的记录ID
   */
  static async addDocument(tableName, supplierName, model, text, keywords, docId, tokens) {
    const metrics = this.startMetrics(`\u6DFB\u52A0\u6587\u6863\u5230\u8868 ${tableName}`);
    this.ensureDatabaseDirectory();
    let db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        await this.createTable(tableName, supplierName, model, text);
        await db.close();
        db = await lancedb.connect(import_public.pub.get_db_path());
      }
      const tableObj = await db.openTable(tableName);
      const embedding = await this.getEmbedding(supplierName, model, text);
      const id = import_public.pub.uuid();
      await tableObj.add([{
        id,
        doc: text,
        docId,
        keywords,
        tokens,
        vector: embedding
      }]);
      return id;
    } catch (error) {
      throw new Error(`\u6DFB\u52A0\u6587\u6863\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  static async checkColumn(tableObj, recordInfo) {
    let schema = await tableObj.schema();
    let newFields = [];
    for (let key of Object.keys(recordInfo)) {
      if (schema.fields.find((item) => item.name == key)) {
        continue;
      }
      const fieldType = typeof recordInfo[key];
      let newField = {
        name: key,
        valueSql: ""
      };
      if (fieldType == "string") {
        newField.valueSql = "cast( NULL as Utf8)";
      } else if (fieldType == "number") {
        newField.valueSql = "cast(NULL as Float)";
      } else if (fieldType == "object") {
        if (Array.isArray(recordInfo[key])) {
          newField.valueSql = 'cast(["\n\n","\u3002"] as List)';
        }
      }
      newFields.push(newField);
    }
    import_log.logger.info("\u6DFB\u52A0\u5B57\u6BB5", newFields);
    await tableObj.addColumns(newFields);
    return true;
  }
  /**
   * 通用添加文档
   * @param tableName 表名
   * @param record 要添加的记录
   * @returns boolean
   */
  static async addRecord(tableName, record) {
    const metrics = this.startMetrics(`\u6DFB\u52A0\u6587\u6863\u5230\u8868 ${tableName}`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        throw new Error(`\u8868 "${tableName}" \u4E0D\u5B58\u5728`);
      }
      const tableObj = await db.openTable(tableName);
      await tableObj.add(record);
      return true;
    } catch (error) {
      throw new Error(`\u6DFB\u52A0\u6587\u6863\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  // 打开表
  static async openTable(tableName) {
    const db = await lancedb.connect(import_public.pub.get_db_path());
    return await db.openTable(tableName);
  }
  /**
   * 通用更新文档
   * @param tableName 表名
   * @param record 要更新的记录
   * @returns boolean
   * @example
   * await LanceDBManager.updateRecord('test', { where:'id=1',values:{name:'test1',age:20} });
   */
  static async updateRecord(tableName, record) {
    const metrics = this.startMetrics(`\u66F4\u65B0\u6587\u6863\u5230\u8868 ${tableName}`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        return false;
      }
      const tableObj = await db.openTable(tableName);
      await tableObj.update(record);
      await tableObj.optimize();
      import_log.logger.info(`\u6210\u529F\u66F4\u65B0\u6587\u6863\u5230\u8868 ${tableName}`);
      return true;
    } catch (error) {
      import_log.logger.error(`\u66F4\u65B0\u6587\u6863\u5931\u8D25: ${error.message}`, tableName, record);
      return false;
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  /**
   * 通用删除文档
   * @param tableName 表名
   * @param where 删除条件
   * @returns boolean
   */
  static async deleteRecord(tableName, where) {
    const metrics = this.startMetrics(`\u5220\u9664\u6587\u6863\u5230\u8868 ${tableName}`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        return false;
      }
      const tableObj = await db.openTable(tableName);
      await tableObj.delete(where);
      await tableObj.optimize();
      return true;
    } catch (error) {
      import_log.logger.error(`\u5220\u9664\u6587\u6863\u5931\u8D25: ${error.message}`);
      return false;
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  /**
   * 通用查询文档
   * @param tableName 表名
   * @param where 查询条件
   * @returns 查询结果
   */
  static async queryRecord(tableName, where, field = []) {
    const metrics = this.startMetrics(`\u67E5\u8BE2\u6587\u6863\u5230\u8868 ${tableName}`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        return [];
      }
      const tableObj = await db.openTable(tableName);
      let query = tableObj.query().where(where).limit(1e4);
      if (field.length > 0) {
        query = query.select(field);
      }
      const results = await query.toArray();
      return results;
    } catch (error) {
      import_log.logger.error(`\u67E5\u8BE2\u6587\u6863\u5931\u8D25: ${error.message}`);
      return [];
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  /**
   * 通用查询指定表的总行数
   * @param tableName 表名
   * @param where 查询条件
   * @returns 查询结果
   */
  static async tableCount(tableName) {
    const metrics = this.startMetrics(`\u67E5\u8BE2\u6587\u6863\u5230\u8868 ${tableName}`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        return 0;
      }
      const tableObj = await db.openTable(tableName);
      const results = await tableObj.countRows();
      return results;
    } catch (error) {
      import_log.logger.error(`\u67E5\u8BE2\u6587\u6863\u5931\u8D25: ${error.message}`);
      return 0;
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  /**
   * 批量添加文档
   * @param tableName 表名
   * @param model 使用的模型名称
   * @param texts 文本数组
   * @returns 添加的记录数量
   */
  static async addDocuments(tableName, supplierName, model, texts, keywords, docId) {
    if (!texts.length) {
      return 0;
    }
    const metrics = this.startMetrics(`\u6279\u91CF\u6DFB\u52A0 ${texts.length} \u6761\u6587\u6863\u5230\u8868 ${tableName}`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        throw new Error(`\u8868 "${tableName}" \u4E0D\u5B58\u5728`);
      }
      const tableObj = await db.openTable(tableName);
      const embeddingPromises = texts.map((text) => this.getEmbedding(supplierName, model, text));
      const embeddings = await Promise.all(embeddingPromises);
      const records = embeddings.map((embedding, index) => ({
        id: import_public.pub.uuid(),
        doc: texts[index],
        docId,
        keywords: keywords[index],
        vector: embedding
      }));
      await tableObj.add(records);
      await tableObj.optimize();
      return records.length;
    } catch (error) {
      throw new Error(`\u6279\u91CF\u6DFB\u52A0\u6587\u6863\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  /**
   * 执行向量搜索
   * @param tableName 表名
   * @param model 使用的模型名称
   * @param queryText 查询文本
   * @param limit 结果数量限制
   * @returns 查询结果
   */
  static async search(tableName, supplierName, model, queryText, limit = 5) {
    const metrics = this.startMetrics(`\u5728\u8868 ${tableName} \u4E2D\u641C\u7D22`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        throw new Error(`\u8868 "${tableName}" \u4E0D\u5B58\u5728`);
      }
      const tableObj = await db.openTable(tableName);
      const embedding = await this.getEmbedding(supplierName, model, queryText);
      const results = await tableObj.search(embedding).limit(limit).select(["id", "doc", "_distance"]).toArray();
      return results.map((item) => ({
        id: item.id,
        doc: item.doc,
        score: 1 - item._distance,
        // 转换距离为相似度分数
        vectorScore: 1 - item._distance,
        keywordScore: 0
      }));
    } catch (error) {
      throw new Error(`\u641C\u7D22\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  static async hybridSearchByNew(tableName, ragInfo, queryText, keywords = []) {
    const metrics = this.startMetrics(`\u5728\u8868 ${tableName} \u4E2D\u6267\u884C\u6DF7\u5408\u641C\u7D22`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    const tableObj = await db.openTable(tableName);
    const embedding = await this.getEmbedding(ragInfo.supplierName, ragInfo.embeddingModel, queryText);
    let isTokensIdx = await tableObj.indexStats("tokens_idx");
    if (!isTokensIdx) {
      await this.createDocFtsIndex(tableName);
    }
    let sortedResults = await tableObj.query().fullTextSearch(keywords.join(" ")).nearestTo(embedding).rerank(await lancedb.rerankers.RRFReranker.create()).select(["id", "doc", "docId", "tokens"]).limit(ragInfo.maxRecall).toArray();
    const docIdList = sortedResults.map((item) => item.docId);
    const docNameMap = await this.getDocName(docIdList);
    const optimizedResults = await this.optimizeDocumentContent(sortedResults, docNameMap);
    const userUrl = `http://127.0.0.1:7071`;
    return this.formatResults(optimizedResults, docNameMap, "{URL}", userUrl);
  }
  /**
   * 执行混合搜索（向量相似度 + 关键词匹配）
   * 优化版本：减少重复计算和数据库查询次数，提升性能
   * @param tableName 表名
   * @param model 使用的模型名称
   * @param queryText 查询文本
   * @param keywords 关键词数组
   * @param limit 结果数量限制
   * @param vectorWeight 向量搜索权重 (0-1)
   * @param keywordWeight 关键词匹配权重 (0-1)
   * @returns 查询结果
   */
  static async hybridSearch(tableName, ragInfo, queryText, keywords = []) {
    const metrics = this.startMetrics(`\u5728\u8868 ${tableName} \u4E2D\u6267\u884C\u4F18\u5316\u6DF7\u5408\u641C\u7D22`);
    this.ensureDatabaseDirectory();
    var vectorWeight = ragInfo.vectorWeight;
    var keywordWeight = ragInfo.keywordWeight;
    [vectorWeight, keywordWeight] = this.normalizeWeights(vectorWeight, keywordWeight);
    const needVectorSearch = vectorWeight > 0;
    const needKeywordSearch = keywords.length > 0 && keywordWeight > 0;
    if (!needVectorSearch && !needKeywordSearch) {
      return [];
    }
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        return [];
      }
      const tableObj = await db.openTable(tableName);
      await this.preWarmQuery(tableObj);
      const resultMap = /* @__PURE__ */ new Map();
      const searchPromises = [];
      if (needVectorSearch) {
        searchPromises.push(this.performVectorSearch(
          tableObj,
          ragInfo,
          queryText,
          resultMap
        ));
      }
      if (needKeywordSearch) {
        searchPromises.push(this.performKeywordSearch(
          tableObj,
          keywords,
          keywordWeight,
          resultMap
        ));
      }
      await Promise.all(searchPromises);
      const sortedResults = this.sortResults(resultMap, ragInfo.maxRecall);
      const docIdList = sortedResults.map((item) => item.docId);
      const docNameMap = await this.getDocName(docIdList);
      const optimizedResults = await this.optimizeDocumentContent(sortedResults, docNameMap);
      const userUrl = `http://127.0.0.1:7071`;
      return this.formatResults(optimizedResults, docNameMap, "{URL}", userUrl);
    } catch (error) {
      throw new Error(`\u6DF7\u5408\u641C\u7D22\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  /**
   * 规范化权重确保它们的总和为1
   */
  static normalizeWeights(vectorWeight, keywordWeight) {
    vectorWeight = Math.max(0, Math.min(1, vectorWeight));
    keywordWeight = Math.max(0, Math.min(1, keywordWeight));
    if (vectorWeight > 0 && keywordWeight > 0) {
      const sum = vectorWeight + keywordWeight;
      return [vectorWeight / sum, keywordWeight / sum];
    }
    return [vectorWeight, keywordWeight];
  }
  /**
   * 预热查询提高性能
   */
  static async preWarmQuery(tableObj) {
    try {
      await tableObj.query().limit(1).toArray();
    } catch {
    }
  }
  // 当向量数据足够多时，切换到余弦相似度索引
  static async ToCosineIndex(tableName) {
    let indexTipsPath = import_public.pub.get_data_path() + "/rag/index_tips";
    if (!import_public.pub.file_exists(indexTipsPath)) {
      import_public.pub.mkdir(indexTipsPath);
    }
    let indexTipFile = indexTipsPath + "/" + tableName + ".pl";
    if (import_public.pub.file_exists(indexTipFile)) {
      return;
    }
    if (await LanceDBManager.tableCount(tableName) > 256) {
      import_public.pub.write_file(indexTipFile, "1");
      await LanceDBManager.addIndex(tableName, [{ type: "ivfPq", key: "vector" }]);
    }
  }
  /**
   * 执行向量搜索
   */
  static async performVectorSearch(tableObj, ragInfo, queryText, resultMap) {
    const metrics = this.startMetrics("\u6267\u884C\u5411\u91CF\u641C\u7D22");
    try {
      const embedding = await this.getEmbedding(ragInfo.supplierName, ragInfo.embeddingModel, queryText);
      const searchLimit = Math.max(ragInfo.maxRecall * 3, 50);
      await this.ToCosineIndex(tableObj.name);
      const results = await tableObj.search(embedding).limit(searchLimit).select(["id", "doc", "docId", "_distance"]).toArray();
      const indexTipFile = path.join(import_public.pub.get_data_path(), "rag", "index_tips", tableObj.name + ".pl");
      const ivfPq = import_public.pub.file_exists(indexTipFile);
      for (const result of results) {
        const id = result.id;
        const doc = result.doc;
        const distance = result._distance;
        const score = 1 - distance;
        const docId = result.docId;
        if (ivfPq && score <= ragInfo.recallAccuracy) {
          continue;
        }
        if (!ivfPq && distance > 600) {
          continue;
        }
        resultMap.set(id, {
          id,
          doc,
          docId,
          vectorScore: score,
          keywordScore: 0,
          score: score * ragInfo.vectorWeight
        });
      }
    } finally {
      this.endMetrics(metrics);
    }
  }
  /**
   * 执行关键词搜索
   */
  static async performKeywordSearch(tableObj, keywords, keywordWeight, resultMap) {
    const metrics = this.startMetrics("\u6267\u884C\u5173\u952E\u8BCD\u641C\u7D22");
    try {
      const processedKeywords = keywords.map((k) => k.toLowerCase());
      const keywordConditions = this.buildKeywordConditions(processedKeywords);
      const results = await tableObj.query().where(keywordConditions).select(["id", "doc", "docId"]).toArray();
      const docCache = /* @__PURE__ */ new Map();
      for (const result of results) {
        const id = result.id;
        const doc = result.doc;
        const docId = result.docId;
        const keywordScore = this.calculateKeywordScore(doc, processedKeywords, docCache);
        if (resultMap.has(id)) {
          const existing = resultMap.get(id);
          existing.keywordScore = keywordScore;
          existing.score = existing.vectorScore * (1 - keywordWeight) + keywordScore * keywordWeight;
        } else {
          resultMap.set(id, {
            id,
            doc,
            docId,
            vectorScore: 0,
            keywordScore,
            score: keywordScore * keywordWeight
          });
        }
      }
    } finally {
      this.endMetrics(metrics);
    }
  }
  /**
   * 构建关键词查询条件
   */
  static buildKeywordConditions(keywords) {
    if (keywords.length === 1) {
      return `doc LIKE '%${keywords[0].replace(/'/g, "''")}%'`;
    }
    return keywords.map((kw) => `doc LIKE '%${kw.replace(/'/g, "''")}%'`).join(" OR ");
  }
  /**
   * 计算关键词匹配分数
   * 优先考虑匹配的关键词数量，其次考虑关键词出现的总次数
   */
  static calculateKeywordScore(doc, keywords, docCache) {
    if (!docCache.has(doc)) {
      docCache.set(doc, doc.toLowerCase());
    }
    const lowerDoc = docCache.get(doc);
    const matchedKeywords = /* @__PURE__ */ new Set();
    let totalOccurrences = 0;
    let positionBonus = 0;
    for (const keyword of keywords) {
      let position = lowerDoc.indexOf(keyword);
      let keywordOccurrences = 0;
      while (position !== -1) {
        keywordOccurrences++;
        if (matchedKeywords.has(keyword) === false) {
          positionBonus += Math.max(0, 1 - position / 100);
          matchedKeywords.add(keyword);
        }
        position = lowerDoc.indexOf(keyword, position + 1);
      }
      totalOccurrences += keywordOccurrences;
    }
    if (keywords.length === 0) return 0;
    const uniqueMatchScore = matchedKeywords.size / keywords.length;
    const occurrenceScore = Math.min(1, totalOccurrences / (keywords.length * 5));
    const normalizedPositionBonus = positionBonus / Math.max(1, keywords.length);
    return uniqueMatchScore * 0.7 + occurrenceScore * 0.2 + normalizedPositionBonus * 0.1;
  }
  /**
   * 排序结果并限制数量
   */
  static sortResults(resultMap, limit) {
    return Array.from(resultMap.values()).sort((a, b) => b.score - a.score).slice(0, limit);
  }
  /**
   * 优化文档内容 - 对切片长度接近原文的情况使用完整文档
   */
  static async optimizeDocumentContent(results, docNameMap) {
    const docChunkLength = /* @__PURE__ */ new Map();
    results.forEach((result) => {
      const docId = result.docId;
      const length = result.doc.length;
      docChunkLength.set(docId, (docChunkLength.get(docId) || 0) + length);
    });
    const usedDocId = /* @__PURE__ */ new Map();
    for (const [docId, totalLength] of docChunkLength.entries()) {
      const docInfo = docNameMap.get(docId);
      if (docInfo && docInfo.doc.length * 0.1 < totalLength) {
        usedDocId.set(docId, docInfo.doc);
      }
    }
    if (usedDocId.size > 0) {
      for (let i = 0; i < results.length; i++) {
        const docId = results[i].docId;
        if (usedDocId.has(docId)) {
          results[i].doc = usedDocId.get(docId);
          results[i].id = docId;
        }
      }
      const uniqueId = /* @__PURE__ */ new Set();
      results = results.filter((item) => {
        if (uniqueId.has(item.id)) {
          return false;
        }
        uniqueId.add(item.id);
        return true;
      });
    }
    return results;
  }
  /**
   * 格式化结果为标准输出格式
   */
  static formatResults(results, docNameMap, repURL, userUrl) {
    return results.map((item) => {
      let docContent = item.doc || "";
      if (docContent.includes(repURL)) {
        docContent = docContent.replace(new RegExp(repURL, "g"), userUrl);
      }
      return {
        id: item.id,
        doc: docContent,
        docId: item.docId,
        docName: docNameMap.get(item.docId)?.doc_name,
        docFile: docNameMap.get(item.docId)?.doc_file,
        tokens: item.tokens,
        score: item.score !== void 0 ? item._score : item._score + item._relevance_score,
        vectorScore: item.vectorScore !== void 0 ? item.vectorScore : item._relevance_score,
        keywordScore: item.keywordScore !== void 0 ? item.keywordScore : item._score
      };
    });
  }
  /**
   * 获取文档信息
   * @param docIdList - 文档ID列表
   * @returns 文档ID到文档名称的映射
   */
  static async getDocName(docIdList) {
    if (!docIdList || docIdList.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const metrics = this.startMetrics(`\u83B7\u53D6${docIdList.length}\u4E2A\u6587\u6863\u540D\u79F0`);
    const result = /* @__PURE__ */ new Map();
    const dataDir = import_public.pub.get_data_path();
    const repDataDir = "{DATA_DIR}";
    try {
      this.ensureDatabaseDirectory();
      const db = await lancedb.connect(import_public.pub.get_db_path());
      try {
        if (!await this.tableExists(db, "doc_table")) {
          return result;
        }
        const tableObj = await db.openTable("doc_table");
        const uniqueDocIds = [...new Set(docIdList)];
        const batchSize = 10;
        for (let i = 0; i < uniqueDocIds.length; i += batchSize) {
          const batch = uniqueDocIds.slice(i, i + batchSize);
          const orConditions = batch.map(
            (id) => `doc_id='${id}'`
          ).join(" OR ");
          if (orConditions) {
            const results = await tableObj.query().where(orConditions).select(["doc_id", "doc_name", "md_file"]).toArray();
            results.forEach((item) => {
              let docFile = item.md_file.replace(repDataDir, dataDir);
              result.set(item.doc_id, { doc_name: item.doc_name, doc_file: docFile, doc: import_public.pub.read_file(docFile) });
            });
          }
        }
      } finally {
        await db.close();
      }
    } catch (error) {
      import_log.logger.error(`\u83B7\u53D6\u6587\u6863\u540D\u79F0\u5931\u8D25: ${error.message}`);
    } finally {
      this.endMetrics(metrics);
    }
    return result;
  }
  /**
   * 获取表中的所有文档
   * @param tableName 表名
   * @returns 表中的所有文档
   */
  static async getAllDocuments(tableName) {
    const metrics = this.startMetrics(`\u83B7\u53D6\u8868 ${tableName} \u7684\u6240\u6709\u6587\u6863`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        throw new Error(`\u8868 "${tableName}" \u4E0D\u5B58\u5728`);
      }
      const tableObj = await db.openTable(tableName);
      const results = await tableObj.query().select(["id", "doc"]).toArray();
      return results.map((item) => ({
        id: item.id,
        doc: item.doc
      }));
    } catch (error) {
      throw new Error(`\u83B7\u53D6\u6240\u6709\u6587\u6863\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  /**
   * 获取表中的记录数量
   * @param tableName 表名
   * @returns 记录数量
   */
  static async getDocumentCount(tableName) {
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        throw new Error(`\u8868 "${tableName}" \u4E0D\u5B58\u5728`);
      }
      const tableObj = await db.openTable(tableName);
      return await tableObj.countRows();
    } catch (error) {
      throw new Error(`\u83B7\u53D6\u8BB0\u5F55\u6570\u91CF\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
    }
  }
  /**
   * 删除表
   * @param tableName 表名
   * @returns 成功与否
   */
  static async dropTable(tableName) {
    const metrics = this.startMetrics(`\u5220\u9664\u8868 ${tableName}`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        return false;
      }
      await db.dropTable(tableName);
      return true;
    } catch (error) {
      if (error.message.includes("LanceError(IO)")) {
        const tablePath = path.join(import_public.pub.get_db_path(), `${tableName}.lance`);
        if (fs.existsSync(tablePath)) {
          fs.rmdirSync(tablePath, { recursive: true });
          return true;
        }
      }
      throw new Error(`\u5220\u9664\u8868\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  /**
   * 获取所有表名
   * @returns 所有表名列表
   */
  static async listTables() {
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      return await db.tableNames();
    } catch (error) {
      throw new Error(`\u83B7\u53D6\u8868\u5217\u8868\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
    }
  }
  /**
   * 从表中删除指定ID的文档
   * @param tableName 表名
   * @param docId 文档ID
   * @returns 成功删除的记录数
   */
  static async deleteDocument(tableName, docId) {
    const metrics = this.startMetrics(`\u4ECE\u8868 ${tableName} \u4E2D\u5220\u9664\u6587\u6863 ID: ${docId}`);
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        throw new Error(`\u8868 "${tableName}" \u4E0D\u5B58\u5728`);
      }
      const tableObj = await db.openTable(tableName);
      const where = "`docId` = '" + docId + "'";
      const exists = (await tableObj.query().where(where).select(["docId"]).limit(1).toArray()).length > 0;
      if (!exists) {
        return 0;
      }
      await tableObj.delete(where);
      return 1;
    } catch (error) {
      throw new Error(`\u5220\u9664\u6587\u6863\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
  /**
   * 获取数据库状态信息
   * @returns 数据库状态信息
   */
  static async getDatabaseStats() {
    this.ensureDatabaseDirectory();
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      const tableNames = await db.tableNames();
      const tableDetails = [];
      let totalDocuments = 0;
      for (const name of tableNames) {
        const table = await db.openTable(name);
        const count = await table.countRows();
        totalDocuments += count;
        tableDetails.push({ name, documents: count });
      }
      return {
        dbPath: import_public.pub.get_db_path(),
        tables: tableNames.length,
        totalDocuments,
        tableDetails
      };
    } catch (error) {
      throw new Error(`\u83B7\u53D6\u6570\u636E\u5E93\u7EDF\u8BA1\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
    }
  }
  /**
  * 执行高级关键词搜索
  * 通过文本分析和标记化提供更精确的关键词匹配
  * @param tableName 表名
  * @param keywords 关键词数组
  * @param options 搜索选项
  * @returns 搜索结果
  */
  static async keywordSearch(tableName, keywords, options = {}) {
    const metrics = this.startMetrics(`\u5728\u8868 ${tableName} \u4E2D\u6267\u884C\u5173\u952E\u8BCD\u641C\u7D22`);
    this.ensureDatabaseDirectory();
    const {
      limit = 5,
      matchMode = "any",
      caseSensitive = false,
      fuzzyMatch = false
    } = options;
    if (!keywords.length) {
      return [];
    }
    const db = await lancedb.connect(import_public.pub.get_db_path());
    try {
      if (!await this.tableExists(db, tableName)) {
        throw new Error(`\u8868 "${tableName}" \u4E0D\u5B58\u5728`);
      }
      const tableObj = await db.openTable(tableName);
      const processedKeywords = caseSensitive ? keywords : keywords.map((k) => k.toLowerCase());
      let whereClause = "";
      switch (matchMode) {
        case "all":
          whereClause = processedKeywords.map((kw) => {
            const escaped = kw.replace(/'/g, "''");
            return caseSensitive ? `doc LIKE '%${escaped}%'` : `LOWER(doc) LIKE '%${escaped}%'`;
          }).join(" AND ");
          break;
        case "phrase":
          const phrase = processedKeywords.join(" ");
          whereClause = caseSensitive ? `doc LIKE '%${phrase.replace(/'/g, "''")}%'` : `LOWER(doc) LIKE '%${phrase.replace(/'/g, "''")}%'`;
          break;
        case "any":
        default:
          whereClause = processedKeywords.map((kw) => {
            const escaped = kw.replace(/'/g, "''");
            return caseSensitive ? `doc LIKE '%${escaped}%'` : `LOWER(doc) LIKE '%${escaped}%'`;
          }).join(" OR ");
          break;
      }
      if (fuzzyMatch) {
        const fuzzyConditions = processedKeywords.filter((kw) => kw.length > 3).map((kw) => {
          const prefix = kw.substring(0, 3).replace(/'/g, "''");
          const suffix = kw.substring(kw.length - 3).replace(/'/g, "''");
          return caseSensitive ? `(doc LIKE '${prefix}%' OR doc LIKE '%${suffix}')` : `(LOWER(doc) LIKE '${prefix}%' OR LOWER(doc) LIKE '%${suffix}')`;
        });
        if (fuzzyConditions.length > 0) {
          whereClause = `(${whereClause}) OR (${fuzzyConditions.join(" OR ")})`;
        }
      }
      const results = await tableObj.query().where(whereClause).select(["id", "doc"]).toArray();
      const scoredResults = results.map((result) => {
        const id = result.id;
        const doc = result.doc;
        const matchDoc = caseSensitive ? doc : doc.toLowerCase();
        let score = 0;
        let matchedKeywords = 0;
        let exactMatchBonus = 0;
        let proximityBonus = 0;
        for (const keyword of processedKeywords) {
          const keywordIndex = matchDoc.indexOf(keyword);
          if (keywordIndex !== -1) {
            matchedKeywords++;
            const positionScore = Math.max(0, 1 - keywordIndex / 200);
            const beforeChar = keywordIndex > 0 ? matchDoc[keywordIndex - 1] : " ";
            const afterChar = keywordIndex + keyword.length < matchDoc.length ? matchDoc[keywordIndex + keyword.length] : " ";
            const isExactMatch = /[\s.,;!?()]/.test(beforeChar) && /[\s.,;!?()]/.test(afterChar);
            exactMatchBonus += isExactMatch ? 0.5 : 0;
            score += 1 + positionScore + (isExactMatch ? 0.5 : 0);
            if (processedKeywords.length > 1) {
              const nextKeyword = processedKeywords.find((k) => k !== keyword && matchDoc.includes(k));
              if (nextKeyword) {
                const nextIndex = matchDoc.indexOf(nextKeyword);
                const distance = Math.abs(keywordIndex - nextIndex);
                if (distance < 20) {
                  proximityBonus += 0.3 * (1 - distance / 20);
                }
              }
            }
          }
        }
        let finalScore = 0;
        if (matchMode === "all") {
          finalScore = matchedKeywords === processedKeywords.length ? score / processedKeywords.length + exactMatchBonus + proximityBonus : 0;
        } else if (matchMode === "phrase") {
          const phrase = processedKeywords.join(" ");
          finalScore = matchDoc.includes(phrase) ? 1 + (matchDoc.indexOf(phrase) < 100 ? 0.5 : 0) : 0.1 * (matchedKeywords / processedKeywords.length);
        } else {
          finalScore = matchedKeywords / processedKeywords.length + exactMatchBonus / processedKeywords.length + proximityBonus;
        }
        return {
          id,
          doc,
          score: finalScore,
          vectorScore: 0,
          keywordScore: finalScore
        };
      });
      const filteredResults = scoredResults.filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
      return filteredResults;
    } catch (error) {
      throw new Error(`\u5173\u952E\u8BCD\u641C\u7D22\u5931\u8D25: ${error.message}`);
    } finally {
      await db.close();
      this.endMetrics(metrics);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LanceDBManager
});
