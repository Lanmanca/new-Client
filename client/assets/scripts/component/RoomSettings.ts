import config from '@/config';
import { i18n } from '@/manager';
import { IRoomSettings } from '@/types/room';
import { _decorator, Button as CCButton, Label, Node, ScrollView } from 'cc';
import { BaseUI, Button, Form } from './index';

const { ccclass, property } = _decorator;

@ccclass('RoomSettings')
export class RoomSettings extends BaseUI {
    @property({ type: Label, tooltip: '弹窗标题节点' })
    public title: Label = null;

    @property({ type: ScrollView, tooltip: '表单容器节点' })
    public formContainer: ScrollView = null;

    @property({ type: Node, tooltip: '表单节点' })
    public form: Node = null;

    @property({ type: CCButton, tooltip: '确认按钮' })
    public confirmButton: CCButton = null;

    @property({ type: CCButton, tooltip: '取消按钮' })
    public cancelButton: CCButton = null;

    /**
     * 点击确认时的回调
     */
    public onConfirm: (roomSettings: IRoomSettings) => boolean | Promise<boolean> = null;
    public onCancel: () => boolean | Promise<boolean> = null;

    /**
     * 获取结果
     */
    public get value() {
        return this.form.getComponent(Form).value as IRoomSettings;
    }

    async start() {
        this.initDefaultSettings();

        this.title.string = i18n.t(`${config.ROOM_SETTINGS_KEY}.title`);

        // 注册确认按钮事件
        const confirmBtn = this.confirmButton.getComponent(Button);
        confirmBtn.label = i18n.t(`${config.ROOM_SETTINGS_KEY}.confirm`);
        confirmBtn.onClick = this.confirm.bind(this);

        // 拿到垂直滚动条节点
        const scrollBarNode = this.formContainer.verticalScrollBar?.node;

        // 注册取消按钮事件
        const cancelBtn = this.cancelButton.getComponent(Button);
        cancelBtn.onClick = this.cancel.bind(this);
        cancelBtn.label = i18n.t(`${config.ROOM_SETTINGS_KEY}.cancel`);

        // 动画开始前，先把滚动条“藏”起来 (用 opacity 隐藏最自然，如果不生效可以改用 active = false)
        if (scrollBarNode) {
            scrollBarNode.active = false;
        }

        // 等待弹窗动画完全结束，节点尺寸彻底稳定
        await this.showAndWait();

        // isValid 判断是检查节点是否被销毁，避免极端情况导致的错误
        if (this.formContainer && this.formContainer.isValid) {
            // 动画结束，尺寸彻底稳定，在后台偷偷把位置修好
            this.formContainer.scrollToTop();

            // 位置修好后，再把滚动条放出来
            if (scrollBarNode) {
                scrollBarNode.active = true;
            }
        }
    }

    /**
     * 初始化默认设置
     */
    private initDefaultSettings() {
        const form = this.form.getComponent(Form);
        form.items = config.ROOM_SETTINGS;
        this.formContainer.scrollToTop(); // 初始滚动到顶部
    }

    /**
     * 确认
     */
    public async confirm(): Promise<boolean> {
        if (this.onConfirm) {
            // 验证表单
            const validate = await this.form.getComponent(Form).validate();
            if (!validate) {
                return false;
            }

            // 验证通过获取表单的值
            const formData = this.form.getComponent(Form).value as IRoomSettings;

            let result = this.onConfirm(formData);
            if (result instanceof Promise) {
                result = await result;
            }

            // 返回false阻止关闭
            if (!result) {
                return false;
            }
        }

        await this.hideAndWait();
        this.node.destroy();
    }

    /**
     * 取消
     */
    public async cancel() {
        if (this.onCancel) {
            let result = this.onCancel();
            if (result instanceof Promise) {
                result = await result;
            }
            if (!result) {
                return false;
            }
        }
        await this.hideAndWait();
        this.node.destroy();
    }
}
