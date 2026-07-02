import { _decorator, Component, Label, Sprite } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Countdown')
export class Countdown extends Component {

    @property(Sprite)
    public progressSprite: Sprite = null!; // 绑定 ProgressMask 的 Sprite 组件

    @property(Label)
    public timeLabel: Label = null!;       // 绑定 TimeLabel 组件

    private totalTime: number = 0;         // 倒计时总时长（秒）
    private currentTime: number = 0;       // 当前剩余时间
    private isCounting: boolean = false;
    private onComplete: (() => void) | null = null;  // 倒计时结束回调

    onLoad() {
        this.hide();
    }

    /**
     * 开启倒计时
     * @param duration 倒计时时长（秒）
     * @param remaining 剩余时间（默认等于 duration）
     * @param onComplete 倒计时结束时的回调（可选）
     */
    public startCountdown(duration: number, remaining: number = duration, onComplete?: () => void) {
        this.onComplete = onComplete || null;
        this.totalTime = Math.max(0.01, duration);
        this.currentTime = Math.max(0, Math.min(remaining, this.totalTime));

        if (this.currentTime <= 0) {
            this.hide();
            if (this.onComplete) this.onComplete();
            return;
        }

        this.isCounting = true;
        this.show();
        this.render();
    }

    public show() {
        if (this.progressSprite?.node?.isValid) {
            this.progressSprite.node.active = true;
        }
        if (this.timeLabel?.node?.isValid) {
            this.timeLabel.node.active = true;
        }
    }

    public hide() {
        this.isCounting = false;
        this.currentTime = 0;
        if (this.progressSprite?.node?.isValid) {
            this.progressSprite.fillRange = 0;
            this.progressSprite.node.active = false;
        }
        if (this.timeLabel?.node?.isValid) {
            this.timeLabel.string = '';
            this.timeLabel.node.active = false;
        }
    }

    update(dt: number) {
        if (!this.isCounting) return;

        // 每帧减少时间
        this.currentTime -= dt;

        if (this.currentTime <= 0) {
            // 倒计时结束
            this.currentTime = 0;
            this.hide();
            if (this.onComplete) {
                const cb = this.onComplete;
                this.onComplete = null;
                cb();
            }
        } else {
            this.render();
        }
    }

    private render() {
        if (this.progressSprite?.node?.isValid) {
            this.progressSprite.fillRange = this.currentTime / this.totalTime;
        }
        if (this.timeLabel?.node?.isValid) {
            this.timeLabel.string = Math.ceil(this.currentTime).toString();
        }
    }
}