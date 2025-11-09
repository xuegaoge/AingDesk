var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var auto_updater_exports = {};
__export(auto_updater_exports, {
  AutoUpdaterService: () => AutoUpdaterService,
  autoUpdaterService: () => autoUpdaterService
});
module.exports = __toCommonJS(auto_updater_exports);
var import_electron = require("electron");
var import_electron_updater = require("electron-updater");
var import_utils = require("ee-core/utils");
var import_log = require("ee-core/log");
var import_public = require("../../class/public");
var import_electron2 = require("ee-core/electron");
class AutoUpdaterService {
  config;
  constructor() {
    this.config = {
      windows: true,
      macOS: true,
      linux: true,
      options: {
        provider: "generic",
        url: "https://aingdesk.bt.cn/"
      },
      force: true
    };
  }
  create() {
    import_log.logger.info("[autoUpdater] load");
    const cfg = this.config;
    if (import_utils.is.windows() && cfg.windows || import_utils.is.macOS() && cfg.macOS || import_utils.is.linux() && cfg.linux) {
    } else {
      return;
    }
    if (cfg.force) {
      this.checkUpdate();
    }
    const status = {
      error: -1,
      available: 1,
      noAvailable: 2,
      downloading: 3,
      downloaded: 4
    };
    const version = import_electron.app.getVersion();
    import_log.logger.info("[autoUpdater] current version: ", version);
    let server = cfg.options.url;
    let lastChar = server.substring(server.length - 1);
    server = lastChar === "/" ? server : server + "/";
    import_log.logger.info("[autoUpdater] server: ", server);
    cfg.options.url = server;
    import_electron_updater.autoUpdater.forceDevUpdateConfig = true;
    import_electron_updater.autoUpdater.autoDownload = cfg.force ? true : false;
    try {
      import_electron_updater.autoUpdater.setFeedURL(cfg.options);
    } catch (error) {
      import_log.logger.error("[autoUpdater] setFeedURL error : ", error);
    }
    import_electron_updater.autoUpdater.on("checking-for-update", () => {
      this.sendStatusToWindow(import_public.pub.lang("\u6B63\u5728\u68C0\u67E5\u66F4\u65B0..."));
    });
    import_electron_updater.autoUpdater.on("update-available", (info) => {
      this.sendStatusToWindow(info);
    });
    import_electron_updater.autoUpdater.on("update-not-available", (info) => {
      this.sendStatusToWindow(info);
    });
    import_electron_updater.autoUpdater.on("error", (err) => {
      let info = {
        status: status.error,
        desc: err
      };
      this.sendStatusToWindow(info);
    });
    import_electron_updater.autoUpdater.on("download-progress", (progressObj) => {
      let percentNumber = progressObj.percent;
      let totalSize = this.bytesChange(progressObj.total);
      let transferredSize = this.bytesChange(progressObj.transferred);
      let text = import_public.pub.lang("\u5DF2\u4E0B\u8F7D ") + percentNumber + "%";
      text = text + " (" + transferredSize + "/" + totalSize + ")";
      let info = {
        status: status.downloading,
        desc: text,
        percentNumber,
        totalSize,
        transferredSize
      };
      import_log.logger.info("[addon:autoUpdater] progress: ", text);
      this.sendStatusToWindow(info);
    });
    import_electron_updater.autoUpdater.on("update-downloaded", (info) => {
      this.sendStatusToWindow(info);
      (0, import_electron2.setCloseAndQuit)(true);
      import_electron_updater.autoUpdater.quitAndInstall();
    });
  }
  /**
   * 检查更新
   */
  checkUpdate() {
    import_electron_updater.autoUpdater.checkForUpdates();
  }
  /**
   * 下载更新
   */
  download() {
    import_electron_updater.autoUpdater.downloadUpdate();
  }
  /**
   * 向前端发消息
   */
  sendStatusToWindow(content = {}) {
    const textJson = JSON.stringify(content);
    const channel = "custom/app/updater";
    const win = (0, import_electron2.getMainWindow)();
    import_log.logger.info("[addon:autoUpdater] sendStatusToWindow: ", textJson);
    win.webContents.send(channel, textJson);
  }
  /**
   * 单位转换
   */
  bytesChange(limit) {
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
    if (dou == "00") {
      return sizeStr.substring(0, index) + sizeStr.substring(index + 3, index + 5);
    }
    return size;
  }
}
AutoUpdaterService.toString = () => "[class AutoUpdaterService]";
const autoUpdaterService = new AutoUpdaterService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AutoUpdaterService,
  autoUpdaterService
});
