<template>
    <div :class="['think-wrapper', { 'is-close': isClose }]" ref="wrapperRef" v-if="content.replace(/\s/g, '')">
        <div class="has-thought cursor-pointer" @click="toggle">
            <span class="flex items-center gap-2.5 h-15 text-12px">
                <i class="i-si:check-circle-fill w-16 h-16 text-[#fff]"></i>{{ $t("调用结果:") }}
                [{{ mcpToolContent.tool_server }}--{{ mcpToolContent.tool_name }}]
            </span>
            <span>
                <i class="i-si:expand-less-alt-fill w-16 h-16 cursor-pointer" v-if="!isClose"></i>
                <i class="i-si:expand-more-alt-fill w-16 h-16 cursor-pointer" v-else></i>
            </span>
        </div>
        <pre class="content-pre">{{ preCOntent }}</pre>
    </div>
</template>

<script setup lang="ts">
/* import hljs from 'highlight.js';
import markdownit from 'markdown-it' */

import { getSoftSettingsStoreData } from '@/views/SoftSettings/store';
const {
    themeColors,
    themeMode
} = getSoftSettingsStoreData()
const props = defineProps<{ content: string }>()
const mcpToolContent = computed(() => {
    return JSON.parse(props.content.replace(/<mcptool>|<\/mcptool>/g, '').trim())
})
// 错误文本判定（扩充常见 MCP/Claude Code 错误提示）
const errorPatterns = [
    /invalid/i,
    /File does not exist/i,
    /EISDIR/i,
    /illegal operation/i,
    /Error:/i,
    /has not been read yet/i,
    /Read it first/i,
    /未读取/i,
    /请先读取/i
]

function isErrorText(txt: string) {
    return errorPatterns.some(r => r.test(txt))
}

const filteredResults = computed(() => {
    const results = Array.isArray(mcpToolContent.value.tool_result) ? mcpToolContent.value.tool_result : []
    // 仅展示“最新一次”的工具结果，避免出现错误时回退展示历史成功结果导致的页面信息陈旧问题
    if (results.length > 0) {
        return [results[results.length - 1]]
    }
    return []
})

const preCOntent = computed(() => {
    const resStrList: string[] = []
    const items = filteredResults.value
    for (let i = 0; i < items.length; i++) {
        const itm = items[i]
        if (itm.type == "text") {
            try {
                const parRes = JSON.parse(itm.text)
                resStrList.push(JSON.stringify(parRes, null, 4))
            } catch (error) {
                resStrList.push(itm.text)
            }
        } else {
            resStrList.push(JSON.stringify(itm))
        }
    }
    // 去重同内容（仅保留一次）
    return Array.from(new Set(resStrList)).join('\n')
})
const isClose = ref(true)
const wrapperRef = ref()
const thinkContent = ref("")
/* const md = markdownit({
    html: true,
    linkify: true,
    typographer: true,
    langPrefix: 'language-',
    highlight(str, lang): string {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(lang, str, true).value
            } catch (__) { }
        }

        return md.utils.escapeHtml(str);
    }
}) */

// md.use(mathJax3)
/* watch(() => props.content, () => {
    const renderStr = JSON.stringify(JSON.parse(mcpToolContent.value.tool_result[0].text), null, 4)
    const res = md.render(renderStr)  // 正文渲染时取消think部分
    thinkContent.value = res
}, { immediate: true }) */

// 关闭思考
function closeThink() {
    isClose.value = true
}


// 打开思考
function openThink() {
    isClose.value = false
    wrapperRef.value.style.height = "auto"
}

// 思考面板开关切换
function toggle() {
    isClose.value = !isClose.value
}


/**
 * @description 根据主题计算当前应用的颜色模式
 */
const themeThinkBg = computed(() => {
    if (themeMode.value == "light") {
        return themeColors.value.thinkWrapperLight
    } else {
        {
            return themeColors.value.thinlWrapperDark
        }
    }
})
</script>

<style scoped lang="scss">
@use "@/assets/base";

.think-wrapper {
    margin-bottom: 5px;
    background-color: v-bind(themeThinkBg);
    box-sizing: border-box;
    transition:  0.5s ease;
    overflow: hidden;

    .has-thought {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-image: linear-gradient(22deg, rgb(11, 163, 96) 0%, #3cba92 100%);
        padding: 10px;
        color: #fff;
    }
    .think-content {
        line-height: 28px;
    }

    &.is-close {
        height: 42px;
    }
}

.is-close {
    max-height: 42px;
}

.content-pre {
    font-family: "microsoft YAHEI";
    padding-left: 26px;
    white-space: pre-wrap;
    overflow-wrap: break-word;
}
</style>
