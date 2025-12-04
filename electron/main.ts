import { ElectronEgg } from 'ee-core';
import { Lifecycle } from './preload/lifecycle';
import { preload } from './preload';
import { totalService } from './service/total';
import mcp from './controller/mcp';
import { logger } from 'ee-core/log';


// New app
const app = new ElectronEgg();

// Register lifecycle
const life = new Lifecycle();
app.register("ready", life.ready);
app.register("electron-app-ready", life.electronAppReady);
app.register("window-ready", life.windowReady);
app.register("before-close", life.beforeClose);
// Register preload
app.register("preload", preload);


// Register service
setTimeout(() => {
    // 分享服务
    const { shareService } = require('./service/share');
    const {mcpService} = require('./service/mcp');
    const shareIdPrefix = shareService.generateUniquePrefix();
    let socket = shareService.connectToCloudServer(shareIdPrefix);
    shareService.startReconnect(socket,shareIdPrefix);

    // RAG后台任务
    logger.info('[Startup] Initializing RagTask... (v2)');
    try {
        const { RagTask } = require('./rag/rag_task');
        let ragTaskObj = new RagTask()
        logger.info('[Startup] RagTask initialized. Starting parseTask...');
        ragTaskObj.parseTask()
        
        // 创建索引
        logger.info('[Startup] Starting switchToCosineIndex... (SKIPPED)');
        // ragTaskObj.switchToCosineIndex()
        logger.info('[Startup] RagTask setup complete.');
    } catch (error) {
        logger.error('[Startup] Error in RagTask initialization:', error);
    }

    // 同步MCP服务器列表
    mcpService.sync_cloud_mcp()
    
}, 1000);

// 启动统计服务
totalService.start();







// Run
app.run();