
export type ChatItemInfo = {
    agent_info?: AgentItemDto,
    contextPath: string
    context_id: string
    model: string
    parameters: string,
    title: string,
    rag_list?: string[],
    search_type?: string,
    supplierName?: string
}

// 模型安装进度实体
export type InstallProgress = {
    status?: number
    digest?: string
    total?: number
    completed?: number
    progress?: number
    speed?: number
}

// 带有文本、图片、文件的提问实体
export type MultipeQuestionDto = {
    content: string,
    files?: string[],
    images?: string[]
}

// 回答信息stat内容实体
export type Stat = {
    model?: string,
    created_at?: string,
    total_duration?: string,
    load_duration?: string,
    prompt_eval_count?: string,
    prompt_eval_duration?: string,
    eval_count?: string,
    eval_duration?: string,
}

// 回答信息实体
export type AnswerInfo = {
    content: string | string[],
    id?: string
    stat?: Stat | Stat[],
    search_result?: Array<{ content: string; link: string; title: string }>,
    tools_result?: Array<string>
    // MCP 进度事件（后端保存的原始事件数组）
    mcp_progress?: any[]

}
// 对话信息实体
export type ChatInfo = Map<MultipeQuestionDto, AnswerInfo>
// 知识库类型实体
export type KnowledgeDocumentInfo = {
    ragDesc: string
    ragName: string,
    embeddingModel: string,
    embeddingModelExist: boolean,
    errorMsg: string,
    keywordWeight: number,
    maxRecall: number,
    queryRewrite: number,
    ragCreateTime: number,
    recallAccuracy: number,
    rerankModel: string,
    resultReordering: number,
    searchStrategy: number,
    supplierName: string,
    vectorWeight: number,
}
// 当前选中知识库类型实体
export type ActiveKnowledgeDto = KnowledgeDocumentInfo

// 当前知识库的文档实体（单个）
export type ActiveKnowledgeDocDto = {
    doc_abstract: string
    doc_file: string
    doc_id: string
    doc_keywords: string[]
    doc_name: string
    doc_rag: string
    is_parsed: number
    md_file: string
    update_time: number
}
// 第三方api服务商实体
export type ThirdPartyApiServiceItem = {
    apiKey: string
    baseUrl: string
    baseUrlExample: string
    help: string
    home: string
    isUseUrlExample: boolean
    supplierName: string
    supplierTitle: string
    status: boolean,
    icon: string,
    sort: string
}

// api服务商下的模型列表
export type SupplierModelItem = {
    capability: Array<string>
    modelName: string
    supplierName: string,
    status: boolean,
    title: string
}
// 添加第三方下属模型
export type AddThirdPartySupplierMode = {
    modelName: string;
    capability: string[];
    title: string;
    supplierName?: string;
    status?: boolean;
};

// 添加模型服务商表单数据
export type AddSupplierFormData = {
    supplierTitle: string,
    supplierName: string,
    baseUrl: string,
    apiKey: string,
}

// 服务商配置信息
export type SupplierConfigInfo = {
    baseUrl: string,
    apiKey: string,
}

// 当前模型的可选实体
export type CurrentModelDto = {
    model?: string,
    parameters?: string,
    supplierName?: string,
}

// 智能体对象实体
export type AgentItemDto = {
    agent_name: string,
    agent_title: string,
    prompt: string,
    msg: string,
    agent_type: string,
    icon: string,
    create_time: number,
    is_system: boolean,
}

//  创建知识库表单实体
export type CreateKnowledgeFormData = {
    ragName: string,
    ragDesc: string,
    supplierName?: string,
    embeddingModel: string | string[],
    searchStrategy?: number,
    maxRecall?: number,
    recallAccuracy?: number,
    resultReordering?: number,
    rerankModel?: string,
    queryRewrite?: number,
    vectorWeight?: number,
    keywordWeight?: number,
}

// 测试文档分片参数实体
export type TestDocChunkParams = {
    filename: string,
    chunkSize: number,
    overlapSize: number,
    separators: string[],
}

// MCP服务器列表实体
export type CloudMcpServerListDto = {
    name: string;
    description: string;
    type: string;
    command: string;
    baseUrl: string;
    env: string;
    args: string;
    isActive?: boolean;
};
// 云端MCP列表实体
export interface McpServerListDto extends CloudMcpServerListDto {
    isActive: boolean;
    tools: string[];
};

// 多模型对象列表
export type MultipleModelListDto = {
    model: string,
    supplierName: string,
    parameters?: string
}
