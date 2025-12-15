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
var import_public = require("../class/public");
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
      port: 7071,
      filterRequest: {
        uris: ["", "favicon.ico", "index.html"],
        returnData: "OK"
      },
      koaConfig: {
        preMiddleware: [
          () => async (ctx, next) => {
            try {
              const method = ctx.method;
              const uriPath = (ctx.path || "").replace(/^\//, "");
              if (method === "GET") {
                if (uriPath === "index/get_version") {
                  ctx.status = 200;
                  ctx.body = import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), { version: import_public.pub.version() });
                  return;
                }
                if (uriPath === "index/get_languages") {
                  const settingsFilePath = import_path.default.resolve(import_public.pub.get_language_path(), "settings.json");
                  let fileContent = import_public.pub.read_file(settingsFilePath);
                  if (!fileContent) {
                    fileContent = `[{"name":"zh","google":"zh-cn","title":"\u7B80\u4F53\u4E2D\u6587","cn":"\u7B80\u4F53\u4E2D\u6587"},{"name":"en","google":"en","title":"English","cn":"\u82F1\u8BED"}]`;
                  }
                  const currentLanguage = import_public.pub.get_language();
                  const languages = JSON.parse(fileContent);
                  ctx.status = 200;
                  ctx.body = import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), { languages, current: currentLanguage });
                  return;
                }
                if (uriPath === "index/get_server_language") {
                  const currentLanguage = import_public.pub.get_language();
                  const languageFilePath = import_path.default.resolve(import_public.pub.get_language_path(), `${currentLanguage}/server.json`);
                  const filePath = import_public.pub.is_file(languageFilePath) ? languageFilePath : import_path.default.resolve(import_public.pub.get_language_path(), `zh/server.json`);
                  let fileContent = import_public.pub.read_file(filePath);
                  if (!fileContent) fileContent = "{}";
                  const languagePack = JSON.parse(fileContent);
                  ctx.status = 200;
                  ctx.body = import_public.pub.return_success(languagePack, null);
                  return;
                }
                if (uriPath === "index/get_data_save_path") {
                  const savePathConfigFile = import_path.default.resolve(import_public.pub.get_system_data_path(), "save_path.json");
                  if (!import_public.pub.file_exists(savePathConfigFile)) {
                    const currentPath = import_public.pub.get_data_path();
                    const config2 = { oldPath: "", currentPath, isMove: false, isMoveSuccess: false, isClearOldPath: false, dataSize: 0, copyStatus: { status: 0, speed: 0, total: 0, current: 0, percent: 0, startTime: 0, endTime: 0, fileTotal: 0, fileCurrent: 0, message: "", error: "" } };
                    import_public.pub.write_json(savePathConfigFile, config2);
                  }
                  const savePathConfig = import_public.pub.read_json(savePathConfigFile);
                  ctx.status = 200;
                  ctx.body = import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), savePathConfig);
                  return;
                }
              }
            } catch (e) {
            }
            await next();
          }
        ]
      }
    },
    mainServer: {
      indexPath: "/public/dist/index.html",
      channelSeparator: "/"
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
