import { Language } from './i18n';

/**
 * 状态接口
 */
export interface IState {
    /**
     * 状态
     */
    status: boolean;
    /**
     * 消息
     */
    message?: string;
}

/**
 * 应用标识
 */
export interface IApp {
    /**
     * 应用名称
     */
    name: string;
    /**
     * 设备ID
     */
    deviceId: string;
    /**
     * 设备类型
     */
    deviceType: string;
    /**
     * 应用版本
     */
    appVersion: string;
    /**
     * API版本
     */
    apiVersion: string;
    /**
     * 语言
     */
    language: Language;
}
