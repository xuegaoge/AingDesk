var import_electron = require("electron");
const ele = {
  ipcRenderer: import_electron.ipcRenderer
};
import_electron.contextBridge.exposeInMainWorld("electron", ele);
