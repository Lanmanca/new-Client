import { imageManager } from '@/manager';
import { _decorator, Component, Label, Node, Sprite, UITransform } from 'cc';
const { ccclass, property } = _decorator;

export interface IListItem_user {
    icon: string;
    label: string;
    isShowLineNode: boolean;
    onClick: () => void | Promise<void>;
}

@ccclass('ListItem_user')
export class ListItem_user extends Component {
    @property({ type: Sprite, tooltip: 'icon' })
    icon: Sprite = null!;

    @property({ type: Label, tooltip: '列表文本' })
    label: Label = null!;

    @property({ type: Node, tooltip: '列表线' })
    lineNode: Node = null!;

    onClick: () => void | Promise<void> = null;

    start() {
        this.node.on(Node.EventType.TOUCH_END, this._onClick, this);
    }

    setData(data: IListItem_user) {
        this.icon.spriteFrame = imageManager.getUIImage(data.icon);
        this.icon.getComponent(UITransform).setContentSize(35, 35);
        this.label.string = data.label;
        this.lineNode.active = data.isShowLineNode;
        this.onClick = data.onClick;
    }

    private async _onClick() {
        if (this.onClick) {
            const result = this.onClick();
            if (result instanceof Promise) {
                await result;
            }
        }
    }
}

