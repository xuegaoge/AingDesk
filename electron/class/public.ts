import * as crypto from 'crypto';
import * as fs from 'fs';
import { v1 as uuidv1 } from 'uuid';
import NodeCache from 'node-cache';
import * as path from 'path';
import * as Ps from 'ee-core/ps';
import {exec, execSync } from 'child_process';
import axios from 'axios'
import {Ollama} from 'ollama';

import { Jieba,TfIdf } from '@node-rs/jieba';
import { dict,idf } from '@node-rs/jieba/dict.js';
export const jieba = Jieba.withDict(dict);
export const tfidf = TfIdf.withDict(idf);

export type ReturnMsg = {
    status:number, // 状态 0成功 -1失败
    code:number, // 状态码
    msg:string,  // 消息
    error_msg:string, // 错误消息
    message:any // 响应数据
}

// 创建缓存
const Cache = new NodeCache({ stdTTL: 360, checkperiod: 7200 });

class Public {

    // 计算MD5
    md5(str: string): string {
        const hash = crypto.createHash('md5');
        hash.update(str);
        return hash.digest('hex');
    }

    // 计算SHA1
    sha1(str: string): string {
        const hash = crypto.createHash('sha1');
        hash.update(str);
        return hash.digest('hex');
    }

    // 计算SHA256
    sha256(str: string): string {
        const hash = crypto.createHash('sha256');
        hash.update(str);
        return hash.digest('hex');
    }


    // 计算SHA512
    sha512(str: string): string {
        const hash = crypto.createHash('sha512');
        hash.update(str);
        return hash.digest('hex');
    }

    // 判断文件是否存在
    file_exists(file: string): boolean {
        return fs.existsSync(file);
    }

    // 读取文件
    read_file(file: string): string {
        if (!fs.existsSync(file)) {
            return '';
        }
        return fs.readFileSync(file, 'utf-8');
    }


    // 读取JSON文件
    read_json(file: string): any {
        if (!fs.existsSync(file)) {
            return {};
        }
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }

    // 写入JSON文件
    write_json(file: string, data: any): void {
        fs.writeFileSync(file, JSON.stringify(data, null, 4));
    }

    // 写文件
    write_file(file: string, content: string): void {
        fs.writeFileSync(file, content);
    }

    // 删除文件
    delete_file(file: string): void {
        if (!fs.existsSync(file)) {
            return;
        }
        fs.unlinkSync(file);
    }


    // 创建文件夹
    mkdir(dir: string): void {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }


    // 删除文件夹
    rmdir(dir: string): void {
        if (!fs.existsSync(dir)) {
            return;
        }
        fs.rmdirSync(dir, { recursive: true });
    }


    // 读取文件夹
    readdir(dir: string): string[] {
        if (!fs.existsSync(dir)) {
            return [];
        }
        let dirList =  fs.readdirSync(dir);
        let resultList:string[] = [];
        
        for (let i = 0; i < dirList.length; i++) {
            resultList.push(dir + "/" +dirList[i]);
        }
        return resultList;
    }

    // 获取文件信息
    stat(file: string): fs.Stats {
        if (!fs.existsSync(file)) {
            return new fs.Stats();
        }
        return fs.statSync(file);
    }


    // 获取文件大小
    filesize(file: string): number {
        let fileStat = this.stat(file);
        if (fileStat.size == undefined) {
            return 0;
        }
        return fileStat.size;
    }

    // 获取文件创建时间
    filectime(file: string): number {
        let fileStat = this.stat(file);
        if (fileStat.ctimeMs == undefined) {
            return 0;
        }
        return Math.floor(fileStat.ctimeMs / 1000);
    }

    // 获取文件修改时间
    filemtime(file: string): number {
        let fileStat = this.stat(file);
        if (!fileStat.mtimeMs) {
            return 0;
        }
        // 返回秒级时间戳（整数）
        return Math.floor(fileStat.mtimeMs / 1000);
    }

    // 获取uuid
    uuid(): string {
        return uuidv1();
    }


    /**
     * @name 获取语言包目录
     * @returns {string} 语言包目录
     */
    get_language_path(){
        return path.resolve(Ps.getExtraResourcesDir() , 'languages');
    }

    /**
     * @name 判断是否为文件
     * @param {string} path 文件路径
     * @returns {bool} 是否为文件
     * @example is_file('/www/wwwroot/index.html')
     */
    is_file(path){
        return fs.existsSync(path) && fs.statSync(path).isFile();
    }

    /**
     * 发送异步HTTP请求
     * @param {string} url - 请求的URL
     * @param {Object} options - 请求选项
     * @param {string} [options.method='GET'] - 请求方法 ('GET', 'POST', 'PUT', 'DELETE' 等)
     * @param {Object} [options.headers={}] - 请求头
     * @param {Object|string} [options.data] - 发送的数据
     * @param {number} [options.timeout=10000] - 超时时间(毫秒)
     * @param {string} [options.encoding='utf8'] - 响应编码
     * @param {boolean} [options.json=true] - 是否自动解析JSON响应
     * @returns {Promise<Object>} 响应对象，包含statusCode, body, headers
     */
    async httpRequest(url:string, options:{
        method?:string, // 请求方法 ('GET', 'POST', 'PUT', 'DELETE' 等)
        headers?:any, // 请求头
        data?:any, // 发送的数据
        timeout?:number, // 超时时间(毫秒)
        encoding?:string, // 响应编码
        json?:boolean // 是否自动解析JSON响应
    } = {}):Promise<{statusCode:number,body:any,headers:any,error?:boolean}>{
        try {
            const method = options.method?.toUpperCase() || 'GET';
            const timeout = options.timeout || 10000;
            const shouldParseJson = options.json !== false;
            
            // 构建请求配置
            const requestOptions:any = {
                method: method,
                url: url,
                headers: options.headers || { 'User-Agent': 'AingDesk/'+this.version() },
                timeout: timeout,
                responseType: shouldParseJson ? 'json' : 'text',
                responseEncoding: options.encoding || 'utf8',
                proxy: false
            };

            // 处理请求体数据
            if (options.data) {
                if (method === 'GET') {
                    console.warn('Data provided with GET request will be ignored');
                } else {
                    requestOptions.data = options.data;
                }
            }

            // 发送请求
            const response = await axios(requestOptions);
            
            return {
                statusCode: response.status,
                body: response.data,
                headers: response.headers
            };
        } catch (error:any) {
            if (error.response) {
                // 服务器响应了，但状态码不在2xx范围
                return {
                    statusCode: error.response.status,
                    body: error.response.data,
                    headers: error.response.headers,
                    error: true
                };
            } else if (error.request) {
                // 请求已发送但没有收到响应
                throw new Error(`请求超时或无响应: ${error.message}`);
            } else {
                // 请求配置有问题
                throw new Error(`请求配置错误: ${error.message}`);
            }
        }
    }



    /**
     * @name 获取根目录
     * @returns {string} 根目录
     * @example get_root_path()
     */
    get_root_path():string{
        let result =  Ps.getRootDir()
        if(!result) return path.resolve(__dirname,'../');
        return result;
    }


    get_user_data_path():string{
        let userApp = Ps.getAppUserDataDir()
        if(!userApp) userApp = this.get_root_path()
        return userApp;
    }
        
    /**
     * @name 获取数据目录
     * @returns {string} 数据目录
     */
    get_data_path():string{

        // 尝试获取用户设置的目录
        let savePathConfigFile = path.resolve(this.get_system_data_path(),'save_path.json')
        if(fs.existsSync(savePathConfigFile)){
            let savePathConfig = this.read_json(savePathConfigFile)
            let currentPath = savePathConfig.currentPath
            if(currentPath){
                if(this.file_exists(currentPath)){
                    return currentPath;
                }else{
                    this.delete_file(savePathConfigFile)
                }
            }
        }

        // 优先使用用户数据目录
        let data_path = path.resolve(this.get_user_data_path(),'data');
        if (!fs.existsSync(data_path)) {
            fs.mkdirSync(data_path);
        }
        
        // 兼容旧行为：若用户数据目录不可用，则回退到根目录
        if (!fs.existsSync(data_path)) {
            data_path = path.resolve(this.get_root_path(),'data');
            if (!fs.existsSync(data_path)) {
                fs.mkdirSync(data_path);
            }
        }
        return data_path;
    }

    /**
     * 获取资源目录
     */
    get_resource_path():string{
        try{
            return Ps.getExtraResourcesDir();
        }catch(e){
            return path.resolve(this.get_root_path(),'build','extraResources');
        }
    }
    /**
     * 获取系统数据目录
     * @returns 
     */
    get_system_data_path():string{
        let sys_path = path.resolve(this.get_user_data_path(),"sys_data");
        if(!fs.existsSync(sys_path)){
            fs.mkdirSync(sys_path);
        }
        return sys_path;
    }


    /**
     * @name 获取上下文存储目录
     * @returns {string} 上下文存储目录
     */
    get_context_path(uuid:string):string{
        // 获取用户数据目录
        let context_save_path = path.resolve(this.get_data_path(),'context');

        // 如果不存在则创建
        if (!fs.existsSync(context_save_path)) {
            fs.mkdirSync(context_save_path);
        }

        // 创建uuid目录
        let context_path = path.resolve(context_save_path,uuid);
        if (!fs.existsSync(context_path)) {
            fs.mkdirSync(context_path);
        }

        // 返回目录
        return context_path;
    }

    /**
     * @name 获取上下文存储目录
     * @returns {string} 上下文存储目录
     */
    get_share_context_path(shareId:string,contextId:string):string{
        // 获取用户数据目录
        let context_save_path = path.resolve(this.get_data_path(),'share',shareId,'context');

        // 如果不存在则创建
        if (!fs.existsSync(context_save_path)) {
            fs.mkdirSync(context_save_path);
        }

        // 创建uuid目录
        let context_path = path.resolve(context_save_path,contextId);
        if (!fs.existsSync(context_path)) {
            fs.mkdirSync(context_path);
        }

        // 返回目录
        return context_path;
    }


    /**
     * @name 获取配置项
     * @param {string} key 配置项
     * @returns {any}
     */
    config_get(key:string):any{
        let config_file = path.resolve(this.get_data_path() , 'config.json');
        if(!fs.existsSync(config_file)) {
            let default_config = {"max_common_use":10}
            this.write_file(config_file,JSON.stringify(default_config));
        }
        let config = {}
        try{
            config = JSON.parse(this.read_file(config_file));
        }catch(e){
            config = {};
        }
        
        if(key === undefined) return config;
        return config[key];
    }

    /**
     * @name 设置配置项
     * @param {string} key 
     * @param {any} value 
     */
    config_set(key:string,value:any){
        return this.C(key,value);
    }


    /**
     * @name 读取或设置配置项
     * @param {string} key 配置项 [必填]
     * @param {string} value 配置值 [选填] 如果没有值则为读取配置项
     * @returns {any}
     * @example C('test','123')
     */
    C(key:string,value?:any):any{
        if(!key) return;
        if(value === undefined) return this.config_get(key);

        let config_file = path.resolve(this.get_data_path() , 'config.json');
        let config = {};
        if(fs.existsSync(config_file)){
            try{
                config = JSON.parse(this.read_file(config_file));
            }catch(e){
                config = {};
            }
        }
        config[key] = value;
        this.write_file(config_file,JSON.stringify(config));
    }


    /**
     * @name 获取当前语言
     * @returns {string}
     * @example get_language()
     */
    get_language(){
        let lang = this.cache_get('language');
        if(lang) return lang;
        lang =  this.C('language');
        if(!lang){
            // 获取系统语言
            try{
                let lang_full = Intl.DateTimeFormat().resolvedOptions().locale;
                lang = lang_full.split('-')[0];
            }catch(e){
                lang = 'zh';
            }
        }

        // 缓存
        this.cache_set('language',lang,3600);

        return lang;
    }

    /**
     * @name 获取当前语言和支持的语言列表
     * @returns {Object} 返回结果
     */
    get_languages() {
        // 判断缓存
        let data = this.cache_get('languages');
        if(data) return data;

        let filename = path.resolve(this.get_language_path(), 'settings.json');
        let body = this.read_file(filename)
        if(!body){
            body = `{
                "name": "zh",
                "google": "zh-cn",
                "title": "简体中文",
                "cn": "简体中文"
            },
            {
                "name": "en",
                "google": "en",
                "title": "English",
                "cn": "英语"
            }`
        }
        let current = this.get_language();
        data = {
            languages: JSON.parse(body),
            current: current
        };

        // 缓存
        this.cache_set('languages',data,3600);
        return data;
    }
    /**
     * @name 获取客户端语言包
     * @returns {Object} 返回结果
     */
    get_client_language() {
        // 判断缓存
        let client_lang = this.cache_get('client_lang');
        if(client_lang) return client_lang;

        let language = this.get_language();
        let language_path = this.get_language_path();
        let filename = path.resolve(language_path, language+'/client.json');
        if(!this.is_file(filename)){
            filename = path.resolve(language_path,'en/client.json');
        }
        let body = this.read_file(filename)
        if (!body) {
            body = '{}'
        }

        client_lang = JSON.parse(body);

        // 缓存
        this.cache_set('client_lang',client_lang,3600);

        return client_lang
    }

    /**
     * @name 多语言渲染
     * @param {string} content - 内容
     * @param {any[]} args - 参数
     * @returns {string}
     * @example lang('Hello {}', 'World')
     * @example lang('Hello {} {}', 'World', '!')
     * @example lang('Hello')
     */
    lang(content,...args){
        // 获取语言包
        let lang_dataValue = this.cache_get('lang_data');
        let lang_data:object = {};
        if (lang_dataValue && typeof lang_dataValue == 'object') {
            lang_data = lang_dataValue as object;
        }

        if(Object.keys(lang_data).length == 0){
            let lang = this.get_language();
            if (typeof lang !== 'string') {
                lang = 'zh';
            }
            let lang_file = path.resolve(this.get_language_path(), lang as string , 'server.json');
            lang_data = {};
            if(fs.existsSync(lang_file)) {
                lang_data = JSON.parse(this.read_file(lang_file));
            }
        }

        // 尝试从语言包中获取内容
        let lang_content = content;
        let hash = this.md5(content);
        if(lang_data[hash]){
            lang_content = lang_data[hash];
        }

        // 替换参数
        if(args.length > 0){
            lang_content = lang_content.replace(/{}/g, function() {
                return args.shift();
            });
        }

        // 返回内容
        return lang_content;
    }


    
    /**
     * @name 获取缓存
     * @param {any} key 缓存键
     * @returns 
     */
    cache_get(key:any):any{
        return Cache.get(key);

    }

    /**
     * @name 设置缓存
     * @param {any} key 缓存键
     * @param {any} value 缓存值
     * @param {number} expire 过期时间
     * @returns 
     */
    cache_set(key:any,value:any,expire:number){
        if (!expire) expire = 0;
        return Cache.set(key,value,expire);
    }

    /**
     * @name 删除缓存
     * @param {any} key 缓存键
     * @returns 
     */
    cache_del(key:any){
        return Cache.del(key);
    }

    /**
     * @name 清空缓存
     * @returns 
     */
    cache_clear(){
        return Cache.flushAll();
    }

    /**
     * @name 判断缓存是否存在
     * @param {any} key 缓存键
     * @returns
     * @example cache_has('key')
     */
    cache_has(key:any){
        return Cache.has(key);
    }

    // {
    //     "status":0,
    //     "code":200,
    //     "msg":"安装任务创建成功",
    //     "error_msg":"",
    //     "message":{
    //          "task_id":"xxxxxxxxx"
    //     }
                
    // }


    /**
     * 通用返回消息
     * @param {number} status 状态 0成功 -1失败
     * @param {number} code 状态码
     * @param {string} msg 消息
     * @param {string} error_msg 错误消息
     * @param {any} message 响应数据
     * @returns {ReturnMsg}
     */
    return_msg(status:number,code:number,msg:string,error_msg:string,message:any):ReturnMsg{
        return {
            status:status,
            code:code,
            msg:msg,
            error_msg:error_msg,
            message:message
        }
    }

    /**
     * 返回成功消息
     * @param {string} msg 消息
     * @param {any} message 响应数据
     * @returns {ReturnMsg}
     */
    return_success(msg:string,message?:any):ReturnMsg{
        return this.return_msg(0,200,msg,'',message);
    }

    /**
     * 返回失败消息
     * @param {string} msg 消息
     * @param {string} error_msg 响应数据
     * @returns {ReturnMsg}
     */
    return_error(msg:string,error_msg?:any):ReturnMsg{
        return this.return_msg(-1,500,msg,error_msg,'');
    }

    /**
     * 简化响应消息
     * @param {bool} status 消息
     * @param {string} msg 提示消息
     * @param {any} message 响应数据
     * @returns {ReturnMsg}
     */
    return_simple(status:boolean,msg:string,message:any):ReturnMsg{
        return this.return_msg(status?0:-1,status?200:500,msg,'',message);
    }


    /**
     * @name 执行cmd/shell命令
     * @param {string} cmd 命令
     * @returns {string} 返回结果
     */
    exec_shell(cmd:string):string{
        return execSync(cmd).toString();
    }


    /**
     * @name 获取当前时间
     * @returns {number} 返回当前时间戳(秒级)
     */
    time():number{
        return Math.round(new Date().getTime()/1000);
    }


    // 判断是否为Windows系统
    is_windows():boolean{
        return process.platform === 'win32';
    }

    // 判断是否为Linux系统
    is_linux():boolean{
        return process.platform === 'linux';
    }

    // 判断是否为Mac系统
    is_mac():boolean{
        return process.platform === 'darwin';
    }

    // 更新系统环境变量
    update_env(): void {
        try {
            let newEnv: { [key: string]: string } = {};
            if (process.platform === 'win32') {
                newEnv = this.getWindowsEnv();
            } else {
                newEnv = this.getNonWindowsEnv();
            }
            // 更新环境变量
            this.updateProcessEnv(newEnv);
            console.info('env updated');
        } catch (error) {
            if (error instanceof Error) {
                console.error(`env update error: ${error.message}`);
            } else {
                console.error('env update error:', error);
            }
        }
    }
    // 获取 Windows 系统的环境变量
    private getWindowsEnv(): { [key: string]: string } {
        const output = execSync('powershell -Command "[Environment]::GetEnvironmentVariables()"').toString();
        const lines = output.split('\n');
        // 跳过标题行
        let startIndex = 0;
        while (startIndex < lines.length &&!lines[startIndex].includes('----')) {
            startIndex++;
        }
        startIndex++;
        const newEnv: { [key: string]: string } = {};
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                const parts = this.parseEnvLine(line, /\s{2,}/);
                if (parts) {
                    const [key, value] = parts;
                    newEnv[key] = value;
                }
            }
        }
        return newEnv;
    }
    // 获取非 Windows 系统的环境变量
    private getNonWindowsEnv(): { [key: string]: string } {
        const output = execSync('printenv').toString();
        const lines = output.split('\n');
        const newEnv: { [key: string]: string } = {};
        lines.forEach((line) => {
            const parts = this.parseEnvLine(line, '=');
            if (parts) {
                const [key, value] = parts;
                newEnv[key] = value;
            }
        });
        return newEnv;
    }
    // 解析环境变量行
    private parseEnvLine(line: string, separator: string | RegExp): [string, string] | null {
        const parts = line.split(separator);
        if (Array.isArray(parts) && parts.length === 2) {
            const key = parts[0].trim();
            let value = parts[1].trim();
            return [key, value];
        }
        return null;
    }
    // 更新 process.env 对象
    private updateProcessEnv(newEnv: { [key: string]: string }): void {
        Object.assign(process.env, newEnv);
    }

    /**
     * @name 延迟执行
     * @param {number} ms 延迟时间
     * @returns {Promise<void>}
     */
    async sleep(ms:number):Promise<void>{
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }


    /**
     * @name 获取MAC地址
     * @returns string
     */
    get_mac_address():string{
        let mac = '';
        let interfaces = require('os').networkInterfaces();
        for (let dev in interfaces) {
            let iface = interfaces[dev];
            for (let i = 0; i < iface.length; i++) {
                let alias = iface[i];
                if (alias.family === 'IPv4' && alias.mac !== '00:00:00:00:00:00') {
                    mac = alias.mac;
                    break;
                }
            }
            if(mac) break;
        }
        return mac;
    }

    /**
     * @name 获取设备唯一标识
     * @returns string
     */
    get_device_id():string {
        let mac = this.get_mac_address();
        if(mac) return this.md5(mac);
        return this.md5(this.uuid());
    }

    /**
     * @name 获取软件版本
     * @returns string
     */
    version():string{
        return Ps.appVersion();
    }

    /**
     * @name 获取系统类型
     * @returns string  Windows | Linux | MacOS
     */
    os_type():string{
        if(this.is_windows()) return 'Windows';
        if(this.is_linux()) return 'Linux';
        if(this.is_mac()) return 'MacOS';
        return 'Unknown';
    }

    /**
     * @name 获取客户端ID
     * @returns string
     */
    client_id():string{
        // 64位客户端唯一标识
        let client_id = this.C('client_id');
        if(!client_id){
            // 生成客户端ID
            client_id = this.md5(this.get_device_id()) + this.md5(new Date().getTime().toString());
            this.C('client_id',client_id);
        }
        return client_id;
    }


    /**
     * Convert bytes to a more readable format
     */
    bytesChange(limit: number): string {
        let size = "";
        if (limit < 0.1 * 1024) {
        size = limit.toFixed(2) + "B";
        } else if (limit < 0.1 * 1024 * 1024) {
        size = (limit / 1024).toFixed(2) + "KB";
        } else if (limit < 0.1 * 1024 * 1024 * 1024) {
        size = (limit / (1024 * 1024)).toFixed(2) + "MB";
        } else {
        size = (limit / (1024 * 1024 * 1024)).toFixed(2) + "GB";
        }

        let sizeStr = size + "";
        let index = sizeStr.indexOf(".");
        let dou = sizeStr.substring(index + 1, index + 3);
        if (dou === "00") {
        return sizeStr.substring(0, index) + sizeStr.substring(index + 3, index + 5);
        }

        return size;
    }

    /**
     * 将图片转为base64
     * @param file 文件路径
     * @returns string
     */
    imageToBase64(file:string):string{
        let data = fs.readFileSync(file);
        let base64Data = data.toString('base64');

        // 增加图片格式前缀
        let ext = path.extname(file).replace('.','');
        let imgBase64 = `data:image/${ext};base64,${base64Data}`;
        return imgBase64;
    }


    // 获取当前日期时间字符串
    getCurrentDateTime = () => {
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
            this.lang('星期日'), 
            this.lang('星期一'), 
            this.lang('星期二'),
            this.lang('星期三'), 
            this.lang('星期四'), 
            this.lang('星期五'), 
            this.lang('星期六')][now.getDay()];

        // 上午/下午
        const ampm = hour < 12 ? this.lang('上午') : this.lang('下午');

        return `${year}-${month}-${day} ${hour}:${minute}:${second} -- ${ampm}  ${weekDay}`;
    }


    // 获取当前日期
    getCurrentDate = () => {
        // 获取当前日期
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();

        return `${year}-${month}-${day}`;
    }

    // 获取用户所在地区
    getUserLocation = () => {
        if(pub.get_language() == 'zh'){
            return global.area || this.lang("未知地区");
        }
        return this.lang("未知地区");
    }

    // 打开文件
    openFile(filePath) {
        let command;
        // 根据操作系统确定命令
        switch (process.platform) {
          case 'win32': // Windows
            command = `start "" "${filePath}"`;
            break;
          case 'darwin': // macOS
            command = `open "${filePath}"`;
            break;
          case 'linux': // Linux
            command = `xdg-open "${filePath}"`;
            break;
          default:
            console.error('不支持的操作系统');
            return;
        }
        
        // 执行命令
        exec(command, (error) => {
          if (error) {
            return;
          }
        });
    }


    // 获取随机字符串
    randomString(length = 8) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    
    /**
     * 获取ollama地址和密钥
     * @returns {Promise<{apiUrl:string,apiKey:string}>} 返回ollama地址和密钥
     */
    get_ollama_host(): string {
        let ollamaHost = this.C('ollama_host');
        if (!ollamaHost) {
            ollamaHost = "http://127.0.0.1:11434";
        }
        return ollamaHost;
    }

    /**
     * 初始化ollama
     * @param {boolean} force 是否强制重新初始化
     * @returns Ollama
     */
    init_ollama(): Ollama {
        let ollama:Ollama;
        const ollamaHost = this.get_ollama_host();
        if (!ollamaHost) {
            ollama = new Ollama();
        }else{
            let config = {
                host: ollamaHost
            }
            ollama = new Ollama(config);
        }
        return ollama;
    }

    /**
     * @name 分词（搜索）
     * @param doc 文档内容
     * @returns string[] 分词结果
     */
    cutForSearch(doc:string):string[]{
        return jieba.cutForSearch(doc,true)
    }


    /**
     * 计算目录下的所有文件的大小
     * @param dirPath - 目录路径
     * @returns number
     */
    getDirSize(dirPath: string): number {
        let totalSize = 0;
        const files = pub.readdir(dirPath);
        for (const file of files) {
            const stats = pub.stat(file);
            if (stats.isDirectory()) {
                totalSize += this.getDirSize(file); // 递归计算子目录大小
            } else {
                totalSize += stats.size; // 累加文件大小
            }
        }
        return totalSize;
    }

    /**
     * @name 获取向量数据库路径
     * @returns {string} 向量数据库路径
     */
    get_db_path():string{
        return path.join(pub.get_data_path(), 'rag', 'vector_db');
    }

    /**
     * @name 获取知识库路径
     * @returns {string} 知识库路径
     */
    get_rag_path():string{
        // 知识库保存路径
        return this.get_data_path() + "/rag";
    }

}

const pub = new Public();
export{ pub,Public };
