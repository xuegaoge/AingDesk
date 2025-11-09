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
var total_exports = {};
__export(total_exports, {
  totalService: () => totalService
});
module.exports = __toCommonJS(total_exports);
var import_public = require("../class/public");
var import_https = __toESM(require("https"));
var import_querystring = __toESM(require("querystring"));
var import_log = require("ee-core/log");
class TotalService {
  apiDomain = "api.aingdesk.com";
  // 统计安装量和日活跃量
  async total() {
    let data = import_querystring.default.stringify({
      "version": import_public.pub.version(),
      // 版本号
      "os_type": import_public.pub.os_type(),
      // 操作系统类型  windows,mac,linux
      "client_id": import_public.pub.client_id()
      // 64位客户端唯一标识
    });
    let userAgent = "AingDesk/" + import_public.pub.version() + " (" + import_public.pub.os_type() + ")";
    let options = {
      hostname: this.apiDomain,
      port: 443,
      path: "/client/total",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": data.length,
        "User-Agent": userAgent
      }
    };
    let req = import_https.default.request(options, (res) => {
      res.setEncoding("utf8");
      res.on("data", (data2) => {
        let result = JSON.parse(data2);
        if (result.status === true) {
          if (result.data && result.data.shareid_prefix) {
            if (!import_public.pub.C("shareIdPrefix")) {
              import_public.pub.C("shareIdPrefix", result.data.shareid_prefix);
            }
            global.area = result.data.area;
          }
        }
      });
    });
    req.on("error", (e) => {
      import_log.logger.warn(e);
    });
    req.write(data);
    req.end();
  }
  // 启动统计服务，每天统计一次
  async start() {
    this.total();
    setInterval(() => {
      this.total();
    }, 86400);
  }
}
TotalService.toString = () => "[class TotalService]";
const totalService = new TotalService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  totalService
});
