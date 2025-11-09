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
var os_exports = {};
__export(os_exports, {
  default: () => os_default
});
module.exports = __toCommonJS(os_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_electron = require("electron");
var import_window = require("../service/os/window");
class OsController {
  /**
   * All methods receive two parameters
   * @param args Parameters transmitted by the frontend
   * @param event - Event are only available during IPC communication. For details, please refer to the controller documentation
   */
  /**
   * Message prompt dialog box
   */
  messageShow() {
    import_electron.dialog.showMessageBoxSync({
      type: "info",
      // "none", "info", "error", "question" 或者 "warning"
      title: "Custom Title",
      message: "Customize message content",
      detail: "Other additional information"
    });
    return "Opened the message box";
  }
  /**
   * Message prompt and confirmation dialog box
   */
  messageShowConfirm() {
    const res = import_electron.dialog.showMessageBoxSync({
      type: "info",
      title: "Custom Title",
      message: "Customize message content",
      detail: "Other additional information",
      cancelId: 1,
      // Index of buttons used to cancel dialog boxes
      defaultId: 0,
      // Set default selected button
      buttons: ["confirm", "cancel"]
    });
    let data = res === 0 ? "click the confirm button" : "click the cancel button";
    return data;
  }
  /**
   * Select Directory
   */
  selectFolder() {
    const filePaths = import_electron.dialog.showOpenDialogSync({
      properties: ["openDirectory", "createDirectory"]
    });
    if (!filePaths) {
      return "";
    }
    return filePaths[0];
  }
  /**
   * open directory
   */
  openDirectory(args) {
    const { id } = args;
    if (!id) {
      return false;
    }
    let dir = "";
    if (import_path.default.isAbsolute(id)) {
      dir = id;
    } else {
      dir = import_electron.app.getPath(id);
    }
    import_electron.shell.openPath(dir);
    return true;
  }
  /**
   * Select Picture
   */
  selectPic() {
    const filePaths = import_electron.dialog.showOpenDialogSync({
      title: "select pic",
      properties: ["openFile"],
      filters: [
        { name: "Images", extensions: ["jpg", "png", "gif"] }
      ]
    });
    if (!filePaths) {
      return null;
    }
    try {
      const data = import_fs.default.readFileSync(filePaths[0]);
      const pic = "data:image/jpeg;base64," + data.toString("base64");
      return pic;
    } catch (err) {
      console.error(err);
      return null;
    }
  }
  /**
   * Open a new window
   */
  createWindow(args) {
    const wcid = import_window.windowService.createWindow(args);
    return wcid;
  }
  /**
   * Get Window contents id
   */
  getWCid(args) {
    const wcid = import_window.windowService.getWCid(args);
    return wcid;
  }
  /**
   * Realize communication between two windows through the transfer of the main process
   */
  window1ToWindow2(args) {
    import_window.windowService.communicate(args);
    return;
  }
  /**
   * Realize communication between two windows through the transfer of the main process
   */
  window2ToWindow1(args) {
    import_window.windowService.communicate(args);
    return;
  }
  /**
   * Create system notifications
   */
  sendNotification(args, event) {
    const { title, subtitle, body, silent } = args;
    const options = {};
    if (title) {
      options.title = title;
    }
    if (subtitle) {
      options.subtitle = subtitle;
    }
    if (body) {
      options.body = body;
    }
    if (silent !== void 0) {
      options.silent = silent;
    }
    import_window.windowService.createNotification(options, event);
    return true;
  }
}
OsController.toString = () => "[class OsController]";
var os_default = OsController;
