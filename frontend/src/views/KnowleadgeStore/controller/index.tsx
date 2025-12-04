import { nextTick, ref } from 'vue';
import { post, get } from '@/api';
import { eventBUS } from '@/views/Home/utils/tools';
import { sendLog } from '@/views/Home/controller';
import { message, useDialog } from '@/utils/naive-tools';
import type { ActiveKnowledgeDocDto, ActiveKnowledgeDto, CreateKnowledgeFormData, KnowledgeDocumentInfo } from '@/views/Home/dto';
import UploadKnowledgeDoc from '../components/UploadKnowledgeDoc.vue';
import { NButton, NSpin } from 'naive-ui';
import i18n from '@/lang';

/********* 临时引入start *********/
import { installModel } from '@/views/Settings/controller/index';
import { getKnowledgeStoreData } from '../store';
import { getSiderStoreData } from '@/views/Sider/store';
import { getThirdPartyApiStoreData } from '@/views/ThirdPartyApi/store';
import { getSettingsStoreData } from '@/views/Settings/store';
/********* 临时引入end *********/

const $t = i18n.global.t;

/**
 * @description 打开知识库侧边栏界面
 */
export async function openKnowledgeStore(ragDto: ActiveKnowledgeDto) {
	const { knowledgeSiderWidth, activeKnowledgeDto, activeKnowledge, activeKnowledgeForChat } = getKnowledgeStoreData();
	try {
		handleSwitchKnowledge(ragDto);
		activeKnowledgeDto.value = ragDto;
		activeKnowledge.value = ragDto.ragName;
		activeKnowledgeForChat.value = [ragDto.ragName];
		await getRagDocList(activeKnowledge.value as string);
		if (knowledgeSiderWidth.value == 0) {
			knowledgeIsOpen();
		}
		singleActive('knowledge', ragDto.ragName);
	} catch (error) {
		sendLog(error as Error);
	}
}

/**
 * @description 知识库切换状态
 */
export function handleSwitchKnowledge(rag: KnowledgeDocumentInfo) {
	const { activeKnowledge, docContent } = getKnowledgeStoreData();

	if (rag.ragName != activeKnowledge.value) {
		docContent.value = '';
	}
}

/**
 * @description 获取知识库文档列表
 */
export async function getRagDocList(ragName: string) {
	const { activeKnowledgeDocList } = getKnowledgeStoreData();
	try {
		const res = await post('/rag/get_rag_doc_list', { ragName });
		activeKnowledgeDocList.value = res.message;
	} catch (error) {
		sendLog(error as Error);
	}
}

// 知识库展开状态
function knowledgeIsOpen() {
	const { knowledgeSiderWidth } = getKnowledgeStoreData();
	knowledgeSiderWidth.value = 240;
}

/**
 * @description currentChat和currentKnowledge只能存在一个
 */
export function singleActive(type: 'chat' | 'knowledge', sign: any) {
	const { activeKnowledge } = getKnowledgeStoreData();
	const { currentContextId } = getSiderStoreData();

	if (type == 'chat') {
		activeKnowledge.value = '';
		currentContextId.value = sign;
		knowledgeIsClose();
	} else {
		currentContextId.value = '';
		activeKnowledge.value = sign;
	}
}

// 知识库关闭状态
export function knowledgeIsClose() {
	const { knowledgeSiderWidth } = getKnowledgeStoreData();
	knowledgeSiderWidth.value = 0;
}

/**
 * @description 新建知识库
 */
export async function createNewKnowledgeStore() {
	const { isInstalledBge, createKnowledgeShow } = getKnowledgeStoreData();
	await ragStatus();
	await getEmbeddingModels();
	if (!isInstalledBge.value) {
		installBge();
		return;
	}
	createKnowledgeShow.value = true;
}

/**
 * @description 取消新建知识库
 */
export function cancelCreateNewKnowledgeStore() {
	const { createKnowledgeShow, isEditKnowledge } = getKnowledgeStoreData();
	createKnowledgeShow.value = false;
	isEditKnowledge.value = false;
	resetForm();
}

/**
 * @description 重置新建数据库表单
 */
export function resetForm() {
	const { createKnowledgeModelRef } = getKnowledgeStoreData();
	createKnowledgeModelRef.value.restoreValidation();
	resetCreateKnowledgeFormData()
}

/**
 * @description 确认新建知识库
 */
export async function confirmCreateNewKnowledgeStore() {
	const { createKnowledgeModelRef, createKnowledgeFormData, activeKnowledge, activeKnowledgeDto, knowledgeList, createKnowledgeShow } = getKnowledgeStoreData();
	const validRes = await createKnowledgeModelRef.value.validate();
	if (!validRes) return;
	// 创建知识库
	try {
		await createRag();
		activeKnowledge.value = createKnowledgeFormData.value.ragName;
		resetForm();
		knowledgeIsOpen();
		await getRagList();
		activeKnowledgeDto.value = knowledgeList.value.find((item: any) => item.ragName == activeKnowledge.value) as ActiveKnowledgeDto;
		await getRagDocList(activeKnowledge.value as string);
		createKnowledgeShow.value = false;
	} catch (error) {
		sendLog(error as Error);
		console.warn(error);
	}
}



/**
 * @description 跳转到知识库使用文档
 */
export function jumpToHelp() {
	window.open('https://docs.aingdesk.com/zh-Hans/Practical-tutorials/knowledgebase');
}

/**
 * @description 获取知识库状态
 */
export async function ragStatus() {
	const { isInstalledBge } = getKnowledgeStoreData();
	try {
		const { code } = await post('/rag/rag_status');
		if (code !== 200) {
			isInstalledBge.value = false;
		} else {
			isInstalledBge.value = true;
		}
	} catch (error) {
		sendLog(error as Error);
	}
}

/**
 * @description 获取嵌入模型列表
 */
export async function getEmbeddingModels() {
	const { embeddingModelsList, createKnowledgeFormData, isEditKnowledge } = getKnowledgeStoreData();
	try {
		const res = await post('/rag/get_embedding_models');
		embeddingModelsList.value = Object.values(res.message).flat();
		// 如果编辑状态则不强制选择bge-m3
		if (isEditKnowledge.value) return
		// 如果新建则默认选择bge-m3或第一个
		if (embeddingModelsList.value.length) {
			let findRes = embeddingModelsList.value.find((item: any) => {
				if (item.model.includes('bge-m3') && item.title.includes('ollama')) {
					return item;
				}
				return undefined;
			});

			if (findRes === undefined) {
				findRes = embeddingModelsList.value.find((item: any) => {
					if (item.model.includes('bge-m3')) {
						return item;
					}
					return undefined;
				});
			}

			if (findRes) {
				createKnowledgeFormData.value.enbeddingModel = findRes.model;
				createKnowledgeFormData.value.supplierName = findRes.supplierName;
			} else {
				createKnowledgeFormData.value.enbeddingModel = embeddingModelsList.value[0].model;
				createKnowledgeFormData.value.supplierName = embeddingModelsList.value[0].supplierName;
			}
		}
	} catch (error) {
		sendLog(error as Error);
	}
}

/**
 * @description 接入第三方
 */
export function doThird() {
	const { installEmbeddingModelShow } = getKnowledgeStoreData();
	const { thirdPartyApiShow } = getThirdPartyApiStoreData();
	thirdPartyApiShow.value = true;
	installEmbeddingModelShow.value = false;
}

/**
 * @description 知识库：本地模型教程
 */
export function localModelTutorial() {
	window.open('https://docs.aingdesk.com/zh-Hans/guide/knowledgebase');
}

/**
 * @description 安装bge-m3:latest的回调方法
 */
export async function installBedgeCallback() {
	const { isInstalledBge, installEmbeddingModelShow } = getKnowledgeStoreData();
	installEmbeddingModelShow.value = false
	await installModel('bge-m3:latest', () => {
		isInstalledBge.value = true;
		createNewKnowledgeStore();
	});
}

/**
 * @description 立即安装本地知识库嵌套模型
 */
export async function installBgeNow() {
	const { settingsShow } = getSettingsStoreData();
	/**
	 * @description 安装本地模型
	 */
	const { managerInstallConfirm } = getSettingsStoreData();
	const res = await post('/manager/get_model_manager');
	if (res.message.status == false) {
		// 如果没有安装ollama就立即安装，并且注册bge安装的回调
		managerInstallConfirm.value = true;
		eventBUS.$on('ollamaInstallBge', installBedgeCallback);
	} else {
		// 如果已经安装了ollama，就直接跳转到设置页面并执行嵌套模型安装
		settingsShow.value = true;
		installBedgeCallback();
	}
	return;
}

/**
 * @description 提示安装bge,安装完成后继续创建新的知识库
 */
export function installBge() {
	const { installEmbeddingModelShow } = getKnowledgeStoreData();
	installEmbeddingModelShow.value = true;
}

/**
 * @description 新建知识库：接口请求
 */
export async function createRag() {
	const { createKnowledgeFormData, activeKnowledge } = getKnowledgeStoreData();
	try {
		const res = await post('/rag/create_rag', createKnowledgeFormData.value);
		if (res.code == 200) {
			activeKnowledge.value = createKnowledgeFormData.value.ragName;
			message.success($t('知识库创建成功'));
		} else {
			message.error($t('知识库创建失败'));
		}
	} catch (error) {
		sendLog(error as Error);
	}
}

/**
 * @description 获取知识库列表
 */
const initTime = ref(0);
export async function getRagList(init: boolean = false) {
	const { knowledgeList, activeKnowledge, activeKnowledgeDto } = getKnowledgeStoreData();
	try {
		const res = await post('/rag/get_rag_list');
		knowledgeList.value = res.message;
		if (init) {
			activeKnowledge.value = knowledgeList.value[0].ragName;
			activeKnowledgeDto.value = knowledgeList.value[0];
		}
	} catch (error) {
		sendLog(error as Error);
		message.error($t('获取知识库列表失败，请重试'));
	}
}

/**
 * @description 删除知识库询问
 */
export function removeRagConfirm(ragName: string) {
	const { deleteKnowledgeName, deleteKnowledgeShow } = getKnowledgeStoreData();
	deleteKnowledgeShow.value = true;
	deleteKnowledgeName.value = ragName;
}

/**
 * @description 取消删除知识库
 */
export function cancelRemoveRagConfirm() {
	const { deleteKnowledgeShow } = getKnowledgeStoreData();
	deleteKnowledgeShow.value = false;
}

/**
 * @description 确认删除知识库
 */
export async function confirmRemoveRagConfirm() {
	const { deleteKnowledgeName, deleteKnowledgeShow, knowledgeList, knowledgeSiderWidth } = getKnowledgeStoreData();
	await removeRag(deleteKnowledgeName.value);
	deleteKnowledgeShow.value = false;
	if (knowledgeList.value.length == 0) {
		knowledgeSiderWidth.value = 0;
	}
}


/***
 * @description 删除知识库
 */
export async function removeRag(ragName: string) {
	const { knowledgeList, activeKnowledge, activeKnowledgeDto } = getKnowledgeStoreData();
	try {
		await post('/rag/remove_rag', { ragName });
		await getRagList();
		if (knowledgeList.value.length) {
			activeKnowledge.value = knowledgeList.value[0].ragName;
			activeKnowledgeDto.value = knowledgeList.value[0];
			await getRagDocList(activeKnowledge.value as string);
		}
		message.success($t('删除知识库成功'));
	} catch (error) {
		sendLog(error as Error);
		message.error($t('删除知识库失败，请重试'));
	}
}

/**
 * @description 重置知识库表单数据
 */
function resetCreateKnowledgeFormData() {
	const { createKnowledgeFormData } = getKnowledgeStoreData()
	createKnowledgeFormData.value = {
		ragName: '',
		ragDesc: '',
		enbeddingModel: '',
		supplierName: '',
		maxRecall: 5,
	};
}

/**
 * @description 修改知识库
 */
export function modifyRag(knowledgeInfo: CreateKnowledgeFormData) {
	const { createKnowledgeFormData, isEditKnowledge, createKnowledgeShow } = getKnowledgeStoreData();
	isEditKnowledge.value = true
	createKnowledgeFormData.value.enbeddingModel = knowledgeInfo.embeddingModel
	createKnowledgeFormData.value.ragName = knowledgeInfo.ragName
	createKnowledgeFormData.value.ragDesc = knowledgeInfo.ragDesc
	createKnowledgeFormData.value.supplierName = knowledgeInfo.supplierName
	createKnowledgeFormData.value.maxRecall = knowledgeInfo.maxRecall
	createKnowledgeShow.value = true
}

/**
 * @description 确认修改知识库
 */
export async function confirmModifyRag() {
	const { createKnowledgeShow, createKnowledgeFormData, isEditKnowledge } = getKnowledgeStoreData();
	try {
		await post('/rag/modify_rag', createKnowledgeFormData.value);
		await getRagList();
		message.success($t('修改知识库成功'));
		createKnowledgeShow.value = false;
		isEditKnowledge.value = false;
		resetCreateKnowledgeFormData()
	} catch (error) {
		sendLog(error as Error);
		message.error($t('修改知识库失败，请重试'));
	}
}

/**
 * @description 删除知识库文档：弹窗
 */
export function delKnowledgeDoc(doc: any) {
	const { deleteKnowledgeDoc, deleteKnowledgeDocShow } = getKnowledgeStoreData();
	deleteKnowledgeDocShow.value = true;
	deleteKnowledgeDoc.value = doc;

}

/**
 * @description 取消删除知识库文档
 */
export function cancelDelKnowledgeDoc() {
	const { deleteKnowledgeDocShow } = getKnowledgeStoreData();
	deleteKnowledgeDocShow.value = false;
}

/**
 * @description 确认删除知识库文档
 */
export async function confirmDelKnowledgeDoc() {
	const { deleteKnowledgeDoc, activeKnowledge, deleteKnowledgeDocShow } = getKnowledgeStoreData();
	try {
		await removeDoc(deleteKnowledgeDoc.value);
		message.success($t('文档删除成功'));
		await getRagDocList(activeKnowledge.value as string);
		cancelDelKnowledgeDoc()
		deleteKnowledgeDocShow.value = false;
	} catch (error) {
		message.success($t('文档删除失败'));
	}
}

/**
 * @description 删除知识库文档：接口请求
 */
export async function removeDoc(doc: any) {
	const { activeKnowledge } = getKnowledgeStoreData();
	try {
		await get('/rag/remove_doc', { ragName: activeKnowledge.value, docIdList: JSON.stringify([doc.doc_id]) });
	} catch (error) {
		sendLog(error as Error);
	}
}

/**
 * @description 获取指定文档内容
 */
export async function getDocContent(doc: ActiveKnowledgeDocDto) {
	const { docContent } = getKnowledgeStoreData();
	try {
		const res = await get('/rag/get_doc_content', { ragName: doc.doc_rag, docName: doc.doc_name });
		docContent.value = res.message;
	} catch (error) {
		sendLog(error as Error);
	}
}

/**
 * @description 取消上传文档
 */
export async function doCancel() {
	const { fileOrDirList, chooseList, isUploadingDoc, knowledgeUploadDocShow } = getKnowledgeStoreData();
	fileOrDirList.value = [];
	chooseList.value = [];
	isUploadingDoc.value = false;
	knowledgeUploadDocShow.value = false;
}

/**
 * @description 继续上传文档
 */
export async function uploadAhead() {
	eventBUS.$emit('chooseFile');
}

/***
 * @description 确认上传文档
 */
export async function doOk() {
	const { isUploadingDoc } = getKnowledgeStoreData();
	try {
		isUploadingDoc.value = true;
		await uploadRagDocForManual();
		doCancel()
		ragDocLoop();
	} catch (error) {
		sendLog(error as Error);
		isUploadingDoc.value = false;
	}
}

/**
 * @description 上传知识库文档：打开弹窗
 */
export async function openDocUploadDialog() {
	const { knowledgeUploadDocShow } = getKnowledgeStoreData();
	knowledgeUploadDocShow.value = true;
}

/**
 * @description 上传知识库文档：手动上传
 */
export async function uploadRagDocForManual() {
	const { fileOrDirList, activeKnowledge, sliceChunkFormData, uploadMode } = getKnowledgeStoreData();
	let url = '/rag/upload_doc';
	let params: any = {
		ragName: activeKnowledge.value,
		separators: sliceChunkFormData.value.separators,
		chunkSize: sliceChunkFormData.value.chunkSize,
		overlapSize: sliceChunkFormData.value.overlapSize,
	};

	if (uploadMode.value === 'dir') {
		url = '/rag/import_folder';
		params.folderPath = fileOrDirList.value[0];
	} else {
		params.filePath = JSON.stringify(fileOrDirList.value);
	}

	const { code, msg } = await post(url, params);
	if (code == 200) {
		message.success(msg as string);
		setTimeout(async () => {
			await getRagDocList(activeKnowledge.value as string);
		}, 500);
		return true;
	} else {
		message.error(msg as string);
		throw new Error(msg);
	}
}

/**
 * @description 文档列表轮询
 */
function ragDocLoop() {
	const { activeKnowledge, activeKnowledgeDocList, docParseStatus } = getKnowledgeStoreData();
	let timer: any = null;
	docParseStatus.value = true;
	timer = setInterval(async () => {
		await getRagDocList(activeKnowledge.value as string);
		const parsedStstus = activeKnowledgeDocList.value.every((item: any) => {
			return item.is_parsed == 1 || item.is_parsed == 3;
		});
		if (parsedStstus) {
			clearInterval(timer);
			docParseStatus.value = false;
		}
	}, 5000);
}

/***
 * @description 测试文档分片
 */
export async function testChunk() {
	const { sliceChunkFormData, customSeparators } = getKnowledgeStoreData()
	if (!customSeparators.value) {
		sliceChunkFormData.value.separators = []
	}
	try {
		return await post("/rag/test_chunk", sliceChunkFormData.value)
	} catch (error) {
		sendLog(error as Error)
	}
}

/**
 * @description 文档分片预览
 */
export async function doPreview() {
	const { sliceChunkFormData, sliceFormRef, slicePreviewList } = getKnowledgeStoreData();
	try {
		await sliceFormRef.value?.validate();
		if (!sliceChunkFormData.value.filename) {
			return message.error($t('请选择文件'));
		} else {
			const res = await testChunk();
			slicePreviewList.value = res?.message.chunkList;
		}
	} catch (error) {
		sendLog(error as Error);
	}
}

/**
 * @description 选择模型回调
 */
export function doSelectModel(_: any, option: any) {
	const { createKnowledgeFormData } = getKnowledgeStoreData();
	createKnowledgeFormData.value.supplierName = option.supplierName;
}

/***
 * @description 选择当前知识库
 */
export function chooseCurrent(item: any) {
	const { activeKnowledgeForChat } = getKnowledgeStoreData()
	if (!item.embeddingModelExist) {
		return
	}
	if (activeKnowledgeForChat.value?.includes(item.ragName)) {
		activeKnowledgeForChat.value = activeKnowledgeForChat.value.filter((i: string) => i !== item.ragName)
	} else {
		activeKnowledgeForChat.value?.push(item.ragName)
	}
}

/**
 * @description 优化知识库
 */
export async function optimizeTable(ragName: string) {
	const { optimizeKnowledgeShow } = getKnowledgeStoreData()
	try {
		optimizeKnowledgeShow.value = true
		const res = await get("/rag/optimize_table", { ragName })
		message.success(res.msg!)
		optimizeKnowledgeShow.value = false
	} catch (error) {
		sendLog(error as Error)
	}
}
