import { uiManager } from '@/manager';
import { SlideDirection } from '@/types/sidebar';
import { _decorator, Enum, EventTouch, instantiate, Layout, Node, Prefab, UITransform } from 'cc';
import { BaseUI } from './BaseUI';
const { ccclass, property } = _decorator;

@ccclass('Sidebar')
export class Sidebar extends BaseUI {

    @property({ type: Node, tooltip: '背景节点' })
    backgroundNode: Node = null;

    @property({ type: Enum(SlideDirection), tooltip: '弹出方向' })
    direction: SlideDirection = SlideDirection.RIGHT;

    @property({ type: Node, tooltip: '内容节点' })
    childNode: Node = null;

    private contentNode: Node | null = null;

    onClose?: () => void;

    start() {
        if (!this.backgroundNode) return;
        this.backgroundNode.on(Node.EventType.TOUCH_END, this._onClick, this);
    }

    init(contentPrefab: Prefab) {
        if (!contentPrefab) return;

        if (this.contentNode) {
            this.contentNode.destroy();
        }

        const content = instantiate(contentPrefab);

        this.childNode.addChild(content);

        this.contentNode = content;

        // 强制刷新 Layout
        const layout = this.childNode.getComponent(Layout);
        layout?.updateLayout();

        // 父容器最大高度
        const parentUI = this.node.getComponent(UITransform);

        if (!parentUI) return;

        const maxHeight = parentUI.contentSize.height * 0.9;

        // 内容真实高度
        const contentUI = content.getComponent(UITransform);

        if (!contentUI) return;

        const realHeight = contentUI.contentSize.height;

        // 超过最大高度才限制
        if (realHeight > maxHeight) {
            contentUI.setContentSize(
                contentUI.contentSize.width,
                maxHeight
            );
        }
    }

    private _onClick(event: EventTouch) {
        // 阻止点击事件冒泡
        if (event.target !== this.backgroundNode) return;

        uiManager.closeSidebar(this.node, this.direction);

        if (this.onClose) {
            this.onClose();
        }
    }
}