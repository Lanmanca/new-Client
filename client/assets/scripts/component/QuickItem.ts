import { _decorator, Component, Label, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('QuickItem')
export class QuickItem extends Component {

    @property({ type: Label, tooltip: '快捷语' })
    quickLabel: Label;

    public onSelect: ((text: string) => void) | null = null;

    start() {
        this.node.on(Node.EventType.TOUCH_END, this.onClick, this);
    }

    setData(quick: string) {
        this.quickLabel.string = quick;
    }

    onClick() {
        const text = this.quickLabel.string;

        this.onSelect(text);
    }
}