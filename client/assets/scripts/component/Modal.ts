import { IModal } from '@/types/modal';
import { _decorator, Button as CButton, Color, Label, Node, ScrollView, Widget } from 'cc';
import { BaseUI } from './BaseUI';
import { Button } from './Button';
const { ccclass, property } = _decorator;

@ccclass('Modal')
export class Modal extends BaseUI implements IModal {
    @property({ type: Label, tooltip: '模态框标题节点' })
    titleNode: Label = null;

    @property({ type: CButton, tooltip: '取消按钮' })
    cancelButton: CButton = null;

    @property({ type: CButton, tooltip: '确定按钮' })
    confirmButton: CButton = null;

    @property({ type: CButton, tooltip: '关闭按钮' })
    closeButton: CButton = null;

    @property({ type: Node, tooltip: '模态框内容节点' })
    contentNode: Node = null;

    @property({ type: ScrollView, tooltip: '模态框内容滚动视图' })
    scrollView: ScrollView = null;

    title: string = '提示';
    content: string | Node = '';
    showCancel: boolean = false;
    showConfirm: boolean = true;
    showClose: boolean = false;
    cancelText: string = '取消';
    confirmText: string = '确定';
    titleColor: Color = new Color().fromHEX('#FFFFFF');

    onConfirm: () => boolean | Promise<boolean> = () => true;
    onCancel: () => boolean | Promise<boolean> = () => true;

    private _cancelButton: Button;
    private _confirmButton: Button;
    private _closeButton: Button;
    private _labelNode: Node;

    onLoad() {
        this._cancelButton = this.cancelButton.getComponent(Button);
        this._confirmButton = this.confirmButton.getComponent(Button);
        this._closeButton = this.closeButton.getComponent(Button);

        // 绑定按钮事件
        this._cancelButton.onClick = this._onCancel.bind(this);
        this._confirmButton.onClick = this._onConfirm.bind(this);
        this._closeButton.onClick = this._onCancel.bind(this);

        // 设置内容
        this._labelNode = this.contentNode.getChildByPath('Label');

        this.init();

        // 节点已在场景树中，强制重算 Widget 布局（先父后子）
        const widget = this.node.getComponent(Widget);
        widget?.updateAlignment();
        const bodyNode = this.node.getChildByName('Body');
        const bodyWidget = bodyNode?.getComponent(Widget);
        bodyWidget?.updateAlignment();

        this.showAndWait();
    }

    // 解决滚动条错位问题
    async start() {
        // 拿到垂直滚动条节点
        if (this.scrollView) {
            const scrollBarNode = this.scrollView.verticalScrollBar?.node;

            // 动画开始前，先把滚动条“藏”起来 (用 opacity 隐藏最自然，如果不生效可以改用 active = false)
            if (scrollBarNode) {
                scrollBarNode.active = false;
            }

            // 等待弹窗动画完全结束，节点尺寸彻底稳定
            await this.showAndWait();

            // isValid 判断是检查节点是否被销毁，避免极端情况导致的错误
            if (this.scrollView && this.scrollView.isValid) {
                // 动画结束，尺寸彻底稳定，在后台偷偷把位置修好
                this.scrollView.scrollToTop();

                // 位置修好后，再把滚动条放出来
                if (scrollBarNode) {
                    scrollBarNode.active = true;
                }
            }
        }
    }

    public init() {
        // 设置标题
        this.titleNode.string = this.title;
        this.titleNode.color = this.titleColor;

        // 设置按钮
        this.cancelButton.node.active = this.showCancel;
        this.confirmButton.node.active = this.showConfirm;
        this.closeButton.node.active = this.showClose;

        this._cancelButton.label = this.cancelText;
        this._confirmButton.label = this.confirmText;

        if (this._labelNode && typeof this.content === 'string') {
            this._labelNode.getComponent(Label).string = this.content;
        } else if (this.content instanceof Node) {
            if (this._labelNode) {
                this._labelNode.active = false;
            }
            this.contentNode.addChild(this.content);
        }
    }

    /**
     * 将弹窗垂直方向拉伸为距屏幕上下各 margin 像素，自动适配不同屏幕高度。
     * 同时修正 Body 节点的 Widget 为 TOP+BOTTOM 拉伸模式。
     */
    public stretchToFit(margin: number = 100) {
        // Modal 根节点：上下对齐
        const widget = this.node.getComponent(Widget);
        if (!widget) return;
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.isAlignVerticalCenter = false;
        widget.top = margin;
        widget.bottom = margin;
        widget.alignMode = Widget.AlignMode.ALWAYS;

        // Body 节点：关闭垂直居中，开启 TOP+BOTTOM 拉伸
        const bodyNode = this.node.getChildByName('Body');
        if (bodyNode) {
            const bodyWidget = bodyNode.getComponent(Widget);
            if (bodyWidget) {
                bodyWidget.isAlignTop = true;
                bodyWidget.isAlignBottom = true;
                bodyWidget.isAlignVerticalCenter = false;
                bodyWidget.alignMode = Widget.AlignMode.ALWAYS;
            }
        }
    }

    /**
     * 取消
     */
    private async _onCancel() {
        if (this.onCancel) {
            let result = this.onCancel();
            if (result instanceof Promise) {
                result = await result;
            }

            if (!result) {
                return;
            }
        }

        await this.hideAndWait();
        this.node.destroy();
    }

    /**
     * 确定
     */
    private async _onConfirm() {
        if (this.onConfirm) {
            let result = this.onConfirm();
            if (result instanceof Promise) {
                result = await result;
            }

            if (!result) {
                return;
            }
        }

        await this.hideAndWait();
        this.node.destroy();
    }
}
