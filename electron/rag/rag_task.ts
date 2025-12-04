import { LanceDBManager } from './vector_database/vector_lancedb';
import { pub } from '../class/public';
import { Rag } from './rag';
import {indexService} from '../service/index'
import { logger } from 'ee-core/log';
import path from 'path';



export class RagTask {
    private docTable = 'doc_table';
    private initialized = false;


    /**
     * 重置卡住的任务
     * 启动时调用，将所有状态为1 (处理中) 的任务重置为 -1 (失败)
     */
    public async resetStuckTasks() {
        logger.info('[RagTask] Checking for stuck tasks (is_parsed=1)...');
        try {
            const stuckDocs = await LanceDBManager.queryRecord(this.docTable, "is_parsed=1");
            if (stuckDocs && stuckDocs.length > 0) {
                logger.warn(`[RagTask] Found ${stuckDocs.length} stuck tasks. Resetting to failed state.`);
                for (const doc of stuckDocs) {
                    logger.warn(`[RagTask] Resetting stuck task: ${doc.doc_id}`);
                    await LanceDBManager.updateRecord(this.docTable, {
                        where: `doc_id='${doc.doc_id}'`,
                        values: { is_parsed: -1 }
                    }, path.basename(doc.doc_file || 'unknown'));
                }
            } else {
                logger.info('[RagTask] No stuck tasks found.');
            }
        } catch (error) {
            logger.error('[RagTask] Error resetting stuck tasks:', error);
        }
    }

    /**
     * 清除未完成的任务队列
     */
    public async clearTaskQueue() {
        logger.info('[RagTask] Clearing task queue (is_parsed != 3)...');
        try {
            // is_parsed != 3 means not finished (0=pending, 1=processing, 2=embedding, -1=failed)
            await LanceDBManager.deleteRecord(this.docTable, "is_parsed != 3");
            logger.info('[RagTask] Task queue cleared.');
            return true;
        } catch (error) {
            logger.error('[RagTask] Error clearing task queue:', error);
            return false;
        }
    }

    /**
     * 获取未解析文档
     * @returns Promise<any>
     */
    async getNotParseDocument(): Promise<any> {
        let result = await LanceDBManager.queryRecord(this.docTable, "is_parsed=0");
        return result;
    }

    async getNotEmbeddingDocument(): Promise<any> {
        let result = await LanceDBManager.queryRecord(this.docTable, "is_parsed=2");
        return result;
    }


    /**
     * 文档分割 - 将长文本分割成小块，尊重Markdown文档结构
     * @param docBody 待分割的文档内容
     * @returns 分割后的文本块数组
     */
    public docChunk(docBody: string,chunkSize:number,overlapSize:number): string[] {
        // 每个块的最大字符数
        if(!chunkSize || chunkSize < 100){
            chunkSize = 1000;
        }
        // 重叠区域的字符数，确保上下文连贯性
        if(!overlapSize){
            overlapSize = 100;
        }

        // 最小块大小阈值，小于此值不设置重叠区域
        const minSizeForOverlap = overlapSize;
        
        // 处理空文档情况
        if (!docBody || docBody.trim().length === 0) {
            return [];
        }
        
        const chunks: string[] = [];
        
        // 首先按照Markdown标题分割（# 开头的行）
        const headingRegex = /^#{1,6}\s+.+$/gm;
        const headingMatches = [...docBody.matchAll(headingRegex)];
        
        if (headingMatches.length > 1) {
            // 有明确的Markdown标题结构，按标题分块
            const sections: string[] = [];
            
            for (let i = 0; i < headingMatches.length; i++) {
                const currentMatch = headingMatches[i];
                const nextMatch = headingMatches[i + 1];
                
                const startIdx = currentMatch.index!;
                const endIdx = nextMatch ? nextMatch.index! : docBody.length;
                
                sections.push(docBody.substring(startIdx, endIdx));
            }
            
            // 对每个部分进一步处理
            for (const section of sections) {
                if (section.length <= chunkSize) {
                    chunks.push(section.trim());
                } else {
                    // 如果部分太长，进一步分割
                    const subChunks = this.splitTextBySize(section, chunkSize, overlapSize, minSizeForOverlap);
                    chunks.push(...subChunks);
                }
            }
        } else {
            // // 没有明确的标题结构，尝试按照Markdown列表、代码块等分割
            // const mdBlockRegex = /```[\s\S]*?```|^\s*[*+-]\s+.*$(?:\n^\s*[*+-]\s+.*$)*/gm;
            // const mdBlocks = [...docBody.matchAll(mdBlockRegex)];
            
            // if (mdBlocks.length > 0) {
            //     // 处理Markdown块和块之间的文本
            //     let lastEnd = 0;
                
            //     for (const block of mdBlocks) {
            //         // 先处理块前的文本
            //         if (block.index! > lastEnd) {
            //             const textBefore = docBody.substring(lastEnd, block.index!);
            //             const textChunks = this.splitTextBySize(textBefore, chunkSize, overlapSize, minSizeForOverlap);
            //             chunks.push(...textChunks);
            //         }
                    
            //         // 处理Markdown块本身
            //         const blockContent = block[0];
            //         if (blockContent.length <= chunkSize) {
            //             chunks.push(blockContent.trim());
            //         } else {
            //             const blockChunks = this.splitTextBySize(blockContent, chunkSize, overlapSize, minSizeForOverlap);
            //             chunks.push(...blockChunks);
            //         }
                    
            //         lastEnd = block.index! + block[0].length;
            //     }
                
            //     // 处理最后一个块后的文本
            //     if (lastEnd < docBody.length) {
            //         const textAfter = docBody.substring(lastEnd);
            //         const textChunks = this.splitTextBySize(textAfter, chunkSize, overlapSize, minSizeForOverlap);
            //         chunks.push(...textChunks);
            //     }
                // 没有特定Markdown结构，按段落分割
                const textChunks = this.splitTextBySize(docBody, chunkSize, overlapSize, minSizeForOverlap);
                chunks.push(...textChunks);
            // } else {
            //     // 没有特定Markdown结构，按段落分割
            //     const textChunks = this.splitTextBySize(docBody, chunkSize, overlapSize, minSizeForOverlap);
            //     chunks.push(...textChunks);
            // }
        }
        
        return chunks;
    }
    
    /**
     * 辅助方法：按大小分割文本
     */
    private splitTextBySize(text: string, chunkSize: number, overlapSize: number, minSizeForOverlap: number): string[] {
        const chunks: string[] = [];
        const paragraphs = text.split('\n\n');
        let currentChunk = '';
        
        for (const paragraph of paragraphs) {
            // 如果段落本身就超过了块大小，则需要进一步分割
            if (paragraph.length > chunkSize) {
                // 如果当前块不为空，先保存它
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                }
                
                // 将段落按单换行符进一步分割
                const lines = paragraph.split('\n');
                for (const line of lines) {
                    // 如果当前行加入后会超出块大小，先保存当前块
                    if (currentChunk.length + line.length > chunkSize && currentChunk.length > 0) {
                        chunks.push(currentChunk.trim());
                        
                        // 只有当块足够大时才保留重叠部分
                        if (currentChunk.length >= minSizeForOverlap) {
                            currentChunk = currentChunk.slice(-overlapSize);
                        } else {
                            currentChunk = '';
                        }
                    }
                    
                    // 添加当前行到块中
                    currentChunk += line + '\n';
                }
            } else {
                // 如果加入当前段落后会超出块大小，先保存当前块
                if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
                    chunks.push(currentChunk.trim());
                    
                    // 只有当块足够大时才保留重叠部分
                    if (currentChunk.length >= minSizeForOverlap) {
                        currentChunk = currentChunk.slice(-overlapSize);
                    } else {
                        currentChunk = '';
                    }
                }
                
                // 添加当前段落到块中
                currentChunk += paragraph + '\n\n';
            }
        }
        
        // 添加最后一个块（如果有内容）
        if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks;
    }


    // 递归分割
    recursionSplit(chunkList:string[],separators:string[],chunkSize:number,currentSep:string,overlapSize:number):string[]{
        let chunks:string[] = [];
        let currentSepIsString = typeof currentSep == 'string';
        for(let chunk of chunkList){
            if(chunk.length == 0){
                continue;
            }
            if(chunk.length <= chunkSize){
                if(currentSepIsString){
                    // 如果当前分隔符是字符串，则直接添加
                    chunks.push(chunk.trim() + currentSep);
                }else{
                    chunks.push(chunk.trim());
                }
                continue;
            }

            if(separators.length > 0){
                let sep = separators[0];
                let chunkList2 = this.split(chunk,sep);
                chunks.push(...this.recursionSplit(chunkList2,separators.slice(1),chunkSize,sep,overlapSize));
            }else{
                // 如果所有分隔符都尝试过了，还是没有找到合适的分隔符，就直接按长度分割
                chunks.push(...this.docChunk(chunk,chunkSize,overlapSize));
            }
        }
        return chunks;
    }

    // 使用分隔符分割文本
    // 这里的分隔符可以是字符串或正则表达式
    split(text:string,sep:any){
        let chunkList:string[] = [];
        if(typeof sep == 'string'){
            // 如果是字符串，直接使用字符串分割
            chunkList = text.split(sep);
        }else{
            // 如果是正则表达式，使用正则表达式分割
            let keys:any = text.match(sep); // 匹配分隔符
            if(keys == null){
                return [text];
            }
            for(let key of keys){
                let splitArr:string[] = text.split(key);
                let arrLen = splitArr.length;
                if(arrLen > 1){
                    for(let i = 0; i < arrLen; i++){
                        let chunk = splitArr[i]
                        
                        
                        if(i > 0) {
                            chunk = key + chunk; // 添加分隔符
                        }

                        if(i == arrLen -1){
                            text = chunk; // 更新文本
                            continue;
                        }

                        if(chunk.length > 0){
                            chunkList.push(chunk); // 添加到块列表
                        }
                    }
                }
            }
            
            // 最后一个块
            if(text.length > 0){
                chunkList.push(text);
            }
        }
        
        return chunkList;
    }

    // 自动识别分隔符
    defaultSeparators(separators: string[],filename:string,text:string): string[] {
        if (separators.length == 0) {
            separators = [];
            // 如果表格文件，且未指定分隔符，则默认使用换行符分割
            if (filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.csv')) {
                separators = ["\n"];
                return separators;
            }

            // 如果文本高频出现第X章、第X节，第X条等明显符合规则的关键字，则使用对应正则表达式进行分割
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
            ]

            for (let patt of patt_list) {
                let keys = text.match(patt);
                if(keys && keys.length > 3){
                    separators.push("/"+patt.source+"/");
                }
            }

        }
        return separators;
    }

    // 格式化分割符
    formatSep(sep:string[]):any[]{
        let sepList:any[] = []
        for(let s of sep){
            // 判断是否为正则表达式
            if (s.length > 3 && s.startsWith('/') && (s.endsWith('/') || s.endsWith('/g'))) {
                // 去掉开头和结尾的斜杠
                if(s.endsWith('/g')){
                    s = s.slice(1,-2);
                }else{
                    s = s.slice(1,-1);
                }

                // 如果没有括号，添加括号
                // 这里的正则表达式是为了匹配括号内的内容
                // 例如：/(\d+)/g => (\d+)
                if(!s.startsWith("(") || !s.endsWith(")")){
                    s = "(" + s + ")";
                }

                sepList.push(new RegExp(s, 'g'));
            }else{
                sepList.push(s);
            }
        }
        return sepList;
    }

    // 获取文档名称
    getDocName(filename:string):string{
        let docName = path.basename(filename)
        // 删除文档名称中的扩展名
        if(docName.includes('.')){
            docName = docName.replace('.md','').split('.').slice(0, -1).join('.');
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
    splitText(filename:string,text: string, separators: string[],chunkSize:number,overlapSize?:number): string[] {
        let chunks:string[] = [];
        let i = 0;
        if(separators.length == 0){
            // 尝试自动识别分隔符
            separators = this.defaultSeparators(separators,filename,text);
            if(separators.length == 0){
                // 如果没有分隔符，则直接按长度分割
                return this.docChunk(text,chunkSize,overlapSize);
            }
        }

        let docName = this.getDocName(filename)
        let sepList:any[] = this.formatSep(separators)
        let sep = sepList[i];
        let chunkList:string[] = this.split(text,sep);
        chunks = this.recursionSplit(chunkList,sepList.slice(1),chunkSize,sep,overlapSize);

        // 为每个块添加文档名称和块索引、起始位置和结束位置
        for(let i = 0; i < chunks.length; i++){
            let chunk = chunks[i].trim()
            if(chunk.length > 0){
                // 计算块起始位置和结束位置
                let startPos = text.indexOf(chunk);
                let endPos = startPos + chunk.length;
                chunks[i] = `[${docName}]#${i+1} POS[${startPos}-${endPos}]\n` + chunk;
            }
        }

        return chunks;
    }


    // 后台解析任务
    public parseTask(){
        logger.info('[RagTask] Starting parallel processing loops...');
        this.runParseLoop();
        this.runEmbedLoop();
    }

    private async runParseLoop() {
        const sleep = 5000;
        while(true) {
            try {
                if (!this.initialized) {
                    await this.resetStuckTasks();
                    this.initialized = true;
                }
                if((global as any).changePath) {
                    logger.info('[RagTask] Detected changePath, copying data path...');
                    (global as any).changePath = false
                    indexService.copyDataPath()
                }
                await this.parse();
            } catch (e) {
                logger.error('[RagTask] Parse loop error:', e);
            }
            await new Promise(r => setTimeout(r, sleep));
        }
    }

    private async runEmbedLoop() {
        const sleep = 5000;
        while(true) {
            try {
                await this.embed();
            } catch (e) {
                logger.error('[RagTask] Embed loop error:', e);
            }
            await new Promise(r => setTimeout(r, sleep));
        }
    }


    // 当向量数据足够多时，切换到余弦相似度索引
    public async switchToCosineIndex(){
        console.log('[RagTask] switchToCosineIndex called.');
        let tableList = pub.readdir(pub.get_data_path() + "/rag/vector_db")
        let indexTipsPath = pub.get_data_path() + "/rag/index_tips"
        if (!pub.file_exists(indexTipsPath)) {
            pub.mkdir(indexTipsPath)
        }
        
        for(let tablePath of tableList){
            // 给主线程喘息机会
            await new Promise(resolve => setTimeout(resolve, 100));
            let tableName = tablePath.split('/').pop()?.replace(".lance","")
            // console.log(tableName,tableName?.length)
            if (tableName?.length !== 32) {
                continue
            }

            // 创建全文索引
            await LanceDBManager.createDocFtsIndex(tableName)

            let indexTipFile = indexTipsPath + "/" + tableName + ".pl"
            if (pub.file_exists(indexTipFile)) {
                continue
            }

            if(await LanceDBManager.tableCount(tableName) > 256) {
                await LanceDBManager.addIndex(tableName,[{type: 'ivfPq',key: 'vector'}])
                pub.write_file(indexTipFile,"1")
            }
        }
    }

    /**
     * 解析文档
     * @returns Promise<void>
     */
    public async parse(){
        let notParseDocument = await this.getNotParseDocument()
        
        if(!notParseDocument || notParseDocument.length === 0) {
            return;
        }
        
        console.log('[RagTask] parse() started.');
        console.log(`[RagTask] Found ${notParseDocument.length} unparsed documents.`);
        
        // 限制每批处理的数量，防止一次处理太多导致卡顿太久
        // 如果队列中有大量积压，分批处理可以让系统有喘息机会，并且防止长时间占用
        if(notParseDocument && notParseDocument.length > 10){
            notParseDocument = notParseDocument.slice(0, 10);
        }

        let dataDir = pub.get_data_path()
        let repDataDir = '{DATA_DIR}'

        let ragObj = new Rag()
        const concurrency = 8
        for (let i = 0; i < notParseDocument.length; i += concurrency) {
                // 给主线程喘息机会
                await new Promise(resolve => setTimeout(resolve, 100));
                const batch = notParseDocument.slice(i, i + concurrency)
            await Promise.all(batch.map(async (doc:any) => {
                try{
                    let filename = doc.doc_file.replace(repDataDir, dataDir)
                    
                    // 标记为处理中
                    logger.info(`[RagTask] Marking file as processing: ${doc.doc_id}`);
                    try {
                        await Promise.race([
                            LanceDBManager.updateRecord(this.docTable,{where: `doc_id='${doc.doc_id}'`,values: {is_parsed: 1}}, doc.doc_name || path.basename(filename)),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Update status timeout')), 10000))
                        ]);
                    } catch (err) {
                        logger.error(`[RagTask] Failed to mark processing status for ${doc.doc_id}, skipping.`, err);
                        return;
                    }

                    logger.info(`[RagTask] Start parsing file: ${doc.doc_name || path.basename(filename)} (ID: ${doc.doc_id})`);
                    const timeoutMs = 60 * 1000 // 60 seconds
                    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`Parse timeout after ${timeoutMs}ms`)), timeoutMs))
                    
                    // 构建唯一的中文文件名: 原文件名_ID.扩展名.md
                    // 例如: 需求文档_2ee51cfc....docx.md
                    let fileExt = path.extname(doc.doc_name);
                    let fileNameNoExt = path.basename(doc.doc_name, fileExt);
                    let customOutputName = `${fileNameNoExt}_${doc.doc_id}${fileExt}.md`;

                    let parseDoc:any = await Promise.race([
                        ragObj.parseDocument(filename,doc.doc_rag,true,customOutputName),
                        timeout
                    ])
                    logger.info(`[RagTask] Finished parsing file: ${doc.doc_name || path.basename(filename)}`);
                    if(!parseDoc.content){
                        logger.warn(`[RagTask] No content parsed for ${doc.doc_id}`);
                        await LanceDBManager.updateRecord(this.docTable,{where: `doc_id='${doc.doc_id}'`,values: {is_parsed: -1}}, doc.doc_name || path.basename(filename))
                        return
                    }
                    if (parseDoc.savedPath) {
                        logger.info(`[RagTask] 解析产出 MD 文件: ${parseDoc.savedPath}`)
                    }
                    const postProcessPromise = (async () => {
                        logger.info(`[RagTask] Start generating abstract for ${doc.doc_id}`)
                        const abstract = await ragObj.generateAbstract(parseDoc.content)
                        logger.info(`[RagTask] Skip full-doc keywords for ${doc.doc_id}`)
                        const keywords: string[] = []
                        const pdata = {
                            md_file: parseDoc.savedPath?.replace(dataDir, repDataDir),
                            doc_abstract: abstract,
                            is_parsed: 2,
                            update_time: pub.time(),
                        }
                        logger.info(`[RagTask] Start updating record for ${doc.doc_id}`)
                        await Promise.race([
                            LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: pdata }, doc.doc_name || path.basename(filename)),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Update success status timeout')), 10000))
                        ]);
                        logger.info(`[RagTask] Successfully updated record for ${doc.doc_id}`)
                        return true
                    })()
                    await Promise.race([
                        postProcessPromise,
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Post-processing timeout')), 60000))
                    ])
                }catch(e){
                    logger.error(pub.lang('[parseDocument]解析文档失败'),e)
                    try {
                        await Promise.race([
                            LanceDBManager.updateRecord(this.docTable,{where: `doc_id='${doc.doc_id}'`,values: {is_parsed: -1}}, doc.doc_name || path.basename(filename)),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Update failed status timeout')), 5000))
                        ]);
                    } catch (updateErr) {
                        logger.error(`[RagTask] Failed to mark failed status for ${doc.doc_id}`, updateErr);
                    }
                }
            }))
        }
    }



    private async processDocument(doc: any, dataDir: string, repDataDir: string, ragObj: any, ragNameList: string[]) {
        let md_file = doc.md_file.replace(repDataDir, dataDir)
        let fileName = doc.doc_name || path.basename(md_file)
        try {
            logger.info(`[RagTask] [${doc.doc_id}] 1. Start processing: ${fileName}`);

            if (!pub.file_exists(md_file)) {
                logger.warn(`[RagTask] MD file not found for ${doc.doc_id}: ${md_file}`);
                await Promise.race([
                    LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: { is_parsed: -1 } }, fileName),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Update not found status timeout')), 10000))
                ]);
                return
            }

            console.log(`[RagTask] [${fileName}] 2. Reading file...`);
            let md_body = pub.read_file(md_file)
            const chunkSize = doc.chunk_size || 1000
            const overlap = 100

            console.log(`[RagTask] [${fileName}] 3. Splitting text...`);
            let chunks = this.splitText(doc.doc_file, md_body, doc.separators, chunkSize, overlap)
            console.log(`[RagTask] [${fileName}] Split into ${chunks.length} chunks.`);

            let chunkList: any[] = []
            // 根据切片数量动态调整日志频率，避免刷屏
            const logInterval = chunks.length > 1000 ? 100 : (chunks.length > 100 ? 20 : 5);
            
            for (let j = 0; j < chunks.length; j++) {
                let chunk = chunks[j];
                // 给主线程喘息机会，防止大量关键词生成卡死
                await new Promise(resolve => setTimeout(resolve, 20));

                if (j % logInterval === 0 || j === chunks.length - 1) {
                    console.log(`[RagTask] [${fileName}] 4. Generating keywords: ${j + 1}/${chunks.length}`);
                }

                let chunkInfo = {
                    text: chunk,
                    docId: doc.doc_id,
                    tokens: pub.cutForSearch(chunk).join(' '),
                    keywords: await Promise.race([
                        ragObj.generateKeywords(chunk, 3),
                        new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 30000))
                    ])
                }
                chunkList.push(chunkInfo)
            }

            console.log(`[RagTask] [${fileName}] 5. Adding to LanceDB...`);
            let table = pub.md5(doc.doc_rag)
            let ragInfo: any = await Promise.race([
                ragObj.getRagInfo(doc.doc_rag),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Get RagInfo timeout')), 10000))
            ]);
            try {
                const texts = chunkList.map(i => i.text)
                const keywordsArr = chunkList.map(i => i.keywords)
                await Promise.race([
                    LanceDBManager.addDocuments(table, ragInfo.supplierName, ragInfo.embeddingModel, texts, keywordsArr, doc.doc_id),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Add documents timeout')), 120000))
                ])
            } catch (e: any) {
                logger.error(pub.lang('[addDocuments]批量插入数据失败'), e)
                const msg = String(e?.message || e)
                if (msg.includes('Commit conflict') || msg.includes('concurrent commit')) {
                    return
                }
                throw e
            }

            // 更新文档状态
            console.log(`[RagTask] [${fileName}] 6. Updating status...`);
            await Promise.race([
                LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: { is_parsed: 3 } }, fileName),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Update success status timeout')), 10000))
            ])

            // 添加知识库名称到列表
            if (!ragNameList.includes(doc.doc_rag)) {
                ragNameList.push(doc.doc_rag)
            }

            logger.info(`[RagTask] [${doc.doc_id}] Done.`);
        } catch (error) {
            logger.error(`[RagTask] Error processing document ${doc.doc_id}`, error);
            try {
                await Promise.race([
                    LanceDBManager.updateRecord(this.docTable, { where: `doc_id='${doc.doc_id}'`, values: { is_parsed: -1 } }, fileName),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Update failed status timeout')), 10000))
                ])
            } catch (updateErr) {
                logger.error(`[RagTask] Failed to update status to -1 for ${doc.doc_id}`, updateErr);
            }
        }
    }

    /**
     * 开始嵌入文档
     * @returns Promise<string>
     */
    public async embed(){
        try{
            let notEmbeddingDocument = await this.getNotEmbeddingDocument()
            
            if(!notEmbeddingDocument || notEmbeddingDocument.length === 0) {
                return;
            }

            console.log('[RagTask] embed() started.');
            console.log(`[RagTask] Found ${notEmbeddingDocument.length} unembedded documents.`);
            
            // 限制每批处理的数量，防止一次处理太多导致内存溢出，但比之前大
            if(notEmbeddingDocument && notEmbeddingDocument.length > 50){
                notEmbeddingDocument = notEmbeddingDocument.slice(0, 50);
            }

            let dataDir = pub.get_data_path()
            let repDataDir = '{DATA_DIR}'
            let ragObj = new Rag()
            let ragNameList:string[] = []
            const embedConcurrency = 6
            
            const executing: Promise<void>[] = [];
            
            for (const doc of notEmbeddingDocument) {
                // 给主线程喘息机会
                await new Promise(resolve => setTimeout(resolve, 20));
                
                // 创建任务 Promise
                const p = this.processDocument(doc, dataDir, repDataDir, ragObj, ragNameList).then(() => {
                    // 任务完成后从 executing 数组移除
                    const index = executing.indexOf(p);
                    if (index > -1) {
                        executing.splice(index, 1);
                    }
                });
                
                executing.push(p);
                
                // 如果达到并发上限，等待任意一个完成
                if (executing.length >= embedConcurrency) {
                    await Promise.race(executing);
                }
            }
            
            // 等待所有剩余任务完成
            await Promise.all(executing);
            
            // 更新知识库FIT索引
            if (ragNameList.length > 0) {
                logger.info('[RagTask] Starting FTS index update for: ' + ragNameList.join(', '));
                for(let ragName of ragNameList){
                    try {
                        // 给主线程喘息机会
                        await new Promise(resolve => setTimeout(resolve, 100));
                        let encryptTableName = pub.md5(ragName)
                        logger.info(`[RagTask] Creating index for ${ragName}...`);
                        await Promise.race([
                            LanceDBManager.createDocFtsIndex(encryptTableName),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Create FTS Index timeout')), 120000))
                        ]);
                        
                        logger.info(`[RagTask] Optimizing table ${ragName}...`);
                        await Promise.race([
                            LanceDBManager.optimizeTable(encryptTableName),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Optimize Table timeout')), 120000))
                        ]);
                        logger.info(`[RagTask] Finished index update for ${ragName}`);
                    } catch (err) {
                        logger.error(`[RagTask] Failed to update index for ${ragName}`, err);
                    }
                }
                logger.info('[RagTask] All index updates completed.');
            }
            

        }catch(e){
            logger.error(pub.lang('[embed]嵌入文档失败'),e)
            return e
        }
    }
}
