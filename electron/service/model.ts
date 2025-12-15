import OpenAI from 'openai';
import path from 'path';
import { pub } from '../class/public';

// 定义模型信息类型
type ModelInfo = {
    title: string;
    supplierName: string;
    supplierTitle?: string;
    model: string;
    size: number;
    total?: number;
    capability?: string[];
    contextLength: number;
};

// 定义 API 配置类型
type ApiConfig = {
    baseUrl: string;
    apiKey: string;
    supplierName: string;
    supplierTitle?: string;
    status?: boolean;
};

// 定义模型服务类
export class ModelService {
    private baseUrl: string = "";
    private apiKey: string = "";
    public client: OpenAI | null = null;
    public error: any = null;
    private apiConfigPath: string = "";
    private apiConfigFile: string = "";
    private embeddingFile: string = "";
    private modelsFile: string = "";
    private apiConfig: ApiConfig = {} as ApiConfig;
    private models: any[] = [];
    private supplierName: string;

    constructor(supplierName: string) {
        this.supplierName = supplierName;
        if(this.supplierName === 'ollama') {
            this.baseUrl = `${pub.get_ollama_host()}/v1`;
            this.apiKey = supplierName;
        }else{
            this.readApiConfig();
        }
        
    }

    // 设置 API 密钥
    public setApiKey(baseUrl: string, apiKey: string): void {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    // 流式对话
    public async chat(options: any): Promise<any> {
        if (!this.connect()) {
            throw new Error('Failed to connect to the API');
        }
        try {
            return await this.client!.chat.completions.create(options);
        } catch (error) {
            this.error = error;
            throw error;
        }
    }

    // 嵌入模型调用
    public async embedding(model: string, input: string): Promise<any[]> {
        if (!this.connect()) {
            return [];
        }
        try {
            console.log(`[ModelService] calling embedding for model ${model}...`);
            const res:any = await this.client!.embeddings.create({
                model,
                input,
                encoding_format: "float"
            });
            console.log(`[ModelService] embedding success.`);
            return res.data[0] || [];
        } catch (error) {
            console.error(`[ModelService] embedding error:`, error);
            this.error = error;
            return [];
        }
    }

    // 释放资源
    public destroy(): void {
        this.client = null;
    }

    // 读取 API 配置
    public readApiConfig(): ApiConfig | null {
        this.apiConfigPath = path.resolve(pub.get_data_path(), "models", this.supplierName);
        this.apiConfigFile = path.resolve(this.apiConfigPath, "config.json");
        this.modelsFile = path.resolve(this.apiConfigPath, "models.json");
        this.embeddingFile = path.resolve(this.apiConfigPath, "embedding.json");

        if (!pub.file_exists(this.apiConfigFile)) {
            return null;
        }
        try {
            const apiConfigBody = pub.read_file(this.apiConfigFile);
            this.apiConfig = JSON.parse(apiConfigBody);
            this.setApiKey(this.apiConfig.baseUrl, this.apiConfig.apiKey);
            return this.apiConfig;
        } catch (error) {
            this.error = error;
            return null;
        }
    }

    // 读取模型列表
    public readModels(): any[] | null {
        if (!pub.file_exists(this.modelsFile)) {
            return null;
        }
        try {
            const modelsBody = pub.read_file(this.modelsFile);
            this.models = JSON.parse(modelsBody);
            return this.models;
        } catch (error) {
            this.error = error;
            return null;
        }
    }

    // 读取嵌套模型列表
    public readEmbeddingModels(): any[] | null {
        if (!pub.file_exists(this.embeddingFile)) {
            return null;
        }
        try {
            const modelsBody = pub.read_file(this.embeddingFile);
            this.models = JSON.parse(modelsBody);
            return this.models;
        } catch (error) {
            this.error = error;
            return null;
        }
    }

    // 保存模型列表
    public saveModels(models: any[]): any[] {
        let modelsList = this.readModels() || [];
        for (const model of models) {
            if (!modelsList.some((item) => item.modelName === model.id)) {
                const modelInfo = {
                    title: "",
                    supplierName: this.supplierName,
                    modelName: model.id,
                    capability: ["llm"],
                    status: true
                };
                modelsList.push(modelInfo);
            }
        }
        const modelsBody = JSON.stringify(modelsList, null, 4);
        pub.write_file(this.modelsFile, modelsBody);
        this.models = modelsList;
        return modelsList;
    }

    // 获取线上模型列表
    public async getOnlineModels(): Promise<any[] | null> {
        if (!this.connect()) {
            return null;
        }
        try {
            const res:any = await this.client!.models.list({
                query: {
                    sub_type: 'chat'
                }
            });
            const models = res.body.data;
            if(this.supplierName == 'SiliconFlow'){
                await this.getOnlineEmbeddingModels();
            }
            return this.saveModels(models);
        } catch (error) {
            this.error = error;
            return null;
        }
    }

    // 保存嵌套模型列表
    public saveEmbeddingModels(models: any[]): any[] {
        let modelsList = this.readEmbeddingModels() || [];
        for (const model of models) {
            if (!modelsList.some((item) => item.modelName === model.id)) {
                const modelInfo = {
                    title: "",
                    supplierName: this.supplierName,
                    modelName: model.id,
                    capability: ["embedding"],
                    status: true
                };
                modelsList.push(modelInfo);
            }
        }
        const modelsBody = JSON.stringify(modelsList, null, 4);
        pub.write_file(this.embeddingFile, modelsBody);
        this.models = modelsList;
        return modelsList;
    }

    // 获取线上嵌套模型列表
    public async getOnlineEmbeddingModels(): Promise<any[] | null> {
        if (!this.connect()) {
            return null;
        }
        try {
            const res:any = await this.client!.models.list({
                query: {
                    sub_type: 'embedding'
                }
            });
            const models = res.body.data;
            return this.saveEmbeddingModels(models);
        } catch (error) {
            this.error = error;
            return null;
        }
    }

    // 连接 API
    public connect(): boolean {
        if (this.client) {
            return true;
        }
        if (!this.apiKey || !this.baseUrl) {
            this.readApiConfig();
        }
        if (!this.apiKey || !this.baseUrl) {
            this.error = "API 配置错误";
            return false;
        }
        try {
            console.log(`[ModelService] connecting to ${this.baseUrl} with timeout 60000ms`);
            this.client = new OpenAI({
                apiKey: this.apiKey,
                baseURL: this.baseUrl,
                timeout: 60000
            });
            return true;
        } catch (error) {
            this.error = error;
            return false;
        }
    }

    // 测试 API 接口是否可用
    public async testApi(): Promise<boolean> {
        if (!this.connect()) {
            return false;
        }
        try {
            await this.client!.models.list();
            return true;
        } catch (error) {
            this.error = error;
            return false;
        }
    }
}

// 获取模型上下文长度
export function getModelContextLength(model: string): number {
    const modelContextObj: { [key: string]: number } = {
        "qwq": 32768,
        "qwen2.5": 32768,
        "qwen": 32768,
        "deepseek": 32768,
        "phi": 16384,
        "gemma2": 8192,
        "smollm": 8192,
        "llama": 32768,
        "glm": 32768,
        "qvq": 32768,
    };

    const modelStrLower = model.toLowerCase();
    for (const key in modelContextObj) {
        if (modelStrLower.includes(key)) {
            return modelContextObj[key];
        }
    }
    return 32768;
}

function isTools(model:string):boolean {
    let notTools = ['deepseek-r1', 'deepseek-v3', 'deepseek-reasoner', 'lite', 'gemma2', 'smollm', 'llama', 'glm', 'qvq'];
    if(notTools.some((item) => model.toLowerCase().indexOf(item) > -1)) {
        return false;
    }
    return true;
}

function getCapability(model:string, capability:string[]):string[] {
    if(capability.length == 0){
        capability.push("llm");
    }
    const modelStrLower = model.toLowerCase();
    if (capability.includes("embedding")) {
        return capability;
    }
    if (capability.includes("llm")) {
        if(capability.includes("tools")) {
            return capability;
        }
        if(isTools(modelStrLower)) {
            capability.push("tools");
        }
        return capability
    }

    return capability;
}

// 读取供应商模型列表的通用函数
async function readSupplierModels(fileName: string, contextLengthFunc: (model: string) => number): Promise<{ [key: string]: ModelInfo[] }> {
    const supplierPath = path.resolve(pub.get_data_path(), "models");
    const suppliers = pub.readdir(supplierPath);
    const result: { [key: string]: ModelInfo[] } = {};

    for (const supplier of suppliers) {
        const supplierConfigFile = path.resolve(supplier, "config.json");
        const modelConfigFile = path.resolve(supplier, fileName);

        if (!pub.file_exists(supplierConfigFile) || !pub.file_exists(modelConfigFile)) {
            continue;
        }

        try {
            const supplierConfigBody = pub.read_file(supplierConfigFile);
            const supplierConfig: ApiConfig = JSON.parse(supplierConfigBody);
            const modelConfigBody = pub.read_file(modelConfigFile);
            const models = JSON.parse(modelConfigBody);

            if (!supplierConfig.supplierName || models.length === 0) {
                continue;
            }
            if (!supplierConfig.apiKey || !supplierConfig.baseUrl || supplierConfig.status === false) {
                continue;
            }

            const newModels: ModelInfo[] = [];
            for (const model of models) {
                const modelInfo: ModelInfo = {
                    title: model.title || `${supplierConfig.supplierTitle || supplierConfig.supplierName}/${model.modelName}`,
                    supplierName: supplierConfig.supplierName,
                    supplierTitle: supplierConfig.supplierTitle || supplierConfig.supplierName,
                    model: model.modelName,
                    size: 0,
                    contextLength: contextLengthFunc(model.modelName),
                    capability: getCapability(model.modelName, model.capability || []),
                };
                newModels.push(modelInfo);
            }
            result[supplierConfig.supplierTitle] = newModels;
        } catch (error) {
            console.error(`Error reading models for supplier ${supplier}:`, error);
        }
    }
    return result;
}

// 获取所有模型列表
export async function GetSupplierModels(): Promise<{ [key: string]: ModelInfo[] }> {
    return readSupplierModels("models.json", getModelContextLength);
}

// 获取所有嵌套模型列表
export async function GetSupplierEmbeddingModels(): Promise<{ [key: string]: ModelInfo[] }> {
    return readSupplierModels("embedding.json", () => 512);
}


/**
 * 统计模型使用次数
 * @param supplierName 模型供应商名称
 * @param modelName 模型名称
 * @returns 
 */
export function setModelUsedTotal(supplierName: string, modelName: string) {
    let totalFile = path.resolve(pub.get_data_path(),'modelTotal.json')
    if(!pub.file_exists(totalFile)){
        pub.write_file(totalFile, '{}');
    }
    let models = {};
    try{
        models = pub.read_json(totalFile);
    }catch(e){
        pub.write_file(totalFile, '{}');
        models = {};
    }
    let key = `${supplierName}/${modelName}`;
    if(!models[key]){
        models[key] = 0;
    }
    models[key]++;
    pub.write_json(totalFile, models);
}


/**
 * 获取模型使用次数列表
 * @returns 
 */
export function getModelUsedTotalList() {
    let totalFile = path.resolve(pub.get_data_path(),'modelTotal.json')
    if(!pub.file_exists(totalFile)){
        return {};
    }
    try{
        let models = pub.read_json(totalFile);
        return models;
    }catch(e){
        return {};
    }

}


/**
 * 获取模型使用次数
 * @param supplierName 模型供应商名称
 * @param modelName 模型名称
 * @returns 
 */
export function getModelUsedTotal(supplierName: string, modelName: string) {
    let totalObj = getModelUsedTotalList()
    let key = `${supplierName}/${modelName}`;
    if(!totalObj[key]){
        return 0;
    }
    return totalObj[key];
}


