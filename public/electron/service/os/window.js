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
var window_exports = {};
__export(window_exports, {
  WindowService: () => WindowService,
  windowService: () => windowService
});
module.exports = __toCommonJS(window_exports);
var import_path = __toESM(require("path"));
var import_electron = require("electron");
var import_electron2 = require("ee-core/electron");
var import_ps = require("ee-core/ps");
var import_config = require("ee-core/config");
var import_utils = require("ee-core/utils");
var import_log = require("ee-core/log");
class WindowService {
  myNotification;
  windows;
  constructor() {
    this.myNotification = null;
    this.windows = {};
  }
  /**
   * Create a new window
   */
  createWindow(args) {
    const { type, content, windowName, windowTitle } = args;
    let contentUrl = "";
    if (type == "html") {
      contentUrl = import_path.default.join("file://", (0, import_ps.getBaseDir)(), content);
    } else if (type == "web") {
      contentUrl = content;
    } else if (type == "vue") {
      let addr = "http://localhost:8080";
      if ((0, import_ps.isProd)()) {
        const { mainServer } = (0, import_config.getConfig)();
        if (mainServer && mainServer.protocol && (0, import_utils.isFileProtocol)(mainServer.protocol)) {
          addr = mainServer.protocol + import_path.default.join((0, import_ps.getBaseDir)(), mainServer.indexPath);
        }
      }
      contentUrl = addr + content;
    }
    import_log.logger.info("[createWindow] url: ", contentUrl);
    const opt = {
      title: windowTitle,
      x: 10,
      y: 10,
      width: 980,
      height: 650,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true
      }
    };
    const win = new import_electron.BrowserWindow(opt);
    const winContentsId = win.webContents.id;
    win.loadURL(contentUrl);
    win.webContents.openDevTools();
    this.windows[windowName] = win;
    return winContentsId;
  }
  /**
   * Get window contents id
   */
  getWCid(args) {
    const { windowName } = args;
    let win;
    if (windowName == "main") {
      win = (0, import_electron2.getMainWindow)();
    } else {
      win = this.windows[windowName];
    }
    return win.webContents.id;
  }
  /**
   * Realize communication between two windows through the transfer of the main process
   */
  communicate(args) {
    const { receiver, content } = args;
    if (receiver == "main") {
      const win = (0, import_electron2.getMainWindow)();
      win.webContents.send("controller/os/window2ToWindow1", content);
    } else if (receiver == "window2") {
      const win = this.windows[receiver];
      win.webContents.send("controller/os/window1ToWindow2", content);
    }
  }
  /**
   * createNotification
   */
  createNotification(options, event) {
    const channel = "controller/os/sendNotification";
    this.myNotification = new import_electron.Notification(options);
    if (options.clickEvent) {
      this.myNotification.on("click", () => {
        let data = {
          type: "click",
          msg: "\u60A8\u70B9\u51FB\u4E86\u901A\u77E5\u6D88\u606F"
        };
        event.reply(`${channel}`, data);
      });
    }
    if (options.closeEvent) {
      this.myNotification.on("close", () => {
        let data = {
          type: "close",
          msg: "\u60A8\u5173\u95ED\u4E86\u901A\u77E5\u6D88\u606F"
        };
        event.reply(`${channel}`, data);
      });
    }
    this.myNotification.show();
  }
}
WindowService.toString = () => "[class WindowService]";
const windowService = new WindowService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WindowService,
  windowService
});
