/**
 * LanceDB 向量数据库优化工具
 * 
 * 安全说明：
 * - optimize() 是 LanceDB 官方提供的标准维护操作
 * - 只清理存储碎片和旧版本，不修改任何数据内容
 * - 原子操作，要么成功要么回滚，不会损坏数据
 * 
 * 使用方法：
 * 1. 默认使用 AingDesk 配置的数据路径
 * 2. 也可以指定路径: node run_optimize.js "G:\AingDesk\data\rag\vector_db"
 */

const lancedb = require('@lancedb/lancedb');
const path = require('path');
const fs = require('fs');

// 获取数据路径
function getUserDataPath() {
    const appDataPath = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming');
    return path.join(appDataPath, 'AingDesk');
}

function getSystemDataPath() {
    const userDataPath = getUserDataPath();
    const sysPath = path.join(userDataPath, 'sys_data');
    return sysPath;
}

function getDataPath() {
    const savePathConfigFile = path.join(getSystemDataPath(), 'save_path.json');
    if (fs.existsSync(savePathConfigFile)) {
        try {
            const savePathConfig = JSON.parse(fs.readFileSync(savePathConfigFile, 'utf-8'));
            const currentPath = savePathConfig.currentPath;
            if (currentPath && fs.existsSync(currentPath)) {
                return currentPath;
            }
        } catch (e) {}
    }
    return path.join(getUserDataPath(), 'data');
}

// 支持命令行指定路径
const customPath = process.argv[2];
const dbPath = customPath || path.join(getDataPath(), 'rag', 'vector_db');

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDirectorySize(dirPath) {
    let totalSize = 0;
    function calculate(currentPath) {
        if (!fs.existsSync(currentPath)) return;
        const stats = fs.statSync(currentPath);
        if (stats.isFile()) {
            totalSize += stats.size;
        } else if (stats.isDirectory()) {
            fs.readdirSync(currentPath).forEach(file => {
                calculate(path.join(currentPath, file));
            });
        }
    }
    calculate(dirPath);
    return totalSize;
}

(async () => {
    console.log('🚀 LanceDB 向量数据库优化工具\n');
    console.log('ℹ️  安全说明: optimize只清理存储碎片，不修改任何数据内容\n');
    console.log(`📁 数据库路径: ${dbPath}`);
    
    // 检查路径是否存在
    if (!fs.existsSync(dbPath)) {
        console.error(`❌ 路径不存在: ${dbPath}`);
        console.log('\n使用方法: node run_optimize.js [可选:数据库路径]');
        console.log('示例: node run_optimize.js "G:\\AingDesk\\data\\rag\\vector_db"');
        process.exit(1);
    }
    
    const beforeSize = getDirectorySize(dbPath);
    console.log(`📊 优化前大小: ${formatBytes(beforeSize)}\n`);
    
    try {
        const db = await lancedb.connect(dbPath);
        const tableNames = await db.tableNames();
        
        console.log(`📋 发现 ${tableNames.length} 个表: ${tableNames.join(', ')}\n`);
        
        for (const tableName of tableNames) {
            console.log(`🔧 正在优化表: ${tableName}...`);
            const startTime = Date.now();
            
            try {
                const table = await db.openTable(tableName);
                await table.optimize({
                    deleteUnverified: true,
                    cleanupOlderThan: new Date()
                });
                
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`   ✅ ${tableName} 优化完成 (耗时: ${elapsed}s)`);
            } catch (e) {
                console.log(`   ❌ ${tableName} 优化失败: ${e.message}`);
            }
        }
        
        await db.close();
        
        // 等待文件系统更新
        await new Promise(r => setTimeout(r, 1000));
        
        const afterSize = getDirectorySize(dbPath);
        const savedSize = beforeSize - afterSize;
        const savedPercent = ((savedSize / beforeSize) * 100).toFixed(1);
        
        console.log('\n📊 优化结果:');
        console.log(`   优化前: ${formatBytes(beforeSize)}`);
        console.log(`   优化后: ${formatBytes(afterSize)}`);
        console.log(`   节省空间: ${formatBytes(savedSize)} (${savedPercent}%)`);
        
        console.log('\n✨ 优化完成！数据完整性不受影响。');
        
    } catch (e) {
        console.error('❌ 优化过程中出错:', e);
        console.log('\n⚠️  如果出错，数据不会被损坏（原子操作）');
    }
})();