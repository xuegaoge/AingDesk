import path from 'path';
import { pub } from '../class/public';
import { getBaseDir } from 'ee-core/ps';
import { type AppConfig } from 'ee-core/config';

const config: () => AppConfig = () => {
  return {
    openDevTools: false,
    singleLock: true,
    windowsOption: {
      title: 'AingDesk',
      width: 1440,
      height: 900,
      minWidth: 500,
      minHeight: 300,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
      },
      frame: true,
      show: true,
      icon: path.join(getBaseDir(), 'public', 'images', 'logo-32.png'),
    },
    logger: {
      level: 'INFO',
      outputJSON: false,
      appLogName: 'ee.log',
      coreLogName: 'ee-core.log',
      errorLogName: 'ee-error.log',
    },
    remote: {
      enable: false,
      url: 'http://www.bt.cn/',
    },
    socketServer: {
      enable: true,
      port: 7070,
      path: "/socket.io/",
      connectTimeout: 45000,
      pingTimeout: 30000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e8,
      transports: ["polling", "websocket"],
      cors: {
        origin: true,
      },
      channel: 'socket-channel',
    },
    httpServer: {
      enable: true,
      https: {
        enable: false,
        key: '/public/ssl/localhost+1.key',
        cert: '/public/ssl/localhost+1.pem',
      },
      host: '127.0.0.1',
      port: 7071,
      filterRequest: {
        uris: ['', 'favicon.ico', 'index.html'],
        returnData: 'OK'
      },
      koaConfig: {
        preMiddleware: [
          () => async (ctx, next) => {
            try {
              const method = ctx.method;
              const uriPath = (ctx.path || '').replace(/^\//, '');
              if (method === 'GET') {
                if (uriPath === 'index/get_version') {
                  ctx.status = 200;
                  ctx.body = pub.return_success(pub.lang('获取成功'), { version: pub.version() });
                  return;
                }
                if (uriPath === 'index/get_languages') {
                  const settingsFilePath = path.resolve(pub.get_language_path(), 'settings.json');
                  let fileContent = pub.read_file(settingsFilePath);
                  if (!fileContent) {
                    fileContent = `[{"name":"zh","google":"zh-cn","title":"简体中文","cn":"简体中文"},{"name":"en","google":"en","title":"English","cn":"英语"}]`;
                  }
                  const currentLanguage = pub.get_language();
                  const languages = JSON.parse(fileContent);
                  ctx.status = 200;
                  ctx.body = pub.return_success(pub.lang('获取成功'), { languages, current: currentLanguage });
                  return;
                }
                if (uriPath === 'index/get_server_language') {
                  const currentLanguage = pub.get_language();
                  const languageFilePath = path.resolve(pub.get_language_path(), `${currentLanguage}/server.json`);
                  const filePath = pub.is_file(languageFilePath) ? languageFilePath : path.resolve(pub.get_language_path(), `zh/server.json`);
                  let fileContent = pub.read_file(filePath);
                  if (!fileContent) fileContent = '{}';
                  const languagePack = JSON.parse(fileContent);
                  ctx.status = 200;
                  ctx.body = pub.return_success(languagePack, null);
                  return;
                }
                if (uriPath === 'index/get_data_save_path') {
                  const savePathConfigFile = path.resolve(pub.get_system_data_path(),'save_path.json');
                  if(!pub.file_exists(savePathConfigFile)){
                    const currentPath = pub.get_data_path();
                    const config = { oldPath: '', currentPath, isMove: false, isMoveSuccess: false, isClearOldPath: false, dataSize: 0, copyStatus: { status:0, speed:0, total:0, current:0, percent:0, startTime:0, endTime:0, fileTotal:0, fileCurrent:0, message:'', error:'' } };
                    pub.write_json(savePathConfigFile,config);
                  }
                  const savePathConfig = pub.read_json(savePathConfigFile);
                  ctx.status = 200;
                  ctx.body = pub.return_success(pub.lang('获取成功'), savePathConfig);
                  return;
                }
              }
            } catch (e) {}
            await next();
          }
        ]
      }
    },
    mainServer: {
      indexPath: '/public/dist/index.html',
      channelSeparator: '/'
    },
    loadUrl: {
      // 开发环境
      dev: `file://${path.join(__dirname, '../public/dist/index.html')}`,
      // 生产环境
      prod: `file://${path.join(__dirname, '../public/dist/index.html')}`
    }
  };
};

export default config;
