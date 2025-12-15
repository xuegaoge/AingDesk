<template>
    <!-- 联网搜索 -->
    <n-collapse v-if="searchResult && searchResult.length">
        <n-collapse-item :title="$t('共参考{0}份资料', [searchResult.length])">
            <n-list>
                <n-list-item v-for="(item, index) in searchResult" :key="item.link">
                    <n-tooltip trigger="hover">
                        <template #trigger>
                            <div>
                                [{{ index + 1 }}] <n-button text @click="jumpThroughLink(item.link)">{{
                                    item.title ? item.title : item.link }}</n-button>
                            </div>
                        </template>
                        {{ item.link }}
                    </n-tooltip>
                </n-list-item>
            </n-list>
        </n-collapse-item>
    </n-collapse>

    <n-divider v-if="searchResult && searchResult.length" />
    <ThinkWrapper
        :content="content.match(/<think>([\s\S]*?)(?:<\/think>|$)/) ? content.match(/<think>([\s\S]*?)(?:<\/think>|$)/)![1] : ''"
        v-if="content.match(/<think>([\s\S]*?)(?:<\/think>|$)/)" />
    <!-- <McpToolsWrapper
        :content="content.match(/<mcptool>([\s\S]*?)(?:<\/mcptool>|$)/) ? content.match(/<mcptool>([\s\S]*?)(?:<\/mcptool>|$)/)![1] : ''"
        v-if="content.match(/<mcptool>([\s\S]*?)(?:<\/mcptool>|$)/)" /> -->
    <!-- MCP 进度时间线 -->
    <McpProgressTimeline />
    <!-- 回答过程中的渲染（仅保留 type==='result' 的 mcptool 片段） -->
    <McpToolsWrapper v-for="(item, index) in tools_content_arr" :key="index" :content="item" />
    <!-- 获取信息后的渲染 -->
    <McpToolsWrapper :content="item" v-if="tools_result && tools_result.length" v-for="(item, index) in tools_result"
        :key="index" />
    <div ref="markdownRef" class="markdown-content" v-html="answerContent"></div>
</template>

<script setup lang="tsx">
import { getSoftSettingsStoreData } from '@/views/SoftSettings/store/index.ts';
import { getChatToolsStoreData } from '@/views/ChatTools/store/index.ts';
import markdownit from 'markdown-it'
import hljs from 'highlight.js';
import ThinkWrapper from "./ThinkWrapper.vue";
import McpToolsWrapper from "./McpToolsWrapper.vue";
import McpProgressTimeline from "./McpProgressTimeline.vue";
import MermaidRender from './MermaidRender.vue';
import { eventBUS } from '@/views/Home/utils/tools.tsx';
import { useI18n } from 'vue-i18n';
import mk from "@vscode/markdown-it-katex"
import { getAnswerStoreData } from "@/views/Answer/store"
import {
    replaceLatexMathDelimiters,
    jumpThroughLink
} from "@/views/Answer/controller"
import { render } from 'vue';
import { useClipboard } from '@vueuse/core';
import { message } from '@/utils/naive-tools';
const { copy } = useClipboard({ legacy: true })

const { markdownRef } = getAnswerStoreData()
const { t: $t } = useI18n()
const { themeColors, themeMode, currentLanguage } = getSoftSettingsStoreData()
const { questionContent } = getChatToolsStoreData()
const tools_content_arr = computed(() => {
    const matches = props.content.match(/<mcptool>([\s\S]*?)<\/mcptool>/g) || []
    const items = matches.map(match => match.replace(/<mcptool>|<\/mcptool>/g, "").trim())
    // 过滤仅展示结果类事件
    const filtered = [] as string[]
    for (const it of items) {
        try {
            const obj = JSON.parse(it)
            if (obj && obj.type === 'result') {
                filtered.push(it)
            }
        } catch {
            // 如果解析失败，保守展示（避免误过滤实际结果）
            filtered.push(it)
        }
    }
    return filtered
})

const props = defineProps<{ content: string, searchResult?: Array<{ content: string, link: string, title: string }>, tools_result?: Array<string> }>()
const answerContent = ref("")

const md = markdownit({
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

        return str;
    }
})
md.use(mk, {
    throwOnError: false,
})


md.renderer.rules.fence = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const lang = token.info || '';
    const code = token.content;
    const highlightedCode = options.highlight!(code, lang, "");
    const toolbarPlaceholder = `<div class="tool-header" data-lang="${lang}"><div class="tool-header-tit">${lang}</div><div class="tool-placeholder"><div class="tool-wrapper"><span class="tool-copy" data-code="${encodeURIComponent(code)}">${$t("复制")}</span><span class="tool-reference" data-code="${encodeURIComponent(code)}">${$t("引用")}</span></div></div></div>`;
    if (lang == "mermaid") {
        return `<div class="mermaid-wrapper" data-code="${code}">${highlightedCode}</div>`
    } else {
        return `<pre class="hljs"><div class="hljs-wrapper">${toolbarPlaceholder}<code${lang ? ` class="${lang} code-block"` : ''}>${highlightedCode}</code></div></pre>`
    }
};

// 覆盖默认的链接渲染器，设置 target="_blank" 和 rel="noopener noreferrer"
const defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
};

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    // 为链接添加 target="_blank" 属性
    tokens[idx].attrPush(['target', '_blank']);

    // 添加安全相关属性，防止新页面对原页面的访问，增强安全性
    tokens[idx].attrPush(['rel', 'noopener noreferrer']);

    // 调用默认渲染
    return defaultRender(tokens, idx, options, env, self);
};


/**
 * @description 监听markdown内容变化，渲染think部分内容
 */
watch(() => props.content, () => {
    const res = md.render(props.content.replace(/<think>([\s\S]*?)(?:<\/think>|$)/, "").replace(/<mcptool>([\s\S]*?)(?:<\/mcptool>|$)/g, ""))  // 正文渲染时取消think部分
    answerContent.value = replaceLatexMathDelimiters(res);
}, { immediate: true })


// 根据主题计算当前应用的颜色模式
const themeMarkdownBg = computed(() => {
    if (themeMode.value == "light") {
        return {
            code: themeColors.value.markdownCodeLight,
            tool: themeColors.value.markdownToolsLight,
            fontColor: themeColors.value.markdownToolsFontColorLight
        }
    } else {
        return {
            code: themeColors.value.markdownCOdeDark,
            tool: themeColors.value.markdownToolsDark,
            fontColor: themeColors.value.markdownToolsFontColorDark
        }
    }
})


// 监听当前语言变化
watch(currentLanguage, () => {
    const copySpanList = document.querySelectorAll(".tool-copy")
    copySpanList.forEach((span) => {
        (span as HTMLSpanElement).innerText = $t("复制")
        span.addEventListener("click", () => {
            console.log(span)
            copy((span as HTMLSpanElement).dataset.code!)
        })
    })
    const referenceSpanList = document.querySelectorAll(".tool-reference")
    referenceSpanList.forEach(span => {
        (span as HTMLSpanElement).innerText = $t("引用")
    })
})


/**
 * @description 加载完成后/回答完成后渲染mermaid
 */
function doMermaidRender() {
    const mermaidDivWrappers = document.querySelectorAll(".mermaid-wrapper")
    for (let i = 0; i < mermaidDivWrappers.length; i++) {
        const RenDerCmpt = defineComponent({
            setup() {
                const id = (new Date()).getTime().toString()
                return () => <MermaidRender maidContent={(mermaidDivWrappers[i] as HTMLDivElement).dataset.code!} id={`mermaid-svg-${i}`} />
            }
        })
        mermaidDivWrappers[i].innerHTML = ""
        render(h(RenDerCmpt), mermaidDivWrappers[i])
    }
}


/**
 * @description markdown渲染结束后立即进行工具、思考等处理过程
 */
function dealThinkAndTools() {
    let timer: any = null
    const { questionContent, } = getChatToolsStoreData()
    const { markdownRef } = getAnswerStoreData()
    return () => {
        if (timer) {
            clearTimeout(timer)
            timer = null
        } else {
            timer = setTimeout(() => {
                // 处理工具条
                const toolHeaders = markdownRef.value?.querySelectorAll(".tool-header")
                if (toolHeaders?.length) {
                    toolHeaders.forEach(item => {
                        const copyBtns = item.querySelectorAll(".tool-copy")
                        const referenceBtns = item.querySelectorAll(".tool-reference")
                        // 监听工具栏的拷贝内容
                        copyBtns.forEach((copyBtn) => {
                            copyBtn.addEventListener("click", () => {
                                console.log(2222)
                                copy(decodeURIComponent((copyBtn as HTMLSpanElement).dataset.code as string))
                                message.success($t("复制成功"))
                            }, true)
                        })

                        // 监听引用工具操作
                        referenceBtns.forEach(referenceBtn => {
                            referenceBtn.addEventListener("click", () => {
                                questionContent.value = decodeURIComponent((referenceBtn as HTMLSpanElement).dataset.code as string)
                            })
                        })
                    })
                }
            }, 300)
        }
    }
}

// 在生命周期中处理think和工具
const mountedDeal = dealThinkAndTools()
onMounted(() => {
    doMermaidRender()
    mountedDeal()
})
onUpdated(() => {
    nextTick(() => {
        mountedDeal()
        // 执行滚动
        eventBUS.$emit("doScroll")
    })
})
// 监听回答完成后的mermaid渲染
eventBUS.$on("answerRendered", doMermaidRender)
</script>


<style lang="scss">
@import 'katex/dist/katex.min.css';

.tool-wrapper {
    padding: 0 var(--bt-pd-normal) 0 0;
    height: 40px;
    display: flex;
    gap: var(--bt-mg-small);
    justify-content: flex-end;
    align-items: center;

    span {
        cursor: pointer;
    }
}

.markdown-content {
    // font-size: 16px;

    p {
        margin-block-end: 1em;
    }

    ul {
        padding-inline-start: 40px;
        margin: var(--bt-mg-small);

        li {
            list-style: initial;
        }
    }

    ol {
        li {
            list-style: initial;
        }
    }

    .hljs-wrapper {
        overflow-x: auto;
        background-color: v-bind("themeMarkdownBg.code");
        padding: 40px var(--bt-pd-normal) 0;
        position: relative;

        .tool-header {
            height: 40px;
            width: 100%;
            background-image: linear-gradient(60deg, #29323c 0%, #485563 100%);
            position: absolute;
            left: 0;
            top: 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-family: "Microsoft YAHEI";
            color: #fff;

            .tool-header-tit {
                padding-left: var(--bt-pd-normal);
            }

            .tool-list {
                height: 40px;
                min-width: 300px;
            }
        }

        .top-tools {
            width: 100%;
            height: 40px;
            background-color: #ff3300;
        }

        .hljs {
            background-color: v-bind("themeMarkdownBg.code");
            padding: var(--bt-pd-normal);


            code {
                display: inline-block;
                width: 100%;
                background-color: transparent;
                padding: 0;
                white-space: pre-line;
            }

            img {
                width: 100%;
            }
        }

        .code-block {
            width: 100%;
            box-sizing: border-box;
            overflow-x: auto;

        }
    }

    code {
        // background-color: #F9FAFB;
        background-color: transparent;
        padding: 3px;
    }



    blockquote {
        background-color: #F5F5F5;
        padding: 2px 0 2px 5px;
        margin: var(--bt-mg-small) 0 0 0;

        p {
            margin: 0;
        }
    }
}


code {
    display: inline-block;
}

.hljs {
    background-color: transparent !important;
    color: v-bind("themeMarkdownBg.fontColor") !important;
    white-space: pre-wrap;
}
</style>
