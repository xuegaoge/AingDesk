import type { McpServerListDto } from "@/views/Home/dto";
import { defineStore, storeToRefs } from "pinia";
import { ref } from "vue";

// MCP 进度事件结构
export type McpProgressEvent = {
    ts: number
    event: string
    payload?: any
}

export const useChatToolsStore = defineStore("chatTools", () => {
    // 根据模型状态确定当前对话是否可用
    const chatMask = ref({
        status: false,
        notice: ""
    })
    // 提问内容
    const questionContent = ref("")
    // 提问上传文件列表
    const questionFileList = ref<any>([])
    // 提问上传的图片列表
    const questionImageList = ref<any>([])
    // 提问上传的文件缓存
    const questionFilesCache = ref<File[]>([])
    // 提问的文件域
    const questionFilesRef = ref()
    // 提问携带的文件
    const questionFiles = ref<string[]>([])
    // 提问携带的图片
    const questionImages = ref<string[]>([])
    // 开启单次临时对话
    const temp_chat = ref(false)
    // 激活联网搜索
    const netActive = ref(false)
    // 已安装的mcp列表
    const mcpListForChat = ref<McpServerListDto[]>([])
    // 对话时选择的mcp
    const mcpListChoosed = ref<string[]>([])
    // 多模型对话的唯一id
    const compare_id = ref<string>("")

    // MCP 进度：按对话ID聚合
    const mcpProgress = ref<Map<string, McpProgressEvent[]>>(new Map())
    // 流式解析偏移：避免重复解析，key 采用 `${contextId}:${channel}`
    const mcpStreamOffsets = ref<Map<string, number>>(new Map())

    // 追加进度事件
    function appendMcpProgress(chatId: string, evt: McpProgressEvent) {
        const list = mcpProgress.value.get(chatId) || []
        list.push(evt)
        mcpProgress.value.set(chatId, list)
    }

    // 重置当前对话的进度事件与偏移
    function resetMcpProgress(chatId: string) {
        mcpProgress.value.set(chatId, [])
        // 清除所有 channel 偏移（single/multi）
        for (const key of mcpStreamOffsets.value.keys()) {
            if (key.startsWith(`${chatId}:`)) {
                mcpStreamOffsets.value.delete(key)
            }
        }
    }

    // 启动时或页面刷新后的进度复原（hydration）
    function hydrateMcpProgress(chatId: string, events: McpProgressEvent[]) {
        try {
            const list: McpProgressEvent[] = Array.isArray(events) ? events.map((e: any) => ({
                ts: typeof e.ts === 'number' ? e.ts : Date.now(),
                event: e.event || e.step || 'progress',
                payload: e
            })) : []
            mcpProgress.value.set(chatId, list)
        } catch (_) {
            // 静默处理，避免影响页面加载
            mcpProgress.value.set(chatId, [])
        }
    }
    return {
        chatMask,
        questionContent,
        questionFileList,
        questionImageList,
        questionFilesCache,
        questionFilesRef,
        questionFiles,
        questionImages,
        temp_chat,
        netActive,
        mcpListForChat,
        mcpListChoosed,
        compare_id,
        mcpProgress,
        mcpStreamOffsets,
        appendMcpProgress,
        resetMcpProgress,
        hydrateMcpProgress
    }
})

export function getChatToolsStoreData() {
    return storeToRefs(useChatToolsStore())
}
