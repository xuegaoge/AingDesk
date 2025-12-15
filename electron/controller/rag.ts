import { pub } from '../class/public';
import * as path from 'path';
import * as fs from 'fs';
import { Rag } from '../rag/rag';
import { LanceDBManager } from '../rag/vector_database/vector_lancedb';
import { GetSupplierEmbeddingModels } from '../service/model';
import { ollamaService } from '../service/ollama';
import { RagTask } from '../rag/rag_task';

/**
 * rag controller 类，负责管理知识库的相关操作
 * @class
 */
class RagController {


    /**
     * 获取知识库状态
     * @returns {Promise<any>} - 知识库状态
     */
    async rag_status() {
        try {
            // 检查是否有嵌套模型
            let result = await GetSupplierEmbeddingModels();
            if (Object.keys(result).length > 0) {
                return pub.return_success(pub.lang('知识库组件正常'));
            }

            let ollamaResult = await ollamaService.get_embedding_model_list();
            if (ollamaResult.length > 0) {
                return pub.return_success(pub.lang('知识库组件正常'));
            }
            return pub.return_error(pub.lang('请选安装或接入嵌入模型'));

        } catch (e: any) {
            return pub.return_error(pub.lang('请选安装或接入嵌入模型'), e.message);
        }
    }



    /**
     * 获取嵌套模型列表
     * @returns {Promise<any>} - 嵌套模型列表
     */
    async get_embedding_models() {
        let result = await GetSupplierEmbeddingModels()
        result['ollama'] = await ollamaService.get_embedding_model_list();
        return pub.return_success(pub.lang('获取成功'), result);
    }



    /**
     * 创建知识库
     * @param {string} ragName - 知识库名称
     * @param {string} ragDesc - 知识库描述
     * @returns {Promise<any>} - 创建结果
     */
    async create_rag(args: {
        ragName: string,
        ragDesc: string,
        enbeddingModel?: string,
        supplierName?: string,
        searchStrategy: number,  // 检索策略 1=混合检索 2=向量检索 3=全文检索 
        maxRecall: number,       // 最大召回数
        recallAccuracy: number,  // 召回精度
        resultReordering: number,  // 结果重排序 1=开启 0=关闭  PS: 目前仅语义重排
        rerankModel: string, // 重排序模型 PS: 未实现
        queryRewrite: number,  // 查询重写 1=开启 0=关闭   PS: 未实现
        vectorWeight: number,  // 向量权重
        keywordWeight: number,  // 关键词权重
        savePath?: string, // 保存路径

    }): Promise<any> {

        let { ragName, ragDesc, enbeddingModel, supplierName, searchStrategy, maxRecall, recallAccuracy, resultReordering, rerankModel, queryRewrite, vectorWeight, keywordWeight } = args;

        if (!searchStrategy) searchStrategy = 2;
        if (!maxRecall) maxRecall = 5;
        if (!recallAccuracy) recallAccuracy = 0.1;
        if (!resultReordering) resultReordering = 1;
        if (!rerankModel) rerankModel = '';
        if (!queryRewrite) queryRewrite = 0;
        if (!vectorWeight) vectorWeight = 0.7;
        if (!keywordWeight) keywordWeight = 0.3;

        // 检查参数
        if (!ragName) {
            return pub.return_error(pub.lang('知识库名称不能为空'));
        }

        if (ragName == 'vector_db') {
            return pub.return_error(pub.lang('知识库名称不能为vector_db'));
        }

        if (!enbeddingModel) {
            enbeddingModel = 'bge-m3:latest';
        }

        if (!supplierName) {
            supplierName = 'ollama';
        }

        // 知识库保存路径
        const ragPath = pub.get_rag_path() + "/" + ragName;

        // 检查知识库是否存在
        if (pub.file_exists(ragPath)) {
            return pub.return_error(pub.lang('指定知识库名称已存在'));
        }

        // 创建知识库目录
        pub.mkdir(ragPath);

        // 创建知识库描述文件
        const ragDescFile = ragPath + "/config.json";
        let pdata = {
            ragName: ragName, // 知识库名称
            ragDesc: ragDesc,  // 知识库描述
            ragCreateTime: pub.time(), // 创建时间
            supplierName: supplierName, // 嵌套模型供应商名称
            embeddingModel: enbeddingModel, // 嵌套模型
            searchStrategy: searchStrategy,  // 检索策略 1=混合检索 2=向量检索 3=全文检索 
            maxRecall: maxRecall,  // 最大召回数
            recallAccuracy: recallAccuracy,  // 召回精度
            resultReordering: resultReordering,  // 结果重排序 1=开启 0=关闭  PS: 目前仅语义重排
            rerankModel: rerankModel, // 重排序模型 PS: 未实现
            queryRewrite: queryRewrite,  // 查询重写 1=开启 0=关闭   PS: 未实现
            vectorWeight: vectorWeight,  // 向量权重
            keywordWeight: keywordWeight,  // 关键词权重
        }
        pub.write_file(ragDescFile, JSON.stringify(pdata, null, 4));

        // 创建知识库原始文件目录
        pub.mkdir(ragPath + "/source");

        // 创建知识库markdown文件目录
        pub.mkdir(ragPath + "/markdown");

        // 创建图片目录
        pub.mkdir(ragPath + "/images");

        return pub.return_success(pub.lang('知识库创建成功'));
    }


    /**
     * 删除知识库
     * @param {string} ragName - 知识库名称
     * @returns {Promise<any>} - 删除结果
     */
    async remove_rag(args: { ragName: string }): Promise<any> {
        // logger.info("delete rag");
        if (args.ragName == 'vector_db') {
            return pub.return_error(pub.lang('知识库名称不能为vector_db'));
        }
        // 检查参数
        if (!args.ragName) {
            return pub.return_error(pub.lang('知识库名称不能为空'));
        }

        // 知识库保存路径
        const ragPath = pub.get_rag_path() + "/" + args.ragName;

        // 检查知识库是否存在
        if (!pub.file_exists(ragPath)) {
            return pub.return_error(pub.lang('知识库不存在'));
        }

        // 删除知识库所有文档和向量索引
        let ragObj = new Rag();
        ragObj.removeRag(args.ragName);

        // 删除知识库文件
        pub.rmdir(ragPath);


        // 删除知识库索引标记
        const indexTipFile = path.join(pub.get_data_path(), 'rag', 'index_tips', pub.md5(args.ragName) + ".pl");
        if (pub.file_exists(indexTipFile)) {
            fs.unlinkSync(indexTipFile);
        }

        return pub.return_success(pub.lang('知识库删除成功'));
    }

    /**
     * 获取嵌套模型MAP
     * @returns {Promise<any>} - 嵌套
     */
    async get_embedding_map() {
        let ollamaEmbeddingList = await ollamaService.get_embedding_model_list();
        let supplierEmbeddingList = await GetSupplierEmbeddingModels()

        let embeddingMap = new Map<string, Map<string, Boolean>>();
        let ollamaEmbeddingMap = new Map<string, Boolean>();
        for (let embed of ollamaEmbeddingList) {
            ollamaEmbeddingMap.set(embed.model, true);
        }
        embeddingMap.set('ollama', ollamaEmbeddingMap);
        for (let supplierTitle in supplierEmbeddingList) {
            let supplierEmbeddingMap = new Map<string, Boolean>();
            let supplierName = '';
            for (let embed of supplierEmbeddingList[supplierTitle]) {
                supplierName = embed.supplierName;
                supplierEmbeddingMap.set(embed.model, true);
            }
            if(!supplierName) supplierName = supplierTitle;
            embeddingMap.set(supplierName, supplierEmbeddingMap);
            
        }
        return embeddingMap;
    }

    /**
     * 获取知识库列表
     * @returns {Promise<any>} - 知识库列表
     */
    async get_rag_list(): Promise<any> {
        // logger.info("get rag list");

        // 获取知识库列表
        const ragPathList = pub.readdir(pub.get_rag_path());
        const embeddingMap = await this.get_embedding_map();

        const ragList: any[] = [];
        for (const ragPath of ragPathList) {
            const ragDescFile = ragPath + "/config.json";
            if (pub.file_exists(ragDescFile)) {
                const ragDesc = JSON.parse(pub.read_file(ragDescFile));

                // 补全缺失字段
                if (!ragDesc.vectorWeight) {
                    ragDesc.ragCreateTime = pub.time() // 创建时间
                    ragDesc.embeddingModel = 'bge-m3:latest' // 嵌套模型
                    ragDesc.searchStrategy = 1 // 检索策略 1=混合检索 2=向量检索 3=全文检索
                    ragDesc.maxRecall = 5 // 最大召回数
                    ragDesc.recallAccuracy = 0.1 // 召回精度
                    ragDesc.resultReordering = 1 // 结果重排序 1=开启 0=关闭 PS: 目前仅语义重排
                    ragDesc.rerankModel = '' // 重排序模型 PS: 未实现
                    ragDesc.queryRewrite = 0 // 查询重写 1=开启 0=关闭 PS: 未实现
                    ragDesc.vectorWeight = 0.7 // 向量权重
                    ragDesc.keywordWeight = 0.3 // 关键词权重

                    // 重新写入文件
                    pub.write_file(ragDescFile, JSON.stringify(ragDesc, null, 4));
                }

                if (!ragDesc.supplierName) {
                    ragDesc.supplierName = 'ollama';
                    pub.write_file(ragDescFile, JSON.stringify(ragDesc, null, 4));
                }

                ragDesc.embeddingModelExist = true;
                ragDesc.errorMsg = '';
                let supplierMap = embeddingMap.get(ragDesc.supplierName);
                if (!supplierMap || !supplierMap.get(ragDesc.embeddingModel)) {
                    ragDesc.embeddingModelExist = false;
                    ragDesc.errorMsg = pub.lang('指定嵌入模型不存在: {}', ragDesc.embeddingModel);
                }

                ragList.push(ragDesc);
            }
        }

        return pub.return_success(pub.lang('获取成功'), ragList);
    }


    /**
     * 修改知识库信息
     * @param {string} args.ragName - 知识库名称
     * @param {string} args.ragDesc - 知识库描述
     * @param {object} args.options - 其他选项
     * @returns {Promise<any>} - 修改结果
     */
    async modify_rag(args: {
        ragName: string, ragDesc: string,
        searchStrategy?: number,      // 检索策略 1=混合检索 2=向量检索 3=全文检索 
        maxRecall?: number,           // 最大召回数
        recallAccuracy?: number,    // 召回精度
        resultReordering?: number,    // 结果重排序 1=开启 0=关闭  PS: 目前仅语义重排
        rerankModel?: string,        // 重排序模型 PS: 未实现
        queryRewrite?: number,        // 查询重写 1=开启 0=关闭   PS: 未实现
        vectorWeight?: number,      // 向量权重
        keywordWeight?: number,     // 关键词权重
    }): Promise<any> {

        let { ragName, ragDesc, searchStrategy, maxRecall, recallAccuracy, resultReordering, rerankModel, queryRewrite, vectorWeight, keywordWeight } = args;

        // 检查参数
        if (!ragName) {
            return pub.return_error(pub.lang('知识库名称不能为空'));
        }
        if (ragName == 'vector_db') {
            return pub.return_error(pub.lang('知识库名称不能为vector_db'));
        }

        // 知识库保存路径
        const ragPath = pub.get_rag_path() + "/" + ragName;

        // 检查知识库是否存在
        if (!pub.file_exists(ragPath)) {
            return pub.return_error(pub.lang('知识库不存在'));
        }

        const ragDescFile = ragPath + "/config.json";
        let ragConfig = pub.read_json(ragDescFile);

        ragConfig.ragDesc = ragDesc;
        ragConfig.searchStrategy = searchStrategy == undefined ? ragConfig.searchStrategy : searchStrategy;
        ragConfig.maxRecall = maxRecall == undefined ? ragConfig.maxRecall : maxRecall;
        ragConfig.recallAccuracy = recallAccuracy == undefined ? ragConfig.recallAccuracy : recallAccuracy;
        ragConfig.resultReordering = resultReordering == undefined ? ragConfig.resultReordering : resultReordering;
        ragConfig.rerankModel = rerankModel == undefined ? ragConfig.rerankModel : rerankModel;
        ragConfig.queryRewrite = queryRewrite == undefined ? ragConfig.queryRewrite : queryRewrite;
        ragConfig.vectorWeight = vectorWeight == undefined ? ragConfig.vectorWeight : vectorWeight;
        ragConfig.keywordWeight = keywordWeight == undefined ? ragConfig.keywordWeight : keywordWeight;

        pub.write_file(ragDescFile, JSON.stringify(ragConfig, null, 4));

        return pub.return_success(pub.lang('知识库修改成功'));
    }

    /**
     * 上传知识库文档
     * @param {string} ragName - 知识库名称
     * @param {string} filePath - 文件路径 JSON列表
     * @returns {Promise<any>} - 上传结果
     */
    async upload_doc(args: { ragName: string, filePath: string, separators?: string[], chunkSize?: number, overlapSize?: number }): Promise<any> {
        let { ragName, filePath, separators, chunkSize, overlapSize } = args;

        // 检查参数
        if (!ragName) {
            return pub.return_error(pub.lang('知识库名称不能为空'));
        }

        if (ragName == 'vector_db') {
            return pub.return_error(pub.lang('知识库名称不能为vector_db'));
        }

        if (!filePath) {
            return pub.return_error(pub.lang('文件路径不能为空'));
        }
        let filePathList: string[] = []
        if (filePath.startsWith('[') && filePath.endsWith(']')) {
            filePathList = JSON.parse(filePath);
        } else {
            filePathList = filePath.split(',');
        }
        if (filePathList.length == 0) {
            return pub.return_error(pub.lang('文件路径列表不能为空'));
        }

        if (!separators) {
            separators = [];
        }
        if (!chunkSize) {
            chunkSize = 1000;
        }
        if (!overlapSize) {
            overlapSize = 100;
        }

        if (typeof separators == 'string') {
            separators = [separators]
        }


        // 知识库保存路径
        const ragPath = pub.get_rag_path() + "/" + ragName;

        // 检查知识库是否存在
        if (!pub.file_exists(ragPath)) {
            return pub.return_error(pub.lang('知识库不存在'));
        }


        // 将separators、chunkSize、overlapSize写入知识库配置文件
        const ragDescFile = ragPath + "/config.json";
        if (!pub.file_exists(ragDescFile)) {
            return pub.return_error(pub.lang('知识库配置文件不存在'));
        }
        let ragConfig = pub.read_json(ragDescFile);
        ragConfig.separators = separators;
        ragConfig.chunkSize = chunkSize;
        ragConfig.overlapSize = overlapSize;
        pub.write_json(ragDescFile, ragConfig);


        let ragObj = new Rag();
        // 遍历文件列表
        for (const srcFile of filePathList) {
            // 检查文件是否存在
            if (!pub.file_exists(srcFile)) {
                return pub.return_error(pub.lang('文件不存在'));
            }

            const fileName = path.basename(srcFile);
            // 保存目录
            let dstFile = `${ragPath}/source/${fileName}`

            // 如果同名文件已经存在，则在文件名后面加上编号
            let i = 1;
            while (pub.file_exists(dstFile)) {
                dstFile = `${ragPath}/source/${path.basename(srcFile, path.extname(srcFile))}_${i}${path.extname(srcFile)}`;
                i++;
            }

            // 复制文件到知识库目录，不复制文件属性
            fs.writeFileSync(dstFile, fs.readFileSync(srcFile));

            await ragObj.addDocumentToDB(dstFile, ragName, separators, chunkSize, overlapSize);
        }

        return pub.return_success(pub.lang('文件上传成功'));
    }


    /**
     * 递归扫描文件
     */
    private scanFiles(dir: string, fileList: string[] = []) {
        const files = fs.readdirSync(dir);
        const SUPPORTED_EXTS = [
            '.docx', '.doc', '.xlsx', '.xls', '.csv', '.pptx', '.ppt', '.pdf', 
            '.html', '.htm', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', 
            '.md', '.markdown', '.txt', '.log', '.text', '.conf', '.cfg', '.ini', '.json'
        ];

        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                this.scanFiles(filePath, fileList);
            } else {
                if (SUPPORTED_EXTS.includes(path.extname(file).toLowerCase())) {
                    fileList.push(filePath);
                }
            }
        });
        return fileList;
    }

    /**
     * 导入文件夹（服务端扫描模式）
     * @param {string} ragName - 知识库名称
     * @param {string} folderPath - 文件夹路径
     * @returns {Promise<any>}
     */
    async import_folder(args: { ragName: string, folderPath: string, separators?: string[], chunkSize?: number, overlapSize?: number }): Promise<any> {
        let { ragName, folderPath, separators, chunkSize, overlapSize } = args;

        // 检查参数
        if (!ragName) return pub.return_error(pub.lang('知识库名称不能为空'));
        if (ragName == 'vector_db') return pub.return_error(pub.lang('知识库名称不能为vector_db'));
        if (!folderPath) return pub.return_error(pub.lang('文件夹路径不能为空'));
        if (!pub.file_exists(folderPath)) return pub.return_error(pub.lang('文件夹不存在'));

        // 默认参数处理
        if (!separators) separators = [];
        if (!chunkSize) chunkSize = 1000;
        if (!overlapSize) overlapSize = 100;
        if (typeof separators == 'string') separators = [separators];

        // 知识库路径
        const ragPath = pub.get_rag_path() + "/" + ragName;
        if (!pub.file_exists(ragPath)) return pub.return_error(pub.lang('知识库不存在'));

        // 更新配置
        const ragDescFile = ragPath + "/config.json";
        if (pub.file_exists(ragDescFile)) {
            let ragConfig = pub.read_json(ragDescFile);
            ragConfig.separators = separators;
            ragConfig.chunkSize = chunkSize;
            ragConfig.overlapSize = overlapSize;
            pub.write_json(ragDescFile, ragConfig);
        }

        // 1. 扫描文件
        let files: string[] = [];
        try {
            files = this.scanFiles(folderPath);
        } catch (e: any) {
            return pub.return_error(pub.lang('扫描文件夹失败: {}', e.message));
        }

        if (files.length === 0) {
            return pub.return_error(pub.lang('该文件夹下没有支持的文件'));
        }

        // 2. 批量处理文件复制和准备入库数据
        const ragObj = new Rag();
        const batchSize = 50; // 每次处理50个文件的复制，避免IO拥堵
        let successCount = 0;
        
        // 准备批量插入的数据
        let dbInsertList: Array<{filename: string, dstFile: string}> = [];

        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            
            // 并发复制文件
            await Promise.all(batch.map(async (srcFile) => {
                try {
                    const fileName = path.basename(srcFile);
                    // 使用时间戳+随机数防止重名，而不是循环检查文件是否存在（循环检查在大量文件时极慢）
                    // 或者保留原名，但加上uuid前缀
                    const ext = path.extname(srcFile);
                    const nameNoExt = path.basename(srcFile, ext);
                    // 简单的防重名策略：如果目标存在，加UUID。
                    // 但为了保持原文件名可读性，我们尽量保留原名。
                    // 考虑到数万文件，每次都 check file_exists 可能会慢。
                    // 但如果不 check，直接覆盖可能不安全。
                    // 优化策略：直接用 UUID 作为存储文件名，数据库里存原始文件名。
                    // 但 Rag 系统似乎依赖文件名来做一些事情？查看 rag_task.ts，它用 doc_file 来解析。
                    // 现有的 upload_doc 逻辑是：
                    // let i = 1; while(exists) { ... i++ }
                    // 这在大量重复文件名时是灾难。
                    
                    // 改进：使用 UUID + 扩展名 作为磁盘文件名，确保唯一且无需检查
                    // 或者：hash(fullpath) + ext
                    const safeFileName = `${pub.uuid()}${ext}`; 
                    const dstFile = path.join(ragPath, 'source', safeFileName);
                    
                    // 异步复制
                    await fs.promises.copyFile(srcFile, dstFile);
                    
                    // 记录到列表，准备插入数据库
                    // 注意：这里我们用 safeFileName 作为磁盘文件，但在数据库 doc_name 字段最好存原始文件名以便展示
                    // 修改 addDocumentsToDB 的逻辑？
                    // addDocumentsToDB 使用 path.basename(file.filename) 作为 doc_name
                    // 所以我们需要传原始文件名给 filename，传 safeFileName 的全路径给 dstFile
                    dbInsertList.push({
                        filename: srcFile, // 原始路径，用于提取 doc_name
                        dstFile: dstFile   // 实际存储路径
                    });
                    
                    successCount++;
                } catch (e) {
                    console.error(`Copy file error: ${srcFile}`, e);
                }
            }));
        }

        // 3. 批量插入数据库
        if (dbInsertList.length > 0) {
            // 分批插入数据库，避免一次性构建过大的 SQL/JSON
            const dbBatchSize = 500;
            for (let i = 0; i < dbInsertList.length; i += dbBatchSize) {
                const batch = dbInsertList.slice(i, i + dbBatchSize);
                await ragObj.addDocumentsToDB(batch, ragName, separators, chunkSize, overlapSize);
            }
        }

        return pub.return_success(pub.lang('成功导入 {} 个文件到处理队列', successCount));
    }


    /**
     * 获取知识库文档列表
     * @param {string} ragName - 知识库名称
     * @returns {Promise<any>} - 文件列表
     */
    async get_rag_doc_list(args: { ragName: string }): Promise<any> {
        // logger.info("get rag file list");

        // 检查参数
        if (!args.ragName) {
            return pub.return_error(pub.lang('知识库名称不能为空'));
        }

        // 知识库保存路径
        const ragPath = pub.get_rag_path() + "/" + args.ragName;

        // 检查知识库是否存在
        if (!pub.file_exists(ragPath)) {
            return pub.return_error(pub.lang('知识库不存在'));
        }

        let result = await LanceDBManager.queryRecord("doc_table", "doc_rag='" + args.ragName + "'");

        return pub.return_success(pub.lang('获取成功'), result);
    }


    /**
     * 获取知识库文档内容
     * @param {string} ragName - 知识库名称
     * @param {string} docName - 文档名称
     * return {Promise<any>} - 文档内容
     */
    async get_doc_content(args: { ragName: string, docName: string }): Promise<any> {
        let mdFile = pub.get_data_path() + "/rag/" + args.ragName + "/markdown/" + args.docName + ".md";
        if (pub.file_exists(mdFile)) {
            let content = pub.read_file(mdFile);
            content = content.replace(/{URL}/g, 'http://127.0.0.1:7071');
            return pub.return_success(pub.lang('获取成功'), content);
        }
        return pub.return_error(pub.lang('文档不存在'));
    }


    /**
     * 下载知识库文档
     * @param {string} ragName - 知识库名称
     * @param {string} docName - 文档名称
     * @returns {Promise<any>} - 文件下载流
     */
    async download_doc(args: { ragName: string, docName: string }, event: any): Promise<any> {
        // 检查参数
        if (!args.ragName) {
            return pub.return_error(pub.lang('知识库名称不能为空'));
        }
        if (!args.docName) {
            return pub.return_error(pub.lang('文档名称不能为空'));
        }

        // 知识库保存路径
        const ragPath = pub.get_rag_path() + "/" + args.ragName;

        // 检查知识库是否存在
        if (!pub.file_exists(ragPath)) {
            return pub.return_error(pub.lang('知识库不存在'));
        }

        // 检查文档是否存在
        const docFile = ragPath + "/source/" + args.docName;
        if (!pub.file_exists(docFile)) {
            return pub.return_error(pub.lang('文档不存在'));
        }

        // 设置响应头
        event.response.set('Content-Type', 'application/octet-stream');
        // 设置下载文件名
        let filename = encodeURIComponent(args.docName);
        event.response.set('Content-Disposition', `attachment; filename="${filename}"`);

        // 返回文件流
        const stream = fs.createReadStream(docFile);
        return stream
    }


    async remove_doc(args: { ragName: string, docIdList: string }): Promise<any> {

        // 检查参数
        if (!args.ragName) {
            return pub.return_error(pub.lang('知识库名称不能为空'));
        }
        if (!args.docIdList) {
            return pub.return_error(pub.lang('文档名称不能为空'));
        }

        // 知识库保存路径
        const ragPath = pub.get_rag_path() + "/" + args.ragName;

        // 检查知识库是否存在
        if (!pub.file_exists(ragPath)) {
            return pub.return_error(pub.lang('知识库不存在'));
        }

        let docList = JSON.parse(args.docIdList);
        if (docList.length == 0) {
            return pub.return_error(pub.lang('文档名称列表不能为空'));
        }

        let ragObj = new Rag();

        // 遍历文件列表
        for (const docId of docList) {
            // 获取docName
            let docName = await ragObj.getDocNameByDocId(docId);
            if (!docName) {
                return pub.return_error(pub.lang('文档不存在'));
            }


            // 检查文件是否存在
            const docFile = ragPath + "/source/" + docName;
            if (!pub.file_exists(docFile)) {
                return pub.return_error(pub.lang('文档不存在'));
            }

            // 删除文件
            fs.unlinkSync(docFile);

            // 删除markdown文件
            const mdFile = ragPath + "/markdown/" + docName + ".md";
            if (pub.file_exists(mdFile)) {
                fs.unlinkSync(mdFile);
            }

            // 删除数据库记录
            await ragObj.removeRagDocument(args.ragName, docId);
        }

        return pub.return_success(pub.lang('文档删除成功'));
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
    async reindex_document(args: { ragName: string, docId: string }): Promise<any> {
        let result = await new Rag().reindexDocument(args.ragName, args.docId);
        if (!result) {
            return pub.return_error(pub.lang('操作失败'));
        }
        return pub.return_success(pub.lang('操作成功'));
    }

    /**
     * 重新生成知识库索引
     * @param args
     * @param args.ragName <string> 知识库名称
     * @returns 
     */
    async reindex_rag(args: { ragName: string }): Promise<any> {
        let result = await new Rag().reindexRag(args.ragName);
        if (!result) {
            return pub.return_error(pub.lang('操作失败'));
        }
        return pub.return_success(pub.lang('操作成功'));
    }


    /**
     * 检索知识库
     * @param args
     * @param args.ragName <string> 知识库名称
     * @param args.queryText <string> 查询文本
     * @returns
     */
    async search_document(args: { ragList: string, queryText: string }): Promise<any> {
        let result = await new Rag().searchDocument(JSON.parse(args.ragList), args.queryText);
        return pub.return_success(pub.lang('操作成功'), result);
    }


    /**
     * 获取图片
     * @param args
     * @param args.r <string> 知识库名称
     * @param args.n <string> 图片名称
     * @returns
     */
    async images(args: { r: string, n: string }, event: any): Promise<any> {
        // 检查参数
        if (!args.r) {
            return pub.return_error(pub.lang('知识库名称不能为空'));
        }
        if (!args.n) {
            return pub.return_error(pub.lang('图片名称不能为空'));
        }

        // 知识库保存路径
        const ragPath = pub.get_rag_path() + "/" + args.r;

        // 检查知识库是否存在
        if (!pub.file_exists(ragPath)) {
            return pub.return_error(pub.lang('知识库不存在'));
        }

        // 检查图片是否存在
        let imgFile = ragPath + "/images/" + args.n;
        if (!pub.file_exists(imgFile)) {
            let imgFile1 = imgFile + ".png";
            if (!pub.file_exists(imgFile1)) {
                imgFile1 = imgFile + ".jpg";
                if (!pub.file_exists(imgFile1)) {
                    return pub.return_error(pub.lang('图片不存在'));
                }
            }
        }

        // 设置响应头
        event.response.set('Content-Type', 'image/png');

        // 返回文件流
        const stream = fs.createReadStream(imgFile);
        return stream

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
    async test_chunk(args: { filename: string, chunkSize: number, overlapSize: number, separators: string[] }): Promise<any> {
        let { filename, chunkSize, overlapSize, separators } = args;
        let ragObj = new Rag();
        let result = await ragObj.parseDocument(filename, '')
        let ragTask = new RagTask();
        if (typeof separators == 'string') {
            separators = [separators]
        }

        let chunkList = ragTask.splitText(filename, result.content, separators, chunkSize, overlapSize);
        result.chunkList = chunkList;

        return pub.return_success(pub.lang('操作成功'), result);
    }



    // 优化表
    async optimize_table(args: { ragName: string }): Promise<any> {
        await LanceDBManager.optimizeTable('doc_table')
        let res = await LanceDBManager.optimizeTable(pub.md5(args.ragName))
        return pub.return_success(res);
    }


    /**
     * 获取文档分块列表
     * @param args
     * @param args.ragName <string> 知识库名称
     * @param args.docId <string> 文档ID
     * @returns
     **/
    async get_doc_chunk_list(args: { ragName: string, docId: string }): Promise<any> {
        // 检查参数
        if (!args.ragName) {
            return pub.return_error(pub.lang('知识库名称不能为空'));
        }
        if (!args.docId) {
            return pub.return_error(pub.lang('文档ID不能为空'));
        }

        // 知识库保存路径
        const ragPath = pub.get_rag_path() + "/" + args.ragName;

        // 检查知识库是否存在
        if (!pub.file_exists(ragPath)) {
            return pub.return_error(pub.lang('知识库不存在'));
        }

        let ragObj = new Rag();
        let result = await ragObj.getDocChunkList(args.ragName, args.docId);
        return pub.return_success(pub.lang('操作成功'), result);
    }

    /**
     * 清除未完成的任务队列
     * @returns {Promise<any>}
     */
    async clear_queue(): Promise<any> {
        let ragTask = new RagTask();
        let result = await ragTask.clearTaskQueue();
        if (result) {
            return pub.return_success(pub.lang('任务队列已清除'));
        } else {
            return pub.return_error(pub.lang('清除任务队列失败'));
        }
    }
}


/**
 * 重写 RagController 类的 toString 方法，方便调试和日志输出
 * @returns {string} - 类的字符串表示
 */
RagController.toString = (): string => '[class RagController]';

export default RagController;


