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
var config_default_exports = {};
__export(config_default_exports, {
  default: () => config_default_default
});
module.exports = __toCommonJS(config_default_exports);
var import_path = __toESM(require("path"));
var import_ps = require("ee-core/ps");
const config = () => {
  return {
    openDevTools: false,
    singleLock: true,
    windowsOption: {
      title: "AingDesk",
      width: 1440,
      height: 900,
      minWidth: 500,
      minHeight: 300,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true
      },
      frame: true,
      show: true,
      icon: import_path.default.join((0, import_ps.getBaseDir)(), "public", "images", "logo-32.png")
    },
    logger: {
      level: "INFO",
      outputJSON: false,
      appLogName: "ee.log",
      coreLogName: "ee-core.log",
      errorLogName: "ee-error.log"
    },
    remote: {
      enable: false,
      url: "http://www.bt.cn/"
    },
    socketServer: {
      enable: true,
      port: 7070,
      path: "/socket.io/",
      connectTimeout: 45e3,
      pingTimeout: 3e4,
      pingInterval: 25e3,
      maxHttpBufferSize: 1e8,
      transports: ["polling", "websocket"],
      cors: {
        origin: true
      },
      channel: "socket-channel"
    },
    httpServer: {
      enable: true,
      https: {
        enable: false,
        key: "/public/ssl/localhost+1.key",
        cert: "/public/ssl/localhost+1.pem"
      },
      host: "127.0.0.1",
      port: 7071
    },
    mainServer: {
      indexPath: "/public/dist/index.html"
    },
    loadUrl: {
      // 开发环境
      dev: `file://${import_path.default.join(__dirname, "../public/dist/index.html")}`,
      // 生产环境
      prod: `file://${import_path.default.join(__dirname, "../public/dist/index.html")}`
    }
  };
};
var config_default_default = config;
