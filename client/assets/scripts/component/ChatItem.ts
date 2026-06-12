import { imageManager } from '@/manager';
import { isNullOrEmpty } from '@/utils';
import { _decorator, Component, Label, Node, Sprite } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ChatItem')
export class ChatItem extends Component {

    @property({ type: Node, tooltip: '我的消息' })
    mine: Node = null;

    @property({ type: Node, tooltip: '其他用户消息' })
    other: Node = null;

    @property({ type: Node, tooltip: '系统消息' })
    system: Node = null;

    @property({ type: Label, tooltip: '我的消息时间' })
    mineTime: Label = null;

    @property({ type: Label, tooltip: '我的消息内容' })
    mineMsg: Label = null;

    @property({ type: Label, tooltip: '其他用户消息时间' })
    otherTime: Label = null;

    @property({ type: Label, tooltip: '其他用户消息内容' })
    otherMsg: Label = null;

    @property({ type: Label, tooltip: '系统消息内容' })
    sysMsg: Label = null;

    setMine(avatar: string, time: string, msg: string) {
        this.hideAll();
        const mineAvatar = this.mine.getChildByPath('Avatar/avatar').getComponent(Sprite);
        if (!isNullOrEmpty(avatar)) {
            mineAvatar.spriteFrame = imageManager.getUIImage(avatar);
        } else {
            mineAvatar.spriteFrame = imageManager.getUIImage('avatar_default');
        }

        this.mine.active = true;
        this.mineTime.string = time;
        this.mineMsg.string = msg;
    }

    setOther(avatar: string, time: string, msg: string) {
        this.hideAll();
        const otherAvatar = this.other.getChildByPath('Avatar/avatar').getComponent(Sprite);
        if (!isNullOrEmpty(avatar)) {
            otherAvatar.spriteFrame = imageManager.getUIImage(avatar);
        } else {
            otherAvatar.spriteFrame = imageManager.getUIImage('avatar_default');
        }

        this.other.active = true;
        this.otherTime.string = time;
        this.otherMsg.string = msg;
    }

    setSystem(msg: string) {
        this.hideAll();

        this.system.active = true;
        this.sysMsg.string = msg;
    }

    private hideAll() {
        this.mine.active = false;
        this.other.active = false;
        this.system.active = false;
    }
}