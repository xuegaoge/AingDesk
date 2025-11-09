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
var manager_exports = {};
__export(manager_exports, {
  default: () => manager_default
});
module.exports = __toCommonJS(manager_exports);
var import_public = require("../class/public");
var import_ollama = require("../service/ollama");
var os = __toESM(require("os"));
var import_log = require("ee-core/log");
const { execSync } = require("child_process");
const iconv = require("iconv-lite");
class ManagerController {
  /**
   * 获取模型管理器信息
   * @returns {Promise<any>} - 包含模型管理器信息的成功响应
   */
  async get_model_manager() {
    const ollamaService = new import_ollama.OllamaService();
    const version = await ollamaService.version();
    if (version) {
      if (!await ollamaService.is_running()) {
        import_log.logger.warn(import_public.pub.lang("Ollama \u670D\u52A1\u672A\u542F\u52A8\uFF0C\u6B63\u5728\u5C1D\u8BD5\u542F\u52A8..."));
        if (!await ollamaService.start()) {
          import_log.logger.warn(import_public.pub.lang("Ollama \u670D\u52A1\u542F\u52A8\u5931\u8D25"));
        }
      }
    }
    const modelManager = {
      manager_name: "ollama",
      version,
      models: await ollamaService.model_list(),
      status: version.length > 0,
      ollama_host: import_public.pub.get_ollama_host()
    };
    return import_public.pub.return_success(import_public.pub.lang("\u6A21\u578B\u7BA1\u7406\u5668\u4FE1\u606F\u83B7\u53D6\u6210\u529F"), modelManager);
  }
  /**
   * 安装模型
   * @param {Object} args - 安装模型所需的参数
   * @param {string} args.model - 模型名称
   * @param {string} args.parameters - 模型参数
   * @returns {Promise<any>} - 包含安装结果的成功响应
   */
  async install_model(args) {
    const { model, parameters } = args;
    const ollamaService = new import_ollama.OllamaService();
    const res = await ollamaService.install_model(model, parameters);
    return import_public.pub.return_success(import_public.pub.lang("\u5B89\u88C5\u6210\u529F"), res);
  }
  /**
   * 获取模型安装进度
   * @param {Object} args - 获取安装进度所需的参数
   * @param {string} args.model - 模型名称
   * @param {string} args.parameters - 模型参数
   * @returns {Promise<any>} - 包含安装进度信息的成功响应
   */
  async get_model_install_progress(args) {
    const { model, parameters } = args;
    const ollamaService = new import_ollama.OllamaService();
    const res = await ollamaService.get_model_install_progress(model, parameters);
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u5B89\u88C5\u8FDB\u5EA6\u6210\u529F"), res);
  }
  /**
   * 删除模型
   * @param {Object} args - 删除模型所需的参数
   * @param {string} args.model - 模型名称
   * @param {string} args.parameters - 模型参数
   * @returns {Promise<any>} - 包含删除结果的成功响应
   */
  async remove_model(args) {
    const { model, parameters } = args;
    const ollamaService = new import_ollama.OllamaService();
    const res = await ollamaService.remove_model(model, parameters);
    return import_public.pub.return_success(import_public.pub.lang("\u5220\u9664\u6210\u529F"), res);
  }
  /**
   * 安装模型管理器
   * @param {Object} args - 安装模型管理器所需的参数
   * @param {string} args.manager_name - 模型管理器名称
   * @returns {Promise<any>} - 包含安装状态的响应
   */
  async install_model_manager(args) {
    const { manager_name, models_path } = args;
    if (manager_name !== "ollama") {
      return import_public.pub.return_error(import_public.pub.lang("\u4E0D\u652F\u6301\u7684\u7BA1\u7406\u5668"), "");
    }
    const ollamaService = new import_ollama.OllamaService();
    if (models_path && models_path.length > 0) {
      if (!import_public.pub.file_exists(models_path)) {
        return import_public.pub.return_error(import_public.pub.lang("\u6307\u5B9A\u6A21\u578B\u5B58\u50A8\u8DEF\u5F84\u4E0D\u5B58\u5728"), "");
      }
      ollamaService.set_ollama_model_save_path(models_path);
    }
    const res = await ollamaService.install_ollama();
    return import_public.pub.return_success(import_public.pub.lang("\u6B63\u5728\u5B89\u88C5,\u8BF7\u7A0D\u540E..."), res);
  }
  /**
   * 获取模型管理器安装进度
   * @param {Object} args - 获取安装进度所需的参数
   * @param {string} args.manager_name - 模型管理器名称
   * @returns {Promise<any>} - 包含安装进度信息的成功响应
   */
  async get_model_manager_install_progress(args) {
    const { manager_name } = args;
    if (manager_name !== "ollama") {
      return import_public.pub.return_error(import_public.pub.lang("\u4E0D\u652F\u6301\u7684\u7BA1\u7406\u5668"), "");
    }
    const ollamaService = new import_ollama.OllamaService();
    const res = await ollamaService.get_ollama_install_progress();
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u5B89\u88C5\u8FDB\u5EA6\u6210\u529F"), res);
  }
  /**
   * 获取电脑配置信息
   * @returns {Promise<any>} - 包含电脑配置信息的成功响应
   */
  async get_configuration_info() {
    const configurationInfo = {
      cpu_model: "",
      cpu_cores: 0,
      cpu_clock: "",
      memory_size: 0,
      free_memory_size: 0,
      gpu_model: "",
      gpu_type: "",
      is_cuda: false,
      gpu_memory: 0,
      gpu_free_memory_size: 0,
      os_type: "",
      os_name: "",
      os_version: "",
      recommend: ""
    };
    try {
      const cpus = os.cpus();
      if (cpus.length > 0) {
        configurationInfo.cpu_model = cpus[0].model;
        configurationInfo.cpu_cores = cpus.length;
        configurationInfo.cpu_clock = `${cpus[0].speed / 1e3}GHz`;
      }
      configurationInfo.memory_size = os.totalmem();
      configurationInfo.free_memory_size = os.freemem();
      configurationInfo.os_type = os.type();
      if (configurationInfo.os_type === "Windows_NT") {
        configurationInfo.os_type = "Windows";
        try {
          const buf = execSync("wmic os get Caption /value");
          const winRelease = iconv.decode(buf, "gbk").toString();
          const match = winRelease.match(/Caption=(.*)/);
          if (match) {
            configurationInfo.os_name = match[1].trim();
          }
          const winVersionOutput = execSync("wmic os get Version /value").toString();
          const versionMatch = winVersionOutput.match(/Version=(.*)/);
          if (versionMatch) {
            configurationInfo.os_version = versionMatch[1].trim();
          }
        } catch (error) {
          import_log.logger.error(import_public.pub.lang("\u83B7\u53D6 Windows \u7CFB\u7EDF\u4FE1\u606F\u65F6\u51FA\u9519:"), error);
        }
      } else if (configurationInfo.os_type === "Linux") {
        try {
          const lsbRelease = import_public.pub.exec_shell("lsb_release -d");
          const match = lsbRelease.match(/Description:\t(.*)/);
          if (match) {
            configurationInfo.os_name = match[1].trim();
          }
          const osRelease = import_public.pub.exec_shell("cat /etc/os-release");
          const versionMatch = osRelease.match(/VERSION_ID="(.*)"/);
          if (versionMatch) {
            configurationInfo.os_version = versionMatch[1].trim();
          }
        } catch (error) {
          import_log.logger.error(import_public.pub.lang("\u83B7\u53D6 Linux \u7CFB\u7EDF\u4FE1\u606F\u65F6\u51FA\u9519:"), error);
        }
      } else if (configurationInfo.os_type === "Darwin") {
        configurationInfo.os_type = "MacOS";
        try {
          const sw_vers = import_public.pub.exec_shell("sw_vers");
          const nameMatch = sw_vers.match(/ProductName:\t(.*)/);
          if (nameMatch) {
            configurationInfo.os_name = nameMatch[1].trim();
          }
          const versionMatch = sw_vers.match(/ProductVersion:\t(.*)/);
          if (versionMatch) {
            configurationInfo.os_version = versionMatch[1].trim();
          }
        } catch (error) {
          import_log.logger.error(import_public.pub.lang("\u83B7\u53D6 MacOS \u7CFB\u7EDF\u4FE1\u606F\u65F6\u51FA\u9519:"), error);
        }
      }
      try {
        if (["Windows", "Linux"].includes(configurationInfo.os_type)) {
          const nvidiaSmiExists = this.checkNvidiaSmiExists(configurationInfo.os_type);
          if (nvidiaSmiExists) {
            const nvidiaSmiOutput = import_public.pub.exec_shell("nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits");
            const gpuInfo = nvidiaSmiOutput.split("\n")[0].split(",");
            configurationInfo.gpu_model = gpuInfo[0].trim();
            configurationInfo.gpu_type = "Nvidia";
            configurationInfo.is_cuda = true;
            configurationInfo.gpu_memory = parseInt(gpuInfo[1].trim());
            configurationInfo.gpu_free_memory_size = parseInt(gpuInfo[2].trim());
          } else {
            if (configurationInfo.os_type === "Linux") {
              const lshwOutput = import_public.pub.exec_shell("lshw -C display");
              const gpuMatch = lshwOutput.match(/description: (.*)\n.*product: (.*)\n.*vendor: (.*)\n.*memory: (.*)/s);
              if (gpuMatch) {
                configurationInfo.gpu_model = gpuMatch[2].trim();
                if (gpuMatch[3].includes("NVIDIA")) {
                  configurationInfo.gpu_type = "Nvidia";
                } else if (gpuMatch[3].includes("AMD")) {
                  configurationInfo.gpu_type = "AMD";
                } else if (gpuMatch[3].includes("Intel")) {
                  configurationInfo.gpu_type = "Intel";
                }
                const memoryStr = gpuMatch[4].trim();
                if (memoryStr.includes("GB")) {
                  configurationInfo.gpu_memory = parseFloat(memoryStr.replace("GB", "")) * 1024;
                } else if (memoryStr.includes("MB")) {
                  configurationInfo.gpu_memory = parseFloat(memoryStr.replace("MB", ""));
                }
              }
            } else if (configurationInfo.os_type === "Windows") {
              const wmicOutput = import_public.pub.exec_shell("wmic path win32_VideoController get Name,AdapterRAM");
              const gpuMatch = wmicOutput.match(/Name\s+(.*)\s+AdapterRAM\s+(.*)/);
              if (gpuMatch) {
                configurationInfo.gpu_model = gpuMatch[1].trim();
                if (configurationInfo.gpu_model.includes("NVIDIA")) {
                  configurationInfo.gpu_type = "Nvidia";
                } else if (configurationInfo.gpu_model.includes("AMD")) {
                  configurationInfo.gpu_type = "AMD";
                } else if (configurationInfo.gpu_model.includes("Intel")) {
                  configurationInfo.gpu_type = "Intel";
                }
                const adapterRAM = parseInt(gpuMatch[2].trim());
                if (!isNaN(adapterRAM)) {
                  configurationInfo.gpu_memory = adapterRAM / (1024 * 1024);
                }
              }
            }
          }
        } else if (configurationInfo.os_type === "MacOS") {
          const systemProfilerOutput = import_public.pub.exec_shell("system_profiler SPDisplaysDataType");
          const gpuMatch = systemProfilerOutput.match(/Chipset Model: (.*)\n.*VRAM \(Total\): (.*)/s);
          if (gpuMatch) {
            configurationInfo.gpu_model = gpuMatch[1].trim();
            if (configurationInfo.gpu_model.includes("AMD")) {
              configurationInfo.gpu_type = "AMD";
            } else if (configurationInfo.gpu_model.includes("Intel")) {
              configurationInfo.gpu_type = "Intel";
            }
            const vramStr = gpuMatch[2].trim();
            if (vramStr.includes("GB")) {
              configurationInfo.gpu_memory = parseFloat(vramStr.replace("GB", "")) * 1024;
            } else if (vramStr.includes("MB")) {
              configurationInfo.gpu_memory = parseFloat(vramStr.replace("MB", ""));
            }
          }
        }
      } catch (error) {
        import_log.logger.error(import_public.pub.lang("\u83B7\u53D6 GPU \u4FE1\u606F\u65F6\u51FA\u9519:"), error);
      }
      configurationInfo.gpu_model += " - " + import_public.pub.bytesChange(configurationInfo.gpu_memory * 1024 * 1024);
      if (configurationInfo.cpu_cores >= 8 && configurationInfo.memory_size >= 16 * 1024 * 1024 * 1024 && configurationInfo.is_cuda && configurationInfo.gpu_memory >= 15 * 1024) {
        configurationInfo.recommend = import_public.pub.lang("\u6839\u636E\u60A8\u7684\u786C\u4EF6\u914D\u7F6E\uFF0C\u53EF\u4EE5\u6D41\u7545\u8FD0\u884C\u5927\u90E8\u5206\u4E2D\u5927\u89C4\u6A21\u7684\u6A21\u578B\uFF0C\u5982\uFF1A32b\u300127b\u300124b\u300114b\u30017b \u7B49");
      } else if (configurationInfo.cpu_cores >= 16 && configurationInfo.memory_size >= 32 * 1024 * 1024 * 1024) {
        configurationInfo.recommend = import_public.pub.lang("\u60A8\u7684\u786C\u4EF6\u914D\u7F6E\u9002\u5408\u9009\u62E9\u4E2D\u7B49\u89C4\u6A21\u7684\u6A21\u578B\uFF0C\u5982: 7b\u300114b\u300116b \u7B49");
      } else {
        configurationInfo.recommend = import_public.pub.lang("\u7531\u4E8E\u786C\u4EF6\u8D44\u6E90\u6709\u9650\uFF0C\u5EFA\u8BAE\u9009\u62E9\u8F7B\u91CF\u7EA7\u7684\u6A21\u578B\uFF0C\u5982: 1b\u30012b \u7B49");
      }
    } catch (error) {
      import_log.logger.error(import_public.pub.lang("\u83B7\u53D6\u914D\u7F6E\u4FE1\u606F\u65F6\u51FA\u73B0\u672A\u77E5\u9519\u8BEF:"), error);
      return import_public.pub.return_error(import_public.pub.lang("\u83B7\u53D6\u914D\u7F6E\u4FE1\u606F\u65F6\u51FA\u73B0\u672A\u77E5\u9519\u8BEF"), "");
    }
    return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u914D\u7F6E\u4FE1\u606F\u6210\u529F"), configurationInfo);
  }
  /**
   * 检查 nvidia-smi 命令是否存在
   * @param {string} osType - 操作系统类型
   * @returns {boolean} - 如果 nvidia-smi 命令存在返回 true，否则返回 false
   */
  checkNvidiaSmiExists(osType) {
    if (osType === "Linux") {
      const whichOutput = import_public.pub.exec_shell("which nvidia-smi");
      return whichOutput.length > 0;
    } else if (osType === "Windows") {
      const whereOutput = import_public.pub.exec_shell("where nvidia-smi");
      return whereOutput.length > 0;
    }
    return false;
  }
  /**
   * 获取磁盘信息
   * @returns {Promise<object[]>} - 包含磁盘信息的数组
   */
  async get_disk_list() {
    const diskList = [];
    if (import_public.pub.is_windows()) {
      try {
        const output = execSync("wmic logicaldisk get caption,size,freespace").toString();
        const lines = output.split("\n").filter((line) => line.trim() !== "");
        lines.shift();
        lines.forEach((line) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            const mountpoint = parts[0];
            const free = parseInt(parts[1], 10);
            const total = parseInt(parts[2], 10);
            const used = total - free;
            const progress = total > 0 ? Math.round(used / total * 100) : 0;
            const diskInfo = {
              mountpoint,
              total,
              used,
              free,
              progress
            };
            diskList.push(diskInfo);
          }
        });
      } catch (error) {
        import_log.logger.error(import_public.pub.lang("\u83B7\u53D6 Windows \u78C1\u76D8\u4FE1\u606F\u65F6\u51FA\u9519:"), error);
      }
    } else if (import_public.pub.is_linux()) {
      try {
        const output = execSync("df -P -B1").toString();
        const lines = output.split("\n").filter((line) => line.trim() !== "");
        lines.shift();
        lines.forEach((line) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const mountpoint = parts[5];
            const total = parseInt(parts[1], 10);
            const used = parseInt(parts[2], 10);
            const free = parseInt(parts[3], 10);
            const progress = parseInt(parts[4].replace("%", ""), 10);
            const diskInfo = {
              mountpoint,
              total,
              used,
              free,
              progress
            };
            diskList.push(diskInfo);
          }
        });
      } catch (error) {
        import_log.logger.error(import_public.pub.lang("\u83B7\u53D6 Linux \u78C1\u76D8\u4FE1\u606F\u65F6\u51FA\u9519:"), error);
      }
    } else if (import_public.pub.is_mac()) {
      try {
        const output = execSync("df -P -B1").toString();
        const lines = output.split("\n").filter((line) => line.trim() !== "");
        lines.shift();
        lines.forEach((line) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const mountpoint = parts[8];
            const total = parseInt(parts[1], 10);
            const used = parseInt(parts[2], 10);
            const free = parseInt(parts[3], 10);
            const progress = parseInt(parts[4].replace("%", ""), 10);
            const diskInfo = {
              mountpoint,
              total,
              used,
              free,
              progress
            };
            diskList.push(diskInfo);
          }
        });
      } catch (error) {
        import_log.logger.error(import_public.pub.lang("\u83B7\u53D6 macOS \u78C1\u76D8\u4FE1\u606F\u65F6\u51FA\u9519:"), error);
      }
    }
    return diskList;
  }
  /**
   * 修改 Ollama 模型保存路径
   * @param {Object} args - 修改保存路径所需的参数
   * @param {string} args.save_path - 新的模型保存路径
   * @returns {Promise<any>} - 包含修改结果的成功响应
   */
  async set_ollama_model_save_path(args) {
    const { save_path } = args;
    const ollamaService = new import_ollama.OllamaService();
    const res = ollamaService.set_ollama_model_save_path(save_path);
    return import_public.pub.return_success(import_public.pub.lang("\u4FEE\u6539\u6210\u529F"), res);
  }
  /**
   * 断开重连模型下载任务
   */
  async reconnect_model_download() {
    const ollamaService = new import_ollama.OllamaService();
    const res = ollamaService.reconnect_model_download();
    return import_public.pub.return_success(import_public.pub.lang("\u5C06\u4E3A\u60A8\u91CD\u65B0\u4E0B\u8F7D\uFF0C\u5E76\u65AD\u70B9\u7EED\u4F20\u3002"), res);
  }
  /**
   * 设置ollama连接地址
   * @param {Object} args - 设置ollama连接地址所需的参数
   * @param {string} args.ollama_host - ollama连接地址
   * @returns {Promise<any>} - 包含修改结果的成功响应
   */
  async set_ollama_host(args) {
    const { ollama_host } = args;
    const ollamaService = new import_ollama.OllamaService();
    const res = await ollamaService.set_ollama_host(ollama_host);
    if (res) {
      return import_public.pub.return_success(import_public.pub.lang("\u8BBE\u7F6E\u6210\u529F"), res);
    } else {
      return import_public.pub.return_error(import_public.pub.lang("\u6307\u5B9A\u63A5\u53E3\u5730\u5740\u8FDE\u63A5\u5931\u8D25"), "connect error:" + ollama_host);
    }
  }
}
ManagerController.toString = () => "[class ManagerController]";
var manager_default = ManagerController;
