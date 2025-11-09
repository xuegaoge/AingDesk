var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var search_exports = {};
__export(search_exports, {
  getDefaultPrompt: () => getDefaultPrompt,
  getPromptForWeb: () => getPromptForWeb,
  getSearchQuery: () => getSearchQuery,
  search: () => search,
  searchEngines: () => searchEngines,
  searchWeb: () => searchWeb
});
module.exports = __toCommonJS(search_exports);
var import_baidu = require("./baidu");
var import_duckduckgo = require("./duckduckgo");
var import_sogou = require("./sogou");
var import_so360 = require("./so360");
var import_public = require("../class/public");
var import_agent = require("../service/agent");
const getTemplate = (agent_name) => {
  agent_name = agent_name || "";
  let agentInfo = import_agent.agentService.get_agent_config(agent_name);
  const TEMPLATES_LANG = [
    agentInfo ? agentInfo.prompt : import_public.pub.lang("\u4EE5\u4E0B\u5185\u5BB9\u662F\u57FA\u4E8E\u7528\u6237\u53D1\u9001\u7684\u6D88\u606F\u7684\u641C\u7D22\u7ED3\u679C"),
    import_public.pub.lang("\u5728\u6211\u7ED9\u4F60\u7684\u641C\u7D22\u7ED3\u679C\u4E2D\uFF0C\u6BCF\u4E2A\u7ED3\u679C\u90FD\u662F[\u641C\u7D22\u7ED3\u679C X begin]...[\u641C\u7D22\u7ED3\u679C X end]\u683C\u5F0F\u7684\uFF0CX\u4EE3\u8868\u6BCF\u7BC7\u6587\u7AE0\u7684\u6570\u5B57\u7D22\u5F15\u3002\u53E6\u5916\u641C\u7D22\u7ED3\u679C\u4E2D\u53EF\u80FD\u5305\u542B\u4E00\u4E9B\u4E0D\u76F8\u5173\u7684\u4FE1\u606F\uFF0C\u4F60\u53EF\u4EE5\u6839\u636E\u9700\u8981\u9009\u62E9\u5176\u4E2D\u7684\u5185\u5BB9\u3002"),
    import_public.pub.lang("\u5728\u56DE\u7B54\u65F6\uFF0C\u8BF7\u6CE8\u610F\u4EE5\u4E0B\u51E0\u70B9"),
    import_public.pub.lang("\u4ECA\u5929\u662F"),
    import_public.pub.lang("\u7528\u6237\u6240\u5728\u5730\u70B9\u662F"),
    agentInfo ? "" : import_public.pub.lang("\u4E0D\u8981\u5728\u56DE\u7B54\u5185\u5BB9\u4E2D\u63D0\u53CA\u641C\u7D22\u7ED3\u679C\u7684\u5177\u4F53\u6765\u6E90\uFF0C\u4E5F\u4E0D\u8981\u63D0\u53CA\u641C\u7D22\u7ED3\u679C\u7684\u5177\u4F53\u6392\u540D\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5E76\u975E\u641C\u7D22\u7ED3\u679C\u7684\u6240\u6709\u5185\u5BB9\u90FD\u4E0E\u7528\u6237\u7684\u95EE\u9898\u5BC6\u5207\u76F8\u5173\uFF0C\u4F60\u9700\u8981\u7ED3\u5408\u95EE\u9898\uFF0C\u5BF9\u641C\u7D22\u7ED3\u679C\u8FDB\u884C\u7504\u522B\u3001\u7B5B\u9009\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5BF9\u4E8E\u5217\u4E3E\u7C7B\u7684\u95EE\u9898\uFF08\u5982\u5217\u4E3E\u6240\u6709\u822A\u73ED\u4FE1\u606F\uFF09\uFF0C\u5C3D\u91CF\u5C06\u7B54\u6848\u63A7\u5236\u572810\u4E2A\u8981\u70B9\u4EE5\u5185\uFF0C\u5E76\u544A\u8BC9\u7528\u6237\u53EF\u4EE5\u67E5\u770B\u641C\u7D22\u6765\u6E90\u3001\u83B7\u5F97\u5B8C\u6574\u4FE1\u606F\u3002\u4F18\u5148\u63D0\u4F9B\u4FE1\u606F\u5B8C\u6574\u3001\u6700\u76F8\u5173\u7684\u5217\u4E3E\u9879\uFF1B\u5982\u975E\u5FC5\u8981\uFF0C\u4E0D\u8981\u4E3B\u52A8\u544A\u8BC9\u7528\u6237\u641C\u7D22\u7ED3\u679C\u672A\u63D0\u4F9B\u7684\u5185\u5BB9\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5BF9\u4E8E\u521B\u4F5C\u7C7B\u7684\u95EE\u9898\uFF08\u5982\u5199\u8BBA\u6587\uFF09\uFF0C\u4F60\u9700\u8981\u89E3\u8BFB\u5E76\u6982\u62EC\u7528\u6237\u7684\u9898\u76EE\u8981\u6C42\uFF0C\u9009\u62E9\u5408\u9002\u7684\u683C\u5F0F\uFF0C\u5145\u5206\u5229\u7528\u641C\u7D22\u7ED3\u679C\u5E76\u62BD\u53D6\u91CD\u8981\u4FE1\u606F\uFF0C\u751F\u6210\u7B26\u5408\u7528\u6237\u8981\u6C42\u3001\u6781\u5177\u601D\u60F3\u6DF1\u5EA6\u3001\u5BCC\u6709\u521B\u9020\u529B\u4E0E\u4E13\u4E1A\u6027\u7684\u7B54\u6848\u3002\u4F60\u7684\u521B\u4F5C\u7BC7\u5E45\u9700\u8981\u5C3D\u53EF\u80FD\u5EF6\u957F\uFF0C\u5BF9\u4E8E\u6BCF\u4E00\u4E2A\u8981\u70B9\u7684\u8BBA\u8FF0\u8981\u63A8\u6D4B\u7528\u6237\u7684\u610F\u56FE\uFF0C\u7ED9\u51FA\u5C3D\u53EF\u80FD\u591A\u89D2\u5EA6\u7684\u56DE\u7B54\u8981\u70B9\uFF0C\u4E14\u52A1\u5FC5\u4FE1\u606F\u91CF\u5927\u3001\u8BBA\u8FF0\u8BE6\u5C3D\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5982\u679C\u56DE\u7B54\u5F88\u957F\uFF0C\u8BF7\u5C3D\u91CF\u7ED3\u6784\u5316\u3001\u5206\u6BB5\u843D\u603B\u7ED3\u3002\u5982\u679C\u9700\u8981\u5206\u70B9\u4F5C\u7B54\uFF0C\u5C3D\u91CF\u63A7\u5236\u57285\u4E2A\u70B9\u4EE5\u5185\uFF0C\u5E76\u5408\u5E76\u76F8\u5173\u7684\u5185\u5BB9\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5BF9\u4E8E\u5BA2\u89C2\u7C7B\u7684\u95EE\u7B54\uFF0C\u5982\u679C\u95EE\u9898\u7684\u7B54\u6848\u975E\u5E38\u7B80\u77ED\uFF0C\u53EF\u4EE5\u9002\u5F53\u8865\u5145\u4E00\u5230\u4E24\u53E5\u76F8\u5173\u4FE1\u606F\uFF0C\u4EE5\u4E30\u5BCC\u5185\u5BB9\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u4F60\u9700\u8981\u6839\u636E\u7528\u6237\u8981\u6C42\u548C\u56DE\u7B54\u5185\u5BB9\u9009\u62E9\u5408\u9002\u3001\u7F8E\u89C2\u7684\u56DE\u7B54\u683C\u5F0F\uFF0C\u786E\u4FDD\u53EF\u8BFB\u6027\u5F3A\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u4F60\u7684\u56DE\u7B54\u5E94\u8BE5\u7EFC\u5408\u591A\u4E2A\u76F8\u5173\u7F51\u9875\u6765\u56DE\u7B54\uFF0C\u4E0D\u80FD\u91CD\u590D\u5F15\u7528\u4E00\u4E2A\u7F51\u9875\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u9664\u975E\u7528\u6237\u8981\u6C42\uFF0C\u5426\u5219\u4F60\u56DE\u7B54\u7684\u8BED\u8A00\u9700\u8981\u548C\u7528\u6237\u63D0\u95EE\u7684\u8BED\u8A00\u4FDD\u6301\u4E00\u81F4\u3002"),
    import_public.pub.lang("\u7528\u6237\u6D88\u606F\u4E3A")
  ];
  const OTHER_SYSTEM_PROMPT_TPL_LANG = [
    agentInfo ? agentInfo.prompt : import_public.pub.lang("\u4F60\u662F\u4E00\u4E2A\u64C5\u957F\u641C\u7D22\u7F51\u7EDC\u548C\u56DE\u7B54\u7528\u6237\u67E5\u8BE2\u7684\u4EBA\u5DE5\u667A\u80FD\u6A21\u578B\u3002"),
    import_public.pub.lang("\u5728\u56DE\u7B54\u65F6\uFF0C\u8BF7\u6CE8\u610F\u4EE5\u4E0B\u51E0\u70B9"),
    import_public.pub.lang("\u6839\u636E\u63D0\u4F9B\u7684\u641C\u7D22\u7ED3\u679C\u751F\u6210\u4FE1\u606F\u4E30\u5BCC\u4E14\u4E0E\u7528\u6237\u67E5\u8BE2\u76F8\u5173\u7684\u56DE\u7B54\u3002"),
    import_public.pub.lang("\u5F53\u524D\u65E5\u671F\u548C\u65F6\u95F4\u4E3A"),
    import_public.pub.lang("\u7528\u6237\u6240\u5728\u5730\u533A\u4E3A"),
    agentInfo ? "" : import_public.pub.lang("\u4E0D\u8981\u5728\u56DE\u7B54\u5185\u5BB9\u4E2D\u63D0\u53CA\u641C\u7D22\u7ED3\u679C\u7684\u5177\u4F53\u6765\u6E90\uFF0C\u4E5F\u4E0D\u8981\u63D0\u53CA\u641C\u7D22\u7ED3\u679C\u7684\u5177\u4F53\u6392\u540D\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5E76\u975E\u641C\u7D22\u7ED3\u679C\u7684\u6240\u6709\u5185\u5BB9\u90FD\u4E0E\u7528\u6237\u7684\u95EE\u9898\u5BC6\u5207\u76F8\u5173\uFF0C\u4F60\u9700\u8981\u7ED3\u5408\u95EE\u9898\uFF0C\u5BF9\u641C\u7D22\u7ED3\u679C\u8FDB\u884C\u7504\u522B\u3001\u7B5B\u9009\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5BF9\u4E8E\u5217\u4E3E\u7C7B\u7684\u95EE\u9898\uFF08\u5982\u5217\u4E3E\u6240\u6709\u822A\u73ED\u4FE1\u606F\uFF09\uFF0C\u5C3D\u91CF\u5C06\u7B54\u6848\u63A7\u5236\u572810\u4E2A\u8981\u70B9\u4EE5\u5185\uFF0C\u5E76\u544A\u8BC9\u7528\u6237\u53EF\u4EE5\u67E5\u770B\u641C\u7D22\u6765\u6E90\u3001\u83B7\u5F97\u5B8C\u6574\u4FE1\u606F\u3002\u4F18\u5148\u63D0\u4F9B\u4FE1\u606F\u5B8C\u6574\u3001\u6700\u76F8\u5173\u7684\u5217\u4E3E\u9879\uFF1B\u5982\u975E\u5FC5\u8981\uFF0C\u4E0D\u8981\u4E3B\u52A8\u544A\u8BC9\u7528\u6237\u641C\u7D22\u7ED3\u679C\u672A\u63D0\u4F9B\u7684\u5185\u5BB9\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5BF9\u4E8E\u521B\u4F5C\u7C7B\u7684\u95EE\u9898\uFF08\u5982\u5199\u8BBA\u6587\uFF09\uFF0C\u4F60\u9700\u8981\u89E3\u8BFB\u5E76\u6982\u62EC\u7528\u6237\u7684\u9898\u76EE\u8981\u6C42\uFF0C\u9009\u62E9\u5408\u9002\u7684\u683C\u5F0F\uFF0C\u5145\u5206\u5229\u7528\u641C\u7D22\u7ED3\u679C\u5E76\u62BD\u53D6\u91CD\u8981\u4FE1\u606F\uFF0C\u751F\u6210\u7B26\u5408\u7528\u6237\u8981\u6C42\u3001\u6781\u5177\u601D\u60F3\u6DF1\u5EA6\u3001\u5BCC\u6709\u521B\u9020\u529B\u4E0E\u4E13\u4E1A\u6027\u7684\u7B54\u6848\u3002\u4F60\u7684\u521B\u4F5C\u7BC7\u5E45\u9700\u8981\u5C3D\u53EF\u80FD\u5EF6\u957F\uFF0C\u5BF9\u4E8E\u6BCF\u4E00\u4E2A\u8981\u70B9\u7684\u8BBA\u8FF0\u8981\u63A8\u6D4B\u7528\u6237\u7684\u610F\u56FE\uFF0C\u7ED9\u51FA\u5C3D\u53EF\u80FD\u591A\u89D2\u5EA6\u7684\u56DE\u7B54\u8981\u70B9\uFF0C\u4E14\u52A1\u5FC5\u4FE1\u606F\u91CF\u5927\u3001\u8BBA\u8FF0\u8BE6\u5C3D\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5982\u679C\u56DE\u7B54\u5F88\u957F\uFF0C\u8BF7\u5C3D\u91CF\u7ED3\u6784\u5316\u3001\u5206\u6BB5\u843D\u603B\u7ED3\u3002\u5982\u679C\u9700\u8981\u5206\u70B9\u4F5C\u7B54\uFF0C\u5C3D\u91CF\u63A7\u5236\u57285\u4E2A\u70B9\u4EE5\u5185\uFF0C\u5E76\u5408\u5E76\u76F8\u5173\u7684\u5185\u5BB9\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u5BF9\u4E8E\u5BA2\u89C2\u7C7B\u7684\u95EE\u7B54\uFF0C\u5982\u679C\u95EE\u9898\u7684\u7B54\u6848\u975E\u5E38\u7B80\u77ED\uFF0C\u53EF\u4EE5\u9002\u5F53\u8865\u5145\u4E00\u5230\u4E24\u53E5\u76F8\u5173\u4FE1\u606F\uFF0C\u4EE5\u4E30\u5BCC\u5185\u5BB9\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u4F60\u9700\u8981\u6839\u636E\u7528\u6237\u8981\u6C42\u548C\u56DE\u7B54\u5185\u5BB9\u9009\u62E9\u5408\u9002\u3001\u7F8E\u89C2\u7684\u56DE\u7B54\u683C\u5F0F\uFF0C\u786E\u4FDD\u53EF\u8BFB\u6027\u5F3A\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u4F60\u7684\u56DE\u7B54\u5E94\u8BE5\u7EFC\u5408\u591A\u4E2A\u76F8\u5173\u7F51\u9875\u6765\u56DE\u7B54\uFF0C\u4E0D\u80FD\u91CD\u590D\u5F15\u7528\u4E00\u4E2A\u7F51\u9875\u3002"),
    agentInfo ? "" : import_public.pub.lang("\u9664\u975E\u7528\u6237\u8981\u6C42\uFF0C\u5426\u5219\u4F60\u56DE\u7B54\u7684\u8BED\u8A00\u9700\u8981\u548C\u7528\u6237\u63D0\u95EE\u7684\u8BED\u8A00\u4FDD\u6301\u4E00\u81F4\u3002"),
    import_public.pub.lang("\u4EE5\u4E0B\u5185\u5BB9\u662F\u57FA\u4E8E\u7528\u6237\u53D1\u9001\u7684\u6D88\u606F\u7684\u641C\u7D22\u7ED3\u679C")
  ];
  const QUERY_PROMPT_TPL_LANG = [
    import_public.pub.lang("\u6839\u636E\u7528\u6237\u7684\u95EE\u9898\uFF0C\u548C\u4E0A\u4E00\u4E2A\u5BF9\u8BDD\u7684\u5185\u5BB9\uFF0C\u7406\u89E3\u7528\u6237\u610F\u56FE\uFF0C\u751F\u6210\u4E00\u4E2A\u7528\u4E8E\u641C\u7D22\u5F15\u64CE\u641C\u7D22\u7684\u95EE\u9898\uFF0C\u8FD9\u4E2A\u95EE\u9898\u7684\u641C\u7D22\u7ED3\u679C\u5C06\u4F1A\u7528\u4E8E\u5E2E\u52A9\u667A\u80FD\u6A21\u578B\u56DE\u7B54\u7528\u6237\u95EE\u9898\uFF0C\u56DE\u7B54\u5185\u5BB9\u4E2D\u53EA\u6709\u4E00\u4E2A\u95EE\u9898\uFF0C\u4E14\u53EA\u5305\u542B\u95EE\u9898\u5185\u5BB9\uFF0C\u4E0D\u5305\u542B\u5176\u5B83\u4FE1\u606F\u3002"),
    import_public.pub.lang("\u4ECA\u5929\u7684\u65F6\u95F4\u662F"),
    import_public.pub.lang("\u7528\u6237\u6240\u5728\u5730\u70B9\u662F"),
    import_public.pub.lang("\u4E0A\u4E00\u4E2A\u5BF9\u8BDD"),
    import_public.pub.lang("\u540E\u7EED\u95EE\u9898"),
    import_public.pub.lang("\u7528\u4E8E\u641C\u7D22\u7684\u95EE\u9898")
  ];
  const DEEPSEEK_PROMPT_TPL = `# ${TEMPLATES_LANG[0]}:
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
  const DEEPSEEK_SYSTEM_PROMPT_TPL = "";
  const OTHER_PROMPT_TPL = "{question}";
  const OTHER_SYSTEM_PROMPT_TPL = `# ${OTHER_SYSTEM_PROMPT_TPL_LANG[0]}:
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
  const QUERY_PROMPT_TPL = `# ${QUERY_PROMPT_TPL_LANG[0]}
## ${QUERY_PROMPT_TPL_LANG[1]}: {current_date_time}
## ${QUERY_PROMPT_TPL_LANG[2]}: {user_location}
## ${QUERY_PROMPT_TPL_LANG[3]}:
{chat_history}

## ${QUERY_PROMPT_TPL_LANG[4]}: {question}
${QUERY_PROMPT_TPL_LANG[5]}:`;
  return { DEEPSEEK_PROMPT_TPL, DEEPSEEK_SYSTEM_PROMPT_TPL, OTHER_PROMPT_TPL, OTHER_SYSTEM_PROMPT_TPL, QUERY_PROMPT_TPL };
};
const searchEngines = {
  baidu: import_baidu.localBaiduSearch,
  duckduckgo: import_duckduckgo.localDuckDuckGoSearch,
  sogou: import_sogou.localSogouSearch,
  sougou: import_sogou.localSogouSearch,
  google: import_so360.local360Search,
  so360: import_so360.local360Search,
  360: import_so360.local360Search
};
const searchWeb = async (provider, query) => {
  let queryKey = import_public.pub.md5(`${provider}-${query}`);
  let cache = import_public.pub.cache_get(queryKey);
  if (cache) {
    return cache;
  }
  if (!searchEngines[provider]) {
    throw new Error(`Search provider ${provider} not found`);
  }
  const searchResults = await searchEngines[provider](query);
  import_public.pub.cache_set(queryKey, searchResults, 3600);
  return searchResults;
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
const getSearchQuery = async (query, model, chatHistory) => {
  return query;
};
const generateDeepSeekPrompt = (searchResultList, query, doc_files, agent_name) => {
  const currentDateTime = getCurrentDateTime();
  const userLocation = getUserLocation();
  const search_results = searchResultList.map(
    (result, idx) => `[${import_public.pub.lang("\u641C\u7D22\u7ED3\u679C")} ${idx + 1} begin]
${import_public.pub.lang("\u8FDE\u63A5")}: ${result.link}
${import_public.pub.lang("\u6807\u9898")}: ${result.title}
${import_public.pub.lang("\u5185\u5BB9")}:${result.content}
[${import_public.pub.lang("\u641C\u7D22\u7ED3\u679C")} ${idx} end]`
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
const getDefaultPrompt = (query, model, agent_name) => {
  let userPrompt = "";
  let systemPrompt = "";
  let searchResultList = [];
  const currentDateTime = getCurrentDateTime();
  const userLocation = getUserLocation();
  const { DEEPSEEK_SYSTEM_PROMPT_TPL, OTHER_SYSTEM_PROMPT_TPL } = getTemplate(agent_name);
  if (model.indexOf("deepseek") !== -1) {
    userPrompt = DEEPSEEK_SYSTEM_PROMPT_TPL.replace("{current_date_time}", currentDateTime).replace("{user_location}", userLocation).replace("{question}", query).replace("{search_results}", "");
  } else {
    systemPrompt = OTHER_SYSTEM_PROMPT_TPL.replace("{current_date_time}", currentDateTime).replace("{user_location}", userLocation).replace("{question}", query).replace("{search_results}", "");
  }
  return { userPrompt, systemPrompt, searchResultList, query };
};
const getPromptForWeb = async (query, model, chatHistory, doc_files, agent_name, searchResultList, searchProvider) => {
  try {
    if (query.length < 4) return getDefaultPrompt(query, model, agent_name);
    const searchQuery = await getSearchQuery(query, model, chatHistory);
    if (!searchResultList || !searchResultList.length) {
      if (searchProvider) {
        searchResultList = await searchWeb(searchProvider, searchQuery);
      }
    }
    if (agent_name) {
      searchResultList = searchResultList.slice(0, 3);
      searchResultList = searchResultList.map((result) => {
        result.content = result.content.slice(0, 4096);
        return result;
      });
    }
    if (model.indexOf("deepseek") !== -1) {
      return generateDeepSeekPrompt(searchResultList, searchQuery, doc_files, agent_name);
    } else {
      return generateOtherPrompt(searchResultList, searchQuery, doc_files, agent_name);
    }
  } catch (error) {
    console.error("Error getting prompt for web:", error);
    throw new Error("Failed to get prompt for web");
  }
};
const search = async (query, searchProvider) => {
  try {
    let searchResultList = await searchWeb(searchProvider, query);
    searchResultList = searchResultList.filter((result) => {
      return result.title && result.title.length > 0;
    });
    return searchResultList;
  } catch (error) {
    console.error("Error searching:", error);
  }
  return [];
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getDefaultPrompt,
  getPromptForWeb,
  getSearchQuery,
  search,
  searchEngines,
  searchWeb
});
