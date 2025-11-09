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
var share_exports = {};
__export(share_exports, {
  shareService: () => shareService
});
module.exports = __toCommonJS(share_exports);
var import_fs = __toESM(require("fs"));
var import_tls = __toESM(require("tls"));
var import_public = require("../class/public");
var import_path = __toESM(require("path"));
var import_log = require("ee-core/log");
var import_share_chat = require("./share_chat");
var import_chat2 = __toESM(require("../controller/chat"));
var import_search = require("../search_engines/search");
var import_rag = require("../rag/rag");
var import_model = require("../service/model");
var import_tochat = require("./tochat");
const CLOUD_SERVER_HOST = "share.aingdesk.com";
const CLOUD_SERVER_PORT = 9999;
const HEADER_SIZE = 4;
let ContextStatusMap = /* @__PURE__ */ new Map();
class ShareService {
  // 获取对话列表
  getShareChatList(shareId) {
    const chatPath = import_path.default.resolve(import_public.pub.get_data_path(), "share", shareId, "context");
    const chatList = import_public.pub.readdir(chatPath);
    const chatHistoryList = [];
    for (const contextId of chatList) {
      const chatFilePath = import_path.default.resolve(chatPath, contextId);
      const chatConfigFile = import_path.default.resolve(chatFilePath, "config.json");
      const chatConfigBody = import_public.pub.read_file(chatConfigFile);
      if (chatConfigBody) {
        try {
          chatHistoryList.push(JSON.parse(chatConfigBody));
        } catch (error) {
          import_log.logger.error(`Failed to parse chat config file: ${chatConfigFile}`, error);
        }
      }
    }
    chatHistoryList.sort((a, b) => b.create_time - a.create_time);
    return import_public.pub.return_success("\u83B7\u53D6\u6210\u529F", chatHistoryList);
  }
  // 获取指定对话信息
  getShareChatInfo(shareId, contextId) {
    const chatPath = import_path.default.resolve(import_public.pub.get_data_path(), "share", shareId, "context", contextId);
    const chatConfigFile = import_path.default.resolve(chatPath, "config.json");
    const chatConfigBody = import_public.pub.read_file(chatConfigFile);
    const chatInfo = chatConfigBody ? JSON.parse(chatConfigBody) : null;
    if (!chatInfo) {
      return import_public.pub.return_error(import_public.pub.lang("\u83B7\u53D6\u5931\u8D25"), null);
    }
    const chatHistoryFile = import_path.default.resolve(chatPath, "history.json");
    const chatHistoryBody = import_public.pub.read_file(chatHistoryFile);
    if (chatHistoryBody) {
      try {
        chatInfo.history = JSON.parse(chatHistoryBody);
        return import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), chatInfo);
      } catch (error) {
        import_log.logger.error(`Failed to parse chat history file: ${chatHistoryFile}`, error);
        return import_public.pub.return_error(import_public.pub.lang("\u83B7\u53D6\u5931\u8D25"), null);
      }
    }
    return import_public.pub.return_error(import_public.pub.lang("\u83B7\u53D6\u5931\u8D25"), null);
  }
  // 创建新对话
  createChat(shareId, title) {
    const shareInfo = this.getShareInfo(shareId);
    if (!shareInfo) {
      return import_public.pub.return_error(import_public.pub.lang("\u5206\u4EAB ID \u4E0D\u5B58\u5728"), null);
    }
    const contextId = import_public.pub.uuid();
    const chatPath = import_path.default.resolve(import_public.pub.get_data_path(), "share", shareId, "context", contextId);
    if (!import_public.pub.file_exists(chatPath)) {
      import_public.pub.mkdir(chatPath);
    }
    const chatConfig = {
      title,
      shareId,
      contextId,
      model: shareInfo.model,
      parameters: shareInfo.parameters,
      agent_name: shareInfo.agent_name,
      create_time: import_public.pub.time(),
      update_time: import_public.pub.time()
    };
    const chatConfigFile = import_path.default.resolve(chatPath, "config.json");
    import_public.pub.write_file(chatConfigFile, JSON.stringify(chatConfig));
    return import_public.pub.return_success("\u521B\u5EFA\u6210\u529F", { shareId, contextId });
  }
  // 删除对话
  removeChat(shareId, contextId) {
    const chatPath = import_path.default.resolve(import_public.pub.get_data_path(), "share", shareId, "context", contextId);
    if (import_public.pub.file_exists(chatPath)) {
      import_public.pub.rmdir(chatPath);
    }
    return import_public.pub.return_success(import_public.pub.lang("\u5220\u9664\u6210\u529F"));
  }
  // 中断对话
  abortChat(contextId) {
    return import_public.pub.return_error(import_public.pub.lang("\u6682\u4E0D\u652F\u6301\u8FDC\u7A0B\u4E2D\u65AD"), null);
  }
  // 聊天
  async chat(conn, data, msgId) {
    let { supplierName, modelStr, content, shareInfo, contextId, search, regenerate_id, doc_files, images, rag_list, agent_name, mcp_servers } = data;
    const shareId = shareInfo.share_id;
    supplierName = supplierName || "ollama";
    doc_files = doc_files || [];
    images = images || [];
    rag_list = rag_list || [];
    agent_name = agent_name || "";
    const isOllama = supplierName === "ollama";
    const chatContext = {
      role: "user",
      content,
      images: [],
      doc_files: [],
      tool_calls: ""
    };
    const chatController = new import_chat2.default();
    const toChat = new import_tochat.ToChatService();
    let modelInfo = toChat.get_model_info(modelStr);
    if (modelInfo.contextLength === 0) {
      await chatController.get_model_list();
      modelInfo = toChat.get_model_info(modelStr);
    }
    modelInfo.contextLength = modelInfo.contextLength || 4096;
    ContextStatusMap.set(contextId, true);
    import_share_chat.shareChatService.update_chat_model(shareId, contextId, shareInfo.model, shareInfo.parameters, supplierName);
    let history = import_share_chat.shareChatService.build_chat_history(shareId, contextId, chatContext, modelInfo.contextLength);
    const chatHistory = {
      id: "",
      compare_id: "",
      role: "user",
      reasoning: "",
      stat: {},
      content,
      images: [],
      doc_files: [],
      tool_calls: "",
      created_at: "",
      create_time: import_public.pub.time(),
      tokens: 0,
      search_result: [],
      search_query: "",
      search_type: search
    };
    const resUUID = import_public.pub.uuid();
    const chatHistoryRes = {
      id: resUUID,
      compare_id: "",
      role: "assistant",
      reasoning: "",
      stat: {
        model: modelStr,
        created_at: "",
        total_duration: 0,
        load_duration: 0,
        prompt_eval_count: 0,
        prompt_eval_duration: 0,
        eval_count: 0,
        eval_duration: 0
      },
      content: "",
      images: [],
      doc_files: [],
      tool_calls: "",
      created_at: "",
      create_time: import_public.pub.time(),
      tokens: 0,
      search_result: [],
      search_query: "",
      search_type: search
    };
    import_share_chat.shareChatService.save_chat_history(shareId, contextId, chatHistory, chatHistoryRes, modelInfo.contextLength, regenerate_id);
    chatHistoryRes.content = "";
    if (rag_list) {
      import_share_chat.shareChatService.update_chat_config(shareId, contextId, "rag_list", rag_list);
      if (rag_list.length > 0) {
        let { userPrompt, systemPrompt, searchResultList, query } = await new import_rag.Rag().searchAndSuggest(supplierName, modelStr, content, history[history.length - 1].doc_files, agent_name, [], rag_list);
        chatHistoryRes.search_query = query;
        chatHistoryRes.search_type = "[RAG]:" + rag_list.join(",");
        chatHistoryRes.search_result = searchResultList;
        if (systemPrompt) {
          history.unshift({
            role: "system",
            content: systemPrompt
          });
        }
        if (userPrompt) {
          history[history.length - 1].content = userPrompt;
        }
        if (searchResultList.length > 0) {
          search = "";
        }
      }
    }
    if (search) {
      let lastHistory = "";
      if (history.length > 2) {
        lastHistory += import_public.pub.lang("\u95EE\u9898: ") + history[history.length - 3].content + "\n";
        lastHistory += import_public.pub.lang("\u56DE\u7B54:") + history[history.length - 2].content + "\n";
      }
      let { userPrompt, systemPrompt, searchResultList, query } = await (0, import_search.getPromptForWeb)(content, modelStr, lastHistory, history[history.length - 1].doc_files, agent_name, [], search);
      chatHistoryRes.search_query = query;
      chatHistoryRes.search_type = search;
      chatHistoryRes.search_result = searchResultList;
      if (systemPrompt) {
        history.unshift({
          role: "system",
          content: systemPrompt
        });
      }
      if (userPrompt) {
        history[history.length - 1].content = userPrompt;
      }
    }
    try {
      let letHistory = history[history.length - 1];
      if (letHistory.content === content && letHistory.doc_files.length > 0) {
        letHistory.content = `## ${import_public.pub.lang("\u4EE5\u4E0B\u662F\u7528\u6237\u4E0A\u4F20\u7684\u6587\u6863\u5185\u5BB9\uFF0C\u6BCF\u4E2A\u6587\u6863\u5185\u5BB9\u90FD\u662F[\u7528\u6237\u6587\u6863 X begin]...[\u7528\u6237\u6587\u6863 X end]\u683C\u5F0F\u7684\uFF0C\u4F60\u53EF\u4EE5\u6839\u636E\u9700\u8981\u9009\u62E9\u5176\u4E2D\u7684\u5185\u5BB9\u3002")}
{doc_files}
## ${import_public.pub.lang("\u7528\u6237\u8F93\u5165\u7684\u5185\u5BB9")}:{user_content}`;
        const doc_files_str = letHistory.doc_files.map(
          (doc_file, idx) => `[${import_public.pub.lang("\u7528\u6237\u6587\u6863")} ${idx + 1} begin]
${import_public.pub.lang("\u5185\u5BB9")}: ${doc_file}
[${import_public.pub.lang("\u7528\u6237\u6587\u6863")} ${idx} end]`
        ).join("\n");
        letHistory.content = letHistory.content.replace("{doc_files}", doc_files_str);
        letHistory.content = letHistory.content.replace("{user_content}", content);
      }
      if (letHistory.tool_calls !== void 0) {
        delete letHistory.tool_calls;
      }
      if (letHistory.doc_files !== void 0) {
        delete letHistory.doc_files;
      }
      if (!isOllama) {
        if (letHistory.images && letHistory.images.length > 0) {
          let content2 = [];
          content2.push({ type: "text", text: letHistory.content });
          for (let image of letHistory.images) {
            content2.push({ type: "image_url", image_url: { url: image } });
          }
        }
        if (letHistory.images) delete letHistory.images;
      } else {
        if (letHistory.images && letHistory.images.length > 0) {
          let images2 = [];
          for (let image of letHistory.images) {
            images2.push(image.split(",")[1]);
          }
          letHistory.images = images2;
        }
      }
      const requestOption = {
        model: modelStr,
        messages: history,
        stream: true
      };
      if (isOllama) {
        let modelArr = modelStr.split(":");
        let parameters = modelArr[1];
        let contextLength = 0;
        for (const message of history) {
          contextLength += message.content.length;
        }
        let max_ctx = 4096;
        let min_ctx = 2048;
        if (parameters && parameters === "1.5b") max_ctx = 8192;
        let num_ctx = Math.max(min_ctx, Math.min(max_ctx, contextLength / 2));
        num_ctx = Math.ceil(num_ctx / min_ctx) * min_ctx;
        requestOption.options = {
          num_ctx
        };
      }
      if (modelStr.indexOf("deepseek") !== -1) {
        if (isOllama) {
          requestOption.options.temperature = 0.6;
        } else {
          requestOption.temperature = 0.6;
        }
      }
      let res;
      if (isOllama) {
        const ollama = import_public.pub.init_ollama();
        res = await ollama.chat(requestOption);
      } else {
        const modelService = new import_model.ModelService(supplierName);
        try {
          res = await modelService.chat(requestOption);
        } catch (error) {
          import_log.logger.error(import_public.pub.lang("\u8C03\u7528\u6A21\u578B\u63A5\u53E3\u65F6\u51FA\u9519:"), error);
          return import_public.pub.return_error(import_public.pub.lang("\u8C03\u7528\u6A21\u578B\u63A5\u53E3\u65F6\u51FA\u9519"), error);
        }
      }
      let resTimeMs = 0;
      let isThinking = false;
      let isThinkingEnd = false;
      for await (const chunk of res) {
        if (!isOllama) resTimeMs = (/* @__PURE__ */ new Date()).getTime();
        if (isOllama && chunk.done || !isOllama && (chunk.choices[0].finish_reason === "stop" || chunk.choices[0].finish_reason === "normal")) {
          let resInfo = {};
          if (isOllama) {
            resInfo = {
              model: chunk.model,
              created_at: chunk.created_at.toString(),
              total_duration: chunk.total_duration / 1e9,
              load_duration: chunk.load_duration / 1e6,
              prompt_eval_count: chunk.prompt_eval_count,
              prompt_eval_duration: chunk.prompt_eval_duration / 1e6,
              eval_count: chunk.eval_count,
              eval_duration: chunk.eval_duration / 1e9
            };
          } else {
            let nowTime = import_public.pub.time();
            resInfo = {
              model: modelStr,
              created_at: chunk.created,
              // 对话开始时间
              total_duration: nowTime - chunk.created,
              // 总时长
              load_duration: 0,
              prompt_eval_count: chunk.usage?.prompt_tokens || 0,
              prompt_eval_duration: chunk.created * 1e3 - resTimeMs,
              eval_count: chunk.usage?.completion_tokens || 0,
              eval_duration: nowTime - resTimeMs / 1e3
            };
          }
          chatHistoryRes.created_at = chunk.created_at ? chunk.created_at.toString() : chunk.created;
          chatHistoryRes.create_time = chunk.created ? chunk.created : import_public.pub.time();
          chatHistoryRes.stat = resInfo;
          import_share_chat.shareChatService.set_chat_history(shareId, contextId, resUUID, chatHistoryRes);
          if (isOllama) {
            this.sendToServer(conn, { done: true, content: chunk.message.content }, msgId);
          } else {
            this.sendToServer(conn, { done: true, content: chunk.choices[0]?.delta?.content || "" }, msgId);
          }
          break;
        }
        if (isOllama) {
          this.sendToServer(conn, { done: false, content: chunk.message.content || "" }, msgId);
          chatHistoryRes.content += chunk.message.content;
        } else {
          if (chunk.choices[0]?.delta?.reasoning_content) {
            let reasoningContent = chunk.choices[0]?.delta?.reasoning_content || "";
            if (!isThinking) {
              isThinking = true;
              if (reasoningContent.indexOf("<think>") === -1) {
                this.sendToServer(conn, { done: false, content: "\n<think>\n" }, msgId);
                chatHistoryRes.content += "\n<think>\n";
              }
            }
            this.sendToServer(conn, { done: false, content: reasoningContent }, msgId);
            chatHistoryRes.content += reasoningContent;
            if (reasoningContent.indexOf("</think>") !== -1) {
              isThinkingEnd = true;
            }
          } else {
            if (isThinking) {
              isThinking = false;
              if (!isThinkingEnd) {
                this.sendToServer(conn, { done: false, content: "\n</think>\n" }, msgId);
                chatHistoryRes.content += "\n</think>\n";
                isThinkingEnd = true;
              }
            }
            this.sendToServer(conn, { done: false, content: chunk.choices[0]?.delta?.content || "" }, msgId);
            chatHistoryRes.content += chunk.choices[0]?.delta?.content || "";
          }
        }
        if (!ContextStatusMap.get(contextId)) {
          if (isOllama) res.abort();
          const endContent = import_public.pub.lang("\n\n---\n**\u5185\u5BB9\u4E0D\u5B8C\u6574:** \u7528\u6237\u624B\u52A8\u505C\u6B62\u751F\u6210");
          chatHistoryRes.content += endContent;
          this.sendToServer(conn, { done: true, content: endContent }, msgId);
          import_share_chat.shareChatService.set_chat_history(shareId, contextId, resUUID, chatHistoryRes);
          break;
        }
      }
    } catch (error) {
      import_log.logger.error("Error while chatting with Ollama:", error);
      this.sendToServer(conn, import_public.pub.return_error(import_public.pub.lang("\u804A\u5929\u51FA\u9519"), null), msgId);
    }
  }
  // 判断分享 ID 是否存在
  existsShareId(shareId) {
    return import_public.pub.file_exists(import_path.default.resolve(import_public.pub.get_data_path(), "share", shareId));
  }
  // 获取分享配置
  getShareInfo(shareId) {
    if (!this.existsShareId(shareId)) {
      return null;
    }
    const sharePath = import_path.default.resolve(import_public.pub.get_data_path(), "share", shareId);
    const shareConfigPath = import_path.default.resolve(sharePath, "config.json");
    const shareConfig = import_public.pub.read_file(shareConfigPath);
    if (!shareConfig) {
      return null;
    }
    try {
      return typeof shareConfig === "string" ? JSON.parse(shareConfig) : shareConfig;
    } catch (error) {
      import_log.logger.error(`Failed to parse share config file: ${shareConfigPath}`, error);
      return null;
    }
  }
  // 生成唯一的分享 ID 前缀
  generateUniquePrefix() {
    return import_public.pub.C("shareIdPrefix") || "none";
  }
  // 发送数据到云服务器
  sendToServer(conn, data, msgId) {
    let dataStr = data;
    if (typeof data == "object") {
      data.msgId = msgId;
      dataStr = JSON.stringify(data);
    }
    const header = Buffer.alloc(HEADER_SIZE);
    const bodyBuffer = Buffer.from(dataStr);
    header.writeInt32BE(bodyBuffer.length);
    conn.write(header);
    const packageSize = 4096;
    const packageCount = Math.ceil(bodyBuffer.length / packageSize);
    for (let i = 0; i < packageCount; i++) {
      const start = i * packageSize;
      const end = Math.min(start + packageSize, bodyBuffer.length);
      const packageData = bodyBuffer.slice(start, end);
      conn.write(packageData);
    }
  }
  // 处理接收到的数据
  handleReceivedData(conn, data) {
    try {
      const shareData = JSON.parse(data.toString("utf8"));
      if (!shareData.msgId) {
        return this.sendToServer(conn, import_public.pub.return_error("Unknown msgId", "Unknown msgId"), 0);
      }
      if (!shareData) {
        return this.sendToServer(conn, import_public.pub.return_error("args error", "args error"), shareData.msgId);
      }
      if (!shareData.action) {
        return this.sendToServer(conn, import_public.pub.return_error("Unknown action", "Unknown action"), shareData.msgId);
      }
      if (shareData.action === "set_share_id_prefix") {
        import_public.pub.C("shareIdPrefix", shareData.shareIdPrefix);
        return;
      }
      if (!this.existsShareId(shareData.shareId)) {
        return this.sendToServer(conn, import_public.pub.return_error("Unknown shareId", "Unknown shareId"), shareData.msgId);
      }
      const shareInfo = this.getShareInfo(shareData.shareId);
      shareInfo.supplierName = shareInfo.supplierName || "ollama";
      switch (shareData.action) {
        case "chat":
          const args = {
            supplierName: shareInfo.supplierName,
            modelStr: shareInfo.supplierName == "ollama" ? `${shareInfo.model}:${shareInfo.parameters}` : shareInfo.model,
            content: shareData.content,
            shareInfo,
            contextId: shareData.contextId,
            search: shareData.search,
            regenerate_id: shareData.regenerate_id,
            doc_files: shareData.doc_files || [],
            images: shareData.images || [],
            rag_list: shareInfo.rag_list || [],
            mcp_servers: shareInfo.mcp_servers || []
          };
          this.chat(conn, args, shareData.msgId);
          break;
        case "get_share_chat_list":
          const chatList = this.getShareChatList(shareData.shareId);
          this.sendToServer(conn, chatList, shareData.msgId);
          break;
        case "get_share_chat_info":
          if (!shareData.contextId) {
            return this.sendToServer(conn, import_public.pub.return_error("Unknown contextId", "Unknown contextId"), shareData.msgId);
          }
          const chatInfo = this.getShareChatInfo(shareData.shareId, shareData.contextId);
          this.sendToServer(conn, chatInfo, shareData.msgId);
          break;
        case "create_chat":
          if (!shareData.title) {
            return this.sendToServer(conn, import_public.pub.return_error("Unknown title", "Unknown title"), shareData.msgId);
          }
          const chatRes = this.createChat(shareData.shareId, shareData.title);
          this.sendToServer(conn, chatRes, shareData.msgId);
          break;
        case "remove_chat":
          if (!shareData.contextId) {
            return this.sendToServer(conn, import_public.pub.return_error("Unknown contextId", "Unknown contextId"), shareData.msgId);
          }
          const removeRes = this.removeChat(shareData.shareId, shareData.contextId);
          this.sendToServer(conn, removeRes, shareData.msgId);
          break;
        case "stop_generate":
          if (!shareData.contextId) {
            return this.sendToServer(conn, import_public.pub.return_error("Unknown contextId", "Unknown contextId"), shareData.msgId);
          }
          const abortRes = this.abortChat(shareData.contextId);
          this.sendToServer(conn, abortRes, shareData.msgId);
          break;
        case "modify_chat_title":
          if (!shareData.title) {
            return this.sendToServer(conn, import_public.pub.return_error("Unknown title", "Unknown title"), shareData.msgId);
          }
          if (!shareData.contextId) {
            return this.sendToServer(conn, import_public.pub.return_error("Unknown contextId", "Unknown contextId"), shareData.msgId);
          }
          import_share_chat.shareChatService.update_chat_title(shareData.shareId, shareData.contextId, shareData.title);
          this.sendToServer(conn, import_public.pub.return_success(import_public.pub.lang("\u4FEE\u6539\u6210\u529F")), shareData.msgId);
          break;
        case "get_last_chat_history":
          if (!shareData.contextId) {
            return this.sendToServer(conn, import_public.pub.return_error("Unknown contextId", "Unknown contextId"), shareData.msgId);
          }
          const lastChatHistory = import_share_chat.shareChatService.get_last_chat_history(shareData.shareId, shareData.contextId);
          this.sendToServer(conn, import_public.pub.return_success(import_public.pub.lang("\u83B7\u53D6\u6210\u529F"), lastChatHistory), shareData.msgId);
          break;
        default:
          this.sendToServer(conn, import_public.pub.return_error("Unknown action", null), shareData.msgId);
          break;
      }
    } catch (error) {
      import_log.logger.error("Error while handling received data:", error);
      this.sendToServer(conn, import_public.pub.return_error("Data parse error", "Data parse error"), 0);
    }
  }
  // 接收数据
  receiveData(conn) {
    let buffer = Buffer.alloc(0);
    let bodySize = null;
    conn.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (true) {
        if (bodySize === null) {
          if (buffer.length >= 4) {
            bodySize = buffer.readUInt32BE(0);
            buffer = buffer.slice(4);
          } else {
            break;
          }
        }
        if (bodySize !== null && buffer.length >= bodySize) {
          const body = buffer.slice(0, bodySize);
          buffer = buffer.slice(bodySize);
          this.handleReceivedData(conn, body);
          bodySize = null;
        } else {
          break;
        }
      }
    });
  }
  // 连接到云服务器
  connectToCloudServer(shareIdPrefix) {
    global.connectToCloudServer = false;
    if (import_public.pub.C("shareServiceStatus") === false) {
      return null;
    }
    const sharePath = import_path.default.resolve(import_public.pub.get_data_path(), "share");
    if (!import_public.pub.file_exists(sharePath)) {
      return null;
    }
    const shareList = import_public.pub.readdir(sharePath);
    if (!shareList || shareList.length === 0) {
      return null;
    }
    const certFile = import_path.default.resolve(import_public.pub.get_resource_path(), "cert/server.crt");
    const options = {
      host: CLOUD_SERVER_HOST,
      port: CLOUD_SERVER_PORT,
      ca: import_fs.default.readFileSync(certFile),
      rejectUnauthorized: false
      // timeout: 5000 // 5 秒超时
    };
    const socket = import_tls.default.connect(options, () => {
      import_log.logger.info("Connected to cloud server");
      this.sendToServer(socket, shareIdPrefix, 0);
    });
    socket.on("timeout", () => {
      import_log.logger.error("Connection timed out");
      socket.destroy();
    });
    if (socket) global.connectToCloudServer = true;
    this.receiveData(socket);
    socket.on("end", () => {
      import_log.logger.info("Disconnected from cloud server");
    });
    socket.on("error", (error) => {
      import_log.logger.error("Socket error:", error);
    });
    socket.on("close", (hadError) => {
      if (hadError) {
        import_log.logger.error("Socket closed with error");
      } else {
        import_log.logger.info("Socket closed normally");
      }
    });
    return socket;
  }
  // 开始重连
  startReconnect(socket, shareIdPrefix) {
    setInterval(() => {
      if (!socket || socket.destroyed) {
        socket = this.connectToCloudServer(shareIdPrefix);
      }
    }, 5e3);
  }
}
ShareService.prototype.toString = () => "[class ShareService]";
const shareService = new ShareService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  shareService
});
