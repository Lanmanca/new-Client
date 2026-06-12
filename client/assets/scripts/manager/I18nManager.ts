import { Language } from '@/types/i18n';
import { IState } from '@/types/state';
import { assetManager, JsonAsset } from 'cc';
import { stateManager } from './StateManager';

/**
 * 国际化管理器
 */
class I18nManager {
    private static _instance: I18nManager;
    public static get instance(): I18nManager {
        if (!this._instance) {
            this._instance = new I18nManager();
        }
        return this._instance;
    }

    private _language: Language;

    /**
     * 当前语言
     */
    public get language() {
        return this._language || Language.ZH;
    }

    public set language(language: Language) {
        if (!Object.values(Language).includes(language) || language === this._language) {
            return;
        }

        this._language = language;

        // 切换语言时重新初始化
        this.init();
    }

    /**
     * 语言文件
     */
    private languageFile: JsonAsset;

    /**
     * 语言数据
     */
    private languageData: Record<string, any>;

    /**
     * 初始化
     */
    public init() {
        // 如果没有设置语言，或者语言不支持，则默认设置为中文
        if (!this.language || !Object.values(Language).includes(this.language)) {
            const lang = stateManager.getItem<Language>('language');
            this.language = lang || Language.ZH;
        }

        return new Promise<IState>(resolve => {
            assetManager.loadBundle('i18n', (err, bundle) => {
                if (err) {
                    resolve({ status: false, message: err.message });
                    return;
                }

                bundle.load(this.language, JsonAsset, (err, data) => {
                    if (err) {
                        resolve({ status: false, message: err.message });
                        return;
                    }

                    this.languageFile = data;
                    this.languageData = data.json;
                    resolve({ status: true });
                });
            });
        });
    }

    /**
     * 获取语言文本
     * @param key 文本key
     * @returns 文本
     */
    public t(key: string, params?: Record<string, any>): string {
        if (!this.languageFile || !key) {
            return '';
        }

        // 获取翻译文本
        let text: string;

        if (key.includes('.')) {
            const keys = key.split('.');
            let value: any = this.languageData;
            for (let i = 0; i < keys.length; i++) {
                value = value[keys[i]];
                if (value == undefined || value == null) {
                    return '';
                }
            }
            text = value;
        } else {
            text = this.languageData[key] || '';
        }

        // 如果没有参数或text不是字符串，直接返回
        if (!params || typeof text !== 'string') {
            return text || '';
        }

        // 处理命名参数插值
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }
}

/**
 * I18n 管理器
 */
export const i18n = I18nManager.instance;
