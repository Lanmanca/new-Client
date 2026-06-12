import { animationManager } from '@/manager';
import { AnimationType } from '@/types/animation';
import { _decorator } from 'cc';
import { BaseUI } from './BaseUI';
const { ccclass, property } = _decorator;

@ccclass('Loading')
export class Loading extends BaseUI {
    animationType: AnimationType = AnimationType.FADE;

    protected onBeforeShow() {
        animationManager.playRotateForever(this.node);
    }

    start() {
        this.showAndWait();
    }
}
