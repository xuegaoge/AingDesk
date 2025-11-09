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
var mcp_exports = {};
__export(mcp_exports, {
  mcpService: () => mcpService
});
module.exports = __toCommonJS(mcp_exports);
var import_path = __toESM(require("path"));
var import_public = require("../class/public");
var import_log = require("ee-core/log");
var import_axios = __toESM(require("axios"));
var import_fs = __toESM(require("fs"));
class McpService {
  /**
   * 获取MCP配置文件
   * @returns {McpConfig|null} - 返回MCP配置对象，如果文件不存在或解析失败则返回null
   */
  read_mcp_config() {
    const mcp_config_file = import_path.default.resolve(import_public.pub.get_data_path(), "mcp-server.json");
    if (!import_public.pub.file_exists(mcp_config_file)) {
      let defaultConfig = {
        mcpServers: []
      };
      import_public.pub.write_json(mcp_config_file, defaultConfig);
      import_log.logger.info(`MCP\u914D\u7F6E\u6587\u4EF6 ${mcp_config_file} \u4E0D\u5B58\u5728\uFF0C\u5DF2\u521B\u5EFA\u9ED8\u8BA4\u914D\u7F6E\u6587\u4EF6`);
    }
    try {
      return import_public.pub.read_json(mcp_config_file);
    } catch (error) {
      import_log.logger.error(`\u8BFB\u53D6 MCP \u914D\u7F6E\u6587\u4EF6 ${mcp_config_file} \u65F6\u51FA\u9519:`, error);
      return null;
    }
  }
  /**
   * 获取MCP服务器列表
   * @returns {ServerConfig[]} - 返回MCP服务器列表
   */
  get_mcp_servers() {
    let mcpConfig = this.read_mcp_config();
    if (mcpConfig && mcpConfig.mcpServers) {
      return mcpConfig.mcpServers;
    }
    return [];
  }
  /**
   * 保存MCP配置文件
   * @param {McpConfig} mcpConfig - MCP配置对象
   */
  save_mcp_config(mcpServers) {
    const mcp_config_file = import_path.default.resolve(import_public.pub.get_data_path(), "mcp-server.json");
    try {
      let mcpConfig = this.read_mcp_config();
      if (!mcpConfig) {
        mcpConfig = { mcpServers: [] };
      }
      mcpConfig.mcpServers = mcpServers;
      import_public.pub.write_json(mcp_config_file, mcpConfig);
    } catch (error) {
      import_log.logger.error(`\u4FDD\u5B58 MCP \u914D\u7F6E\u6587\u4EF6 ${mcp_config_file} \u65F6\u51FA\u9519:`, error);
    }
  }
  /**
   * 获取常用的MCP服务器列表
   * @returns {Promise<any>} - 返回常用的MCP服务器列表
   */
  read_common_mcp_config() {
    const common_mcp_config_file = import_path.default.resolve(import_public.pub.get_data_path(), "common-mcp-server.json");
    if (!import_public.pub.file_exists(common_mcp_config_file)) {
      return null;
    }
    try {
      return import_public.pub.read_json(common_mcp_config_file);
    } catch (error) {
      import_log.logger.error(`\u8BFB\u53D6\u5E38\u7528 MCP \u914D\u7F6E\u6587\u4EF6 ${common_mcp_config_file} \u65F6\u51FA\u9519:`, error);
      return null;
    }
  }
  /**
   * 保存常用的MCP配置文件
   * @param {any} config - 常用MCP配置对象
   */
  save_common_mcp_config(config) {
    const common_mcp_config_file = import_path.default.resolve(import_public.pub.get_data_path(), "common-mcp-server.json");
    try {
      import_public.pub.write_json(common_mcp_config_file, config);
    } catch (error) {
      import_log.logger.error(`\u4FDD\u5B58\u5E38\u7528 MCP \u914D\u7F6E\u6587\u4EF6 ${common_mcp_config_file} \u65F6\u51FA\u9519:`, error);
    }
  }
  get_bin_path() {
    let binPath = import_path.default.resolve(import_public.pub.get_user_data_path(), "bin");
    if (!import_public.pub.file_exists(binPath)) {
      import_public.pub.mkdir(binPath);
    }
    return binPath;
  }
  get_bun_bin() {
    let binPath = this.get_bin_path();
    if (import_public.pub.is_windows()) {
      return import_path.default.resolve(binPath, "bun.exe");
    }
    return import_path.default.resolve(binPath, "bun");
  }
  get_uv_bin() {
    let binPath = this.get_bin_path();
    if (import_public.pub.is_windows()) {
      return import_path.default.resolve(binPath, "uv.exe");
    }
    return import_path.default.resolve(binPath, "uv");
  }
  /**
   * 获取当前操作系统的路径
   * @returns {string} - 返回当前操作系统的路径
   */
  get_os_path() {
    let os_path = "win-";
    if (import_public.pub.is_mac()) {
      os_path = "darwin-";
    } else if (import_public.pub.is_linux()) {
      os_path = "linux-";
    }
    os_path += process.arch;
    return os_path;
  }
  async download_file(url, saveFile) {
    let abort = new AbortController();
    let headers = {
      "User-Agent": "AingDesk/" + import_public.pub.version()
    };
    let downloadBytes = 0;
    if (import_public.pub.file_exists(saveFile)) {
      const stats = import_public.pub.stat(saveFile);
      downloadBytes = stats.size;
    }
    if (downloadBytes > 0) {
      headers["Range"] = `bytes=${downloadBytes}-`;
    }
    try {
      const response = await (0, import_axios.default)({
        url,
        method: "GET",
        headers,
        responseType: "stream",
        signal: abort.signal,
        // 禁止使用代理
        proxy: false
      });
      const contentLength = response.headers["content-length"];
      if (contentLength && downloadBytes >= parseInt(contentLength) || response.status === 416) {
        import_log.logger.info(`\u6587\u4EF6 ${saveFile} \u5DF2\u7ECF\u4E0B\u8F7D\u5B8C\u6210\uFF0C\u8DF3\u8FC7\u4E0B\u8F7D`);
        return true;
      }
      if (response.status !== 200 && response.status !== 206) {
        import_log.logger.error(`\u4E0B\u8F7D\u6587\u4EF6\u5931\u8D25\uFF0C\u72B6\u6001\u7801: ${response.status}`);
        return false;
      }
      const writer = import_fs.default.createWriteStream(saveFile, { flags: "a" });
      response.data.pipe(writer);
      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          resolve(true);
        });
        writer.on("error", (error) => {
          reject(error);
        });
      });
    } catch (e) {
      if (e.message.indexOf("status code 416") !== -1) {
        import_log.logger.info(`\u6587\u4EF6 ${saveFile} \u5DF2\u7ECF\u4E0B\u8F7D\u5B8C\u6210\uFF0C\u8DF3\u8FC7\u4E0B\u8F7D`);
        return true;
      }
      return false;
    }
  }
  /**
   * 安装 node.js环境
   * @param args - 参数对象
   */
  async install_npx() {
    let bunFile = this.get_bun_bin();
    if (import_public.pub.file_exists(bunFile)) {
      return import_public.pub.return_success(import_public.pub.lang("\u5DF2\u5B89\u88C5"));
    }
    global.bunInstall = true;
    let binPath = this.get_bin_path();
    let os_path = this.get_os_path();
    let downloadUrl = `https://aingdesk.bt.cn/bin/${os_path}/bun.zip`;
    let bunzipFile = import_path.default.resolve(binPath, "bun.zip");
    this.download_file(downloadUrl, bunzipFile).then(async () => {
      let unzip = require("unzipper");
      let unzipStream = import_fs.default.createReadStream(bunzipFile).pipe(unzip.Extract({ path: binPath }));
      return new Promise((resolve, reject) => {
        unzipStream.on("close", () => {
          import_public.pub.delete_file(bunzipFile);
          if (import_public.pub.file_exists(bunFile)) {
            if (import_public.pub.is_linux() || import_public.pub.is_mac()) {
              import_fs.default.chmodSync(bunFile, 493);
            }
            resolve(import_public.pub.return_success(import_public.pub.lang("\u5B89\u88C5\u6210\u529F")));
          } else {
            reject(import_public.pub.return_error(import_public.pub.lang("\u5B89\u88C5\u5931\u8D25")));
          }
        });
        unzipStream.on("error", (error) => {
          reject(import_public.pub.return_error(import_public.pub.lang("\u5B89\u88C5\u5931\u8D25"), error));
        });
      });
    });
  }
  /**
   * 清除node.js环境变量
   * @returns {void}
   */
  clear_node_env() {
    let env = process.env;
    let PATH_ARR = env["PATH"].split(";");
    let NEW_PATH_ARR = [];
    for (let key in PATH_ARR) {
      if (PATH_ARR[key].indexOf("node") == -1 && PATH_ARR[key].indexOf("npm") == -1) {
        NEW_PATH_ARR.push(PATH_ARR[key]);
      }
    }
    process.env["PATH"] = NEW_PATH_ARR.join(";");
  }
  /**
   * 保存 MCP 工具列表
   * @param name {string} - 工具名称
   * @param tools {any} - 工具列表
   * @returns 
   */
  save_mcp_tools(name, tools) {
    let mcpToolsSavePath = import_path.default.resolve(import_public.pub.get_data_path(), "mcp_tools");
    if (!import_public.pub.file_exists(mcpToolsSavePath)) {
      import_public.pub.mkdir(mcpToolsSavePath);
    }
    let mcpToolsFile = import_path.default.resolve(mcpToolsSavePath, `${name}.json`);
    try {
      import_public.pub.write_json(mcpToolsFile, tools);
    } catch (e) {
      import_log.logger.error(`\u4FDD\u5B58 MCP \u5DE5\u5177\u6587\u4EF6 ${mcpToolsFile} \u65F6\u51FA\u9519:`, e);
    }
  }
  /**
   * 读取 MCP 工具列表
   * @param name {string} - 工具名称
   * @returns 
   */
  read_mcp_tools(name) {
    let mcpToolsSavePath = import_path.default.resolve(import_public.pub.get_data_path(), "mcp_tools");
    if (!import_public.pub.file_exists(mcpToolsSavePath)) {
      return [];
    }
    let mcpToolsFile = import_path.default.resolve(mcpToolsSavePath, `${name}.json`);
    if (!import_public.pub.file_exists(mcpToolsFile)) {
      return [];
    }
    try {
      return import_public.pub.read_json(mcpToolsFile);
    } catch (e) {
      import_log.logger.error(`\u8BFB\u53D6 MCP \u5DE5\u5177\u6587\u4EF6 ${mcpToolsFile} \u65F6\u51FA\u9519:`, e);
      return [];
    }
  }
  /**
   * 同步云端的 MCP 服务器配置
   * @returns {Promise<any>} - 返回同步结果
   */
  async sync_cloud_mcp() {
    let downloadUrl = `https://aingdesk.bt.cn/config/common-mcp-server.json`;
    let res = await import_public.pub.httpRequest(downloadUrl);
    if (res.statusCode !== 200) {
      return import_public.pub.return_error(import_public.pub.lang("\u83B7\u53D6\u5931\u8D25"));
    }
    let commonMcpConfig = res.body;
    if (typeof commonMcpConfig === "string") {
      commonMcpConfig = JSON.parse(commonMcpConfig);
    }
    if (!commonMcpConfig.mcpServers) {
      return import_public.pub.return_error(import_public.pub.lang("\u914D\u7F6E\u6587\u4EF6\u683C\u5F0F\u9519\u8BEF"));
    }
    mcpService.save_common_mcp_config(commonMcpConfig);
    return import_public.pub.return_success(import_public.pub.lang("\u540C\u6B65\u6210\u529F"));
  }
}
McpService.toString = () => "[class McpService]";
const mcpService = new McpService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  mcpService
});
