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
var preload_exports = {};
__export(preload_exports, {
  preload: () => preload
});
module.exports = __toCommonJS(preload_exports);
var import_log = require("ee-core/log");
var import_tray = require("../service/os/tray");
var import_security = require("../service/os/security");
var import_auto_updater = require("../service/os/auto_updater");
var import_mcp = require("../service/mcp");
function preload() {
  import_log.logger.info("[preload] load 5");
  import_tray.trayService.create();
  import_security.securityService.create();
  import_auto_updater.autoUpdaterService.create();
  import_mcp.mcpService.install_npx();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  preload
});
