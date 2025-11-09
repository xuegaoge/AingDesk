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
  default: () => mcp_default
});
module.exports = __toCommonJS(mcp_exports);
var import_public = require("../class/public");
var path = __toESM(require("path"));
var import_log = require("ee-core/log");
var import_mcp_client = require("../service/mcp_client");
var import_mcp = require("../service/mcp");
class McpController {
  /**
   * 获取已安装的MCP服务器列表
   * @param args 
   * @returns {Promise<any>} - 返回已安装的MCP服务器列表
   */
  async get_mcp_server_list(args) {
    let mcpServers = import_mcp.mcpService.get_mcp_servers();
    for (let server of mcpServers) {
      server.tools = import_mcp.mcpService.read_mcp_tools(server.name);
    }
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), mcpServers);
  }
  /**
   * 获取常用的MCP服务器列表
   * @param args 
   * @returns {Promise<any>} - 返回常用的MCP服务器列表
   */
  async get_common_server_list(args) {
    let commonMcpConfig = import_mcp.mcpService.read_common_mcp_config();
    let mcpServers = [];
    if (commonMcpConfig && commonMcpConfig) {
      mcpServers = commonMcpConfig;
      let lastMcpServers = import_mcp.mcpService.get_mcp_servers();
      for (let i = 0; i < mcpServers.length; i++) {
        let server = mcpServers[i];
        if (lastMcpServers && lastMcpServers.length > 0) {
          let installedServer = lastMcpServers.find((s) => s.name === server.name);
          if (installedServer) {
            server.is_install = true;
          } else {
            server.is_install = false;
          }
        } else {
          server.is_install = false;
        }
      }
    }
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), mcpServers);
  }
  /**
   * 获取MCP服务器信息
   * @param args 
   * @returns {Promise<any>} - 返回MCP服务器信息
   */
  async get_mcp_server_info(args) {
    let mcpServers = import_mcp.mcpService.get_mcp_servers();
    let server = mcpServers.find((s) => s.name === args.name);
    if (!server) {
      return import_public.pub.return_error(import_public.pub.lang("\u672A\u627E\u5230\u8BE5\u670D\u52A1\u5668"));
    }
    let tools = [];
    server.tools = tools;
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), server);
  }
  /**
   * 修改MCP服务器信息
   * @param args.name <string> - MCP服务器名称
   * @param args.discription <string> - 描述
   * @param args.type <string> - 类型 (stdio | sse)
   * @param args.command <string> - 执行命令 (npx | uv | 其它可执行文件全路径)
   * @param args.baseUrl <string> - 服务器URL地址
   * @param args.env <object> - 环境变量
   * @param args.args <string[]> - 参数
   * @param args.is_active <boolean> - 是否可用
   * @return {Promise<any>} - 返回操作结果
   */
  async modify_mcp_server(args) {
    let mcpConfig = import_mcp.mcpService.read_mcp_config();
    let mcpServers = [];
    if (mcpConfig && mcpConfig.mcpServers) {
      mcpServers = mcpConfig.mcpServers;
    }
    let server = mcpServers.find((s) => s.name === args.name);
    if (!server) {
      return import_public.pub.return_error(import_public.pub.lang("\u672A\u627E\u5230\u8BE5\u670D\u52A1\u5668"));
    }
    server.description = args.description;
    server.type = args.type;
    server.command = args.command;
    server.baseUrl = args.baseUrl;
    server.env = args.env;
    server.args = args.args;
    server.isActive = args.is_active;
    import_mcp.mcpService.save_mcp_config(mcpServers);
    return import_public.pub.return_success(import_public.pub.lang("\u4FEE\u6539\u6210\u529F"));
  }
  /**
   * 卸载MCP服务器
   * @param args.name <string> - MCP服务器名称
   * @return {Promise<any>} - 返回操作结果
   */
  async remove_mcp_server(args) {
    let mcpConfig = import_mcp.mcpService.read_mcp_config();
    let mcpServers = [];
    if (mcpConfig && mcpConfig.mcpServers) {
      mcpServers = mcpConfig.mcpServers;
    }
    let serverIndex = mcpServers.findIndex((s) => s.name === args.name);
    if (serverIndex === -1) {
      return import_public.pub.return_error(import_public.pub.lang("\u672A\u627E\u5230\u8BE5\u670D\u52A1\u5668"));
    }
    mcpServers.splice(serverIndex, 1);
    import_mcp.mcpService.save_mcp_config(mcpServers);
    return import_public.pub.return_success(import_public.pub.lang("\u5378\u8F7D\u6210\u529F"));
  }
  /**
   * 添加MCP服务器
   * @param args.name <string> - MCP服务器名称
   * @param args.description <string> - 描述
   * @param args.type <string> - 类型 (stdio | sse)
   * @param args.command <string> - 执行命令 (npx | uv | 其它可执行文件全路径)
   * @param args.baseUrl <string> - 服务器URL地址
   * @param args.env <object> - 环境变量
   * @param args.args <string[]> - 参数
   * @return {Promise<any>} - 返回操作结果
   */
  async add_mcp_server(args) {
    let mcpConfig = import_mcp.mcpService.read_mcp_config();
    let mcpServers = [];
    if (mcpConfig && mcpConfig.mcpServers) {
      mcpServers = mcpConfig.mcpServers;
    }
    let server = mcpServers.find((s) => s.name === args.name);
    if (server) {
      return import_public.pub.return_error(import_public.pub.lang("\u8BE5\u670D\u52A1\u5668\u5DF2\u5B58\u5728"));
    }
    if (typeof args.env === "string") {
      try {
        args.env = JSON.parse(args.env);
      } catch (e) {
        return import_public.pub.return_error(import_public.pub.lang("\u73AF\u5883\u53D8\u91CF\u683C\u5F0F\u9519\u8BEF"));
      }
    }
    if (typeof args.args === "string") {
      try {
        args.args = JSON.parse(args.args);
      } catch (e) {
        return import_public.pub.return_error(import_public.pub.lang("\u53C2\u6570\u683C\u5F0F\u9519\u8BEF"));
      }
    }
    server = {
      name: args.name,
      description: args.description,
      type: args.type,
      command: args.command,
      baseUrl: args.baseUrl,
      env: args.env,
      args: args.args,
      isActive: true
    };
    mcpServers.push(server);
    import_mcp.mcpService.save_mcp_config(mcpServers);
    return import_public.pub.return_success(import_public.pub.lang("\u6DFB\u52A0\u6210\u529F"));
  }
  /**
   * 修改MCP服务器工具信息
   * @param args.name <string> - MCP服务器名称
   * @param args.tools <Record<string,boolean>> - 工具可用性
   * @return {Promise<any>} - 返回操作结果
   */
  async modify_mcp_tools(args) {
    let mcpConfig = import_mcp.mcpService.read_mcp_config();
    let mcpServers = [];
    if (mcpConfig && mcpConfig.mcpServers) {
      mcpServers = mcpConfig.mcpServers;
    }
    let server = mcpServers.find((s) => s.name === args.name);
    if (!server) {
      return import_public.pub.return_error(import_public.pub.lang("\u672A\u627E\u5230\u8BE5\u670D\u52A1\u5668"));
    }
    for (let i = 0; i < server.tools.length; i++) {
      let tool = server.tools[i];
      if (args.tools[tool.name] !== void 0) {
        tool.is_active = args.tools[tool.name];
      }
    }
    import_mcp.mcpService.save_mcp_config(mcpServers);
    return import_public.pub.return_success(import_public.pub.lang("\u4FEE\u6539\u6210\u529F"));
  }
  /**
   * 获取MCP服务器工具信息
   * @param args.name <string> - MCP服务器名称
   */
  async get_mcp_tools(args) {
    let mcpConfig = import_mcp.mcpService.read_mcp_config();
    let mcpServers = [];
    if (mcpConfig && mcpConfig.mcpServers) {
      mcpServers = mcpConfig.mcpServers;
    }
    let server = mcpServers.find((s) => s.name === args.name);
    if (!server) {
      return import_public.pub.return_error(import_public.pub.lang("\u672A\u627E\u5230\u8BE5\u670D\u52A1\u5668"));
    }
    let mcpClient = new import_mcp_client.MCPClient();
    let tools = await mcpClient.getTools(server);
    if (tools) {
      import_mcp.mcpService.save_mcp_tools(server.name, tools);
    }
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), tools);
  }
  /**
   * 检查环境状态
   * @param args - 参数对象
   */
  async get_status(args) {
    let bunFile = import_mcp.mcpService.get_bun_bin();
    let isBun = 1;
    if (!import_public.pub.file_exists(bunFile)) {
      isBun = 0;
    }
    if (isBun === 0) {
      if (global.bunInstall) {
        isBun = 2;
      }
    }
    let uvFile = import_mcp.mcpService.get_uv_bin();
    let isUv = 1;
    if (!import_public.pub.file_exists(uvFile)) {
      isUv = 0;
    }
    if (isUv === 0) {
      if (global.uvInstall) {
        isUv = 2;
      }
    }
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), {
      node_npx: isBun,
      python_uv: isUv
    });
  }
  /**
   * 安装 node.js环境
   * @param args - 参数对象
   */
  async install_npx(args) {
    return import_mcp.mcpService.install_npx();
  }
  /**
   * 安装 python环境
   * @param args - 参数对象
   */
  async install_uv(args) {
    let uvFile = import_mcp.mcpService.get_uv_bin();
    if (import_public.pub.file_exists(uvFile)) {
      return import_public.pub.return_success(import_public.pub.lang("\u5DF2\u5B89\u88C5"));
    }
    global.uvInstall = true;
    let binPath = import_mcp.mcpService.get_bin_path();
    let os_path = import_mcp.mcpService.get_os_path();
    let downloadUrl = `https://aingdesk.bt.cn/bin/${os_path}/uv.zip`;
    let uvzipFile = path.resolve(binPath, "uv.zip");
    await import_mcp.mcpService.download_file(downloadUrl, uvzipFile);
    let unzip = require("unzipper");
    let fs = require("fs");
    let unzipStream = fs.createReadStream(uvzipFile).pipe(unzip.Extract({ path: binPath }));
    return new Promise((resolve, reject) => {
      unzipStream.on("close", () => {
        import_public.pub.delete_file(uvzipFile);
        resolve(import_public.pub.return_success(import_public.pub.lang("\u5B89\u88C5\u6210\u529F")));
      });
      unzipStream.on("error", (error) => {
        reject(import_public.pub.return_error(import_public.pub.lang("\u5B89\u88C5\u5931\u8D25"), error));
      });
    });
  }
  /**
   * 获取MCP配置文件内容
   * @param args - 参数对象
   * @returns {Promise<any>} - 返回MCP配置文件内容
   */
  async get_mcp_config_body(args) {
    let mcpConfig = import_mcp.mcpService.read_mcp_config();
    if (mcpConfig && mcpConfig.mcpServers) {
      return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), {
        mcp_config_body: JSON.stringify(mcpConfig, null, 4)
      });
    } else {
      return import_public.pub.return_error(import_public.pub.lang("\u672A\u627E\u5230MCP\u914D\u7F6E"));
    }
  }
  /**
   * 保存MCP配置文件内容
   * @param args - 参数对象
   * @returns {Promise<any>} - 返回操作结果
   */
  async save_mcp_config_body(args) {
    let mcpConfig = import_mcp.mcpService.read_mcp_config();
    if (mcpConfig && mcpConfig.mcpServers) {
      try {
        let newMcpConfig = JSON.parse(args.mcp_config_body);
        if (!newMcpConfig.mcpServers) {
          return import_public.pub.return_error(import_public.pub.lang("\u914D\u7F6E\u6587\u4EF6\u683C\u5F0F\u9519\u8BEF"));
        }
        let mcpServers = newMcpConfig.mcpServers;
        import_mcp.mcpService.save_mcp_config(mcpServers);
        return import_public.pub.return_success(import_public.pub.lang("\u4FDD\u5B58\u6210\u529F"));
      } catch (e) {
        import_log.logger.error(`\u4FDD\u5B58 MCP \u914D\u7F6E\u6587\u4EF6\u65F6\u51FA\u9519:${e}`);
        return import_public.pub.return_error(import_public.pub.lang("\u914D\u7F6E\u6587\u4EF6\u683C\u5F0F\u9519\u8BEF"));
      }
    } else {
      return import_public.pub.return_error(import_public.pub.lang("\u672A\u627E\u5230MCP\u914D\u7F6E"));
    }
  }
  /**
   * 获取pypi和npm的源列表
   * @param args - 参数对象
   * @returns 
   */
  async get_registry_list(args) {
    let registryListFile = path.resolve(import_public.pub.get_resource_path(), "index_list.json");
    let defaultList = {
      "pypi": [
        {
          "name": "pypi",
          "url": "https://pypi.python.org/simple",
          "description": "Python\u5B98\u65B9\u6E90"
        },
        {
          "name": "\u6E05\u534E\u5927\u5B66\u6E90",
          "url": "https://pypi.tuna.tsinghua.edu.cn/simple",
          "description": "\u6E05\u534E\u5927\u5B66\u6E90\uFF0C\u9002\u5408\u4E2D\u56FD\u7528\u6237"
        }
      ],
      "npm": [
        {
          "name": "npm",
          "url": "https://registry.npmjs.org",
          "description": "npm\u5B98\u65B9\u6E90"
        },
        {
          "name": "\u6DD8\u5B9D\u6E90",
          "url": "https://registry.npmmirror.com",
          "description": "\u6DD8\u5B9D\u6E90\uFF0C\u9002\u5408\u4E2D\u56FD\u7528\u6237"
        }
      ]
    };
    if (import_public.pub.file_exists(registryListFile)) {
      defaultList = import_public.pub.read_json(registryListFile);
    }
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), defaultList);
  }
  /**
   * 同步云端的MCP配置文件
   * @param args - 参数对象
   * @returns {Promise<any>} - 返回操作结果
   */
  async sync_cloud_mcp(args) {
    return await import_mcp.mcpService.sync_cloud_mcp();
  }
}
McpController.toString = () => "[class McpController]";
var mcp_default = new McpController();
