import { eventManager, i18n, imageManager, uiManager, userManager } from '@/manager';
import { _decorator, Component, director } from 'cc';
import { EventType } from './types/event';
import { generateDeviceId } from './utils';
const { ccclass, property } = _decorator;

/**
 * 游戏管理器
 */
@ccclass('GameManager')
export class GameManager extends Component {
    private static _instance: GameManager;
    public static get instance() {
        return this._instance;
    }

    onLoad() {
        if (GameManager.instance) {
            return;
        }

        // 初始化单例
        GameManager._instance = this;

        // 设置常驻节点
        this.node.setSiblingIndex(0);
        director.addPersistRootNode(this.node);
    }

    start() {
        this.init();
    }

    // 初始化
    private async init() {
        // 生成设备唯一标识
        await generateDeviceId()

        // 初始化语言
        const i18nResult = await i18n.init();
        if (!i18nResult.status) {
            eventManager.emit(EventType.LOADING_FAIL, i18nResult.message);
            return;
        }

        eventManager.emit(EventType.LOADING_UPDATE, 0.1, i18n.t('loading.language'));

        // 初始化图片资源
        const imageResult = await imageManager.init();
        if (!imageResult.status) {
            eventManager.emit(EventType.LOADING_FAIL, imageResult.message);
            return;
        }

        eventManager.emit(EventType.LOADING_UPDATE, 0.3, i18n.t('loading.image'));

        // 初始化UI
        console.log('init ui');
        const uiResult = await uiManager.init();
        if (!uiResult.status) {
            eventManager.emit(EventType.LOADING_FAIL, uiResult.message);
            return;
        }

        console.log('uiResult done');
        eventManager.emit(EventType.LOADING_UPDATE, 0.4, i18n.t('loading.ui'));

        // 初始化用户
        console.log('init user');
        const userResult = await userManager.init();
        if (!userResult.status) {
            eventManager.emit(EventType.LOADING_FAIL, userResult.message);
            return;
        }
        console.log('userResult done');

        eventManager.emit(EventType.LOADING_UPDATE, 0.1, i18n.t('loading.user'));

        // 加载完成进入主界面
        eventManager.emit(EventType.LOADING_COMPLETE, () => {
            uiManager.switchScene('MainUI');
        });
    }
}
