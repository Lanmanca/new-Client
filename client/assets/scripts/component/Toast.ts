import { AnimationType } from '@/types/animation';
import { IToast } from '@/types/modal';
import { _decorator, Label } from 'cc';
import { BaseUI } from './BaseUI';
const { ccclass, property } = _decorator;

@ccclass('Toast')
export class Toast extends BaseUI implements IToast {
    @property({ type: Label, tooltip: '提示内容节点' })
    contentLabel: Label;

    animationType: AnimationType = AnimationType.SLIDE;
    content: string = '';
    duration?: number = 3;

    /**
     * 回调函数
     */
    callBack: () => void;

    start() {
        this.contentLabel.string = this.content;
        this.schedule(async () => {
            await this.hideAndWait();
            if (this.callBack) {
                this.callBack();
            }
            this.node.destroy();
        }, this.duration);
    }
}
