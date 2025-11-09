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
var tray_exports = {};
__export(tray_exports, {
  trayService: () => trayService
});
module.exports = __toCommonJS(tray_exports);
var import_electron = require("electron");
var import_path = __toESM(require("path"));
var import_ps = require("ee-core/ps");
var import_log = require("ee-core/log");
var import_electron2 = require("electron");
var import_electron3 = require("ee-core/electron");
var import_public = require("../../class/public");
class TrayService {
  tray;
  config;
  constructor() {
    this.tray = null;
    this.config = {
      title: "AingDesk",
      icon: "/public/images/tray.png"
    };
  }
  /**
   * Create the tray icon
   */
  create() {
    import_log.logger.info("[tray] load");
    const cfg = this.config;
    const mainWindow = (0, import_electron3.getMainWindow)();
    const iconPath = import_path.default.join((0, import_ps.getBaseDir)(), cfg.icon);
    const trayMenuTemplate = [
      {
        label: import_public.pub.lang("\u663E\u793A"),
        click: function() {
          mainWindow.show();
        }
      },
      {
        label: import_public.pub.lang("\u9000\u51FA"),
        click: function() {
          import_electron2.app.quit();
        }
      }
    ];
    mainWindow.on("close", (event) => {
      import_electron2.app.quit();
    });
    this.tray = new import_electron.Tray(iconPath);
    this.tray.setToolTip(cfg.title);
    const contextMenu = import_electron.Menu.buildFromTemplate(trayMenuTemplate);
    this.tray.setContextMenu(contextMenu);
    this.tray.on("click", () => {
      mainWindow.show();
    });
  }
}
TrayService.toString = () => "[class TrayService]";
const trayService = new TrayService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  trayService
});
