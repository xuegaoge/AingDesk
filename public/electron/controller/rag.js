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
var rag_exports = {};
__export(rag_exports, {
  default: () => rag_default
});
module.exports = __toCommonJS(rag_exports);
var import_public = require("../class/public");
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var import_rag = require("../rag/rag");
var import_vector_lancedb = require("../rag/vector_database/vector_lancedb");
var import_model = require("../service/model");
var import_ollama = require("../service/ollama");
var import_rag_task = require("../rag/rag_task");
class RagController {
  /**
   * 获取知识库状态
   * @returns {Promise<any>} - 知识库状态
   */
  async rag_status() {
    try {
      let result = await (0, import_model.GetSupplierEmbeddingModels)();
      if (Object.keys(result).length > 0) {
        return import_public.pub.return_success(import_public.pub.lang("\u77E5\u8BC6\u5E93\u7EC4\u4EF6\u6B63\u5E38"));
      }
      let ollamaResult = await import_ollama.ollamaService.get_embedding_model_list();
      if (ollamaResult.length > 0) {
        return import_public.pub.return_success(import_public.pub.lang("\u77E5\u8BC6\u5E93\u7EC4\u4EF6\u6B63\u5E38"));
      }
      return import_public.pub.return_error(import_public.pub.lang("\u8BF7\u9009\u5B89\u88C5\u6216\u63A5\u5165\u5D4C\u5165\u6A21\u578B"));
    } catch (e) {
      return import_public.pub.return_error(import_public.pub.lang("\u8BF7\u9009\u5B89\u88C5\u6216\u63A5\u5165\u5D4C\u5165\u6A21\u578B"), e.message);
    }
  }
  /**
   * 获取嵌套模型列表
   * @returns {Promise<any>} - 嵌套模型列表
   */
  async get_embedding_models() {
    let result = await (0, import_model.GetSupplierEmbeddingModels)();
    result["ollama"] = await import_ollama.ollamaService.get_embedding_model_list();
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), result);
  }
  /**
   * 创建知识库
   * @param {string} ragName - 知识库名称
   * @param {string} ragDesc - 知识库描述
   * @returns {Promise<any>} - 创建结果
   */
  async create_rag(args) {
    let { ragName, ragDesc, enbeddingModel, supplierName, searchStrategy, maxRecall, recallAccuracy, resultReordering, rerankModel, queryRewrite, vectorWeight, keywordWeight } = args;
    if (!searchStrategy) searchStrategy = 2;
    if (!maxRecall) maxRecall = 5;
    if (!recallAccuracy) recallAccuracy = 0.1;
    if (!resultReordering) resultReordering = 1;
    if (!rerankModel) rerankModel = "";
    if (!queryRewrite) queryRewrite = 0;
    if (!vectorWeight) vectorWeight = 0.7;
    if (!keywordWeight) keywordWeight = 0.3;
    if (!ragName) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    if (ragName == "vector_db") {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3Avector_db"));
    }
    if (!enbeddingModel) {
      enbeddingModel = "bge-m3:latest";
    }
    if (!supplierName) {
      supplierName = "ollama";
    }
    const ragPath = import_public.pub.get_rag_path() + "/" + ragName;
    if (import_public.pub.file_exists(ragPath)) {
      return import_public.pub.return_error(import_public.pub.lang("\u6307\u5B9A\u77E5\u8BC6\u5E93\u540D\u79F0\u5DF2\u5B58\u5728"));
    }
    import_public.pub.mkdir(ragPath);
    const ragDescFile = ragPath + "/config.json";
    let pdata = {
      ragName,
      // 知识库名称
      ragDesc,
      // 知识库描述
      ragCreateTime: import_public.pub.time(),
      // 创建时间
      supplierName,
      // 嵌套模型供应商名称
      embeddingModel: enbeddingModel,
      // 嵌套模型
      searchStrategy,
      // 检索策略 1=混合检索 2=向量检索 3=全文检索 
      maxRecall,
      // 最大召回数
      recallAccuracy,
      // 召回精度
      resultReordering,
      // 结果重排序 1=开启 0=关闭  PS: 目前仅语义重排
      rerankModel,
      // 重排序模型 PS: 未实现
      queryRewrite,
      // 查询重写 1=开启 0=关闭   PS: 未实现
      vectorWeight,
      // 向量权重
      keywordWeight
      // 关键词权重
    };
    import_public.pub.write_file(ragDescFile, JSON.stringify(pdata, null, 4));
    import_public.pub.mkdir(ragPath + "/source");
    import_public.pub.mkdir(ragPath + "/markdown");
    import_public.pub.mkdir(ragPath + "/images");
    return import_public.pub.return_success(import_public.pub.lang("\u77E5\u8BC6\u5E93\u521B\u5EFA\u6210\u529F"));
  }
  /**
   * 删除知识库
   * @param {string} ragName - 知识库名称
   * @returns {Promise<any>} - 删除结果
   */
  async remove_rag(args) {
    if (args.ragName == "vector_db") {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3Avector_db"));
    }
    if (!args.ragName) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    const ragPath = import_public.pub.get_rag_path() + "/" + args.ragName;
    if (!import_public.pub.file_exists(ragPath)) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u4E0D\u5B58\u5728"));
    }
    let ragObj = new import_rag.Rag();
    ragObj.removeRag(args.ragName);
    import_public.pub.rmdir(ragPath);
    const indexTipFile = path.join(import_public.pub.get_data_path(), "rag", "index_tips", import_public.pub.md5(args.ragName) + ".pl");
    if (import_public.pub.file_exists(indexTipFile)) {
      fs.unlinkSync(indexTipFile);
    }
    return import_public.pub.return_success(import_public.pub.lang("\u77E5\u8BC6\u5E93\u5220\u9664\u6210\u529F"));
  }
  /**
   * 获取嵌套模型MAP
   * @returns {Promise<any>} - 嵌套
   */
  async get_embedding_map() {
    let ollamaEmbeddingList = await import_ollama.ollamaService.get_embedding_model_list();
    let supplierEmbeddingList = await (0, import_model.GetSupplierEmbeddingModels)();
    let embeddingMap = /* @__PURE__ */ new Map();
    let ollamaEmbeddingMap = /* @__PURE__ */ new Map();
    for (let embed of ollamaEmbeddingList) {
      ollamaEmbeddingMap.set(embed.model, true);
    }
    embeddingMap.set("ollama", ollamaEmbeddingMap);
    for (let supplierTitle in supplierEmbeddingList) {
      let supplierEmbeddingMap = /* @__PURE__ */ new Map();
      let supplierName = "";
      for (let embed of supplierEmbeddingList[supplierTitle]) {
        supplierName = embed.supplierName;
        supplierEmbeddingMap.set(embed.model, true);
      }
      if (!supplierName) supplierName = supplierTitle;
      embeddingMap.set(supplierName, supplierEmbeddingMap);
    }
    return embeddingMap;
  }
  /**
   * 获取知识库列表
   * @returns {Promise<any>} - 知识库列表
   */
  async get_rag_list() {
    const ragPathList = import_public.pub.readdir(import_public.pub.get_rag_path());
    const embeddingMap = await this.get_embedding_map();
    const ragList = [];
    for (const ragPath of ragPathList) {
      const ragDescFile = ragPath + "/config.json";
      if (import_public.pub.file_exists(ragDescFile)) {
        const ragDesc = JSON.parse(import_public.pub.read_file(ragDescFile));
        if (!ragDesc.vectorWeight) {
          ragDesc.ragCreateTime = import_public.pub.time();
          ragDesc.embeddingModel = "bge-m3:latest";
          ragDesc.searchStrategy = 1;
          ragDesc.maxRecall = 5;
          ragDesc.recallAccuracy = 0.1;
          ragDesc.resultReordering = 1;
          ragDesc.rerankModel = "";
          ragDesc.queryRewrite = 0;
          ragDesc.vectorWeight = 0.7;
          ragDesc.keywordWeight = 0.3;
          import_public.pub.write_file(ragDescFile, JSON.stringify(ragDesc, null, 4));
        }
        if (!ragDesc.supplierName) {
          ragDesc.supplierName = "ollama";
          import_public.pub.write_file(ragDescFile, JSON.stringify(ragDesc, null, 4));
        }
        ragDesc.embeddingModelExist = true;
        ragDesc.errorMsg = "";
        let supplierMap = embeddingMap.get(ragDesc.supplierName);
        if (!supplierMap || !supplierMap.get(ragDesc.embeddingModel)) {
          ragDesc.embeddingModelExist = false;
          ragDesc.errorMsg = import_public.pub.lang("\u6307\u5B9A\u5D4C\u5165\u6A21\u578B\u4E0D\u5B58\u5728: {}", ragDesc.embeddingModel);
        }
        ragList.push(ragDesc);
      }
    }
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), ragList);
  }
  /**
   * 修改知识库信息
   * @param {string} args.ragName - 知识库名称
   * @param {string} args.ragDesc - 知识库描述
   * @param {object} args.options - 其他选项
   * @returns {Promise<any>} - 修改结果
   */
  async modify_rag(args) {
    let { ragName, ragDesc, searchStrategy, maxRecall, recallAccuracy, resultReordering, rerankModel, queryRewrite, vectorWeight, keywordWeight } = args;
    if (!ragName) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    if (ragName == "vector_db") {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3Avector_db"));
    }
    const ragPath = import_public.pub.get_rag_path() + "/" + ragName;
    if (!import_public.pub.file_exists(ragPath)) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u4E0D\u5B58\u5728"));
    }
    const ragDescFile = ragPath + "/config.json";
    let ragConfig = import_public.pub.read_json(ragDescFile);
    ragConfig.ragDesc = ragDesc;
    ragConfig.searchStrategy = searchStrategy == void 0 ? ragConfig.searchStrategy : searchStrategy;
    ragConfig.maxRecall = maxRecall == void 0 ? ragConfig.maxRecall : maxRecall;
    ragConfig.recallAccuracy = recallAccuracy == void 0 ? ragConfig.recallAccuracy : recallAccuracy;
    ragConfig.resultReordering = resultReordering == void 0 ? ragConfig.resultReordering : resultReordering;
    ragConfig.rerankModel = rerankModel == void 0 ? ragConfig.rerankModel : rerankModel;
    ragConfig.queryRewrite = queryRewrite == void 0 ? ragConfig.queryRewrite : queryRewrite;
    ragConfig.vectorWeight = vectorWeight == void 0 ? ragConfig.vectorWeight : vectorWeight;
    ragConfig.keywordWeight = keywordWeight == void 0 ? ragConfig.keywordWeight : keywordWeight;
    import_public.pub.write_file(ragDescFile, JSON.stringify(ragConfig, null, 4));
    return import_public.pub.return_success(import_public.pub.lang("\u77E5\u8BC6\u5E93\u4FEE\u6539\u6210\u529F"));
  }
  /**
   * 上传知识库文档
   * @param {string} ragName - 知识库名称
   * @param {string} filePath - 文件路径 JSON列表
   * @returns {Promise<any>} - 上传结果
   */
  async upload_doc(args) {
    let { ragName, filePath, separators, chunkSize, overlapSize } = args;
    if (!ragName) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    if (ragName == "vector_db") {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3Avector_db"));
    }
    if (!filePath) {
      return import_public.pub.return_error(import_public.pub.lang("\u6587\u4EF6\u8DEF\u5F84\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    let filePathList = [];
    if (filePath.startsWith("[") && filePath.endsWith("]")) {
      filePathList = JSON.parse(filePath);
    } else {
      filePathList = filePath.split(",");
    }
    if (filePathList.length == 0) {
      return import_public.pub.return_error(import_public.pub.lang("\u6587\u4EF6\u8DEF\u5F84\u5217\u8868\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    if (!separators) {
      separators = [];
    }
    if (!chunkSize) {
      chunkSize = 1e3;
    }
    if (!overlapSize) {
      overlapSize = 100;
    }
    if (typeof separators == "string") {
      separators = [separators];
    }
    const ragPath = import_public.pub.get_rag_path() + "/" + ragName;
    if (!import_public.pub.file_exists(ragPath)) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u4E0D\u5B58\u5728"));
    }
    const ragDescFile = ragPath + "/config.json";
    if (!import_public.pub.file_exists(ragDescFile)) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u914D\u7F6E\u6587\u4EF6\u4E0D\u5B58\u5728"));
    }
    let ragConfig = import_public.pub.read_json(ragDescFile);
    ragConfig.separators = separators;
    ragConfig.chunkSize = chunkSize;
    ragConfig.overlapSize = overlapSize;
    import_public.pub.write_json(ragDescFile, ragConfig);
    let ragObj = new import_rag.Rag();
    for (const srcFile of filePathList) {
      if (!import_public.pub.file_exists(srcFile)) {
        return import_public.pub.return_error(import_public.pub.lang("\u6587\u4EF6\u4E0D\u5B58\u5728"));
      }
      const fileName = path.basename(srcFile);
      let dstFile = `${ragPath}/source/${fileName}`;
      let i = 1;
      while (import_public.pub.file_exists(dstFile)) {
        dstFile = `${ragPath}/source/${path.basename(srcFile, path.extname(srcFile))}_${i}${path.extname(srcFile)}`;
        i++;
      }
      fs.writeFileSync(dstFile, fs.readFileSync(srcFile));
      await ragObj.addDocumentToDB(dstFile, ragName, separators, chunkSize, overlapSize);
    }
    return import_public.pub.return_success(import_public.pub.lang("\u6587\u4EF6\u4E0A\u4F20\u6210\u529F"));
  }
  /**
   * 获取知识库文档列表
   * @param {string} ragName - 知识库名称
   * @returns {Promise<any>} - 文件列表
   */
  async get_rag_doc_list(args) {
    if (!args.ragName) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    const ragPath = import_public.pub.get_rag_path() + "/" + args.ragName;
    if (!import_public.pub.file_exists(ragPath)) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u4E0D\u5B58\u5728"));
    }
    let result = await import_vector_lancedb.LanceDBManager.queryRecord("doc_table", "doc_rag='" + args.ragName + "'");
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), result);
  }
  /**
   * 获取知识库文档内容
   * @param {string} ragName - 知识库名称
   * @param {string} docName - 文档名称
   * return {Promise<any>} - 文档内容
   */
  async get_doc_content(args) {
    let mdFile = import_public.pub.get_data_path() + "/rag/" + args.ragName + "/markdown/" + args.docName + ".md";
    if (import_public.pub.file_exists(mdFile)) {
      let content = import_public.pub.read_file(mdFile);
      content = content.replace(/{URL}/g, "http://127.0.0.1:7071");
      return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), content);
    }
    return import_public.pub.return_error(import_public.pub.lang("\u6587\u6863\u4E0D\u5B58\u5728"));
  }
  /**
   * 下载知识库文档
   * @param {string} ragName - 知识库名称
   * @param {string} docName - 文档名称
   * @returns {Promise<any>} - 文件下载流
   */
  async download_doc(args, event) {
    if (!args.ragName) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    if (!args.docName) {
      return import_public.pub.return_error(import_public.pub.lang("\u6587\u6863\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    const ragPath = import_public.pub.get_rag_path() + "/" + args.ragName;
    if (!import_public.pub.file_exists(ragPath)) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u4E0D\u5B58\u5728"));
    }
    const docFile = ragPath + "/source/" + args.docName;
    if (!import_public.pub.file_exists(docFile)) {
      return import_public.pub.return_error(import_public.pub.lang("\u6587\u6863\u4E0D\u5B58\u5728"));
    }
    event.response.set("Content-Type", "application/octet-stream");
    let filename = encodeURIComponent(args.docName);
    event.response.set("Content-Disposition", `attachment; filename="${filename}"`);
    const stream = fs.createReadStream(docFile);
    return stream;
  }
  async remove_doc(args) {
    if (!args.ragName) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    if (!args.docIdList) {
      return import_public.pub.return_error(import_public.pub.lang("\u6587\u6863\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    const ragPath = import_public.pub.get_rag_path() + "/" + args.ragName;
    if (!import_public.pub.file_exists(ragPath)) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u4E0D\u5B58\u5728"));
    }
    let docList = JSON.parse(args.docIdList);
    if (docList.length == 0) {
      return import_public.pub.return_error(import_public.pub.lang("\u6587\u6863\u540D\u79F0\u5217\u8868\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    let ragObj = new import_rag.Rag();
    for (const docId of docList) {
      let docName = await ragObj.getDocNameByDocId(docId);
      if (!docName) {
        return import_public.pub.return_error(import_public.pub.lang("\u6587\u6863\u4E0D\u5B58\u5728"));
      }
      const docFile = ragPath + "/source/" + docName;
      if (!import_public.pub.file_exists(docFile)) {
        return import_public.pub.return_error(import_public.pub.lang("\u6587\u6863\u4E0D\u5B58\u5728"));
      }
      fs.unlinkSync(docFile);
      const mdFile = ragPath + "/markdown/" + docName + ".md";
      if (import_public.pub.file_exists(mdFile)) {
        fs.unlinkSync(mdFile);
      }
      await ragObj.removeRagDocument(args.ragName, docId);
    }
    return import_public.pub.return_success(import_public.pub.lang("\u6587\u6863\u5220\u9664\u6210\u529F"));
  }
  // /**
  //  * 修改文档名称
  //  * @param {string} ragName - 知识库名称
  //  * @param {string} docName - 文档名称
  //  * @param {string} newDocName - 新文档名称
  //  */
  // async modify_rag_file_name(args: { ragName:string, docName:string, newDocName:string}): Promise<any> {
  //     logger.info("modify rag file name");
  //     // 检查参数
  //     if (!args.ragName) {
  //         return pub.return_error(pub.lang('知识库名称不能为空'));
  //     }
  //     if (!args.docName) {
  //         return pub.return_error(pub.lang('文档名称不能为空'));
  //     }
  //     if (!args.newDocName) {
  //         return pub.return_error(pub.lang('新文档名称不能为空'));
  //     }
  //     // 知识库保存路径
  //     const ragPath = pub.get_rag_path() + "/" + args.ragName;
  //     // 检查知识库是否存在
  //     if (!pub.file_exists(ragPath)) {
  //         return pub.return_error(pub.lang('知识库不存在'));
  //     }
  //     // 检查文档是否存在
  //     const docFile = ragPath + "/source/" + args.docName;
  //     if (!pub.file_exists(docFile)) {
  //         return pub.return_error(pub.lang('文档不存在'));
  //     }
  //     // 修改文档名称
  //     const newDocFile = ragPath + "/source/" + args.newDocName;
  //     fs.renameSync(docFile, newDocFile);
  //     // 修改markdown文件名称
  //     const mdFile = ragPath + "/markdown/" + path.basename(args.docName) + ".md";
  //     const newMdFile = ragPath + "/markdown/" + path.basename(args.newDocName) + ".md";
  //     if (pub.file_exists(mdFile)) {
  //         fs.renameSync(mdFile, newMdFile);
  //     }
  //     return pub.return_success(pub.lang('文档名称修改成功'));
  // }
  /**
   * 重新生成文档索引
   * @param args 
   * @param args.ragName <string> 知识库名称
   * @param args.docName <string> 文档名称
   * @returns 
   */
  async reindex_document(args) {
    let result = await new import_rag.Rag().reindexDocument(args.ragName, args.docId);
    if (!result) {
      return import_public.pub.return_error(import_public.pub.lang("\u64CD\u4F5C\u5931\u8D25"));
    }
    return import_public.pub.return_success(import_public.pub.lang("\u64CD\u4F5C\u6210\u529F"));
  }
  /**
   * 重新生成知识库索引
   * @param args
   * @param args.ragName <string> 知识库名称
   * @returns 
   */
  async reindex_rag(args) {
    let result = await new import_rag.Rag().reindexRag(args.ragName);
    if (!result) {
      return import_public.pub.return_error(import_public.pub.lang("\u64CD\u4F5C\u5931\u8D25"));
    }
    return import_public.pub.return_success(import_public.pub.lang("\u64CD\u4F5C\u6210\u529F"));
  }
  /**
   * 检索知识库
   * @param args
   * @param args.ragName <string> 知识库名称
   * @param args.queryText <string> 查询文本
   * @returns
   */
  async search_document(args) {
    let result = await new import_rag.Rag().searchDocument(JSON.parse(args.ragList), args.queryText);
    return import_public.pub.return_success(import_public.pub.lang("\u64CD\u4F5C\u6210\u529F"), result);
  }
  /**
   * 获取图片
   * @param args
   * @param args.r <string> 知识库名称
   * @param args.n <string> 图片名称
   * @returns
   */
  async images(args, event) {
    if (!args.r) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    if (!args.n) {
      return import_public.pub.return_error(import_public.pub.lang("\u56FE\u7247\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    const ragPath = import_public.pub.get_rag_path() + "/" + args.r;
    if (!import_public.pub.file_exists(ragPath)) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u4E0D\u5B58\u5728"));
    }
    let imgFile = ragPath + "/images/" + args.n;
    if (!import_public.pub.file_exists(imgFile)) {
      let imgFile1 = imgFile + ".png";
      if (!import_public.pub.file_exists(imgFile1)) {
        imgFile1 = imgFile + ".jpg";
        if (!import_public.pub.file_exists(imgFile1)) {
          return import_public.pub.return_error(import_public.pub.lang("\u56FE\u7247\u4E0D\u5B58\u5728"));
        }
      }
    }
    event.response.set("Content-Type", "image/png");
    const stream = fs.createReadStream(imgFile);
    return stream;
  }
  /**
   * 测试分块
   * @param args 
   * @param args.filename <string> 文件名
   * @param args.chunkSize <number> 块大小
   * @param args.overlapSize <number> 重叠大小
   * @param args.separators <string[]> 分隔符
   * @returns 
   */
  async test_chunk(args) {
    let { filename, chunkSize, overlapSize, separators } = args;
    let ragObj = new import_rag.Rag();
    let result = await ragObj.parseDocument(filename, "");
    let ragTask = new import_rag_task.RagTask();
    if (typeof separators == "string") {
      separators = [separators];
    }
    let chunkList = ragTask.splitText(filename, result.content, separators, chunkSize, overlapSize);
    result.chunkList = chunkList;
    return import_public.pub.return_success(import_public.pub.lang("\u64CD\u4F5C\u6210\u529F"), result);
  }
  // 优化表
  async optimize_table(args) {
    await import_vector_lancedb.LanceDBManager.optimizeTable("doc_table");
    let res = await import_vector_lancedb.LanceDBManager.optimizeTable(import_public.pub.md5(args.ragName));
    return import_public.pub.return_success(res);
  }
  /**
   * 获取文档分块列表
   * @param args
   * @param args.ragName <string> 知识库名称
   * @param args.docId <string> 文档ID
   * @returns
   **/
  async get_doc_chunk_list(args) {
    if (!args.ragName) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    if (!args.docId) {
      return import_public.pub.return_error(import_public.pub.lang("\u6587\u6863ID\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    const ragPath = import_public.pub.get_rag_path() + "/" + args.ragName;
    if (!import_public.pub.file_exists(ragPath)) {
      return import_public.pub.return_error(import_public.pub.lang("\u77E5\u8BC6\u5E93\u4E0D\u5B58\u5728"));
    }
    let ragObj = new import_rag.Rag();
    let result = await ragObj.getDocChunkList(args.ragName, args.docId);
    return import_public.pub.return_success(import_public.pub.lang("\u64CD\u4F5C\u6210\u529F"), result);
  }
}
RagController.toString = () => "[class RagController]";
var rag_default = RagController;
