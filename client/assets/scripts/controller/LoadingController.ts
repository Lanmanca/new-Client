import { eventManager } from '@/manager';
import { EventType } from '@/types/event';
import { _decorator, Component, Label, ProgressBar } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LoadingController')
export class LoadingController extends Component {
    @property({ type: ProgressBar, tooltip: '进度条' })
    progressBar: ProgressBar;

    @property({ type: Label, tooltip: '描述' })
    desc: Label;

    // 加载完成
    private _loadingComplete: boolean = false;
    // 加载目标进度
    private _targetProgress: number = 0;
    // 当前进度
    private _progress: number = 0;
    // 加载进度描述
    private _desc: string = '';
    // 加载完成回调
    private _completeCallback: () => void | Promise<void> = null;

    start() {
        eventManager.on(EventType.LOADING_UPDATE, this.onUpdateProgress.bind(this));
        eventManager.on(EventType.LOADING_COMPLETE, this.onLoadingComplete.bind(this));
        eventManager.on(EventType.LOADING_FAIL, this.onLoadingFail.bind(this));
    }

    onDestroy() {
        eventManager.off(EventType.LOADING_UPDATE, this.onUpdateProgress.bind(this));
        eventManager.off(EventType.LOADING_COMPLETE, this.onLoadingComplete.bind(this));
        eventManager.off(EventType.LOADING_FAIL, this.onLoadingFail.bind(this));
    }

    update(_: number) {
        if (!this._loadingComplete && this._progress < this._targetProgress) {
            this._progress += 0.01;
            this.progressBar.progress = Math.min(this._progress, 1);
            this.desc.string = this._desc + ' ' + (this._progress * 100).toFixed(0) + '%';

            // 加载完成
            if (this._progress >= 1) {
                this._loadingComplete = true;
                if (this._completeCallback) {
                    this._completeCallback();
                }
            }
        }
    }

    /**
     * 更新进度条
     * @param value 进度值，0-1之间的小数
     * @param desc 描述
     */
    private onUpdateProgress(value: number, desc: string) {
        if (value > 1) value = 1;
        if (value < 0) value = 0;

        this._targetProgress += value;
        this._desc = desc;
    }

    /**
     * 加载完成
     */
    private onLoadingComplete(callback: () => void) {
        this._targetProgress = 1;
        this._completeCallback = callback;
    }

    /**
     * 加载失败
     * @param errMsg 错误信息
     */
    private onLoadingFail(errMsg: string) {
        this._desc = errMsg;
        this._loadingComplete = true;
    }
}
