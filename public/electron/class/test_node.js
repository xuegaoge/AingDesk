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
var test_node_exports = {};
__export(test_node_exports, {
  selectFastestNode: () => selectFastestNode
});
module.exports = __toCommonJS(test_node_exports);
var import_http = __toESM(require("http"));
var import_https = __toESM(require("https"));
const nodes = [
  "https://dg2.bt.cn",
  "https://download.bt.cn",
  "https://ctcc1-node.bt.cn",
  "https://cmcc1-node.bt.cn",
  "https://ctcc2-node.bt.cn",
  "https://hk1-node.bt.cn",
  "https://na1-node.bt.cn",
  "https://jp1-node.bt.cn",
  "https://cf1-node.aapanel.com"
];
function testNodeDownloadSpeed(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? import_https.default : import_http.default;
    const fullUrl = url + "/ollama/test.bin";
    let startTime = Date.now();
    let downloadedBytes = 0;
    const req = protocol.get(fullUrl, (res) => {
      res.on("data", (chunk) => {
        downloadedBytes += chunk.length;
      });
      res.on("end", () => {
        if (!startTime) {
          reject(new Error("No data received"));
          return;
        }
        const endTime = Date.now();
        const elapsedTime = (endTime - startTime) / 1e3;
        const speed = downloadedBytes / elapsedTime;
        resolve(speed);
      });
    });
    req.on("error", (error) => {
      reject(error);
    });
    req.setTimeout(2e3, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}
async function selectFastestNode() {
  const promises = nodes.map((node) => {
    return testNodeDownloadSpeed(node).then((speed) => {
      return { node, speed, error: null };
    }).catch((error) => {
      return { node, speed: 0, error };
    });
  });
  return Promise.all(promises).then((results) => {
    const fastestNode = results.reduce((prev, current) => {
      return prev.speed > current.speed ? prev : current;
    });
    if (fastestNode.error) {
      return "https://download.bt.cn";
    } else {
      return fastestNode.node;
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  selectFastestNode
});
