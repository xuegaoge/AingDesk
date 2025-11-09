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
var ollama_exports = {};
__export(ollama_exports, {
  OllamaService: () => OllamaService,
  ollamaService: () => ollamaService
});
module.exports = __toCommonJS(ollama_exports);
var import_public = require("../class/public");
var path = __toESM(require("path"));
var import_axios = __toESM(require("axios"));
var fs = __toESM(require("fs"));
var import_log = require("ee-core/log");
var import_test_node = require("../class/test_node");
var import_child_process = require("child_process");
let ModelDownloadSpeed = /* @__PURE__ */ new Map();
let ReconnectModelDownload = false;
let ReconnectOllamaDownload = false;
let ModelDownLoadSpeedList = [];
let ModelDownLoadSpeedList10s = [];
let OllamaDownloadSpeed = {
  total: 0,
  completed: 0,
  speed: 0,
  progress: 0,
  status: 0
};
class OllamaService {
  /**
   * 获取 Ollama 可执行文件的路径
   * @returns {string[]} 包含 Ollama 可执行文件路径的数组
   */
  get_ollama_bin() {
    if (import_public.pub.is_windows()) {
      const localAppData = process.env["LOCALAPPDATA"];
      const ollamaBin = `${localAppData}\\Programs\\Ollama\\ollama.exe`;
      if (import_public.pub.file_exists(ollamaBin)) {
        return [ollamaBin, "ollama"];
      }
      return ["ollama"];
    }
    let result = [];
    let bins = ["/usr/local/bin/ollama", "/usr/bin/ollama", "/sbin/ollama"];
    for (let bin of bins) {
      if (import_public.pub.file_exists(bin)) {
        result.push(bin);
      }
    }
    result.push("ollama");
    return result;
  }
  /**
   * 获取 Ollama 的版本信息
   * @returns {string} 若成功获取到版本信息则返回版本号，否则返回空字符串
   */
  async version() {
    try {
      try {
        let url = `${import_public.pub.get_ollama_host()}/api/version`;
        let res = await import_public.pub.httpRequest(url, {
          timeout: 1e3,
          method: "GET",
          json: true
        });
        if (res.statusCode === 200) {
          if (res.body && res.body.version) {
            return res.body.version;
          }
        }
      } catch (e) {
        import_log.logger.error("Get ollama version error:", e);
      }
      const ollamaBinList = this.get_ollama_bin();
      for (const bin of ollamaBinList) {
        const res = import_public.pub.exec_shell(`${bin} --version`);
        const versionRegex = /version is (\S+)/;
        const match = res.match(versionRegex);
        if (match) {
          return match[1];
        }
      }
      return "";
    } catch (error) {
      import_log.logger.error(import_public.pub.lang("\u83B7\u53D6 ollama \u7248\u672C\u65F6\u51FA\u9519:"), error);
      return "";
    }
  }
  /**
   * 检查 Ollama 是否正在运行
   * @returns {Promise<boolean>} 若 Ollama 正在运行则返回 true，否则返回 false
   */
  async is_running() {
    try {
      const ollama = import_public.pub.init_ollama();
      await ollama.ps();
      import_log.logger.info("Ollama is running");
      return true;
    } catch (e) {
      import_log.logger.warn("Ollama is not running");
      return false;
    }
  }
  /**
   * 启动 Ollama 服务
   * @returns {Promise<boolean>} 若 Ollama 启动成功则返回 true，否则返回 false
   */
  async start() {
    if (import_public.pub.is_windows()) {
      (0, import_child_process.exec)('"ollama app"');
    } else if (import_public.pub.is_linux()) {
      (0, import_child_process.exec)("systemctl start ollama");
    } else if (import_public.pub.is_mac()) {
      (0, import_child_process.exec)("open /Applications/Ollama.app");
    }
    await import_public.pub.sleep(5e3);
    return true;
  }
  /**
   * 获取嵌套模型列表
   * @returns {Promise<any[]>} 包含模型信息的数组，若出错则返回空数组
   */
  async get_embedding_model_list() {
    const models = await this.model_list();
    let result = models.filter((model) => {
      return model.install && model.capability.includes("embedding");
    });
    result = result.map((model) => {
      let supplierName = "ollama";
      let title = `${supplierName}/${model.full_name}`;
      let modelInfo = {
        title,
        supplierName,
        model: model.full_name,
        size: model.size,
        contextLength: 512
      };
      return modelInfo;
    });
    return result;
  }
  /**
   * 获取 Ollama 模型列表
   * @returns {Promise<any[]>} 包含模型信息的数组，若出错则返回空数组
   */
  async model_list() {
    try {
      const modelListFile = path.resolve(import_public.pub.get_resource_path(), "ollama_model.json");
      let modelListSrc = [];
      if (import_public.pub.file_exists(modelListFile)) {
        const modelListData = import_public.pub.read_file(modelListFile);
        modelListSrc = JSON.parse(modelListData);
      }
      const ollama = import_public.pub.init_ollama();
      const { models } = await ollama.list();
      let isCn = import_public.pub.get_language() == "zh";
      for (let model of models) {
        let isExist = false;
        for (let modelSrc of modelListSrc) {
          let srcName = modelSrc["full_name"].toLowerCase();
          let dstName = model.name.toLowerCase();
          if (srcName === dstName) {
            isExist = true;
            break;
          }
        }
        if (!isExist) {
          let arr = model.name.split(":");
          let modelSrc = {
            full_name: model.name,
            name: arr[1],
            parameters: "",
            size: import_public.pub.bytesChange(model.size),
            msg: "",
            zh_cn_msg: "",
            link: "",
            pull_count: 0,
            tag_count: 0,
            updated: "",
            updated_time: 0,
            capability: []
          };
          for (let modelInfo of modelListSrc) {
            if (modelInfo["name"].toLowerCase() === arr[0]) {
              modelSrc["pull_count"] = modelInfo.pull_count;
              modelSrc["tag_count"] = modelInfo.tag_count;
              modelSrc["updated"] = modelInfo.updated;
              modelSrc["updated_time"] = modelInfo.updated_time;
              modelSrc["capability"] = modelInfo.capability;
              modelSrc["zh_cn_msg"] = modelInfo.zh_cn_msg;
              modelSrc["msg"] = modelInfo.msg;
              modelSrc["link"] = modelInfo.link;
              break;
            }
          }
          modelListSrc.push(modelSrc);
        }
      }
      const modelList = modelListSrc.map((modelInfoSrc) => {
        const modelInfo = {
          full_name: modelInfoSrc["full_name"],
          model: modelInfoSrc["name"],
          parameters: modelInfoSrc["parameters"],
          download_size: modelInfoSrc["size"],
          size: 0,
          msg: modelInfoSrc["msg"],
          title: isCn ? modelInfoSrc["zh_cn_msg"] : modelInfoSrc["msg"],
          link: modelInfoSrc["link"],
          pull_count: modelInfoSrc["pull_count"],
          tag_count: modelInfoSrc["tag_count"],
          updated: modelInfoSrc["updated"],
          updated_time: modelInfoSrc["updated_time"],
          capability: modelInfoSrc["capability"],
          install: false,
          running: false,
          memory_size: 0,
          memory_require: 0,
          need_gpu: false,
          performance: -1
        };
        const installedModel = models.find((m) => {
          return m.name.toLowerCase() === modelInfoSrc["full_name"].toLowerCase();
        });
        if (installedModel) {
          modelInfo.install = true;
          modelInfo.size = installedModel.size;
        }
        return modelInfo;
      });
      return modelList;
    } catch (error) {
      import_log.logger.error(import_public.pub.lang("\u83B7\u53D6 Ollama \u6A21\u578B\u5217\u8868\u65F6\u51FA\u9519:"), error);
      return [];
    }
  }
  /**
   * 下载速度监控
   * @param fullModel <string> 模型全名，如：deepseek-r1:1.5b
   * @returns 
   */
  download_speed_monitoring(fullModel) {
    let data = null;
    if (fullModel === "ollama") {
      data = OllamaDownloadSpeed;
    } else {
      data = ModelDownloadSpeed.get(fullModel);
      if (!data) {
        return;
      }
    }
    if (data.status !== 1) {
      return;
    }
    if (ModelDownLoadSpeedList.length < 60) {
      return;
    }
    let { average, average10s } = this.get_average_speed();
    if (average10s < average / 3) {
      import_log.logger.warn(import_public.pub.lang("\u68C0\u6D4B\u5230\u4E0B\u8F7D\u901F\u5EA6\u5F02\u5E38\uFF0C\u6B63\u5728\u5C1D\u8BD5\u91CD\u65B0\u8FDE\u63A5\u4E0B\u8F7D\u8282\u70B9..."));
      if (fullModel === "ollama") {
        this.reconnect_ollama_download();
      } else {
        this.reconnect_model_download();
      }
      ModelDownLoadSpeedList = [];
      ModelDownLoadSpeedList10s = [];
    }
  }
  /**
   * 添加下载速度到列表 
   * @param speed <number> 下载速度
   */
  append_speed_to_list(speed) {
    ModelDownLoadSpeedList.push(speed);
    if (ModelDownLoadSpeedList.length > 60) {
      ModelDownLoadSpeedList.shift();
    }
    ModelDownLoadSpeedList10s.push(speed);
    if (ModelDownLoadSpeedList10s.length > 10) {
      ModelDownLoadSpeedList10s.shift();
    }
  }
  /**
   * 获取平均下载速度
   * @returns 
   */
  get_average_speed() {
    let total = 0;
    for (let i = 0; i < ModelDownLoadSpeedList.length; i++) {
      total += ModelDownLoadSpeedList[i];
    }
    let average = total / ModelDownLoadSpeedList.length;
    total = 0;
    for (let i = 0; i < ModelDownLoadSpeedList10s.length; i++) {
      total += ModelDownLoadSpeedList10s[i];
    }
    let average10s = total / ModelDownLoadSpeedList10s.length;
    return { average, average10s };
  }
  /**
   * 安装指定模型
   * @param {string} model 模型名称，如：deepseek-r1
   * @param {string} parameters 模型参数规模，如：1.5b
   * @returns {Promise<boolean>} 安装成功返回 true，否则返回 false
   */
  async install_model(model, parameters) {
    let fullModel = `${model}:${parameters}`;
    if (ModelDownloadSpeed.has(fullModel) && !ReconnectModelDownload) {
      ModelDownloadSpeed.delete(fullModel);
    }
    ReconnectModelDownload = false;
    try {
      const ollama = import_public.pub.init_ollama();
      let stream = await ollama.pull({ model: fullModel, stream: true });
      let lastTime = import_public.pub.time();
      let lastCompleted = 0;
      let speed = 0;
      let setEnd = false;
      for await (let part of stream) {
        if (part.digest) {
          let percent = 0;
          if (part.completed && part.total) {
            percent = Math.round(part.completed / part.total * 100);
          }
          let currentTime = import_public.pub.time();
          if (currentTime - lastTime > 0) {
            let completed = part.completed - lastCompleted;
            speed = completed / (currentTime - lastTime);
            lastTime = currentTime;
            lastCompleted = part.completed;
            this.append_speed_to_list(speed);
            this.download_speed_monitoring(fullModel);
          }
          if (speed < 0) {
            speed = 0;
          }
          let data = {
            digest: part.digest,
            status: setEnd ? 2 : 1,
            progress: percent,
            speed,
            total: part.total,
            completed: part.completed
          };
          if (setEnd) {
            data.status = 2;
            data.progress = 100;
            data.speed = speed;
          }
          if (percent === 100 && !setEnd) {
            setEnd = true;
          }
          ModelDownloadSpeed.set(fullModel, data);
          if (ReconnectModelDownload) {
            stream.abort();
            setTimeout(() => {
              this.install_model(model, parameters);
            }, 200);
            return true;
          }
        } else if (part.status === "success") {
          ModelDownLoadSpeedList = [];
          ModelDownLoadSpeedList10s = [];
          let data = {
            digest: "",
            status: 3,
            progress: 100,
            speed: 0,
            total: 0,
            completed: 0
          };
          ModelDownloadSpeed.set(fullModel, data);
        }
      }
      return true;
    } catch (error) {
      import_log.logger.error(import_public.pub.lang("\u5B89\u88C5\u6A21\u578B\u65F6\u51FA\u9519:"), error);
      return false;
    }
  }
  /**
   * 重连模型下载
   */
  reconnect_model_download() {
    ReconnectModelDownload = true;
    ReconnectOllamaDownload = true;
  }
  /**
   * 重连 Ollama 下载
   */
  reconnect_ollama_download() {
    ReconnectOllamaDownload = true;
  }
  /**
   * 获取模型安装进度
   * @param {string} model 模型名称，如：deepseek-r1
   * @param {string} parameters 模型参数规模，如：1.5b
   * @returns {Object} 包含模型下载进度和速度等信息的对象
   */
  get_model_install_progress(model, parameters) {
    const fullModel = `${model}:${parameters}`;
    const data = ModelDownloadSpeed.get(fullModel);
    if (data) {
      return data;
    }
    return {
      digest: "",
      status: 0,
      progress: 0,
      speed: 0,
      total: 0,
      completed: 0
    };
  }
  /**
   * 删除指定模型
   * @param {string} model 模型名称，如：deepseek-r1
   * @param {string} parameters 模型参数规模，如：1.5b
   * @returns {Promise<any>} 删除操作的结果
   */
  async remove_model(model, parameters) {
    const fullModel = `${model}:${parameters}`;
    try {
      const ollama = import_public.pub.init_ollama();
      return await ollama.delete({ model: fullModel });
    } catch (error) {
      import_log.logger.error(import_public.pub.lang("\u5220\u9664\u6A21\u578B\u65F6\u51FA\u9519:"), error);
      return null;
    }
  }
  async ollama_download_end(downloadFile) {
    try {
      const installed = await this.installOllamaAfterDownload(downloadFile);
      if (installed) {
        import_log.logger.info(import_public.pub.lang("\u5B89\u88C5\u5B8C\u6210"));
      }
    } catch (error) {
      import_log.logger.error(import_public.pub.lang("\u5B89\u88C5\u8FC7\u7A0B\u4E2D\u51FA\u73B0\u9519\u8BEF:"), error);
    }
  }
  /**
   * 安装 Ollama
   * @returns {Promise<boolean>} 安装成功返回 true，否则返回 false
   */
  async install_ollama() {
    ReconnectOllamaDownload = false;
    const { downloadUrl, downloadFile } = await this.getOllamaDownloadInfo();
    const writer = fs.createWriteStream(downloadFile, { flags: "a" });
    try {
      if (!downloadUrl || !downloadFile) {
        return false;
      }
      let downloadBytes = 0;
      if (import_public.pub.file_exists(downloadFile)) {
        downloadBytes = import_public.pub.filesize(downloadFile);
      }
      let headers = {
        "User-Agent": "AingDesk/" + import_public.pub.version()
      };
      if (downloadBytes > 0) {
        headers["Range"] = `bytes=${downloadBytes}-`;
      }
      let abort = new AbortController();
      const response = await (0, import_axios.default)({
        url: downloadUrl,
        method: "GET",
        headers,
        responseType: "stream",
        signal: abort.signal,
        // 禁止使用代理
        proxy: false
      });
      OllamaDownloadSpeed = {
        total: 0,
        completed: 0,
        speed: 0,
        progress: 0,
        status: 0
      };
      OllamaDownloadSpeed.total = parseInt(response.headers["content-length"], 10);
      if (downloadBytes > 0) {
        OllamaDownloadSpeed.completed = downloadBytes;
        OllamaDownloadSpeed.total += downloadBytes;
      }
      let downloadSize = 0;
      let startTime = import_public.pub.time();
      let speed = 0;
      const updateProgress = () => {
        const currentTime = import_public.pub.time();
        if (currentTime - startTime > 0) {
          OllamaDownloadSpeed.speed = speed / (currentTime - startTime);
          startTime = currentTime;
          speed = 0;
          this.append_speed_to_list(OllamaDownloadSpeed.speed);
          this.download_speed_monitoring("ollama");
        }
        OllamaDownloadSpeed.status = 1;
        OllamaDownloadSpeed.progress = Math.round(OllamaDownloadSpeed.completed / OllamaDownloadSpeed.total * 100);
        if (ReconnectOllamaDownload) {
          abort.abort();
          setTimeout(() => {
            this.install_ollama();
          }, 200);
        }
      };
      response.data.on("data", (chunk) => {
        OllamaDownloadSpeed.completed += chunk.length;
        downloadSize += chunk.length;
        speed += chunk.length;
        updateProgress();
      });
      response.data.on("end", async () => {
        writer.close();
        await this.ollama_download_end(downloadFile);
      });
      const handleError = async (error) => {
        if (error.code === "ERR_CANCELED") {
          return;
        }
        import_log.logger.error(import_public.pub.lang("\u4E0B\u8F7D\u8FC7\u7A0B\u4E2D\u51FA\u73B0\u9519\u8BEF:"), error);
        OllamaDownloadSpeed.status = -1;
      };
      response.data.on("error", handleError);
      writer.on("error", handleError);
      response.data.pipe(writer);
      return true;
    } catch (error) {
      if (error.code === "ERR_BAD_REQUEST" || error.status == 416) {
        OllamaDownloadSpeed.status = 2;
        OllamaDownloadSpeed.progress = 100;
        OllamaDownloadSpeed.completed = OllamaDownloadSpeed.total;
        writer.close();
        this.ollama_download_end(downloadFile);
        return true;
      } else if (error.code === "ERR_CANCELED") {
        return false;
      } else {
        import_log.logger.error(import_public.pub.lang("\u5B89\u88C5\u8FC7\u7A0B\u4E2D\u51FA\u73B0\u672A\u77E5\u9519\u8BEF:"), error);
        return false;
      }
    }
  }
  /**
   * 获取 Ollama 安装进度
   * @returns {Object} 包含 Ollama 下载进度和速度等信息的对象
   */
  get_ollama_install_progress() {
    return OllamaDownloadSpeed;
  }
  /**
   * 设置 Ollama 模型存储目录
   * @param {string} save_path 模型存储目录的路径
   * @returns {boolean} 设置成功返回 true，否则返回 false
   */
  set_ollama_model_save_path(save_path) {
    try {
      if (import_public.pub.is_windows()) {
        (0, import_child_process.execSync)(`setx OLLAMA_MODELS "${save_path}"`, { shell: "cmd.exe" });
        process.env.OLLAMA_MODELS = save_path;
        import_log.logger.info(import_public.pub.lang("Windows \u73AF\u5883\u53D8\u91CF\u8BBE\u7F6E\u6210\u529F\u3002"));
        this.killOllamaProcess("cmd.exe");
        (0, import_child_process.exec)('"ollama app"');
        import_log.logger.info(import_public.pub.lang("Ollama \u5DF2\u91CD\u65B0\u542F\u52A8\u3002"));
      } else if (import_public.pub.is_linux()) {
        const shellConfigFile = `${process.env.HOME}/.bashrc`;
        const configContent = `export OLLAMA_MODELS="${save_path}"`;
        (0, import_child_process.execSync)(`echo "${configContent}" >> ${shellConfigFile}`);
        process.env.OLLAMA_MODELS = save_path;
        import_log.logger.info(import_public.pub.lang("Linux \u73AF\u5883\u53D8\u91CF\u8BBE\u7F6E\u6210\u529F\u3002"));
        this.killOllamaProcess("/bin/bash");
        (0, import_child_process.execSync)("ollama serve &", { shell: "/bin/bash" });
        import_log.logger.info(import_public.pub.lang("Ollama \u5DF2\u91CD\u65B0\u542F\u52A8\u3002"));
      } else if (import_public.pub.is_mac()) {
        const shellConfigFile = `${process.env.HOME}/.zshrc`;
        const configContent = `export OLLAMA_MODELS="${save_path}"`;
        (0, import_child_process.execSync)(`echo "${configContent}" >> ${shellConfigFile}`);
        process.env.OLLAMA_MODELS = save_path;
        import_log.logger.info(import_public.pub.lang("macOS \u73AF\u5883\u53D8\u91CF\u8BBE\u7F6E\u6210\u529F\u3002"));
        this.killOllamaProcess("/bin/zsh");
        (0, import_child_process.execSync)("ollama serve &", { shell: "/bin/zsh" });
        import_log.logger.info(import_public.pub.lang("Ollama \u5DF2\u91CD\u65B0\u542F\u52A8\u3002"));
      } else {
        import_log.logger.info(import_public.pub.lang("\u4E0D\u652F\u6301\u7684\u64CD\u4F5C\u7CFB\u7EDF"));
        return false;
      }
      return true;
    } catch (error) {
      import_log.logger.error(import_public.pub.lang("\u8BBE\u7F6E Ollama \u6A21\u578B\u5B58\u50A8\u76EE\u5F55\u6216\u91CD\u542F\u670D\u52A1\u65F6\u51FA\u9519:"), error);
      return false;
    }
  }
  /**
   * 根据操作系统获取 Ollama 的下载信息
   * @returns {downloadUrl: string, downloadFile: string } 包含下载 URL 和文件路径的对象
   */
  async getOllamaDownloadInfo() {
    if (import_public.pub.is_windows()) {
      return {
        downloadUrl: `http://aingdesk.bt.cn/OllamaSetup.exe`,
        downloadFile: path.resolve(import_public.pub.get_resource_path(), "OllamaSetup.exe")
      };
    } else if (import_public.pub.is_mac()) {
      return {
        downloadUrl: `http://aingdesk.bt.cn/Ollama-darwin.zip`,
        downloadFile: path.resolve(import_public.pub.get_resource_path(), "ollama-darwin.zip")
      };
    } else if (import_public.pub.is_linux()) {
      let nodeUrl = await (0, import_test_node.selectFastestNode)();
      return {
        downloadUrl: `${nodeUrl}/ollama/ollama-linix-amd64.tgz`,
        downloadFile: path.resolve(import_public.pub.get_resource_path(), "ollama-linix-amd64.tgz")
      };
    }
    import_log.logger.info(import_public.pub.lang("\u4E0D\u652F\u6301\u7684\u64CD\u4F5C\u7CFB\u7EDF"));
    return { downloadUrl: "", downloadFile: "" };
  }
  /**
   * 下载完成后安装 Ollama
   * @param {string} downloadFile 下载的文件路径
   * @returns {Promise<boolean>} 安装成功返回 true，否则返回 false
   */
  async installOllamaAfterDownload(downloadFile) {
    return new Promise((resolve) => {
      const checkInstallStatus = () => {
        setTimeout(async () => {
          const version = await this.version();
          if (version.length > 0) {
            OllamaDownloadSpeed.status = 3;
            import_log.logger.info("Ollama install successify");
            import_public.pub.delete_file(downloadFile);
            resolve(true);
          } else {
            OllamaDownloadSpeed.status = -1;
            import_log.logger.error("Ollama install failed");
            resolve(false);
          }
        }, 5e3);
      };
      setTimeout(() => {
        OllamaDownloadSpeed.status = 2;
        if (import_public.pub.is_windows()) {
          (0, import_child_process.exec)('setx OLLAMA_HOST "127.0.0.1"', () => {
            (0, import_child_process.exec)(`"${downloadFile}" /SILENT /NORESTART`, (error, stdout, stderr) => {
              if (error) {
                import_log.logger.error(`ollama install error: ${error.message}`);
                resolve(false);
              }
              if (stderr) {
                import_log.logger.error(`ollama install stderr: ${stderr}`);
                resolve(false);
              }
              if (stdout) {
                import_log.logger.info(`ollama install stdout: ${stdout}`);
              }
              OllamaDownloadSpeed = {
                total: 0,
                completed: 0,
                speed: 0,
                progress: 0,
                status: 0
              };
              checkInstallStatus();
            });
          });
        } else if (import_public.pub.is_mac()) {
          try {
            import_public.pub.exec_shell(`unzip -o ${downloadFile} -d /Applications`);
            import_public.pub.exec_shell("open /Applications/Ollama.app");
            if (import_public.pub.file_exists("/Applications/Ollama.app")) {
              checkInstallStatus();
            }
          } catch (error) {
            import_log.logger.error("Error during Ollama DMG installation:", error);
            resolve(false);
          }
        } else if (import_public.pub.is_linux()) {
          try {
            import_public.pub.exec_shell(`tar -xzf ${downloadFile} -C /usr/local`);
            const shellConfigFile = "/etc/systemd/system/ollama.service";
            const currentUser = import_public.pub.exec_shell("whoami").trim();
            const shellConfigContent = `[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/local/ollama serve
User=${currentUser}
Group=${currentUser}
Restart=always
RestartSec=3
Environment="PATH=$PATH"

[Install]
WantedBy=default.target
`;
            import_public.pub.write_file(shellConfigFile, shellConfigContent);
            import_public.pub.exec_shell("systemctl daemon-reload");
            import_public.pub.exec_shell("systemctl enable ollama");
            import_public.pub.exec_shell("systemctl start ollama");
            checkInstallStatus();
          } catch (error) {
            import_log.logger.error("Error during Ollama Linux installation:", error);
            resolve(false);
          }
        }
      }, 4e3);
    });
  }
  /**
   * 结束 Ollama 进程
   * @param {string} shell 要使用的 shell 类型
   */
  killOllamaProcess(shell) {
    try {
      if (import_public.pub.is_windows()) {
        (0, import_child_process.execSync)('taskkill /F /IM "ollama app.exe"', { shell });
        (0, import_child_process.execSync)('taskkill /F /IM "ollama.exe"', { shell });
      } else {
        (0, import_child_process.execSync)("pkill -f ollama", { shell });
      }
      import_log.logger.info(import_public.pub.lang("Ollama \u8FDB\u7A0B\u5DF2\u7ED3\u675F\u3002"));
    } catch (killError) {
      import_log.logger.warn(import_public.pub.lang("\u7ED3\u675F Ollama \u8FDB\u7A0B\u65F6\u53EF\u80FD\u672A\u627E\u5230\u8FDB\u7A0B:"), killError.message);
    }
  }
  async test_ollama_host(ollamaHost) {
    try {
      let url = `${ollamaHost}/api/version`;
      let res = await import_public.pub.httpRequest(url, {
        timeout: 1e3,
        method: "GET",
        json: true
      });
      return res.statusCode === 200;
    } catch (e) {
      import_log.logger.error("Get ollama version error:", e);
      return false;
    }
  }
  /**
   * 设置ollama地址和密钥
   * @param {string} ollamaHost - ollama地址
   * @returns {Promise<boolean>} 设置成功返回 true，否则返回 false
   */
  async set_ollama_host(ollamaHost) {
    if (await this.test_ollama_host(ollamaHost)) {
      import_public.pub.C("ollama_host", ollamaHost);
      return true;
    }
    return false;
  }
}
OllamaService.toString = () => "[class OllamaService]";
const ollamaService = new OllamaService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OllamaService,
  ollamaService
});
