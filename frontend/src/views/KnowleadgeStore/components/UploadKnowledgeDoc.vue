<template>
    <n-modal :close-on-esc="false" :mask-closable="false" :title="$t('上传知识库文档')" v-model:show="knowledgeUploadDocShow" preset="card" draggable class="w-580px" segmented>
        <n-spin :description="$t('正在解析文档，这可能要几分钟时间...')" v-model:show="isUploadingDoc">
            <div class="upload-wrapper">
                <div class="mode-choose" v-if="chooseList.length == 0">
                    <n-radio-group v-model:value="uploadMode">
                        <n-radio value="file">{{ $t("上传文件") }}</n-radio>
                        <n-radio value="dir">{{ $t("上传文件夹") }}</n-radio>
                    </n-radio-group>
                </div>
                <div :class="['upload-area-wrapper', { 'wait': chooseList.length == 0 }]">
                    <input type="file" @change="handleFileChange" multiple :webkitdirectory="uploadMode == 'dir'"
                        ref="fileUpload" style="display: none" :accept="acceptFileType" />
                    <div class="upload-area" v-if="chooseList.length == 0" @click="chooseFiles" ref="dragAreaRef">
                        <i class="i-tdesign:folder-add w-40 h-40"></i>
                        <n-button type="primary">{{ $t("点击上传") }}</n-button>
                        <div class="text-[#909399] flex justify-center flex-col px-5">
                            {{ $t("文件支持类型") }}:
                            <div class="flex flex-wrap">
                                <span v-for="item in fileType" :key="item" type="default" style="margin:0 5px">.{{ item
                                    }}</span>
                            </div>
                        </div>
                    </div>

                    <n-scrollbar style="min-height: 200px; max-height: 600px;" v-else>
                        <n-button @click="sliceSettings" type="info" size="small">{{ $t("文档分片设置") }}</n-button>
                        <n-list hoverable>
                            <n-list-item v-for="item in chooseList" :key="item">
                                <div class="file-list-item">
                                    <span>{{ item.name }}</span>
                                    <i class="i-ri:close-circle-line w-20 h-20 text-[#909399]"
                                        @click="removeFile(item)"></i>
                                </div>
                            </n-list-item>
                        </n-list>
                    </n-scrollbar>
                </div>
            </div>
        </n-spin>

        <template #footer>
            <div class="modal-footer-btns">
                <n-button :disabled="isUploadingDoc" @click="doCancel">{{ $t('取消') }}</n-button>
                <n-button :disabled="isUploadingDoc" type="info" @click="uploadAhead" v-if="fileOrDirList.length">{{ $t('继续添加文件') }}</n-button>
                <n-button :disabled="isUploadingDoc || fileOrDirList.length == 0" type="primary"
                    @click="doOk">{{ $t('确认') }}</n-button>
            </div>
        </template>
    </n-modal>
</template>

<script setup lang="ts">
import { doCancel, uploadAhead, doOk } from "../controller"
import { getKnowledgeStoreData } from '../store';
import { eventBUS } from '@/views/Home/utils/tools';
const fileUpload = ref<HTMLInputElement>()
const {
    uploadMode,
    fileOrDirList,
    chooseList,
    sliceRuleShow,
    slicePreviewList,
    sliceChunkFormData,
    isUploadingDoc,
    knowledgeUploadDocShow
} = getKnowledgeStoreData();
import i18n from '@/lang';
import { testChunk } from '@/views/KnowleadgeStore/controller';
const $t = i18n.global.t;
/**
 * @description 判断文件类型
 */
const fileType: string[] = [
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
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "webp",
    "md",
    "markdown",
    "txt",
    "log",
    "text",
    "conf",
    "cfg",
    "ini",
    "json",
]
// 生成文件选择限制范围
const acceptFileType = fileType.reduce((p, v) => {
    return p + `.${v},`
}, "")
// 
function fileTypeCheck(file: File) {
    const suffix = file.name.split('.').pop()?.toLowerCase()
    return fileType.includes(suffix!)
}

/***
 * @description 选择文件的回调
 */
function handleFileChange() {
    for (let file of fileUpload.value!.files!) {
        if (!fileTypeCheck(file)) {
            continue;
        }
        chooseList.value.push(file)
    }
    for (let file of chooseList.value) {
        // @ts-ignore
        fileOrDirList.value.push(file.path)
    }
}

/**
 * @description 点击按钮进行文件选择
 */
async function chooseFiles() {
    if (uploadMode.value === 'dir') {
        let folderPath: string | undefined;
        try {
            // @ts-ignore
            const api = (window as any).electron?.ipcRenderer;
            if (api && typeof api.invoke === 'function') {
                folderPath = await api.invoke('controller.os.selectFolder');
            }
        } catch (e) {}

        if (!folderPath) {
            const input = window.prompt($t('请输入要导入的文件夹绝对路径，例如 C\\Data\\Docs')); 
            if (input && input.trim()) {
                folderPath = input.trim();
            }
        }

        if (folderPath) {
            chooseList.value = [{ name: folderPath, path: folderPath, isDir: true }];
            fileOrDirList.value = [folderPath];
        }
    } else {
        fileUpload.value!.click()
    }
}



/**
 * @description 移除添加的文件
 */
function removeFile(item: any) {
    chooseList.value = chooseList.value.filter((i: any) => i.name != item.name)
    fileOrDirList.value = fileOrDirList.value.filter((i: any) => i != item.path)
}

/**
 * @description 文档分片设置
 */
async function sliceSettings() {
    sliceRuleShow.value = true
    sliceChunkFormData.value.filename = chooseList.value[0].path;
    const res = await testChunk()
    slicePreviewList.value = res?.message.chunkList
}

onMounted(() => {
    eventBUS.$on("chooseFile", chooseFiles)
})
</script>

<style scoped lang="scss">
@use "@/assets/base";

.upload-wrapper {
    .mode-choose {
        @include base.row-flex-between;
        justify-content: flex-start;
        margin-top: 20px;
    }

    .upload-area-wrapper {
        margin-top: 20px;
        width: 100%;
        min-height: 260px;
        max-height: 600px;
        cursor: pointer;


        &.wait {
            @include base.column-flex-center;
            background: rgb(232.8, 233.4, 234.6);
            align-items: center;
        }

        .upload-area {
            @include base.column-flex-center;
            justify-content: flex-start;
        }
    }
}

.file-list-item {
    width: 100%;
    @include base.row-flex-between;
}
</style>
