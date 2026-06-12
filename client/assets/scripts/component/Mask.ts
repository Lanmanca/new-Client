import { noConcurrent } from '@/utils';
import { _decorator, Component, Node, Sprite } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Mask')
export class Mask extends Component {
    /**
     * 是否开启透明遮罩
     */
    public isOpacity: boolean = false;

    /**
     * 遮罩点击回调
     */
    public onClick: () => void;

    start() {
        if (this.isOpacity) {
            const sprite = this.node.getComponent(Sprite);
            sprite.spriteFrame = null;
        }

        this.node.on(Node.EventType.TOUCH_END, this._onClick);
    }

    onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_END, this._onClick);
    }

    private _onClick = noConcurrent(() => {
        if (this.onClick) {
            this.onClick();
        }
    });
}
