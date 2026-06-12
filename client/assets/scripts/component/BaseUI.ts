import { animationManager } from '@/manager/AnimationManager';
import { AnimationType } from '@/types/animation';
import { _decorator, Component, isValid } from 'cc';
const { ccclass, property } = _decorator;

export enum UIState {
    NONE,
    SHOWING,
    HIDING,
    SHOWN,
    HIDDEN,
}

@ccclass('BaseUI')
export class BaseUI extends Component {
    /**
     * 当前动画
     */
    protected animationType: AnimationType = AnimationType.SCALE;

    protected _state: UIState = UIState.NONE;
    protected _onShownCallback: () => void = null;
    protected _onHiddenCallback: () => void = null;

    /**
     * 获取当前状态
     */
    public get state(): UIState {
        return this._state;
    }

    /**
     * 显示
     */
    public async show(animate: boolean = true): Promise<void> {
        if (this._state === UIState.SHOWING || this._state === UIState.SHOWN) {
            return;
        }

        // 节点无效直接返回
        if (!isValid(this.node)) {
            return;
        }

        this._state = UIState.SHOWING;
        this.node.active = true;

        // 调用子类的显示前逻辑
        this.onBeforeShow();

        if (animate) {
            switch (this.animationType) {
                case AnimationType.SCALE:
                    await animationManager.playShow(this.node);
                    break;
                case AnimationType.FADE:
                    await animationManager.playFadeIn(this.node);
                    break;
                case AnimationType.SLIDE:
                    await animationManager.playSlideUp(this.node);
                    break;
            }
        }

        this._state = UIState.SHOWN;
        this.onShown();

        if (this._onShownCallback) {
            this._onShownCallback();
            this._onShownCallback = null;
        }
    }

    /**
     * 隐藏
     */
    public async hide(animate: boolean = true): Promise<void> {
        if (this._state === UIState.HIDING || this._state === UIState.HIDDEN) {
            return;
        }

        // 节点已销毁则直接标记隐藏并退出
        if (!isValid(this.node)) {
            this._state = UIState.HIDDEN;
            return;
        }

        this._state = UIState.HIDING;

        // 调用子类的隐藏前逻辑
        this.onBeforeHide();

        if (animate) {
            switch (this.animationType) {
                case AnimationType.SCALE:
                    await animationManager.playHide(this.node);
                    break;
                case AnimationType.FADE:
                    await animationManager.playFadeOut(this.node);
                    break;
                case AnimationType.SLIDE:
                    await animationManager.playSlideDown(this.node);
                    break;
            }
        }

        // 再次检查 防止动画期间节点被销毁
        if (!isValid(this.node)) {
            this._state = UIState.HIDDEN;
            return;
        }

        this.node.active = false;
        this._state = UIState.HIDDEN;
        this.onHidden();

        if (this._onHiddenCallback) {
            this._onHiddenCallback();
            this._onHiddenCallback = null;
        }
    }

    /**
     * 显示并等待
     */
    public showAndWait(): Promise<void> {
        return new Promise(resolve => {
            this._onShownCallback = resolve;
            this.show();
        });
    }

    /**
     * 隐藏并等待
     */
    public hideAndWait(): Promise<void> {
        return new Promise(resolve => {
            this._onHiddenCallback = resolve;
            this.hide();
        });
    }

    /**
     * 显示前钩子
     */
    protected onBeforeShow() { }

    /**
     * 显示后钩子
     */
    protected onShown() { }

    /**
     * 隐藏前钩子
     */
    protected onBeforeHide() { }

    /**
     * 隐藏后钩子
     */
    protected onHidden() { }

    onDestroy() {
        animationManager.stopAll(this.node);
        this._onShownCallback = null;
        this._onHiddenCallback = null;
    }
}
