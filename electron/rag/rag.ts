import { parseDocument } from './doc_engins/doc';
import { LanceDBManager } from './vector_database/vector_lancedb';
import * as path from 'path';
import { pub,jieba,tfidf } from '../class/public';
import { agentService } from '../service/agent';



// 获取模板常量
const getTemplate = (agent_name?:string):{ DEEPSEEK_PROMPT_TPL:string, DEEPSEEK_SYSTEM_PROMPT_TPL:string, OTHER_PROMPT_TPL:string, OTHER_SYSTEM_PROMPT_TPL:string, QUERY_PROMPT_TPL:string } => {
    agent_name = agent_name || '';
    let agentInfo = agentService.get_agent_config(agent_name);
    
    
    // 提取模板常量
    let TEMPLATES_LANG = [
        agentInfo?agentInfo.prompt:pub.lang('以下内容是基于用户发送的消息的知识库检索结果'),
        pub.lang('在我给你的检索结果中，每个结果都是[检索结果 X begin]...[检索结果 X end]格式的，X代表每段知识内容的的数字索引。另外检索结果中可能包含一些不相关的信息，你可以根据需要选择其中的内容。'),
        pub.lang('在回答时，请注意以下几点'),
        pub.lang('今天是'),
        pub.lang('用户所在地点是'),
        pub.lang('不要在回答内容中提及检索结果的具体来源，也不要提及检索结果的具体排名。'),
        pub.lang('并非检索结果的所有内容都与用户的问题密切相关，你需要结合问题，对检索结果进行甄别、筛选。'),
        agentInfo?'':pub.lang('对于列举类的问题（如列举所有航班信息），尽量将答案控制在10个要点以内，并告诉用户可以查看检索来源、获得完整信息。优先提供信息完整、最相关的列举项；如非必要，不要主动告诉用户检索结果未提供的内容。'),
        agentInfo?'':pub.lang('对于创作类的问题（如写论文），你需要解读并概括用户的题目要求，选择合适的格式，充分利用检索结果并抽取重要信息，生成符合用户要求、极具思想深度、富有创造力与专业性的答案。你的创作篇幅需要尽可能延长，对于每一个要点的论述要推测用户的意图，给出尽可能多角度的回答要点，且务必信息量大、论述详尽。'),
        agentInfo?'':pub.lang('如果回答很长，请尽量结构化、分段落总结。如果需要分点作答，尽量控制在5个点以内，并合并相关的内容。'),
        agentInfo?'':pub.lang('对于客观类的问答，如果问题的答案非常简短，可以适当补充一到两句相关信息，以丰富内容。'),
        pub.lang('你需要根据用户要求和回答内容选择合适、美观的回答格式，确保可读性强。'),
        pub.lang('你的回答应该综合多个相关知识片段来回答，不能重复引用一个知识片段。'),
        pub.lang('除非用户要求，否则你回答的语言需要和用户提问的语言保持一致。'),
        pub.lang('用户消息为'),
    ]

    let OTHER_SYSTEM_PROMPT_TPL_LANG = [
        agentInfo?agentInfo.prompt:pub.lang('你是一个擅长根据知识库检索结果回答用户查询的人工智能模型。'),
        pub.lang('在回答时，请注意以下几点'),
        pub.lang('根据提供的检索结果生成信息丰富且与用户查询相关的回答，如果知识库检索结果中有图片引用信息，可根据需要引用这些图片来强化内容结构。'),
        pub.lang('当前日期和时间为'),
        pub.lang('用户所在地区为'),
        pub.lang('不要提及检索结果的具体排名。'),
        pub.lang('并非检索结果的所有内容都与用户的问题密切相关，你需要结合用户的意图，对检索结果进行甄别、筛选。'),
        agentInfo?'':pub.lang('对于列举类的问题（如列举所有航班信息），尽量将答案控制在10个要点以内，并告诉用户可以查看检索来源、获得完整信息。优先提供信息完整、最相关的列举项'),
        agentInfo?'':pub.lang('对于创作类的问题（如写论文），你需要解读并概括用户的题目要求，选择合适的格式，充分利用检索结果并抽取重要信息，生成符合用户要求、极具思想深度、富有创造力与专业性的答案。你的创作篇幅需要尽可能延长，对于每一个要点的论述要推测用户的意图，给出尽可能多角度的回答要点，且务必信息量大、论述详尽。'),
        agentInfo?'':pub.lang('如果回答很长，请尽量结构化、分段落总结。如果需要分点作答。'),
        agentInfo?'':pub.lang('对于客观类的问答，如果问题的答案非常简短，可以适当补充一到两句相关信息，以丰富内容。'),
        agentInfo?'':pub.lang('你需要根据用户要求和回答内容选择合适、美观的回答格式，确保可读性强。'),
        pub.lang('你的回答应该综合多个相关知识片段来回答，不能重复引用一个知识片段。'),
        pub.lang(''),
        pub.lang('以下内容是基于用户发送的消息的检索结果'),
    ]


    let QUERY_PROMPT_TPL_LANG = [
        pub.lang('根据用户的问题，和上一个对话的内容，理解用户意图，生成一个用于检索引擎检索的问题，这个问题的检索结果将会用于帮助智能模型回答用户问题，回答内容中只有一个问题，且只包含问题内容，不包含其它信息。'),
        pub.lang('今天的时间是'),
        pub.lang('用户所在地点是'),
        pub.lang('上一个对话'),
        pub.lang('后续问题'),
        pub.lang('用于检索的问题'),
    ]

    let DEEPSEEK_PROMPT_TPL = `# ${TEMPLATES_LANG[0]}:
{search_results}
${TEMPLATES_LANG[1]}
${TEMPLATES_LANG[2]}:
- ${TEMPLATES_LANG[3]}{current_date_time}。
- ${TEMPLATES_LANG[4]}{user_location}。
- ${TEMPLATES_LANG[5]}
- ${TEMPLATES_LANG[6]}
- ${TEMPLATES_LANG[7]}
- ${TEMPLATES_LANG[8]}
- ${TEMPLATES_LANG[9]}
- ${TEMPLATES_LANG[10]}
- ${TEMPLATES_LANG[11]}
- ${TEMPLATES_LANG[12]}
- ${TEMPLATES_LANG[13]}

{doc_files}

# ${TEMPLATES_LANG[14]}:
{question}`

    let DEEPSEEK_SYSTEM_PROMPT_TPL = ""
    let OTHER_PROMPT_TPL = "{question}"

    let OTHER_SYSTEM_PROMPT_TPL = `# ${OTHER_SYSTEM_PROMPT_TPL_LANG[0]}:
## ${OTHER_SYSTEM_PROMPT_TPL_LANG[1]}:
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[2]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[3]} {current_date_time}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[4]} {user_location}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[5]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[6]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[7]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[8]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[9]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[10]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[11]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[12]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[13]}

## ${OTHER_SYSTEM_PROMPT_TPL_LANG[14]}:
<search-results>
{search_results}
</search-results>
{doc_files}`

    let  QUERY_PROMPT_TPL = `# ${QUERY_PROMPT_TPL_LANG[0]}
## ${QUERY_PROMPT_TPL_LANG[1]}: {current_date_time}
## ${QUERY_PROMPT_TPL_LANG[2]}: {user_location}
## ${QUERY_PROMPT_TPL_LANG[3]}:
{chat_history}

## ${QUERY_PROMPT_TPL_LANG[4]}: {question}
${QUERY_PROMPT_TPL_LANG[5]}:`
    


    return { DEEPSEEK_PROMPT_TPL, DEEPSEEK_SYSTEM_PROMPT_TPL, OTHER_PROMPT_TPL, OTHER_SYSTEM_PROMPT_TPL, QUERY_PROMPT_TPL }
}



// 获取当前日期时间字符串
const getCurrentDateTime = () => {
    // 获取当前日期时间
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();

    // 星期几
    const weekDay = [
        pub.lang('星期日'), 
        pub.lang('星期一'), 
        pub.lang('星期二'),
        pub.lang('星期三'), 
        pub.lang('星期四'), 
        pub.lang('星期五'), 
        pub.lang('星期六')][now.getDay()];

    // 上午/下午
    const ampm = hour < 12 ? pub.lang('上午') : pub.lang('下午');

    return `${year}-${month}-${day} ${hour}:${minute}:${second} -- ${ampm}  ${weekDay}`;
}

// 获取用户所在地区
const getUserLocation = () => {
    if(pub.get_language() == 'zh'){
        return global.area || pub.lang("未知地区");
    }
    return pub.lang("未知地区");
}


// 生成 DeepSeek 类型的提示信息
const generateDeepSeekPrompt = (searchResultList: any[], query: string,doc_files:string[],agent_name:string): { userPrompt: string; systemPrompt: string,searchResultList:any,query:string } => {
    const currentDateTime = getCurrentDateTime();
    const userLocation = getUserLocation();

    const search_results = searchResultList.map(
        (result, idx) =>
            `[${pub.lang('检索结果')} ${idx+1} begin]
${pub.lang('来源')}: ${result.link}
${pub.lang('内容')}:${result.content}
[${pub.lang('检索结果')} ${idx} end]`
    ).join("\n");


    let doc_files_str = doc_files.map(
        (doc_file, idx) =>
            `[${pub.lang('用户文档')} ${idx+1} begin]
${pub.lang('内容')}: ${doc_file}
[${pub.lang('用户文档')} ${idx} end]`
    ).join("\n");


    doc_files_str = `${pub.lang('以下是用户上传的文档内容，每个文档内容都是[用户文档 X begin]...[用户文档 X end]格式的，你可以根据需要选择其中的内容。')}
${doc_files_str}`
    const { DEEPSEEK_PROMPT_TPL, DEEPSEEK_SYSTEM_PROMPT_TPL } = getTemplate(agent_name);
    const userPrompt = DEEPSEEK_PROMPT_TPL
       .replace("{search_results}", search_results)
       .replace("{current_date_time}", currentDateTime)
       .replace("{question}", query)
       .replace("{user_location}", userLocation)
        .replace("{doc_files}", doc_files_str);

    const systemPrompt = DEEPSEEK_SYSTEM_PROMPT_TPL;

    return { userPrompt, systemPrompt, searchResultList,query };
};

// 生成其他类型的提示信息
const generateOtherPrompt = (searchResultList: any[], query: string,doc_files:string[],agent_name:string): { userPrompt: string; systemPrompt: string,searchResultList:any,query:string } => {
    const currentDateTime = getCurrentDateTime();
    const userLocation = getUserLocation();

    const search_results = searchResultList.map(
        (result, idx) =>
            `<result source="${result.link}" id="${idx+1}">${result.content}</result>`
    ).join("\n");


    let doc_files_str = doc_files.map(
        (doc_file, idx) =>
            `<doc source="${doc_file}" id="${idx+1}">${doc_file}</doc>`
    ).join("\n");
    doc_files_str = `${pub.lang('以下是用户上传的文档内容')}
<doc_files>
${doc_files_str}
</doc_files>`;
    const { OTHER_PROMPT_TPL, OTHER_SYSTEM_PROMPT_TPL } = getTemplate(agent_name);
    const systemPrompt = OTHER_SYSTEM_PROMPT_TPL
       .replace("{search_results}", search_results)
       .replace("{current_date_time}", currentDateTime)
       .replace("{user_location}", userLocation)
         .replace("{doc_files}", doc_files_str);

    const userPrompt = OTHER_PROMPT_TPL.replace("{question}", query);

    return { userPrompt, systemPrompt ,searchResultList,query};
};


// 获取默认提示信息
export const getDefaultPrompt = (query: string,model:string): { userPrompt: string; systemPrompt: string,searchResultList:any,query:string } => {
    let userPrompt = '';
    let systemPrompt = '';
    let searchResultList = [];
    const currentDateTime = getCurrentDateTime();
    const userLocation = getUserLocation();
    const { DEEPSEEK_SYSTEM_PROMPT_TPL, OTHER_SYSTEM_PROMPT_TPL } = getTemplate();
    if (model.indexOf("deepseek") !== -1) {
        userPrompt = DEEPSEEK_SYSTEM_PROMPT_TPL
        .replace("{current_date_time}", currentDateTime)
        .replace("{user_location}", userLocation)
        .replace("{question}", query)
        .replace("{search_results}", '');
    }else{
        systemPrompt = OTHER_SYSTEM_PROMPT_TPL
        .replace("{current_date_time}", currentDateTime)
        .replace("{user_location}", userLocation)
        .replace("{question}", query)
        .replace("{search_results}", '');
    }

    return { userPrompt, systemPrompt,searchResultList,query };
}

export class Rag {
    private docTable = 'doc_table';

    /**
     * 解析文档
     * @param filename:string 文件名
     * @param ragName:string rag名称
     * @returns Promise<any>
     */
    public async parseDocument(filename: string,ragName:string,saveToFile?:boolean,customOutputFilename?:string): Promise<any> {
        return await parseDocument(filename,ragName,saveToFile,customOutputFilename);
    }


    /**
     * 检查文档表是否存在
     * @returns Promise<boolean>
     */
    public async checkDocTable(tableName:string): Promise<boolean> {
        let tablePath = path.join(pub.get_data_path(), 'rag', 'vector_db', tableName + '.lance');
        return pub.file_exists(tablePath);
    }


    public async checkDocTableSchema(tableName:string){
        let db = await LanceDBManager.connect();
        let tableObj = await db.openTable(tableName);
        let schema = await tableObj.schema();
        let fields = schema.fields;
        let newFields = {'doc_id':"0",'doc_name':"",'doc_file':"",'md_file':"",'doc_rag':"",'doc_abstract':"",'doc_keywords':['key1','key2'],'is_parsed':-1,'update_time':0,'separators':['\n\n','。'],'chunk_size':500,'overlap_size':50};
        let newFieldsKeys = Object.keys(newFields);
        let isSame = true;
        let oldFieldsKeys:string[]  = []
        for(let field of fields){
            oldFieldsKeys.push(field.name);
        }

        // 检查字段是否一致
        for(let field of newFieldsKeys){
            if(oldFieldsKeys.indexOf(field) == -1){
                console.log(`字段 ${field} 不一致`);
                isSame = false;
                break;
            }
        }
        

        if(isSame){
            tableObj.close();
            db.close();
            return true;
        }

        // 导出旧表数据
        let oldDocList = await tableObj.query().limit(100000).toArray()
        // 删除旧表
        await LanceDBManager.dropTable(tableName);

        // 为旧表添加新字段和默认值
        
        let newDocList:any[] = [];
        for(let item of oldDocList){
            let newItem = {};
            for(let field of newFieldsKeys){
                newItem[field] = item[field] || newFields[field];
            }
            newItem['doc_keywords'] = await this.generateKeywords(item['doc_abstract']);
            newDocList.push(newItem);
        }


        // 创建新表并插入数据
        await LanceDBManager.createTableAt(tableName,newDocList,[
            {key:'doc_id',type:'btree'},
            {key:'doc_rag',type:'btree'},
            {key:'is_parsed',type:'btree'},
            {key:'doc_keywords',type:'labelList'},
        ]);

        tableObj.close();
        db.close();
        return true;
    }



    /**
     * 创建文档表
     * @returns Promise<any>
     */
    public async createDocTable(tableName:string): Promise<boolean> {
        if (await this.checkDocTable(tableName)) {
            return true
        }

        let ok = await LanceDBManager.createTableAt(tableName,[{
            doc_id: '0',
            doc_name: '',
            doc_file: '',
            md_file: '',
            doc_rag: '',
            doc_abstract: '',
            doc_keywords: ['key1', 'key2'],
            is_parsed: -1,
            update_time: 0,
            separators: ['\n\n','。'],
            chunk_size: 500,
            overlap_size: 50,
        }],[
            {key:'doc_id',type:'btree'},
            {key:'doc_rag',type:'btree'},
            {key:'is_parsed',type:'btree'},
            {key:'doc_keywords',type:'labelList'},
        ]);

        await LanceDBManager.deleteRecord(tableName, "doc_id='0'");
        return ok;
    }


    /**
     * 生成文档关键词
     * @param doc:string 文档内容
     * @param num:number 关键词数量，默认为5
     * @returns Promise<string[]> 提取的关键词数组
     */
    public async generateKeywords(doc: string,num:number = 5): Promise<string[]> {
        let result = tfidf.extractKeywords(jieba,doc,num);
        let keywords = result.map((item:any) => item.keyword);
        return keywords;
    }


    /**
     * 生成文档摘要
     * @param doc:string 文档内容
     * @returns Promise<string>
     * @example
     * let abstract = await rag.generateAbstract(doc);
     */
    public async generateAbstract(doc: string): Promise<string> {
        // 从文档中提取前100个字符作为摘要
        if (doc && doc.trim() !== '') {
            return doc.substring(0, 100) + '...';
        }
        return '';
    }

    public async getDocNameByDocId(docId:string): Promise<string> {
        let docContentList = await LanceDBManager.queryRecord(this.docTable, `doc_id='${docId}'`);
        if(docContentList.length>0){
            return docContentList[0].doc_name;
        }
        return '';
    }


    /**
     * 删除指定文档
     * @param ragName <string> rag名称
     * @param docId <string> 文档ID
     * @returns Promise<any>
     */
    public async removeRagDocument(ragName:string,docId:string): Promise<any> {
        await LanceDBManager.deleteRecord(this.docTable, `doc_id='${docId}'`);
        return await LanceDBManager.deleteDocument(pub.md5(ragName), docId);
    }


    /**
     * 删除指定知识库
     * @param ragName <string> rag名称
     * @returns Promise<any>
     */
    public async removeRag(ragName:string): Promise<any> {
        // 删除知识库所有文档
        await LanceDBManager.deleteRecord(this.docTable, `doc_rag='${ragName}'`);
        // 删除知识向量表
        return await LanceDBManager.dropTable(pub.md5(ragName));
    }


    /**
     * 批量将文档添加到数据库
     * @param fileList:Array<{filename: string, dstFile: string}> 文件列表
     * @param ragName:string rag名称
     * @returns Promise<any>
     */
    public async addDocumentsToDB(fileList: Array<{filename: string, dstFile: string}>, ragName:string, separators:string[], chunkSize:number, overlapSize:number): Promise<any> {
        await this.createDocTable(this.docTable)
        await this.checkDocTableSchema(this.docTable);

        let dataDir = pub.get_data_path();
        let repDataDir = '{DATA_DIR}';
        
        let records:any[] = [];
        
        for(let file of fileList){
            records.push({
                doc_id: pub.uuid(),
                doc_name: path.basename(file.filename),
                doc_file: file.dstFile.replace(dataDir, repDataDir),
                md_file: '',
                doc_rag: ragName,
                doc_abstract: '',
                doc_keywords: [],
                is_parsed: 0,
                update_time: pub.time(),
                separators: separators,
                chunk_size: chunkSize,
                overlap_size: overlapSize,
            });
        }

        return await LanceDBManager.addRecord(this.docTable, records);
    }


    /**
     * 将文档添加到数据库
     * @param filename:string 文件名
     * @param ragName:string rag名称
     * @returns Promise<any>
     */
    public async addDocumentToDB(filename: string,ragName:string,separators:string[],chunkSize:number,overlapSize:number): Promise<any> {
        filename = path.resolve(filename);
        await this.createDocTable(this.docTable)
        await this.checkDocTableSchema(this.docTable);

        let dataDir = pub.get_data_path();
        let repDataDir = '{DATA_DIR}';
        let pdata:any = [{
            doc_id: pub.uuid(),
            doc_name: path.basename(filename),
            doc_file: filename.replace(dataDir, repDataDir),
            md_file: '',
            doc_rag: ragName,
            doc_abstract: '',
            doc_keywords: [],
            is_parsed: 0,
            update_time: pub.time(),
            separators: separators,
            chunk_size: chunkSize,
            overlap_size: overlapSize,
        }];
        return await LanceDBManager.addRecord(this.docTable,pdata);
    }


    /**
     * 从数据库中删除文档
     * @param docId:string 文档ID
     * @returns Promise<any>
     */
    public async deleteDocumentFromDB(docId: string): Promise<any> {
        return await LanceDBManager.deleteRecord(this.docTable, "doc_id="+docId);
    }


    /**
     * 获取知识库信息
     * @param  ragName:string 知识库名称
     * @returns Promise<any>
     */
    public async getRagInfo(ragName:string) {
        let ragConfigFile = path.resolve(pub.get_data_path(), 'rag',ragName, 'config.json');
        if (pub.file_exists(ragConfigFile)) {
            try {
                let content = pub.read_file(ragConfigFile);
                if (!content || content.trim() === '') {
                    console.error(`[Rag.getRagInfo] Config file is empty: ${ragConfigFile}`);
                    return null;
                }
                let result = JSON.parse(content);
                if (!result.supplierName) result.supplierName = 'ollama'
                return result;
            } catch (e) {
                console.error(`[Rag.getRagInfo] Failed to parse config for ${ragName}:`, e);
                return null;
            }
        }
        return null;
    }


    /**
     * 检索文档
     * @param ragList:string[] rag列表
     * @param queryText:string 查询文本
     * @returns Promise<any>
     */
    public async searchDocument(ragList: string[], queryText: string): Promise<any> {

        // 生成关键词
        let keywords = pub.cutForSearch(queryText);

        // 并行执行所有知识库的检索请求
        const searchPromises = ragList.map(async (ragName) => {
            let ragInfo = await this.getRagInfo(ragName);
            if(!ragInfo){
                return [];
            }
            return LanceDBManager.hybridSearchByNew(pub.md5(ragName), ragInfo, queryText,keywords)
        });
        
        // 等待所有检索完成并合并结果
        const results = await Promise.all(searchPromises);
        // 扁平化结果数组并返回
        return results.flat();
    }

    private cutRagResult(searchResultList:any[],supplierName:string,docLength):any[]{
        // 计算内容长度，超过限制则截断，ollama最大限制4K，其它最大限制32K
        let maxLength = 4096 * 1.5;
        if (supplierName !== 'ollama') {
            maxLength = 32768 * 1.5;
        }

        if(docLength > maxLength) {
            let currentLength = 0;

            for(let i=0;i<searchResultList.length;i++){
                let docLength = searchResultList[i].content.length;
                // 截断超过最大长度的内容
                if(currentLength + docLength > maxLength){
                    if(currentLength == maxLength){
                        searchResultList[i].content = ""
                    }else{
                        searchResultList[i].content = searchResultList[i].content.substring(0, maxLength - currentLength);
                        currentLength = maxLength;
                    }
                }
            }
        }

        // 删除空内容
        searchResultList = searchResultList.filter((item:any) => item.content.trim() !== '');
        return searchResultList;
    }
    


    /**
     * 检索并拼接提示词
     * @param ragList:string[] rag列表
     * @param model:string 模型名称
     * @param queryText:string 查询文本
     * @param doc_files:string[] 文档内容列表
     * @param agent_name <string> 智能体名称
     * @returns Promise<{ userPrompt: string; systemPrompt: string;searchResultList:any,query:string }>
     */
    public async searchAndSuggest(supplierName:string,model: string, queryText: string,doc_files:string[],agent_name:string,rag_results?:any[],ragList?: string[]): Promise<{ userPrompt: string; systemPrompt: string;searchResultList:any,query:string }> {
        try{
            if(!rag_results || !rag_results.length){
                if(ragList.length > 0){
                    rag_results = await this.searchDocument(ragList, queryText)
                }
            }
            // 兼容搜索引擎的格式，link => doc_file,title=>doc_name,content=>doc
            let searchResultList:any[] = [];
            let docLength = 0
            for(let docContent of rag_results){
                if(!docContent.docFile || !docContent.docName){
                    continue;
                }
                docLength += docContent.doc.length;
                searchResultList.push({
                    link: docContent.docFile,
                    title: docContent.docName,
                    content: docContent.doc
                });
            }


            // 截断多余内容
            searchResultList = this.cutRagResult(searchResultList,supplierName,docLength)
            

            if (model.indexOf("deepseek") !== -1) {
                return generateDeepSeekPrompt(searchResultList, queryText,doc_files,agent_name);
            } else {
                return generateOtherPrompt(searchResultList, queryText,doc_files,agent_name);
            }
        }catch(e:any){
            return {
                userPrompt: queryText,
                systemPrompt: '',
                searchResultList:[],
                query:`${queryText}, error: ${e.message}`
            }
        }
    }


    /**
     * 重新生成文档索引
     * @param ragName:string 知识库名称
     * @param docId:string 文档ID
     * @returns Promise<any>
     */
    public async reindexDocument(ragName:string,docId: string): Promise<boolean> {
        let docContentList = await LanceDBManager.queryRecord(this.docTable, "doc_id='"+docId+"'");
        if(docContentList.length>0){
            let docName = docContentList[0]?.doc_name || 'unknown';
            await LanceDBManager.updateRecord(this.docTable,{where: `doc_id='${docId}'`,values: {is_parsed: 0}}, docName);

        }
        return true;
    }


    /**
     * 重新生成知识库索引
     * @param ragName:string 知识库名称
     * @returns Promise<any>
     */
    public async reindexRag(argName:string): Promise<boolean> {
        await LanceDBManager.updateRecord(this.docTable,{where: `doc_rag='${argName}'`,values: {is_parsed: 0}}, `RAG库:${argName}`);
        return true;
    }


    /**
     * 获取文档分片列表
     * @param ragName:string 知识库名称
     * @param docId:string 文档ID
     * @returns Promise<any[]>
     */
    public async getDocChunkList(ragName:string,docId:string): Promise<any[]> {
        let where = "`docId` = '" + docId + "'";
        let chunkList = await LanceDBManager.queryRecord(pub.md5(ragName), where,["id","docId","doc","tokens"]);
        return chunkList;
    }
    
}

 
