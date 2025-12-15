<template>
    <!-- 欢迎界面 -->
    <NModal :show="welcomeShow">
        <NCard class="welcome-wrapper">
            <div class="welcome-content">
                <div class="logo-wrapper">
                    <NImage :src="logo" class="logo" width="100px" />
                    <span class="brand">亿级卖家智库系统V1.1</span>
                    <span class="slogan">{{ $t("简单好用的AI助手") }}</span>
                </div>
                <div class="desc-wrapper">
                    <div class="desc-item"><i
                            class="i-si:check-circle-duotone w-20 h-20 text-[var(--bt-theme-color)]"></i>{{
                                $t("免费开源无限制") }}</div>
                    <div class="desc-item"><i
                            class="i-si:check-circle-duotone w-20 h-20 text-[var(--bt-theme-color)]"></i>{{
                                $t("可在线分享他人使用") }}
                    </div>
                    <div class="desc-item"><i
                            class="i-si:check-circle-duotone w-20 h-20 text-[var(--bt-theme-color)]"></i>{{
                                $t("支持联网搜索和知识库") }}
                    </div>
                </div>
                <div class="btns">
                    <NButton type="primary" style="width: 100%;" @click="useThirdPartyApi">{{ $t("使用第三方模型") }}</NButton>
                    <NButton ghost type="default" style="width: 100%;" @click="useOllama">{{ $t("使用本地模型") }}</NButton>
                </div>
            </div>
        </NCard>
    </NModal>
</template>

<script setup lang="ts">
import { NCard,NModal,NButton,NImage } from 'naive-ui';
import logo from "@/assets/images/logo.png";
import useIndexStore, { getIndexStore } from "../store";
import { storeToRefs } from "pinia";
import storage from '@/utils/storage';
import {openModelManage} from "@/views/Settings/controller"
import { getThirdPartyApiStoreData } from '@/views/ThirdPartyApi/store';
import { getSettingsStoreData } from '@/views/Settings/store';
const { thirdPartyApiShow ,} = getThirdPartyApiStoreData()
const {welcomeShow,} = getIndexStore()
const {settingsShow} = getSettingsStoreData()

/**
 * @description 使用第三方模型
 */
function useThirdPartyApi(){
    welcomeShow.value = false;
    storage.welcomeEnd = welcomeShow.value as unknown as string;
    thirdPartyApiShow.value = true;
}

/**
 * @description 使用本地模型
 */
function useOllama(){
    welcomeShow.value = false;
    storage.welcomeEnd = welcomeShow.value as unknown as string;
    openModelManage();
}
</script>

<style scoped lang="scss">
@use "@/assets/base";

.welcome-wrapper {
    width: 400px;
    box-sizing: border-box;
    padding: 20px;

    .welcome-content {
        @include base.column-flex-center;

        .logo-wrapper,
        .desc-wrapper,
        .btns {
            @include base.column-flex-center;
        }

        .logo-wrapper {
            gap: 0px;

            .brand {
                font-size: 30px;
                font-weight: bold;
            }

            .slogan {
                font-size: 22px;
            }
        }

        .desc-wrapper {
            margin-top: 10px;
            align-items: flex-start;

            .desc-item {
                @include base.row-flex-between;
                justify-content: flex-start;
                align-items: center;
                gap: 5px;
            }
        }

        .btns {
            margin-top: 20px;
            width: 90%;
        }
    }
}
</style>