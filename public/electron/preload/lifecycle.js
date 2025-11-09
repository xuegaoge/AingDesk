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
var lifecycle_exports = {};
__export(lifecycle_exports, {
  Lifecycle: () => Lifecycle
});
module.exports = __toCommonJS(lifecycle_exports);
var import_log = require("ee-core/log");
var import_config = require("ee-core/config");
var import_electron = require("ee-core/electron");
var import_public = require("../class/public");
var import_menu = require("../class/menu");
let WindowSize = { size: 0, position: 0 };
class Lifecycle {
  /**
   * Core app has been loaded
   */
  async ready() {
    import_log.logger.info("[lifecycle] ready");
  }
  /**
   * Electron app is ready
   */
  async electronAppReady() {
    import_log.logger.info("[lifecycle] electron-app-ready");
  }
  /**
   * Main window has been loaded
   */
  async windowReady() {
    import_log.logger.info("[lifecycle] window-ready");
    const win = (0, import_electron.getMainWindow)();
    win.setMenu(null);
    let window = import_public.pub.C("window");
    if (window && window.size) {
      win.setSize(window.size[0], window.size[1]);
    }
    if (window && window.position) {
      win.setPosition(window.position[0], window.position[1]);
    }
    const config = (0, import_config.getConfig)();
    const { windowsOption } = config;
    if (windowsOption?.show === false) {
      win.once("ready-to-show", () => {
        win.show();
        win.focus();
      });
    }
    win.on("resize", () => {
      if (win.isFullScreen() || win.isMaximized() || win.isMinimized()) return;
      WindowSize.size = win.getSize();
      WindowSize.position = win.getPosition();
    });
    win.webContents.on("context-menu", (event, params) => {
      let menu_obj = new import_menu.ContextMenu(event, params);
      let contextMenu = menu_obj.get_context_menu();
      if (contextMenu) contextMenu.popup({ window: win });
    });
    win.webContents.on("new-window", (event, url) => {
      event.preventDefault();
      require("electron").shell.openExternal(url);
    });
    win.webContents.on("will-navigate", (event, url) => {
      event.preventDefault();
      require("electron").shell.openExternal(url);
    });
    win.webContents.setWindowOpenHandler((Details) => {
      const { url } = Details;
      if (url.startsWith("http")) {
        require("electron").shell.openExternal(url);
      } else {
        import_public.pub.openFile(decodeURIComponent(url.replace("file:///", "")));
      }
      return { action: "deny" };
    });
  }
  /**
   * Before app close
   */
  async beforeClose() {
    import_log.logger.info("[lifecycle] before-close");
    import_public.pub.C("window", WindowSize);
  }
}
Lifecycle.toString = () => "[class Lifecycle]";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Lifecycle
});
