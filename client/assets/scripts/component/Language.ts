import { _decorator, Color, Component, Node, Sprite } from 'cc';
const { ccclass, property } = _decorator;

interface ChildNode {
    zhNode: Node;
    enNode: Node;
}

@ccclass('Language')
export class Language extends Component {

    @property({ type: Node, tooltip: '容器节点' })
    containerNode: Node = null!;

    private getChildNode(): ChildNode {
        return {
            zhNode: this.containerNode.getChildByName('Zh'),
            enNode: this.containerNode.getChildByName('En')
        }
    }

    start() {
        const { zhNode, enNode } = this.getChildNode();

        // 默认选中 Zh
        this.setActive(zhNode);

        // 绑定点击
        zhNode.on(Node.EventType.TOUCH_END, () => {
            this.setActive(zhNode);
        });

        enNode.on(Node.EventType.TOUCH_END, () => {
            this.setActive(enNode);
        });
    }

    /** 设置选中状态 */
    private setActive(node: Node) {
        const { zhNode, enNode } = this.getChildNode();

        this.updateNodeColor(zhNode, node === zhNode);
        this.updateNodeColor(enNode, node === enNode);
    }

    /** ⭐ 只改 bg 子节点颜色 */
    private updateNodeColor(node: Node, isActive: boolean) {
        const bg = node.getChildByName('bg');
        if (!bg) return;

        const bgSprite = bg.getComponent(Sprite);
        if (!bgSprite) return;

        bgSprite.color = isActive
            ? new Color().fromHEX('#19b55d')   // 高亮
            : new Color().fromHEX('#111111');  // 默认
    }
}