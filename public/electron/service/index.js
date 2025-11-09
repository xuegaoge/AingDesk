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
var service_exports = {};
__export(service_exports, {
  IndexService: () => IndexService,
  indexService: () => indexService
});
module.exports = __toCommonJS(service_exports);
var import_public = require("../class/public");
var path = __toESM(require("path"));
var fs = __toESM(require("fs-extra"));
class IndexService {
  // 递归列出目录下所有文件
  listFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        results = results.concat(this.listFiles(filePath));
      } else {
        results.push(filePath);
      }
    }
    return results;
  }
  /**
   * 复制数据到新路径
   * @returns 
   */
  async copyDataPath() {
    if (global.isCopyDataPath) {
      return;
    }
    global.isCopyDataPath = true;
    let savePathConfigFile = path.resolve(import_public.pub.get_system_data_path(), "save_path.json");
    let savePathConfig = import_public.pub.read_json(savePathConfigFile);
    try {
      let oldPath = savePathConfig.oldPath;
      let newPath = savePathConfig.currentPath;
      savePathConfig.copyStatus.status = 1;
      savePathConfig.copyStatus.startTime = import_public.pub.time();
      savePathConfig.copyStatus.total = import_public.pub.getDirSize(oldPath);
      import_public.pub.write_json(savePathConfigFile, savePathConfig);
      let files = this.listFiles(oldPath);
      savePathConfig.copyStatus.fileTotal = files.length;
      savePathConfig.copyStatus.fileCurrent = 0;
      let lastTime = import_public.pub.time();
      let lastCurrent = 0;
      for (let filename of files) {
        let newFilename = filename.replace(oldPath, newPath);
        let dstPath = path.dirname(newFilename);
        let name = path.basename(newFilename);
        if (!import_public.pub.file_exists(dstPath)) {
          import_public.pub.mkdir(dstPath);
        }
        let fStat = import_public.pub.stat(filename);
        savePathConfig.copyStatus.fileCurrent++;
        savePathConfig.copyStatus.message = import_public.pub.lang("\u6B63\u5728\u590D\u5236\u6587\u4EF6: {}", name);
        savePathConfig.copyStatus.error = "";
        await fs.copyFile(filename, newFilename);
        savePathConfig.copyStatus.current += fStat.size;
        lastCurrent += fStat.size;
        savePathConfig.copyStatus.percent = Math.floor(savePathConfig.copyStatus.current / savePathConfig.copyStatus.total * 100);
        if (import_public.pub.time() != lastTime) {
          savePathConfig.copyStatus.speed = lastCurrent;
          lastTime = import_public.pub.time();
          lastCurrent = 0;
        }
        import_public.pub.write_json(savePathConfigFile, savePathConfig);
      }
      if (savePathConfig.oldPath != newPath && savePathConfig.oldPath) {
        if (import_public.pub.file_exists(oldPath)) {
          savePathConfig.copyStatus.message = import_public.pub.lang("\u6B63\u5728\u5220\u9664\u65E7\u6570\u636E");
          import_public.pub.write_json(savePathConfigFile, savePathConfig);
          await fs.rmdir(oldPath, { recursive: true });
          savePathConfig.isClearOldPath = true;
        }
      }
      savePathConfig.isMoveSuccess = true;
      savePathConfig.isMove = false;
      savePathConfig.copyStatus.status = 2;
      savePathConfig.copyStatus.endTime = import_public.pub.time();
      savePathConfig.copyStatus.message = import_public.pub.lang("\u590D\u5236\u5B8C\u6210");
      savePathConfig.copyStatus.error = "";
    } catch (e) {
      let rmPath = savePathConfig.currentPath;
      savePathConfig.copyStatus.status = -1;
      savePathConfig.copyStatus.message = import_public.pub.lang("\u590D\u5236\u5931\u8D25\uFF0C\u5DF2\u64A4\u56DE\u64CD\u4F5C: {}", e.message);
      savePathConfig.currentPath = savePathConfig.oldPath;
      savePathConfig.isMove = false;
      savePathConfig.oldPath = "";
      savePathConfig.isMoveSuccess = false;
      savePathConfig.copyStatus.error = e.message;
      fs.rmdir(rmPath, { recursive: true });
    } finally {
      import_public.pub.write_json(savePathConfigFile, savePathConfig);
      global.isCopyDataPath = false;
    }
  }
}
IndexService.toString = () => "[class IndexService]";
const indexService = new IndexService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  IndexService,
  indexService
});
