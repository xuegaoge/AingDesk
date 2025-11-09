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
var security_exports = {};
__export(security_exports, {
  SecurityService: () => SecurityService,
  securityService: () => securityService
});
module.exports = __toCommonJS(security_exports);
var import_log = require("ee-core/log");
var import_electron = require("electron");
class SecurityService {
  /**
   * Create and configure the security service
   */
  create() {
    import_log.logger.info("[security] load");
    const runWithDebug = process.argv.find((e) => {
      const isHasDebug = e.includes("--inspect") || e.includes("--inspect-brk") || e.includes("--remote-debugging-port");
      return isHasDebug;
    });
    if (runWithDebug) {
      import_log.logger.error("[error] Remote debugging is not allowed, runWithDebug:", runWithDebug);
      import_electron.app.quit();
    }
  }
}
SecurityService.toString = () => "[class SecurityService]";
const securityService = new SecurityService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SecurityService,
  securityService
});
