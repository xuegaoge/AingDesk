var import_ee_core = require("ee-core");
var import_lifecycle = require("./preload/lifecycle");
var import_preload = require("./preload");
var import_total = require("./service/total");
var import_log = require("ee-core/log");
const app = new import_ee_core.ElectronEgg();
const life = new import_lifecycle.Lifecycle();
app.register("ready", life.ready);
app.register("electron-app-ready", life.electronAppReady);
app.register("window-ready", life.windowReady);
app.register("before-close", life.beforeClose);
app.register("preload", import_preload.preload);
setTimeout(() => {
  const { shareService } = require("./service/share");
  const { mcpService } = require("./service/mcp");
  const shareIdPrefix = shareService.generateUniquePrefix();
  let socket = shareService.connectToCloudServer(shareIdPrefix);
  shareService.startReconnect(socket, shareIdPrefix);
  import_log.logger.info("[Startup] Initializing RagTask... (v2)");
  try {
    const { RagTask } = require("./rag/rag_task");
    let ragTaskObj = new RagTask();
    import_log.logger.info("[Startup] RagTask initialized. Starting parseTask...");
    ragTaskObj.parseTask();
    import_log.logger.info("[Startup] Starting switchToCosineIndex... (SKIPPED)");
    import_log.logger.info("[Startup] RagTask setup complete.");
  } catch (error) {
    import_log.logger.error("[Startup] Error in RagTask initialization:", error);
  }
  mcpService.sync_cloud_mcp();
}, 1e3);
import_total.totalService.start();
app.run();
