import { imageManager, stateManager, uiManager } from '@/manager';
import { _decorator, Component, Label, Node, Sprite } from 'cc';
const { ccclass, property } = _decorator;

export interface InformationChild {
    icon: Sprite,
    state: Sprite,
    select: Sprite,
    border: Sprite,
    title: Label,
    time: Label,
    message: Label
}

export interface InformationData {
    state: boolean,
    icon: string,
    title: string,
    time: string,
    message: string
}

@ccclass('InformationItem')
export class InformationItem extends Component {

    @property({ type: Node })
    containerNode: Node = null!;

    private inDeleteMode: boolean = false;
    private selected: boolean = false;
    private data: InformationData = null!;

    start() {
        this.node.on(Node.EventType.TOUCH_END, this._onClick, this);
    }

    private getChildNode(): InformationChild {
        return {
            icon: this.containerNode.getChildByPath('Avatar/icon').getComponent(Sprite),
            state: this.containerNode.getChildByPath('Avatar/state').getComponent(Sprite),
            select: this.containerNode.getChildByPath('Avatar/select').getComponent(Sprite),
            border: this.containerNode.getChildByPath('Avatar/border').getComponent(Sprite),
            title: this.containerNode.getChildByPath('MessageNode/TitleNode/title').getComponent(Label),
            time: this.containerNode.getChildByPath('MessageNode/TitleNode/time').getComponent(Label),
            message: this.containerNode.getChildByPath('MessageNode/message').getComponent(Label)
        };
    }

    setData(data: InformationData) {
        this.data = data;

        const { icon, state, title, time, message } = this.getChildNode();

        state.node.active = data.state;
        icon.spriteFrame = imageManager.getUIImage(data.icon);
        title.string = data.title;
        time.string = data.time;
        message.string = data.message.slice(0, 21) + '...';
    }

    public setDeleteMode(isDelete: boolean) {
        this.inDeleteMode = isDelete;

        if (!isDelete) {
            this.selected = false;
        }

        this.updateUI();
    }

    /**
     * 
     * @returns 当前项是否被选中
     */
    public isSelected(): boolean {
        return this.selected;
    }

    private updateUI() {
        const { icon, state, select, border } = this.getChildNode();

        if (this.inDeleteMode) {
            icon.node.active = false;
            state.node.active = false;

            border.node.active = true;
            select.node.active = this.selected;
        } else {
            icon.node.active = true;
            state.node.active = this.data.state;

            border.node.active = false;
            select.node.active = false;
        }
    }

    private _onClick() {
        if (this.inDeleteMode) {
            this.selected = !this.selected;
            this.updateUI();
            return;
        }

        this.data.state = false;
        this.updateUI();
        uiManager.navigateTo({ page: 'MessageDetails' });
        stateManager.setItem('message', this.data);
    }
}