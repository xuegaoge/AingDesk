import { nextTick, ref } from "vue"
import { post } from "@/api"
import axios from "axios"
import { eventBUS } from "@/views/Home/utils/tools"
import { sendLog } from "@/views/Home/controller"
import { create_chat, getChatInfo } from "@/views/Sider/controller"
import { message, } from "@/utils/naive-tools"
import type { ChatInfo, MultipeQuestionDto, MultipleModelListDto } from "@/views/Home/dto"
import i18n from "@/lang";

import { getSiderStoreData } from "@/views/Sider/store"
import { getChatContentStoreData } from "@/views/ChatContent/store"
import { getKnowledgeStoreData } from "@/views/KnowleadgeStore/store"
import { getAgentStoreData } from "@/views/Agent/store"
import { getChatToolsStoreData, useChatToolsStore } from "../store"
import { getHeaderStoreData } from "@/views/Header/store"
import { getSoftSettingsStoreData } from "@/views/SoftSettings/store"
import { getThirdPartyApiStoreData } from "@/views/ThirdPartyApi/store"

const $t = i18n.global.t


/**
 * @description 发送对话
 */
type ChatParams = {
    user_content: string
    doc_files?: string
    images?: string
    regenerate_id?: string
    [key: string]: any
}
export async function sendChat(params: ChatParams, multiModelList?: Array<MultipleModelListDto>) {
    const { currentModel, multipleModelList } = getHeaderStoreData()
    const { currentContextId, } = getSiderStoreData()
    const { targetNet, } = getSoftSettingsStoreData()
    const { currentTalkingChatId, isInChat, chatHistory, } = getChatContentStoreData()
    const { activeKnowledgeForChat, } = getKnowledgeStoreData()
    const { netActive, temp_chat, mcpListChoosed, mcpStreamOffsets } = getChatToolsStoreData()
    const { currentSupplierName } = getThirdPartyApiStoreData()
    const { compare_id } = getChatToolsStoreData()
    const chatToolsStore = useChatToolsStore()
    const chatAxiosArr = []

    /********** 单模型及多模型下的ollama处理 ***********/
    // 单模型下的model和parameters
    let model, parameters;
    if (multiModelList) {
        // 多模型ollama处理
        for (let modelParams of multiModelList) {
            if (modelParams.supplierName == "ollama") {
                [modelParams.model, modelParams.parameters] = modelParams.model.split(":")
            }
        }
    } else {
        // 单模型ollama处理
        if (currentSupplierName.value == "ollama") {
            [model, parameters] = currentModel.value.split(":")
        } else {
            model = currentModel.value
            parameters = ""
        }
    }

    /********** 发送对话 ***********/
    // 如果当前对话不存在则创建对话
    try {
        if (!currentContextId.value) {
            await create_chat()
        }
        currentTalkingChatId.value = currentContextId.value
        // 重置当前对话的 MCP 进度（避免上一次残留）
        chatToolsStore.resetMcpProgress(currentContextId.value)
        // 找到当前对话的记录
        let currentChat: null | MultipeQuestionDto = null;
        for (let [key] of chatHistory.value) {
            if (key.content == params.user_content) {
                currentChat = key
            }
        }

        if (!multiModelList) {
            // 单模型下发送对话
            await axios.post("http://192.168.0.254:8081/chat/chat", {
                model,
                parameters,
                supplierName: currentSupplierName.value,
                context_id: currentContextId.value,
                search: netActive.value ? targetNet.value : "",
                rag_list: JSON.stringify(activeKnowledgeForChat.value),
                temp_chat: String(temp_chat.value),
                mcp_servers: mcpListChoosed.value,
                ...params
            }, {
                responseType: 'text',
                onDownloadProgress: (progressEvent: any) => {
                    // 获取当前接收到的部分响应数据
                    const currentResponse = progressEvent.event.currentTarget.responseText;
                    // 增量解析 <mcptool>，派发 MCP 进度事件
                    try {
                        const key = `${currentContextId.value}:single`
                        const prevOffset = mcpStreamOffsets.value.get(key) || 0
                        const chunk = currentResponse.slice(prevOffset)
                        mcpStreamOffsets.value.set(key, currentResponse.length)
                        const reg = /<mcptool>([\s\S]*?)<\/mcptool>/g
                        let match: RegExpExecArray | null
                        while ((match = reg.exec(chunk)) !== null) {
                            const jsonStr = match[1].trim()
                            try {
                                const obj = JSON.parse(jsonStr)
                                if (obj && obj.type === 'progress') {
                                    chatToolsStore.appendMcpProgress(currentContextId.value, {
                                        ts: Date.now(),
                                        event: obj.event || obj.step || 'progress',
                                        payload: obj
                                    })
                                }
                            } catch (_) {
                                // 忽略解析失败，避免中断流式渲染
                            }
                        }
                    } catch (_) {}
                    // 防止切换带来的错误
                    if (currentTalkingChatId.value == currentContextId.value) chatHistory.value.set(currentChat!, { content: currentResponse, stat: { model: currentModel.value }, id: "" })
                }
            })
        } else {
            
            for (let i = 0; i < multiModelList!.length; i++) {
                const chatAxios = axios.post("http://192.168.0.254:8081/chat/chat", {
                    model: multiModelList![i].model,
                    parameters: multiModelList![i].parameters,
                    supplierName: multiModelList![i].supplierName,
                    context_id: currentContextId.value,
                    search: netActive.value ? targetNet.value : "",
                    rag_list: JSON.stringify(activeKnowledgeForChat.value),
                    temp_chat: String(temp_chat.value),
                    mcp_servers: mcpListChoosed.value,
                    compare_id: compare_id.value,
                    ...params
                }, {
                    responseType: 'text',
                    onDownloadProgress: (progressEvent: any) => {
                        // 获取当前接收到的部分响应数据
                        const currentResponse = progressEvent.event.currentTarget.responseText;
                        // 增量解析 <mcptool>，派发 MCP 进度事件（按模型通道）
                        try {
                            const key = `${currentContextId.value}:${i}`
                            const prevOffset = mcpStreamOffsets.value.get(key) || 0
                            const chunk = currentResponse.slice(prevOffset)
                            mcpStreamOffsets.value.set(key, currentResponse.length)
                            const reg = /<mcptool>([\s\S]*?)<\/mcptool>/g
                            let match: RegExpExecArray | null
                            while ((match = reg.exec(chunk)) !== null) {
                                const jsonStr = match[1].trim()
                                try {
                                    const obj = JSON.parse(jsonStr)
                                    if (obj && obj.type === 'progress') {
                                        chatToolsStore.appendMcpProgress(currentContextId.value, {
                                            ts: Date.now(),
                                            event: obj.event || obj.step || 'progress',
                                            payload: obj
                                        })
                                    }
                                } catch (_) {
                                    // 忽略解析失败
                                }
                            }
                        } catch (_) {}
                        // 防止切换带来的错误
                        if (currentTalkingChatId.value == currentContextId.value) {
                            const chat = chatHistory.value.get(currentChat!)
                            chat!.content = [...chat?.content as string[]]
                            chat!.content[i] = currentResponse;
                            (chat!.stat as any)[i] = { model: multiModelList![i].model } as any
                            chat!.id = ""
                            // chatHistory.value.set(currentChat!, { content: currentResponse, stat: { model: currentModel.value }, id: "" })
                        }
                    }
                })

                chatAxiosArr.push(chatAxios)
            }
        }

        await Promise.all(chatAxiosArr)
        /***** 请求结束行为可以在此执行 *****/
        const lastChhat = await post("/chat/get_last_chat_history", { context_id: currentContextId.value })
        // 获取最后一条对话信息并拼接到对话历史中
        if (chatHistory.value.get(currentChat!)) {
            // chatHistory.value.get(params.user_content)!.stat = lastChhat.message.eval_count
            Object.assign(chatHistory.value.get(currentChat!)!.stat as Object, lastChhat.message.stat)
            chatHistory.value.get(currentChat!)!.search_result = lastChhat.message.search_result as Array<any>
            chatHistory.value.get(currentChat!)!.id = lastChhat.message.id

            console.log(chatHistory.value)
        }
        // 渲染mermaid
        eventBUS.$emit("answerRendered")
        isInChat.value = false
    } catch (error) {
        sendLog(error as Error)
    }
}



/**
 * @description 终止对话生成
 */
export async function stopGenerate() {
    const { currentContextId } = getSiderStoreData()
    const { isInChat } = getChatContentStoreData()
    try {
        const res = await post("/chat/stop_generate", { context_id: currentContextId.value })
        if (res.code == 200) {
            message.success($t("对话已停止"))
        }
        isInChat.value = false
        await post("/chat/get_last_chat_history", { context_id: currentContextId.value })
        await getChatInfo(currentContextId.value)
    } catch (error) {
        sendLog(error as Error)
    }
}

/**
 * @description 文件上传限制
 */
export const fileLimit = [
    "docx",
    "doc",
    "xlsx",
    "xls",
    "csv",
    "pptx",
    "ppt",
    "pdf",
    "html",
    "htm",
    "md",
    "markdown",
    "txt",
    "log",
]

export const imageLimit = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "webp",
]

export const acceptFileType = [...fileLimit, ...imageLimit].reduce((p, v) => {
    return p + `.${v},`
}, "")

/**
 * @description 选择文件
 */
export function chooseQuestionFiles() {
    const { questionFilesRef } = getChatToolsStoreData()
    questionFilesRef.value.click()
}

/**
 * @description 上传附件：文件选择回调
 */
export function filesChange() {
    const { questionFilesRef, questionFileList, questionImageList, questionImages, questionFiles, questionFilesCache } = getChatToolsStoreData()
    const sizeCheck = checkFileSize(questionFilesRef.value.files[0])
    if (!sizeCheck) return
    const ext = questionFilesRef.value.files[0].name.split('.').pop()
    if (fileLimit.includes(ext)) {
        questionFileList.value.push(questionFilesRef.value.files[0].name)
        questionFiles.value.push(questionFilesRef.value.files[0].path)
        questionFilesCache.value.push(questionFilesRef.value.files[0])
    } else if (imageLimit.includes(ext)) {
        questionImageList.value.push(questionFilesRef.value.files[0].name)
        questionImages.value.push(questionFilesRef.value.files[0].path)
        questionFilesCache.value.push(questionFilesRef.value.files[0])
    }
    questionFilesRef.value.value = '';
}

/**
 * @description 删除上传的文件
 */
export function removeFile(index: number) {
    const { questionFileList, questionFiles, questionFilesCache } = getChatToolsStoreData()
    const fileName = questionFileList.value.splice(index, 1)
    questionFiles.value.splice(index, 1)
    removeFileFromeCache(fileName[0])
}

/**
 * @description 删除上传的图片
 */
export function removeImage(index: number) {
    const { questionImages, questionImageList, questionFilesCache } = getChatToolsStoreData()
    const fileName = questionImageList.value.splice(index, 1)
    questionImages.value.splice(index, 1)
    removeFileFromeCache(fileName[0])
}


/**
* 
* 文件缓存
* 清除缓存中的指定文件
 */
export function removeFileFromeCache(fileName: string) {
    const { questionFilesCache } = getChatToolsStoreData()
    questionFilesCache.value = questionFilesCache.value.filter(item => item.name !== fileName)
}

/**
 * 
 * 计算文件缓存中所有文件大小总和与20mb的比较
 */
export function checkFileSize(file: File) {
    const { questionFilesCache } = getChatToolsStoreData()
    const totalSize = questionFilesCache.value.reduce((p, v) => {
        return p + v.size
    }, 0)
    if (totalSize + file.size > 20 * 1024 * 1024) {
        message.warning($t("附件总大小不能超过20MB"))
        return false
    }
    return true
}

/**
 * @description 滚动条
 */
export function scrollMove() {
    const { scrollRef, userScrollSelf } = getChatContentStoreData()
    let timer: any = null
    return (delay: number) => {
        if (!timer) {
            timer = setTimeout(() => {
                const scrollWrapper = document.querySelector("#scroll-bar .n-scrollbar-content") as HTMLDivElement
                if (userScrollSelf.value) {
                    clearTimeout(timer)
                    timer = null
                    return
                }
                if (scrollRef.value) {
                    scrollRef.value.scrollTo({
                        top: scrollWrapper.offsetHeight,
                        behavior: "instant"
                    })
                    clearTimeout(timer)
                }
                timer = null
            }, delay)
        }
    }
}


/**
 * @description 发送对话内容到模型
 */
export function sendChatToModel() {
    const { isInChat, userScrollSelf, chatHistory } = getChatContentStoreData()
    const { questionContent, questionFiles, questionImages, questionFileList, questionImageList, questionFilesCache, compare_id } = getChatToolsStoreData()
    const { currentModel, multipleModelList } = getHeaderStoreData()
    const { currentSupplierName } = getThirdPartyApiStoreData()

    if (!questionContent.value.trim()) return

    if (!currentModel.value) {
        message.warning($t("请选择对应模型"))
        return
    }
    isInChat.value = true
    userScrollSelf.value = false
    /********** 准备对话的key，用于拼装对话历史记录 **********/
    // 获取清除所有空格的提问内容
    const formatQuestionContent = questionContent.value.replace(/\n/g, '<br>')
    // 拼接对话历史的完整key
    const chatKey = {
        content: formatQuestionContent,
        files: questionFiles.value,
        images: questionImages.value
    }
    // 立即滚动到最底部
    nextTick(() => eventBUS.$emit("chat-tool-do-scroll"))


    /********** 进行单模型和多模型的对话记录拼接 ***********/
    if (multipleModelList.value.length == 0) { // 如果是单模型，则直接拼装
        // 将chatKey拼装到对话历史记录中
        chatHistory.value.set(chatKey, { content: "", stat: { model: currentModel.value }, search_result: [] })
        // 单模型请求
        sendChat({
            user_content: formatQuestionContent,
            images: questionImages.value.join(","),
            doc_files: questionFiles.value.join(",")
        })
    } else { // 如果是多模型，则进行多模型拼装
        const chatModelParams: MultipleModelListDto[] = [...multipleModelList.value, { model: currentModel.value, supplierName: currentSupplierName.value }]
        // 多模型对话历史拼装,基本结构
        chatHistory.value.set(chatKey, { content: [], stat: [], search_result: [] })
        // 遍历多模型列表，完善多模型历史对话结构
        for (let i = 0; i < chatModelParams.length; i++) {
            const chat = chatHistory.value.get(chatKey)!;
            chat.content = [...(chat.content as string[])];
            chat.content[i] = "";
            chat.stat = chat.stat as any[];
            chat.stat[i] = { model: chatModelParams[i].model };
        }
        // 多模型请求
        sendChat({
            user_content: formatQuestionContent,
            images: questionImages.value.join(","),
            doc_files: questionFiles.value.join(",")
        }, chatModelParams)
    }


    questionContent.value = ""
    questionFiles.value = []
    questionImages.value = []
    questionFileList.value = []
    questionImageList.value = []
    questionFilesCache.value = []
}

/**
 * @description 键盘发送
 */
export function sendChartToModelForKeyBoard(event: KeyboardEvent) {
    const { isInChat } = getChatContentStoreData()
    if (isInChat.value) return
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (event.keyCode == 13) {
            sendChatToModel()
        }
    }
}

/**
 * @description 是否启用联网搜索
 */
export function useSearchEngine() {
    const { netActive, } = getChatToolsStoreData()
    netActive.value = !netActive.value
}


/**
 * @description 打开临时对话
 */
export function useTempChat() {
    const { temp_chat, } = getChatToolsStoreData()
    temp_chat.value = !temp_chat.value
}


/**
 * @description 获取已安装的MCP列表
 */
export async function getMcpServerListForChat() {
    const { mcpListForChat } = getChatToolsStoreData()
    try {
        const res = await post('/mcp/get_mcp_server_list');
        mcpListForChat.value = res.message
    } catch (error) {
        sendLog(error as Error)
    }
}

/**
 * @description 在对话工具时，选择mcp进行对话
 */
export function chooseMcpServerForChat(mcpName: string) {
    const { mcpListChoosed } = getChatToolsStoreData()
    if (mcpListChoosed.value.includes(mcpName)) {
        mcpListChoosed.value = mcpListChoosed.value.filter(item => item !== mcpName)
    } else {
        mcpListChoosed.value.push(mcpName)
    }
}

