import { Node } from 'cc';

export interface IModalOptions {
    /**
     * 加载回调
     */
    onLoad?: (node: Node) => void;
    /**
     * 确定按钮回调
     * @returns 是否关闭模态框
     */
    onConfirm?: (...args: any[]) => boolean | Promise<boolean>;
    /**
     * 取消按钮回调
     * @returns 是否关闭模态框
     */
    onCancel?: (...args: any[]) => boolean | Promise<boolean>;
}

export type IBaseModal = Omit<IModalOptions, 'onLoad'>;

export interface IModal extends IBaseModal {
    /**
     * 标题
     */
    title: string;
    /**
     * 内容
     */
    content: string | Node;
    /**
     * 是否显示取消按钮
     */
    showCancel?: boolean;
    /**
     * 是否显示确定按钮
     */
    showConfirm?: boolean;
    /**
     * 是否显示关闭按钮
     */
    showClose?: boolean;
    /**
     * 确定按钮文本
     */
    confirmText?: string;
    /**
     * 取消按钮文本
     */
    cancelText?: string;
}

export interface IToast {
    /**
     * 持续时间（秒）
     */
    duration?: number;
    /**
     * 内容
     */
    content: string;
}

export interface IConfirm extends IBaseModal {
    /**
     * 标题
     */
    title?: string;
    /**
     * 内容
     */
    content: string;
    /**
     * 确定按钮文本
     */
    confirmText?: string;
    /**
     * 取消按钮文本
     */
    cancelText?: string;
}

export interface IAlert extends Exclude<IBaseModal, 'onCancel'> {
    /**
     * 标题
     */
    title?: string;
    /**
     * 内容
     */
    content: string;
    /**
     * 确定按钮文本
     */
    confirmText?: string;
}
