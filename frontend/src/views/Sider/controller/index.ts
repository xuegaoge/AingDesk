import { nextTick } from "vue"
import { post } from "@/api"
import { sendLog } from "@/views/Home/controller"
import { knowledgeIsClose, modifyRag, removeRagConfirm, optimizeTable } from "@/views/KnowleadgeStore/controller"
import { getSupplierList } from "@/views/ThirdPartyApi/controller/index"
import { singleActive } from "@/views/KnowleadgeStore/controller"

import { eventBUS } from "@/views/Home/utils/tools"
import { message, delConfirm } from "@/utils/naive-tools"
import type { ChatInfo, ChatItemInfo } from "@/views/Home/dto"
import i18n from "@/lang";
import { getSiderStoreData } from "../store"
import { getHeaderStoreData } from "@/views/Header/store"
import { getThirdPartyApiStoreData } from "@/views/ThirdPartyApi/store"
import { getSoftSettingsStoreData } from "@/views/SoftSettings/store"
import { getChatToolsStoreData, useChatToolsStore } from "@/views/ChatTools/store"
import { getKnowledgeStoreData } from "@/views/KnowleadgeStore/store"
import { getAgentStoreData } from "@/views/Agent/store"
import { getChatContentStoreData } from "@/views/ChatContent/store"
const $t = i18n.global.t
/**
 * @description 获取对话列表
 */
export async function get_chat_list() {
    const { chatList, currentContextId, currentChatTitle, contextIdForDel, } = getSiderStoreData()
    const { currentModel, } = getHeaderStoreData()
    const { currentSupplierName, } = getThirdPartyApiStoreData()
    const { netActive, } = getChatToolsStoreData()
    const { activeKnowledgeForChat, } = getKnowledgeStoreData()
    const { currentChatAgent } = getAgentStoreData()

    try {
        const res = await post("/chat/get_chat_list")
        chatList.value = res.message
        if (chatList.value.length) {
            if (currentContextId.value == contextIdForDel.value) {
                currentContextId.value = chatList.value[0].context_id
                // 智能体判断
                if (chatList.value[0].agent_info) {
                    currentChatTitle.value = chatList.value[0].agent_info.agent_title
                    currentChatAgent.value = chatList.value[0].agent_info
                } else {
                    currentChatTitle.value = chatList.value[0].title
                }
                // 模型厂商判断（是否本地）
                if (chatList.value[0].supplierName == "ollama") {
                    currentModel.value = chatList.value[0].model + ":" + chatList.value[0].parameters
                } else {
                    currentModel.value = chatList.value[0].model
                }
                currentSupplierName.value = chatList.value[0].supplierName!
                chatList.value[0].search_type ? netActive.value = true : netActive.value = false
                activeKnowledgeForChat.value = chatList.value[0].rag_list ? chatList.value[0].rag_list : []
                getChatInfo(currentContextId.value)
            }
        }
    } catch (error) {
        sendLog(error as Error)
    }
}


/**
 * @description 创建新对话：打开新对话窗口
 */
export function createNewComu() {
    const { currentContextId, currentChatTitle, } = getSiderStoreData()
    const { chatHistory, } = getChatContentStoreData()
    const { chatForAgent, currentAgent } = getAgentStoreData()
    const { activeKnowledgeForChat, activeKnowledge, activeKnowledgeDto, } = getKnowledgeStoreData()
    const { netActive, } = getChatToolsStoreData()


    try {
        currentContextId.value = ""
        currentChatTitle.value = $t("新对话")
        chatHistory.value = new Map()
        activeKnowledgeForChat.value = []
        netActive.value = false
        activeKnowledge.value = ""
        activeKnowledgeDto.value = null
        // 判断是否当前为智能体对话
        if (chatForAgent.value) {
            currentChatTitle.value = currentAgent.value!.agent_name
        }
        knowledgeIsClose()
    } catch (error) {
        sendLog(error as Error)
    }
}

/**
 * @description 创建新对话：发起请求
 */
export async function create_chat() {
    const { currentModel, } = getHeaderStoreData()
    const { currentContextId, } = getSiderStoreData()
    const { questionContent, } = getChatToolsStoreData()
    const { currentAgent, chatForAgent } = getAgentStoreData()


    const [model, parameters] = currentModel.value.split(":")

    try {
        const res = await post('/chat/create_chat', { model, parameters, title: questionContent.value, agent_name: currentAgent.value?.agent_name })
        currentContextId.value = res.message.context_id
        await get_chat_list()
        chatForAgent.value = false
        currentAgent.value = null
    } catch (error) {
        sendLog(error as Error)
    }
}

/**
 * @description 获取对话信息
 */
export async function getChatInfo(context_id: string) {
    const { chatHistory } = getChatContentStoreData()
    try {
        const res = await post("/chat/get_chat_info", { context_id })
        if (res.code == 200) {
            chatHistory.value = generateObject(res.message)
            // 页面加载后复原 MCP 进度时间线（使用最后一条助手消息的 mcp_progress）
            try {
                const chatToolsStore = useChatToolsStore()
                chatToolsStore.resetMcpProgress(context_id)
                const raw = res.message
                if (raw && Array.isArray(raw) && raw.length) {
                    const lastAssistant = raw[raw.length - 1]
                    const events = lastAssistant?.mcp_progress
                    if (events && Array.isArray(events) && events.length) {
                        chatToolsStore.hydrateMcpProgress(context_id, events)
                    }
                }
            } catch (_) {}
        }
        // 渲染对话历史后立即滑动到底部
        nextTick(() => eventBUS.$emit("doScroll"))
    } catch (error) {
        sendLog(error as Error)
    }
}

// 拼接对话记录
function generateObject(arr: any) {
    const result: ChatInfo = new Map();
    for (let i = 0; i < arr.length; i += 2) {
        // const key = arr[i].content;
        const key = {
            content: arr[i].content,
            files: arr[i].doc_files ? arr[i].doc_files : [],
            images: arr[i].images ? arr[i].images : []
        }
        let value
        // 单模型和多模型的内容拼接
        if (Array.isArray(arr[i + 1].content)) {
            const contentArr = []
            for (let j = 0; j < arr[i + 1].content.length; j++) {
                contentArr.push(arr[i + 1].reasoning[j] + arr[i + 1].content[j])
            }
            value = contentArr
        } else {
            value = arr[i + 1] ? (arr[i + 1].reasoning + arr[i + 1].content) : $t("模型异常，请重新生成");
        }
        result.set(key, {
            content: value,
            stat: arr[i + 1].stat,
            search_result: arr[i + 1].search_result,
            tools_result: arr[i + 1].tools_result,
            mcp_progress: arr[i + 1].mcp_progress,
            id: arr[i + 1].id
        });

    }
    return result;
}


/**
 * @description 删除对话
 */
export async function removeChat(context_id: string) {
    const { chatRemoveConfirm } = getSiderStoreData()
    try {
        const res = await post("/chat/remove_chat", { context_id })
        if (res.code == 200) {
            message.success($t("对话删除成功"))
            get_chat_list()
            chatRemoveConfirm.value = false
        } else {
            message.error(`${$t("对话删除失败：")}${res.error_msg}`)
        }
    } catch (error) {
        sendLog(error as Error)
    }

}

/**
 * @description 修改指定对话标题
 */
export async function modifyChatTitle(params: { context_id: string, title: string }) {
    const { chatModifyConfirm } = getSiderStoreData()
    try {
        const res = await post("/chat/modify_chat_title", params)
        if (res.code == 200) {
            message.success($t("对话标题修改成功"))
            get_chat_list()
            chatModifyConfirm.value = false
        } else {
            message.error(`${$t("对话标题修改失败:")}${res.error_msg}`)
        }
    } catch (error) {
        sendLog(error as Error)
    }
}



/**
 * @description 选择已有对话
 */
export async function handleChoose(e: MouseEvent, chat: ChatItemInfo) {
    const { currentContextId, currentChatTitle } = getSiderStoreData()
    const { currentChatAgent } = getAgentStoreData()
    const { userScrollSelf, } = getChatContentStoreData()
    const { currentModel, currentModelDto } = getHeaderStoreData()
    const { currentSupplierName } = getThirdPartyApiStoreData()
    const { activeKnowledgeForChat } = getKnowledgeStoreData()
    const { netActive } = getChatToolsStoreData()
    if (chat.agent_info) {
        currentChatAgent.value = chat.agent_info
    } else {
        currentChatAgent.value = null
    }
    if ((e.target! as HTMLElement).classList.contains("i-common:more-operation")) {
        return
    } else {
        userScrollSelf.value = false
        await get_chat_list()
        currentContextId.value = chat.context_id
        currentChatTitle.value = chat.title
        if (chat.supplierName == 'ollama') {
            currentModel.value = `${chat.model}:${chat.parameters}`
        } else {
            currentModel.value = `${chat.model}`
        }
        currentSupplierName.value = chat.supplierName!
        currentModelDto.value = {
            model: chat.model,
            parameters: chat.parameters,
            supplierName: chat.supplierName!
        }
        getChatInfo(currentContextId.value)
        singleActive("chat", chat.context_id)
    }
    activeKnowledgeForChat.value = chat.rag_list ? chat.rag_list : []
    chat.search_type ? netActive.value = true : netActive.value = false
}

/**
 * @description 对话操作
 */
export function doChatOperateSelect(val: string, context_id: string) {
    const { contextIdForDel, chatRemoveConfirm, contextIdForModify, newChatTitle, chatModifyConfirm } = getSiderStoreData()
    if (val == "delChat") {
        contextIdForDel.value = context_id
        chatRemoveConfirm.value = true
    } else if (val == "modifyTitle") {
        contextIdForModify.value = context_id
        newChatTitle.value = ""
        chatModifyConfirm.value = true
    }
}

/**
 * @description 新建对话
 */
export function makeNewChat() {
    const { currentChatAgent } = getAgentStoreData()
    currentChatAgent.value = null
    createNewComu()
}

/**
 * @description 折叠侧边栏
 */
export function doFold() {
    const { siderWidth, isFold } = getSiderStoreData()
    siderWidth.value = 0
    isFold.value = true
}

/**
 * @description 删除指定对话
 */
export function doChatDel(contextId: string) {
    const { contextIdForDel, chatRemoveConfirm } = getSiderStoreData()
    contextIdForDel.value = contextId
    chatRemoveConfirm.value = true
}

/***
 * @description 知识库操作
 */
export function dealPopOperation(val: string, knowledge: any) {
    if (val == "delChat") {
        removeRagConfirm(knowledge.ragName)
    } else if (val == "modifyTitle") {
        modifyRag(knowledge)
    } else if (val == "optimization") {
        optimizeTable(knowledge.ragName)
    }
}


/**
 * @description 打开第三方模型弹窗
 */
export function openThirdPartyModel() {
    const { thirdPartyApiShow } = getThirdPartyApiStoreData()
    thirdPartyApiShow.value = true
    getSupplierList()
}



/**
 * @description 清空对话
 */
export async function cleanAllChats() {
    const { chatClearConfirm } = getSiderStoreData()
    chatClearConfirm.value = true
}

/**
 * @description 取消清空对话
 */
export function cancelCleanAllChats() {
    const { chatClearConfirm } = getSiderStoreData()
    chatClearConfirm.value = false
}

/**
 * @description 确定清空对话
 */
export async function confirmCleanAllChats() {
    const { chatHistory } = getChatContentStoreData()
    const { chatList } = getSiderStoreData()
    await delConfirm({
        title: "提示",
        content: "是否删除所有对话?"
    })
    const all_context_id = chatList.value.map(item => item.context_id).join(",")
    await post("/chat/remove_chat", { context_id: all_context_id })
    message.success("删除成功")
    get_chat_list()
    chatHistory.value = new Map()
    cancelCleanAllChats()
}
