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
var rag_exports = {};
__export(rag_exports, {
  Rag: () => Rag,
  getDefaultPrompt: () => getDefaultPrompt
});
module.exports = __toCommonJS(rag_exports);
var import_doc = require("./doc_engins/doc");
var import_vector_lancedb = require("./vector_database/vector_lancedb");
var path = __toESM(require("path"));
var import_public = require("../class/public");
var import_agent = require("../service/agent");
const getTemplate = (agent_name) => {
  agent_name = agent_name || "";
  let agentInfo = import_agent.agentService.get_agent_config(agent_name);
  let TEMPLATES_LANG = [
    agentInfo ? agentInfo.prompt : import_public.pub.lang("\u4EE5\u4E0B\u5185\u5BB9\u662F\u57FA\u4E8E\u7528\u6237\u53D1\u9001\u7684\u6D88\u606F\u7684\u77E5\u8BC6\u5E93\u68C0\u7D22\u7ED3\u679C"),
    import_public.pub.lang("\u5728\u6211\u7ED9\u4F60\u7684\u68C0\u7D22\u7ED3\u679C\u4E2D\uFF0C\u6BCF\u4E2A\u7ED3\u679C\u90FD\u662F[\u68C0\u7D22\u7ED3\u679C X begin]...[\u68C0\u7D22\u7ED3\u679C X end]\u683C\u5F0F\u7684\uFF0CX\u4EE3\u8868\u6BCF\u6BB5\u77E5\u8BC6\u5185\u5BB9\u7684\u7684\u6570\u5B57\u7D22\u5F15\u3002\u53E6\u5916\u68C0\u7D22\u7ED3\u679C\u4E2D\u53EF\u80FD\u5305\u542B\u4E00\u4E9B\u4E0D\u76F8\u5173\u7684\u4FE1\u606F\uFF0C\u4F60\u53EF\u4EE5\u6839\u636E\u9700\u8981\u9009\u62E9\u5176\u4E2D\u7684\u5185\u5BB9\u3002"),
    import_public.pub.lang("\u5728\u56DE\u7B54\u65F6\uFF0C\u8BF7\u6CE8\u610F\u4EE5\u4E0B\u51E0\u70B9"),
    import_public.pub.lang("\u4ECA\u5929\u662F"),
    import_public.pub.lang("\u7528\u6237\u6240\u5728\u5730\u70B9\u662F"),
    import_public.pub.lang("\u4E0D\u8981\u5728\u56DE\u7B54\u5185\u5BB9\u4E2D\u63D0\u53CA\u68C0\u7D22\u7ED3\u679C\u7684\u5177\u4F53\u6765\u6E90\uFF0C\u4E5F\u4E0D\u8981\u63D0\u53CA\u68C0\u7D22\u7ED3\u679C\u7684\u5177\u4F53\u6392\u540D\u3002"),
    import_public.pub.lang("\u5E76\u975E\u68C0\u7D22\u7ED3\u679C\u7684\u6240\u6709\u5185\u5BB9\u90FD\u4E0E\u7528\u6237\u7684\u95EE\u9898\u5BC6\u5207\u76F8\u5173\uFF0C\u4F60\u9700\u8981\u7ED3\u5408\u95EE\u9898\uFF0C\u5BF9\u68C0\u7D22\u7ED3\u679C\u8FDB\u884C\u7504\u522B\u3001\u7B5B\u9009\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5BF9\u4E8E\u5217\u4E3E\u7C7B\u7684\u95EE\u9898\uFF08\u5982\u5217\u4E3E\u6240\u6709\u822A\u73ED\u4FE1\u606F\uFF09\uFF0C\u5C3D\u91CF\u5C06\u7B54\u6848\u63A7\u5236\u572810\u4E2A\u8981\u70B9\u4EE5\u5185\uFF0C\u5E76\u544A\u8BC9\u7528\u6237\u53EF\u4EE5\u67E5\u770B\u68C0\u7D22\u6765\u6E90\u3001\u83B7\u5F97\u5B8C\u6574\u4FE1\u606F\u3002\u4F18\u5148\u63D0\u4F9B\u4FE1\u606F\u5B8C\u6574\u3001\u6700\u76F8\u5173\u7684\u5217\u4E3E\u9879\uFF1B\u5982\u975E\u5FC5\u8981\uFF0C\u4E0D\u8981\u4E3B\u52A8\u544A\u8BC9\u7528\u6237\u68C0\u7D22\u7ED3\u679C\u672A\u63D0\u4F9B\u7684\u5185\u5BB9\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5BF9\u4E8E\u521B\u4F5C\u7C7B\u7684\u95EE\u9898\uFF08\u5982\u5199\u8BBA\u6587\uFF09\uFF0C\u4F60\u9700\u8981\u89E3\u8BFB\u5E76\u6982\u62EC\u7528\u6237\u7684\u9898\u76EE\u8981\u6C42\uFF0C\u9009\u62E9\u5408\u9002\u7684\u683C\u5F0F\uFF0C\u5145\u5206\u5229\u7528\u68C0\u7D22\u7ED3\u679C\u5E76\u62BD\u53D6\u91CD\u8981\u4FE1\u606F\uFF0C\u751F\u6210\u7B26\u5408\u7528\u6237\u8981\u6C42\u3001\u6781\u5177\u601D\u60F3\u6DF1\u5EA6\u3001\u5BCC\u6709\u521B\u9020\u529B\u4E0E\u4E13\u4E1A\u6027\u7684\u7B54\u6848\u3002\u4F60\u7684\u521B\u4F5C\u7BC7\u5E45\u9700\u8981\u5C3D\u53EF\u80FD\u5EF6\u957F\uFF0C\u5BF9\u4E8E\u6BCF\u4E00\u4E2A\u8981\u70B9\u7684\u8BBA\u8FF0\u8981\u63A8\u6D4B\u7528\u6237\u7684\u610F\u56FE\uFF0C\u7ED9\u51FA\u5C3D\u53EF\u80FD\u591A\u89D2\u5EA6\u7684\u56DE\u7B54\u8981\u70B9\uFF0C\u4E14\u52A1\u5FC5\u4FE1\u606F\u91CF\u5927\u3001\u8BBA\u8FF0\u8BE6\u5C3D\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5982\u679C\u56DE\u7B54\u5F88\u957F\uFF0C\u8BF7\u5C3D\u91CF\u7ED3\u6784\u5316\u3001\u5206\u6BB5\u843D\u603B\u7ED3\u3002\u5982\u679C\u9700\u8981\u5206\u70B9\u4F5C\u7B54\uFF0C\u5C3D\u91CF\u63A7\u5236\u57285\u4E2A\u70B9\u4EE5\u5185\uFF0C\u5E76\u5408\u5E76\u76F8\u5173\u7684\u5185\u5BB9\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5BF9\u4E8E\u5BA2\u89C2\u7C7B\u7684\u95EE\u7B54\uFF0C\u5982\u679C\u95EE\u9898\u7684\u7B54\u6848\u975E\u5E38\u7B80\u77ED\uFF0C\u53EF\u4EE5\u9002\u5F53\u8865\u5145\u4E00\u5230\u4E24\u53E5\u76F8\u5173\u4FE1\u606F\uFF0C\u4EE5\u4E30\u5BCC\u5185\u5BB9\u3002"),
    import_public.pub.lang("\u4F60\u9700\u8981\u6839\u636E\u7528\u6237\u8981\u6C42\u548C\u56DE\u7B54\u5185\u5BB9\u9009\u62E9\u5408\u9002\u3001\u7F8E\u89C2\u7684\u56DE\u7B54\u683C\u5F0F\uFF0C\u786E\u4FDD\u53EF\u8BFB\u6027\u5F3A\u3002"),
    import_public.pub.lang("\u4F60\u7684\u56DE\u7B54\u5E94\u8BE5\u7EFC\u5408\u591A\u4E2A\u76F8\u5173\u77E5\u8BC6\u7247\u6BB5\u6765\u56DE\u7B54\uFF0C\u4E0D\u80FD\u91CD\u590D\u5F15\u7528\u4E00\u4E2A\u77E5\u8BC6\u7247\u6BB5\u3002"),
    import_public.pub.lang("\u9664\u975E\u7528\u6237\u8981\u6C42\uFF0C\u5426\u5219\u4F60\u56DE\u7B54\u7684\u8BED\u8A00\u9700\u8981\u548C\u7528\u6237\u63D0\u95EE\u7684\u8BED\u8A00\u4FDD\u6301\u4E00\u81F4\u3002"),
    import_public.pub.lang("\u7528\u6237\u6D88\u606F\u4E3A")
  ];
  let OTHER_SYSTEM_PROMPT_TPL_LANG = [
    agentInfo ? agentInfo.prompt : import_public.pub.lang("\u4F60\u662F\u4E00\u4E2A\u64C5\u957F\u6839\u636E\u77E5\u8BC6\u5E93\u68C0\u7D22\u7ED3\u679C\u56DE\u7B54\u7528\u6237\u67E5\u8BE2\u7684\u4EBA\u5DE5\u667A\u80FD\u6A21\u578B\u3002"),
    import_public.pub.lang("\u5728\u56DE\u7B54\u65F6\uFF0C\u8BF7\u6CE8\u610F\u4EE5\u4E0B\u51E0\u70B9"),
    import_public.pub.lang("\u6839\u636E\u63D0\u4F9B\u7684\u68C0\u7D22\u7ED3\u679C\u751F\u6210\u4FE1\u606F\u4E30\u5BCC\u4E14\u4E0E\u7528\u6237\u67E5\u8BE2\u76F8\u5173\u7684\u56DE\u7B54\uFF0C\u5982\u679C\u77E5\u8BC6\u5E93\u68C0\u7D22\u7ED3\u679C\u4E2D\u6709\u56FE\u7247\u5F15\u7528\u4FE1\u606F\uFF0C\u53EF\u6839\u636E\u9700\u8981\u5F15\u7528\u8FD9\u4E9B\u56FE\u7247\u6765\u5F3A\u5316\u5185\u5BB9\u7ED3\u6784\u3002"),
    import_public.pub.lang("\u5F53\u524D\u65E5\u671F\u548C\u65F6\u95F4\u4E3A"),
    import_public.pub.lang("\u7528\u6237\u6240\u5728\u5730\u533A\u4E3A"),
    import_public.pub.lang("\u4E0D\u8981\u63D0\u53CA\u68C0\u7D22\u7ED3\u679C\u7684\u5177\u4F53\u6392\u540D\u3002"),
    import_public.pub.lang("\u5E76\u975E\u68C0\u7D22\u7ED3\u679C\u7684\u6240\u6709\u5185\u5BB9\u90FD\u4E0E\u7528\u6237\u7684\u95EE\u9898\u5BC6\u5207\u76F8\u5173\uFF0C\u4F60\u9700\u8981\u7ED3\u5408\u7528\u6237\u7684\u610F\u56FE\uFF0C\u5BF9\u68C0\u7D22\u7ED3\u679C\u8FDB\u884C\u7504\u522B\u3001\u7B5B\u9009\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5BF9\u4E8E\u5217\u4E3E\u7C7B\u7684\u95EE\u9898\uFF08\u5982\u5217\u4E3E\u6240\u6709\u822A\u73ED\u4FE1\u606F\uFF09\uFF0C\u5C3D\u91CF\u5C06\u7B54\u6848\u63A7\u5236\u572810\u4E2A\u8981\u70B9\u4EE5\u5185\uFF0C\u5E76\u544A\u8BC9\u7528\u6237\u53EF\u4EE5\u67E5\u770B\u68C0\u7D22\u6765\u6E90\u3001\u83B7\u5F97\u5B8C\u6574\u4FE1\u606F\u3002\u4F18\u5148\u63D0\u4F9B\u4FE1\u606F\u5B8C\u6574\u3001\u6700\u76F8\u5173\u7684\u5217\u4E3E\u9879"),
    agentInfo ? "" : import_public.pub.lang("\u5BF9\u4E8E\u521B\u4F5C\u7C7B\u7684\u95EE\u9898\uFF08\u5982\u5199\u8BBA\u6587\uFF09\uFF0C\u4F60\u9700\u8981\u89E3\u8BFB\u5E76\u6982\u62EC\u7528\u6237\u7684\u9898\u76EE\u8981\u6C42\uFF0C\u9009\u62E9\u5408\u9002\u7684\u683C\u5F0F\uFF0C\u5145\u5206\u5229\u7528\u68C0\u7D22\u7ED3\u679C\u5E76\u62BD\u53D6\u91CD\u8981\u4FE1\u606F\uFF0C\u751F\u6210\u7B26\u5408\u7528\u6237\u8981\u6C42\u3001\u6781\u5177\u601D\u60F3\u6DF1\u5EA6\u3001\u5BCC\u6709\u521B\u9020\u529B\u4E0E\u4E13\u4E1A\u6027\u7684\u7B54\u6848\u3002\u4F60\u7684\u521B\u4F5C\u7BC7\u5E45\u9700\u8981\u5C3D\u53EF\u80FD\u5EF6\u957F\uFF0C\u5BF9\u4E8E\u6BCF\u4E00\u4E2A\u8981\u70B9\u7684\u8BBA\u8FF0\u8981\u63A8\u6D4B\u7528\u6237\u7684\u610F\u56FE\uFF0C\u7ED9\u51FA\u5C3D\u53EF\u80FD\u591A\u89D2\u5EA6\u7684\u56DE\u7B54\u8981\u70B9\uFF0C\u4E14\u52A1\u5FC5\u4FE1\u606F\u91CF\u5927\u3001\u8BBA\u8FF0\u8BE6\u5C3D\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5982\u679C\u56DE\u7B54\u5F88\u957F\uFF0C\u8BF7\u5C3D\u91CF\u7ED3\u6784\u5316\u3001\u5206\u6BB5\u843D\u603B\u7ED3\u3002\u5982\u679C\u9700\u8981\u5206\u70B9\u4F5C\u7B54\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5BF9\u4E8E\u5BA2\u89C2\u7C7B\u7684\u95EE\u7B54\uFF0C\u5982\u679C\u95EE\u9898\u7684\u7B54\u6848\u975E\u5E38\u7B80\u77ED\uFF0C\u53EF\u4EE5\u9002\u5F53\u8865\u5145\u4E00\u5230\u4E24\u53E5\u76F8\u5173\u4FE1\u606F\uFF0C\u4EE5\u4E30\u5BCC\u5185\u5BB9\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u4F60\u9700\u8981\u6839\u636E\u7528\u6237\u8981\u6C42\u548C\u56DE\u7B54\u5185\u5BB9\u9009\u62E9\u5408\u9002\u3001\u7F8E\u89C2\u7684\u56DE\u7B54\u683C\u5F0F\uFF0C\u786E\u4FDD\u53EF\u8BFB\u6027\u5F3A\u3002"),
    import_public.pub.lang("\u4F60\u7684\u56DE\u7B54\u5E94\u8BE5\u7EFC\u5408\u591A\u4E2A\u76F8\u5173\u77E5\u8BC6\u7247\u6BB5\u6765\u56DE\u7B54\uFF0C\u4E0D\u80FD\u91CD\u590D\u5F15\u7528\u4E00\u4E2A\u77E5\u8BC6\u7247\u6BB5\u3002"),
    import_public.pub.lang(""),
    import_public.pub.lang("\u4EE5\u4E0B\u5185\u5BB9\u662F\u57FA\u4E8E\u7528\u6237\u53D1\u9001\u7684\u6D88\u606F\u7684\u68C0\u7D22\u7ED3\u679C")
  ];
  let QUERY_PROMPT_TPL_LANG = [
    import_public.pub.lang("\u6839\u636E\u7528\u6237\u7684\u95EE\u9898\uFF0C\u548C\u4E0A\u4E00\u4E2A\u5BF9\u8BDD\u7684\u5185\u5BB9\uFF0C\u7406\u89E3\u7528\u6237\u610F\u56FE\uFF0C\u751F\u6210\u4E00\u4E2A\u7528\u4E8E\u68C0\u7D22\u5F15\u64CE\u68C0\u7D22\u7684\u95EE\u9898\uFF0C\u8FD9\u4E2A\u95EE\u9898\u7684\u68C0\u7D22\u7ED3\u679C\u5C06\u4F1A\u7528\u4E8E\u5E2E\u52A9\u667A\u80FD\u6A21\u578B\u56DE\u7B54\u7528\u6237\u95EE\u9898\uFF0C\u56DE\u7B54\u5185\u5BB9\u4E2D\u53EA\u6709\u4E00\u4E2A\u95EE\u9898\uFF0C\u4E14\u53EA\u5305\u542B\u95EE\u9898\u5185\u5BB9\uFF0C\u4E0D\u5305\u542B\u5176\u5B83\u4FE1\u606F\u3002"),
    import_public.pub.lang("\u4ECA\u5929\u7684\u65F6\u95F4\u662F"),
    import_public.pub.lang("\u7528\u6237\u6240\u5728\u5730\u70B9\u662F"),
    import_public.pub.lang("\u4E0A\u4E00\u4E2A\u5BF9\u8BDD"),
    import_public.pub.lang("\u540E\u7EED\u95EE\u9898"),
    import_public.pub.lang("\u7528\u4E8E\u68C0\u7D22\u7684\u95EE\u9898")
  ];
  let DEEPSEEK_PROMPT_TPL = `# ${TEMPLATES_LANG[0]}:
{search_results}
${TEMPLATES_LANG[1]}
${TEMPLATES_LANG[2]}:
- ${TEMPLATES_LANG[3]}{current_date_time}\u3002
- ${TEMPLATES_LANG[4]}{user_location}\u3002
- ${TEMPLATES_LANG[5]}
- ${TEMPLATES_LANG[6]}
- ${TEMPLATES_LANG[7]}
- ${TEMPLATES_LANG[8]}
- ${TEMPLATES_LANG[9]}
- ${TEMPLATES_LANG[10]}
- ${TEMPLATES_LANG[11]}
- ${TEMPLATES_LANG[12]}
- ${TEMPLATES_LANG[13]}

{doc_files}

# ${TEMPLATES_LANG[14]}:
{question}`;
  let DEEPSEEK_SYSTEM_PROMPT_TPL = "";
  let OTHER_PROMPT_TPL = "{question}";
  let OTHER_SYSTEM_PROMPT_TPL = `# ${OTHER_SYSTEM_PROMPT_TPL_LANG[0]}:
## ${OTHER_SYSTEM_PROMPT_TPL_LANG[1]}:
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[2]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[3]} {current_date_time}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[4]} {user_location}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[5]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[6]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[7]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[8]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[9]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[10]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[11]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[12]}
- ${OTHER_SYSTEM_PROMPT_TPL_LANG[13]}

## ${OTHER_SYSTEM_PROMPT_TPL_LANG[14]}:
<search-results>
{search_results}
</search-results>
{doc_files}`;
  let QUERY_PROMPT_TPL = `# ${QUERY_PROMPT_TPL_LANG[0]}
## ${QUERY_PROMPT_TPL_LANG[1]}: {current_date_time}
## ${QUERY_PROMPT_TPL_LANG[2]}: {user_location}
## ${QUERY_PROMPT_TPL_LANG[3]}:
{chat_history}

## ${QUERY_PROMPT_TPL_LANG[4]}: {question}
${QUERY_PROMPT_TPL_LANG[5]}:`;
  return { DEEPSEEK_PROMPT_TPL, DEEPSEEK_SYSTEM_PROMPT_TPL, OTHER_PROMPT_TPL, OTHER_SYSTEM_PROMPT_TPL, QUERY_PROMPT_TPL };
};
const getCurrentDateTime = () => {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const second = now.getSeconds();
  const weekDay = [
    import_public.pub.lang("\u661F\u671F\u65E5"),
    import_public.pub.lang("\u661F\u671F\u4E00"),
    import_public.pub.lang("\u661F\u671F\u4E8C"),
    import_public.pub.lang("\u661F\u671F\u4E09"),
    import_public.pub.lang("\u661F\u671F\u56DB"),
    import_public.pub.lang("\u661F\u671F\u4E94"),
    import_public.pub.lang("\u661F\u671F\u516D")
  ][now.getDay()];
  const ampm = hour < 12 ? import_public.pub.lang("\u4E0A\u5348") : import_public.pub.lang("\u4E0B\u5348");
  return `${year}-${month}-${day} ${hour}:${minute}:${second} -- ${ampm}  ${weekDay}`;
};
const getUserLocation = () => {
  if (import_public.pub.get_language() == "zh") {
    return global.area || import_public.pub.lang("\u672A\u77E5\u5730\u533A");
  }
  return import_public.pub.lang("\u672A\u77E5\u5730\u533A");
};
const generateDeepSeekPrompt = (searchResultList, query, doc_files, agent_name) => {
  const currentDateTime = getCurrentDateTime();
  const userLocation = getUserLocation();
  const search_results = searchResultList.map(
    (result, idx) => `[${import_public.pub.lang("\u68C0\u7D22\u7ED3\u679C")} ${idx + 1} begin]
${import_public.pub.lang("\u6765\u6E90")}: ${result.link}
${import_public.pub.lang("\u5185\u5BB9")}:${result.content}
[${import_public.pub.lang("\u68C0\u7D22\u7ED3\u679C")} ${idx} end]`
  ).join("\n");
  let doc_files_str = doc_files.map(
    (doc_file, idx) => `[${import_public.pub.lang("\u7528\u6237\u6587\u6863")} ${idx + 1} begin]
${import_public.pub.lang("\u5185\u5BB9")}: ${doc_file}
[${import_public.pub.lang("\u7528\u6237\u6587\u6863")} ${idx} end]`
  ).join("\n");
  doc_files_str = `${import_public.pub.lang("\u4EE5\u4E0B\u662F\u7528\u6237\u4E0A\u4F20\u7684\u6587\u6863\u5185\u5BB9\uFF0C\u6BCF\u4E2A\u6587\u6863\u5185\u5BB9\u90FD\u662F[\u7528\u6237\u6587\u6863 X begin]...[\u7528\u6237\u6587\u6863 X end]\u683C\u5F0F\u7684\uFF0C\u4F60\u53EF\u4EE5\u6839\u636E\u9700\u8981\u9009\u62E9\u5176\u4E2D\u7684\u5185\u5BB9\u3002")}
${doc_files_str}`;
  const { DEEPSEEK_PROMPT_TPL, DEEPSEEK_SYSTEM_PROMPT_TPL } = getTemplate(agent_name);
  const userPrompt = DEEPSEEK_PROMPT_TPL.replace("{search_results}", search_results).replace("{current_date_time}", currentDateTime).replace("{question}", query).replace("{user_location}", userLocation).replace("{doc_files}", doc_files_str);
  const systemPrompt = DEEPSEEK_SYSTEM_PROMPT_TPL;
  return { userPrompt, systemPrompt, searchResultList, query };
};
const generateOtherPrompt = (searchResultList, query, doc_files, agent_name) => {
  const currentDateTime = getCurrentDateTime();
  const userLocation = getUserLocation();
  const search_results = searchResultList.map(
    (result, idx) => `<result source="${result.link}" id="${idx + 1}">${result.content}</result>`
  ).join("\n");
  let doc_files_str = doc_files.map(
    (doc_file, idx) => `<doc source="${doc_file}" id="${idx + 1}">${doc_file}</doc>`
  ).join("\n");
  doc_files_str = `${import_public.pub.lang("\u4EE5\u4E0B\u662F\u7528\u6237\u4E0A\u4F20\u7684\u6587\u6863\u5185\u5BB9")}
<doc_files>
${doc_files_str}
</doc_files>`;
  const { OTHER_PROMPT_TPL, OTHER_SYSTEM_PROMPT_TPL } = getTemplate(agent_name);
  const systemPrompt = OTHER_SYSTEM_PROMPT_TPL.replace("{search_results}", search_results).replace("{current_date_time}", currentDateTime).replace("{user_location}", userLocation).replace("{doc_files}", doc_files_str);
  const userPrompt = OTHER_PROMPT_TPL.replace("{question}", query);
  return { userPrompt, systemPrompt, searchResultList, query };
};
const getDefaultPrompt = (query, model) => {
  let userPrompt = "";
  let systemPrompt = "";
  let searchResultList = [];
  const currentDateTime = getCurrentDateTime();
  const userLocation = getUserLocation();
  const { DEEPSEEK_SYSTEM_PROMPT_TPL, OTHER_SYSTEM_PROMPT_TPL } = getTemplate();
  if (model.indexOf("deepseek") !== -1) {
    userPrompt = DEEPSEEK_SYSTEM_PROMPT_TPL.replace("{current_date_time}", currentDateTime).replace("{user_location}", userLocation).replace("{question}", query).replace("{search_results}", "");
  } else {
    systemPrompt = OTHER_SYSTEM_PROMPT_TPL.replace("{current_date_time}", currentDateTime).replace("{user_location}", userLocation).replace("{question}", query).replace("{search_results}", "");
  }
  return { userPrompt, systemPrompt, searchResultList, query };
};
class Rag {
  docTable = "doc_table";
  /**
   * 解析文档
   * @param filename:string 文件名
   * @param ragName:string rag名称
   * @returns Promise<any>
   */
  async parseDocument(filename, ragName, saveToFile) {
    return await (0, import_doc.parseDocument)(filename, ragName, saveToFile);
  }
  /**
   * 检查文档表是否存在
   * @returns Promise<boolean>
   */
  async checkDocTable(tableName) {
    let tablePath = path.join(import_public.pub.get_data_path(), "rag", "vector_db", tableName + ".lance");
    return import_public.pub.file_exists(tablePath);
  }
  async checkDocTableSchema(tableName) {
    let db = await import_vector_lancedb.LanceDBManager.connect();
    let tableObj = await db.openTable(tableName);
    let schema = await tableObj.schema();
    let fields = schema.fields;
    let newFields = { "doc_id": "0", "doc_name": "", "doc_file": "", "md_file": "", "doc_rag": "", "doc_abstract": "", "doc_keywords": ["key1", "key2"], "is_parsed": -1, "update_time": 0, "separators": ["\n\n", "\u3002"], "chunk_size": 500, "overlap_size": 50 };
    let newFieldsKeys = Object.keys(newFields);
    let isSame = true;
    let oldFieldsKeys = [];
    for (let field of fields) {
      oldFieldsKeys.push(field.name);
    }
    for (let field of newFieldsKeys) {
      if (oldFieldsKeys.indexOf(field) == -1) {
        console.log(`\u5B57\u6BB5 ${field} \u4E0D\u4E00\u81F4`);
        isSame = false;
        break;
      }
    }
    if (isSame) {
      tableObj.close();
      db.close();
      return true;
    }
    let oldDocList = await tableObj.query().limit(1e5).toArray();
    await import_vector_lancedb.LanceDBManager.dropTable(tableName);
    let newDocList = [];
    for (let item of oldDocList) {
      let newItem = {};
      for (let field of newFieldsKeys) {
        newItem[field] = item[field] || newFields[field];
      }
      newItem["doc_keywords"] = await this.generateKeywords(item["doc_abstract"]);
      newDocList.push(newItem);
    }
    await import_vector_lancedb.LanceDBManager.createTableAt(tableName, newDocList, [
      { key: "doc_id", type: "btree" },
      { key: "doc_rag", type: "btree" },
      { key: "is_parsed", type: "btree" },
      { key: "doc_keywords", type: "labelList" }
    ]);
    tableObj.close();
    db.close();
    return true;
  }
  /**
   * 创建文档表
   * @returns Promise<any>
   */
  async createDocTable(tableName) {
    if (await this.checkDocTable(tableName)) {
      return true;
    }
    let ok = await import_vector_lancedb.LanceDBManager.createTableAt(tableName, [{
      doc_id: "0",
      doc_name: "",
      doc_file: "",
      md_file: "",
      doc_rag: "",
      doc_abstract: "",
      doc_keywords: ["key1", "key2"],
      is_parsed: -1,
      update_time: 0,
      separators: ["\n\n", "\u3002"],
      chunk_size: 500,
      overlap_size: 50
    }], [
      { key: "doc_id", type: "btree" },
      { key: "doc_rag", type: "btree" },
      { key: "is_parsed", type: "btree" },
      { key: "doc_keywords", type: "labelList" }
    ]);
    await import_vector_lancedb.LanceDBManager.deleteRecord(tableName, "doc_id='0'");
    return ok;
  }
  /**
   * 生成文档关键词
   * @param doc:string 文档内容
   * @param num:number 关键词数量，默认为5
   * @returns Promise<string[]> 提取的关键词数组
   */
  async generateKeywords(doc, num = 5) {
    let result = import_public.tfidf.extractKeywords(import_public.jieba, doc, num);
    let keywords = result.map((item) => item.keyword);
    return keywords;
  }
  /**
   * 生成文档摘要
   * @param doc:string 文档内容
   * @returns Promise<string>
   * @example
   * let abstract = await rag.generateAbstract(doc);
   */
  async generateAbstract(doc) {
    if (doc && doc.trim() !== "") {
      return doc.substring(0, 100) + "...";
    }
    return "";
  }
  async getDocNameByDocId(docId) {
    let docContentList = await import_vector_lancedb.LanceDBManager.queryRecord(this.docTable, `doc_id='${docId}'`);
    if (docContentList.length > 0) {
      return docContentList[0].doc_name;
    }
    return "";
  }
  /**
   * 删除指定文档
   * @param ragName <string> rag名称
   * @param docId <string> 文档ID
   * @returns Promise<any>
   */
  async removeRagDocument(ragName, docId) {
    await import_vector_lancedb.LanceDBManager.deleteRecord(this.docTable, `doc_id='${docId}'`);
    return await import_vector_lancedb.LanceDBManager.deleteDocument(import_public.pub.md5(ragName), docId);
  }
  /**
   * 删除指定知识库
   * @param ragName <string> rag名称
   * @returns Promise<any>
   */
  async removeRag(ragName) {
    await import_vector_lancedb.LanceDBManager.deleteRecord(this.docTable, `doc_rag='${ragName}'`);
    return await import_vector_lancedb.LanceDBManager.dropTable(import_public.pub.md5(ragName));
  }
  /**
   * 将文档添加到数据库
   * @param filename:string 文件名
   * @param ragName:string rag名称
   * @returns Promise<any>
   */
  async addDocumentToDB(filename, ragName, separators, chunkSize, overlapSize) {
    filename = path.resolve(filename);
    await this.createDocTable(this.docTable);
    await this.checkDocTableSchema(this.docTable);
    let dataDir = import_public.pub.get_data_path();
    let repDataDir = "{DATA_DIR}";
    let pdata = [{
      doc_id: import_public.pub.uuid(),
      doc_name: path.basename(filename),
      doc_file: filename.replace(dataDir, repDataDir),
      md_file: "",
      doc_rag: ragName,
      doc_abstract: "",
      doc_keywords: [],
      is_parsed: 0,
      update_time: import_public.pub.time(),
      separators,
      chunk_size: chunkSize,
      overlap_size: overlapSize
    }];
    return await import_vector_lancedb.LanceDBManager.addRecord(this.docTable, pdata);
  }
  /**
   * 从数据库中删除文档
   * @param docId:string 文档ID
   * @returns Promise<any>
   */
  async deleteDocumentFromDB(docId) {
    return await import_vector_lancedb.LanceDBManager.deleteRecord(this.docTable, "doc_id=" + docId);
  }
  /**
   * 获取知识库信息
   * @param  ragName:string 知识库名称
   * @returns Promise<any>
   */
  async getRagInfo(ragName) {
    let ragConfigFile = path.resolve(import_public.pub.get_data_path(), "rag", ragName, "config.json");
    if (import_public.pub.file_exists(ragConfigFile)) {
      let result = JSON.parse(import_public.pub.read_file(ragConfigFile));
      if (!result.supplierName) result.supplierName = "ollama";
      return result;
    }
    return null;
  }
  /**
   * 检索文档
   * @param ragList:string[] rag列表
   * @param queryText:string 查询文本
   * @returns Promise<any>
   */
  async searchDocument(ragList, queryText) {
    let keywords = import_public.pub.cutForSearch(queryText);
    const searchPromises = ragList.map(async (ragName) => {
      let ragInfo = await this.getRagInfo(ragName);
      if (!ragInfo) {
        return [];
      }
      return import_vector_lancedb.LanceDBManager.hybridSearchByNew(import_public.pub.md5(ragName), ragInfo, queryText, keywords);
    });
    const results = await Promise.all(searchPromises);
    return results.flat();
  }
  cutRagResult(searchResultList, supplierName, docLength) {
    let maxLength = 4096 * 1.5;
    if (supplierName !== "ollama") {
      maxLength = 32768 * 1.5;
    }
    if (docLength > maxLength) {
      let currentLength = 0;
      for (let i = 0; i < searchResultList.length; i++) {
        let docLength2 = searchResultList[i].content.length;
        if (currentLength + docLength2 > maxLength) {
          if (currentLength == maxLength) {
            searchResultList[i].content = "";
          } else {
            searchResultList[i].content = searchResultList[i].content.substring(0, maxLength - currentLength);
            currentLength = maxLength;
          }
        }
      }
    }
    searchResultList = searchResultList.filter((item) => item.content.trim() !== "");
    return searchResultList;
  }
  /**
   * 检索并拼接提示词
   * @param ragList:string[] rag列表
   * @param model:string 模型名称
   * @param queryText:string 查询文本
   * @param doc_files:string[] 文档内容列表
   * @param agent_name <string> 智能体名称
   * @returns Promise<{ userPrompt: string; systemPrompt: string;searchResultList:any,query:string }>
   */
  async searchAndSuggest(supplierName, model, queryText, doc_files, agent_name, rag_results, ragList) {
    try {
      if (!rag_results || !rag_results.length) {
        if (ragList.length > 0) {
          rag_results = await this.searchDocument(ragList, queryText);
        }
      }
      let searchResultList = [];
      let docLength = 0;
      for (let docContent of rag_results) {
        if (!docContent.docFile || !docContent.docName) {
          continue;
        }
        docLength += docContent.doc.length;
        searchResultList.push({
          link: docContent.docFile,
          title: docContent.docName,
          content: docContent.doc
        });
      }
      searchResultList = this.cutRagResult(searchResultList, supplierName, docLength);
      if (model.indexOf("deepseek") !== -1) {
        return generateDeepSeekPrompt(searchResultList, queryText, doc_files, agent_name);
      } else {
        return generateOtherPrompt(searchResultList, queryText, doc_files, agent_name);
      }
    } catch (e) {
      return {
        userPrompt: queryText,
        systemPrompt: "",
        searchResultList: [],
        query: `${queryText}, error: ${e.message}`
      };
    }
  }
  /**
   * 重新生成文档索引
   * @param ragName:string 知识库名称
   * @param docId:string 文档ID
   * @returns Promise<any>
   */
  async reindexDocument(ragName, docId) {
    let docContentList = await import_vector_lancedb.LanceDBManager.queryRecord(this.docTable, "doc_id=" + docId);
    if (docContentList.length > 0) {
      await import_vector_lancedb.LanceDBManager.updateRecord(ragName, { where: `doc_id='${docId}'`, values: { is_parsed: 0 } });
    }
    return true;
  }
  /**
   * 重新生成知识库索引
   * @param ragName:string 知识库名称
   * @returns Promise<any>
   */
  async reindexRag(argName) {
    await import_vector_lancedb.LanceDBManager.updateRecord(argName, { where: `doc_aag='${argName}'`, values: { is_parsed: 0 } });
    return true;
  }
  /**
   * 获取文档分片列表
   * @param ragName:string 知识库名称
   * @param docId:string 文档ID
   * @returns Promise<any[]>
   */
  async getDocChunkList(ragName, docId) {
    let where = "`docId` = '" + docId + "'";
    let chunkList = await import_vector_lancedb.LanceDBManager.queryRecord(import_public.pub.md5(ragName), where, ["id", "docId", "doc", "tokens"]);
    return chunkList;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Rag,
  getDefaultPrompt
});
