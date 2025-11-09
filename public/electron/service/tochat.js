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
var tochat_exports = {};
__export(tochat_exports, {
  ContextStatusMap: () => ContextStatusMap,
  ModelListInfo: () => ModelListInfo,
  ToChatService: () => ToChatService,
  clearModelListInfo: () => clearModelListInfo
});
module.exports = __toCommonJS(tochat_exports);
var import_log = require("ee-core/log");
var import_public = require("../class/public");
var path = __toESM(require("path"));
var import_agent = require("./agent");
var import_model = require("../service/model");
var import_search = require("../search_engines/search");
var import_rag = require("../rag/rag");
var import_stream = require("stream");
var import_mcp_client = require("./mcp_client");
var import_chat = require("./chat");
let ModelListInfo = [];
let ContextStatusMap = /* @__PURE__ */ new Map();
const clearModelListInfo = () => {
  ModelListInfo = [];
};
const getModelInfo = (model) => {
  const foundInfo = ModelListInfo.find((info) => info.model === model);
  return foundInfo || {
    title: model,
    supplierName: "ollama",
    model,
    size: 0,
    contextLength: (0, import_model.getModelContextLength)(model)
  };
};
const checkIsVisionModel = async (supplierName, model) => {
  const modelLower = model.toLocaleLowerCase();
  if (modelLower.indexOf("vision") !== -1) {
    return true;
  }
  if (supplierName !== "ollama") {
    if (modelLower.indexOf("-vl") !== -1) return true;
    return false;
  }
  try {
    const modelListFile = path.resolve(import_public.pub.get_resource_path(), "ollama_model.json");
    if (!import_public.pub.file_exists(modelListFile)) {
      import_log.logger.warn("\u6A21\u578B\u5217\u8868\u6587\u4EF6\u4E0D\u5B58\u5728:", modelListFile);
      return false;
    }
    const modelList = import_public.pub.read_json(modelListFile);
    if (!Array.isArray(modelList)) {
      import_log.logger.warn("\u6A21\u578B\u5217\u8868\u683C\u5F0F\u4E0D\u6B63\u786E");
      return false;
    }
    return modelList.some((modelInfo) => {
      return (modelInfo.name === model || modelInfo.full_name === model) && modelInfo.capability && Array.isArray(modelInfo.capability) && modelInfo.capability.includes("vision");
    });
  } catch (error) {
    import_log.logger.error("\u68C0\u67E5\u6A21\u578B\u89C6\u89C9\u80FD\u529B\u65F6\u51FA\u9519:", error);
    return false;
  }
};
const saveChatHistory = async (uuid, resUUID, chatHistoryRes) => {
  const key = "\n</think>\n";
  if (chatHistoryRes.content.indexOf(key) !== -1) {
    const spArr = chatHistoryRes.content.split(key);
    chatHistoryRes.reasoning = spArr[0] + key;
    chatHistoryRes.content = spArr[1];
  }
  const chatService = new import_chat.ChatService();
  await chatService.set_chat_history(uuid, resUUID, chatHistoryRes);
};
const handleRag = async (args, chatService, history, chatHistoryRes, contextInfo, supplierName, modelStr, user_content, rag_results) => {
  if (args.rag_list) {
    const ragList = JSON.parse(args.rag_list);
    await chatService.update_chat_config(args.context_id, "rag_list", ragList);
    if (ragList.length > 0) {
      const { userPrompt, systemPrompt, searchResultList, query } = await new import_rag.Rag().searchAndSuggest(supplierName, modelStr, user_content, history[history.length - 1].doc_files, contextInfo.agent_name, rag_results, ragList);
      chatHistoryRes.search_query = query;
      chatHistoryRes.search_type = "[RAG]:" + ragList.join(",");
      chatHistoryRes.search_result = searchResultList;
      if (searchResultList.length > 0 && systemPrompt) {
        history.unshift({
          role: "system",
          content: systemPrompt
        });
      }
      if (userPrompt) {
        history[history.length - 1].content = userPrompt;
      }
      if (searchResultList.length > 0) {
        args.search = "";
      }
    }
  }
  return args.search;
};
const handleSearch = async (args, chatService, history, chatHistoryRes, contextInfo, supplierName, modelStr, user_content, search_results) => {
  if (args.search) {
    let lastHistory = "";
    if (history.length > 2) {
      lastHistory += import_public.pub.lang("\u95EE\u9898: ") + history[history.length - 3].content + "\n";
      lastHistory += import_public.pub.lang("\u56DE\u7B54: ") + history[history.length - 2].content + "\n";
    }
    const { userPrompt, systemPrompt, searchResultList, query } = await (0, import_search.getPromptForWeb)(user_content, modelStr, lastHistory, history[history.length - 1].doc_files, contextInfo.agent_name, search_results, args.search);
    chatHistoryRes.search_query = query;
    chatHistoryRes.search_type = args.search;
    chatHistoryRes.search_result = searchResultList;
    if (systemPrompt && searchResultList.length > 0) {
      history.unshift({
        role: "system",
        content: systemPrompt
      });
    }
    if (userPrompt) {
      history[history.length - 1].content = userPrompt;
    }
  }
};
const handleDocuments = (letHistory, modelName, user_content) => {
  if (letHistory.content === user_content && letHistory.doc_files.length > 0) {
    if (modelName.toLocaleLowerCase().indexOf("qwen") === -1) {
      const doc_files_str = letHistory.doc_files.map(
        (doc_file, idx) => {
          if (!doc_file) return "";
          return `[${import_public.pub.lang("\u7528\u6237\u6587\u6863")} ${idx + 1} begin]
            ${import_public.pub.lang("\u5185\u5BB9")}: ${doc_file}
            [${import_public.pub.lang("\u7528\u6237\u6587\u6863")} ${idx} end]`;
        }
      ).join("\n");
      letHistory.content = `## ${import_public.pub.lang("\u4EE5\u4E0B\u662F\u7528\u6237\u4E0A\u4F20\u7684\u6587\u6863\u5185\u5BB9\uFF0C\u6BCF\u4E2A\u6587\u6863\u5185\u5BB9\u90FD\u662F[\u7528\u6237\u6587\u6863 X begin]...[\u7528\u6237\u6587\u6863 X end]\u683C\u5F0F\u7684\uFF0C\u4F60\u53EF\u4EE5\u6839\u636E\u9700\u8981\u9009\u62E9\u5176\u4E2D\u7684\u5185\u5BB9\u3002")}
<doc_files>
${doc_files_str}
</doc_files>
## ${import_public.pub.lang("\u7528\u6237\u8F93\u5165\u7684\u5185\u5BB9")}:
${user_content}`;
    } else {
      const doc_files_str = letHistory.doc_files.map(
        (doc_file, idx) => {
          if (!doc_file) return "";
          return `${import_public.pub.lang("\u7528\u6237\u6587\u6863")} ${idx + 1} begin
${doc_file}
${import_public.pub.lang("\u7528\u6237\u6587\u6863")} ${idx + 1} end
`;
        }
      ).join("\n");
      letHistory.content += "\n\n" + doc_files_str;
    }
  }
};
const handleImages = (letHistory, isVision) => {
  if (!isVision && letHistory.images.length > 0) {
    const ocrContent = letHistory.images.map((image, idx) => {
      if (!image) return "";
      return `${import_public.pub.lang("\u56FE\u7247")} ${idx + 1} ${import_public.pub.lang("OCR\u89E3\u6790\u7ED3\u679C")} begin
${image}
${import_public.pub.lang("\u56FE\u7247")} ${idx + 1} ${import_public.pub.lang("OCR\u89E3\u6790\u7ED3\u679C")} end
`;
    }).join("\n");
    letHistory.content += "\n\n" + ocrContent;
  }
};
const handleNonOllamaImages = (letHistory) => {
  if (letHistory.images && letHistory.images.length > 0) {
    const content = [];
    content.push({ type: "text", text: letHistory.content });
    for (const image of letHistory.images) {
      content.push({ type: "image_url", image_url: { url: image } });
    }
    letHistory.content = content;
  }
  if (letHistory.images) delete letHistory.images;
};
const handleOllamaImages = (letHistory) => {
  if (letHistory.images && letHistory.images.length > 0) {
    const images = [];
    for (const image of letHistory.images) {
      const imgArr = image.split(",");
      if (imgArr.length > 1) {
        images.push(imgArr[1]);
      }
    }
    letHistory.images = images;
  }
};
const calculateContextLength = (history) => {
  let contextLength = 0;
  for (const message of history) {
    contextLength += message.content.length;
  }
  return contextLength;
};
const formatDate = (timestamp) => {
  if (typeof timestamp !== "number") {
    return timestamp;
  }
  const date = new Date(timestamp * 1e3);
  return date.toISOString();
};
const getResponseInfo = (chunk, isOllama, modelStr, resTimeMs) => {
  if (isOllama) {
    return {
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
    const nowTime = import_public.pub.time();
    return {
      model: modelStr,
      created_at: formatDate(chunk.created),
      total_duration: nowTime - chunk.created,
      load_duration: 0,
      prompt_eval_count: chunk.usage?.prompt_tokens || 0,
      prompt_eval_duration: chunk.created * 1e3 - resTimeMs,
      eval_count: chunk.usage?.completion_tokens || 0,
      eval_duration: nowTime - resTimeMs / 1e3
    };
  }
};
class ToChatService {
  /**
   * 获取指定模型的信息
   * @param {string} model - 模型名称
   * @returns {ModelInfo} - 模型信息对象
   */
  get_model_info(model) {
    return getModelInfo(model);
  }
  /**
   * 判断是否为视觉模型
   * @param {string} supplierName - 供应商名称
   * @param {string} model - 模型名称
   * @returns {Promise<boolean>} - 是否为视觉模型
   */
  async isVisionModel(supplierName, model) {
    return checkIsVisionModel(supplierName, model);
  }
  /**
   * 保存对话内容
   * @param {string} uuid - 对话的唯一标识符
   * @param {string} resUUID - 对话的唯一标识符
   * @param {ChatHistory} chatHistoryRes - 对话历史记录
   */
  async set_chat_history(uuid, resUUID, chatHistoryRes) {
    await saveChatHistory(uuid, resUUID, chatHistoryRes);
  }
  /**
   * 确保消息格式正确
   * @param {any} messages - 消息内容
   * @returns 
   */
  formatMessage(messages) {
    const systemMessages = messages.filter((msg) => msg.role === "system");
    if (systemMessages.length > 0) {
      messages = messages.filter((msg) => msg.role !== "system");
      messages.unshift(systemMessages[0]);
    }
    const userMessages = messages.filter((msg) => msg.role === "user");
    const assistantMessages = messages.filter((msg) => msg.role === "assistant");
    const systemMessage = messages.filter((msg) => msg.role === "system")[0];
    messages = [];
    if (systemMessage) {
      messages.push(systemMessage);
    }
    let i = 0;
    while (i < userMessages.length || i < assistantMessages.length) {
      if (i < userMessages.length) {
        messages.push(userMessages[i]);
      }
      if (i < assistantMessages.length) {
        messages.push(assistantMessages[i]);
      }
      i++;
    }
    return messages;
  }
  /**
   * 开始对话
   * @param {Object} args - 对话所需的参数
   * @param {string} args.context_id - 对话的唯一标识符
   * @param {string} args.supplierName - 供应商名称
   * @param {string} args.model - 模型名称
   * @param {string} args.parameters - 模型参数
   * @param {string} args.user_content - 用户输入的内容
   * @param {string} args.search - 搜索类型
   * @param {string} args.rag_list - RAG列表
   * @param {string} args.regenerate_id - 重新生成的ID
   * @param {string} args.images - 图片列表
   * @param {string} args.doc_files - 文件列表
   * @param {string} args.temp_chat - 临时对话标志
   * @param {any} args.rag_results - RAG结果列表
   * @param {any} args.search_results - 搜索结果列表
   * @param {string} args.compare_id - 对比ID
   * @param {any} event - 事件对象，用于处理HTTP响应
   * @returns {Promise<any>} - 可读流，用于流式响应对话结果
   */
  async chat(args, event) {
    let { context_id: uuid, model: modelName, parameters, user_content, search, regenerate_id, supplierName, images, doc_files, temp_chat, rag_results, search_results, compare_id, mcp_servers } = args;
    if (!supplierName) {
      supplierName = "ollama";
    }
    const isTempChat = temp_chat === "true";
    let isOllama = supplierName === "ollama";
    let modelStr = modelName;
    if (isOllama) {
      modelStr = `${modelName}:${parameters}`;
    } else {
      parameters = supplierName;
    }
    const images_list = images ? images.split(",") : [];
    const doc_files_list = doc_files ? doc_files.split(",") : [];
    (0, import_model.setModelUsedTotal)(supplierName, modelStr);
    const chatService = new import_chat.ChatService();
    const contextInfo = await chatService.read_chat(uuid);
    const chatContext = {
      role: "user",
      content: user_content,
      images: images_list,
      doc_files: doc_files_list,
      tool_calls: ""
    };
    ContextStatusMap.set(uuid, true);
    let modelInfo = {
      title: modelName,
      supplierName,
      model: modelName,
      size: 0,
      contextLength: (0, import_model.getModelContextLength)(modelName)
    };
    if (isOllama) {
      modelInfo = this.get_model_info(modelStr);
      if (modelInfo.contextLength === 0) {
        modelInfo.contextLength = (0, import_model.getModelContextLength)(modelName);
      }
    }
    if (compare_id && regenerate_id) {
      regenerate_id = "";
    }
    await chatService.update_chat_model(uuid, modelName, parameters, supplierName);
    const isVision = await this.isVisionModel(supplierName, modelName);
    let history = await chatService.build_chat_history(uuid, chatContext, modelInfo.contextLength, isTempChat, isVision);
    const chatHistory = {
      id: "",
      compare_id,
      role: "user",
      reasoning: "",
      stat: {},
      content: user_content,
      images: images_list,
      doc_files: doc_files_list,
      tool_calls: "",
      created_at: "",
      create_time: import_public.pub.time(),
      tokens: 0,
      search_result: [],
      search_type: search,
      search_query: "",
      tools_result: []
    };
    const resUUID = import_public.pub.uuid();
    const chatHistoryRes = {
      id: resUUID,
      compare_id,
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
      search_type: search,
      search_query: "",
      tools_result: []
    };
    await chatService.save_chat_history(uuid, chatHistory, chatHistoryRes, modelInfo.contextLength, regenerate_id);
    await chatService.update_chat_config(uuid, "search_type", search);
    let isSystemPrompt = false;
    search = await handleRag(args, chatService, history, chatHistoryRes, contextInfo, supplierName, modelStr, user_content, rag_results);
    await handleSearch(args, chatService, history, chatHistoryRes, contextInfo, supplierName, modelStr, user_content, search_results);
    const letHistory = history[history.length - 1];
    if (!isSystemPrompt && history[0].role !== "system" && letHistory.content === user_content) {
      if (contextInfo.agent_name) {
        const agentConfig = import_agent.agentService.get_agent_config(contextInfo.agent_name);
        if (agentConfig && agentConfig.prompt) {
          history.unshift({
            role: "system",
            content: agentConfig.prompt
          });
        }
      }
    }
    handleDocuments(letHistory, modelName, user_content);
    handleImages(letHistory, isVision);
    if (letHistory.tool_calls !== void 0) {
      delete letHistory.tool_calls;
    }
    if (letHistory.doc_files !== void 0) {
      delete letHistory.doc_files;
    }
    if (isVision) {
      if (!isOllama) {
        handleNonOllamaImages(letHistory);
      } else {
        handleOllamaImages(letHistory);
      }
    }
    if (letHistory.images && letHistory.images.length === 0) {
      delete letHistory.images;
    }
    if (!isVision && letHistory.images) {
      delete letHistory.images;
    }
    history = this.formatMessage(history);
    const requestOption = {
      model: modelStr,
      messages: history,
      stream: true
    };
    if (isOllama) {
      const contextLength = calculateContextLength(history);
      let max_ctx = 4096;
      let min_ctx = 2048;
      const parametersNumber = Number(parameters?.replace("b", "")) || 4;
      if (parametersNumber && parametersNumber <= 4) max_ctx = 8192;
      let num_ctx = Math.max(min_ctx, Math.min(max_ctx, contextLength / 2));
      num_ctx = Math.ceil(num_ctx / min_ctx) * min_ctx;
      requestOption.options = {
        num_ctx
      };
    }
    if (modelName.indexOf("deepseek") !== -1) {
      if (isOllama) {
        requestOption.options.temperature = 0.6;
      } else {
        requestOption.temperature = 0.6;
      }
    }
    if (mcp_servers.length > 0) {
      isOllama = false;
    }
    event.response.set("Content-Type", "text/event-stream;charset=utf-8");
    event.response.set("Connection", "keep-alive");
    event.response.status = 200;
    const s = new import_stream.Stream.Readable({
      read() {
      }
    });
    const PushOther = async (msg) => {
      if (msg) {
        s.push(msg);
        if (msg.indexOf("<mcptool>") !== -1) {
          chatHistoryRes.tools_result.push(msg);
        }
      }
    };
    let res;
    chatHistoryRes.content = "";
    let resTimeMs = 0;
    let isThinking = false;
    let isThinkingEnd = false;
    const ResEvent = async (chunk) => {
      if (!isOllama) resTimeMs = (/* @__PURE__ */ new Date()).getTime();
      if (chunk.choices && chunk.choices.length === 0) {
        return;
      }
      if (isOllama && chunk.done || !isOllama && (chunk.choices[0].finish_reason === "stop" || chunk.choices[0].finish_reason === "normal")) {
        const resInfo = getResponseInfo(chunk, isOllama, modelStr, resTimeMs);
        chatHistoryRes.created_at = chunk.created_at ? chunk.created_at.toString() : chunk.created;
        chatHistoryRes.create_time = chunk.created ? chunk.created : import_public.pub.time();
        chatHistoryRes.stat = resInfo;
        if (!isOllama) {
          chatHistoryRes.content += chunk.choices[0]?.delta?.content || "";
          s.push(chunk.choices[0]?.delta?.content || "");
        }
        s.push(null);
        await this.set_chat_history(uuid, resUUID, chatHistoryRes);
        return false;
      }
      if (isOllama) {
        s.push(chunk.message.content);
        chatHistoryRes.content += chunk.message.content;
      } else {
        if (chunk.choices[0]?.delta?.reasoning_content) {
          let reasoningContent = chunk.choices[0]?.delta?.reasoning_content || "";
          if (!isThinking) {
            isThinking = true;
            if (reasoningContent.indexOf("<think>") === -1) {
              s.push("\n<think>\n");
              chatHistoryRes.content += "\n<think>\n";
            }
          }
          s.push(reasoningContent);
          chatHistoryRes.content += reasoningContent;
          if (reasoningContent.indexOf("</think>") !== -1) {
            isThinkingEnd = true;
          }
        } else {
          if (isThinking) {
            isThinking = false;
            if (!isThinkingEnd) {
              s.push("\n</think>\n");
              chatHistoryRes.content += "\n</think>\n";
              isThinkingEnd = true;
            }
          }
          s.push(chunk.choices[0]?.delta?.content || "");
          chatHistoryRes.content += chunk.choices[0]?.delta?.content || "";
        }
      }
      if (!ContextStatusMap.get(uuid)) {
        try {
          if (isOllama) res.abort();
        } catch (error) {
          import_log.logger.error("Abort error:", error.message);
        }
        const endContent = import_public.pub.lang("\n\n---\n**\u5185\u5BB9\u4E0D\u5B8C\u6574:** \u7528\u6237\u624B\u52A8\u505C\u6B62\u751F\u6210");
        chatHistoryRes.content += endContent;
        s.push(endContent);
        s.push(null);
        await this.set_chat_history(uuid, resUUID, chatHistoryRes);
        return false;
      }
      return true;
    };
    if (mcp_servers.length > 0) {
      try {
        isOllama = false;
        const modelService = new import_model.ModelService(supplierName);
        if (modelService.connect()) {
          const openaiObj = modelService.client;
          const mcpServers = await import_mcp_client.MCPClient.getActiveServers(mcp_servers);
          const mcpClient = new import_mcp_client.MCPClient();
          await mcpClient.connectToServer(mcpServers);
          await mcpClient.processQuery(openaiObj, supplierName, modelStr, history, ResEvent, PushOther);
          await mcpClient.cleanup();
        } else {
          return import_public.pub.lang("\u6A21\u578B\u8FDE\u63A5\u5931\u8D25:{}", modelService.error);
        }
      } catch (error) {
        return import_public.pub.lang("\u51FA\u9519\u4E86: {}", error.message);
      }
    } else {
      if (isOllama) {
        try {
          const ollama = import_public.pub.init_ollama();
          res = await ollama.chat(requestOption);
        } catch (error) {
          return import_public.pub.lang("\u8C03\u7528\u6A21\u578B\u63A5\u53E3\u65F6\u51FA\u9519\u4E86: {}", error.message);
        }
      } else {
        const modelService = new import_model.ModelService(supplierName);
        try {
          res = await modelService.chat(requestOption);
        } catch (error) {
          if (error.error && error.error.message) {
            return import_public.pub.lang("\u8C03\u7528\u6A21\u578B\u63A5\u53E3\u65F6\u51FA\u9519\u4E86: {}", error.error.message);
          }
          return error;
        }
      }
      (async () => {
        for await (const chunk of res) {
          await ResEvent(chunk);
        }
      })();
    }
    return s;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ContextStatusMap,
  ModelListInfo,
  ToChatService,
  clearModelListInfo
});
