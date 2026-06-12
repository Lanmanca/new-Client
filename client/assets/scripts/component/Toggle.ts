import { IToggle } from '@/types/form';
import { _decorator, Toggle as CCToggle, Component, Label, Node, tween, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('Toggle')
export class Toggle extends Component implements IToggle {
    @property({ type: CCToggle, tooltip: 'Toggle组件' })
    toggle: CCToggle = null;

    @property({ type: Label, tooltip: '标签' })
    labelNode: Label = null;

    @property({ type: Number, tooltip: '点击后缩放比例' })
    clickScale: number = 0.9;

    @property({ type: String, tooltip: '标签文本' })
    text: string = '';

    readonly: boolean = false;
    value: string | number | boolean = false;
    checked: boolean = false;
    onChange: (value: string | number | boolean, isChecked: boolean) => void = null;

    // 点击动画持续时间
    private static readonly ANIMATION_DURATION = 0.1;

    start() {
        if (this.text) {
            this.labelNode.string = this.text;
            this.labelNode.node.active = true;
        } else {
            this.labelNode.node.active = false;
        }
        this.toggle.isChecked = this.checked;

        if (!this.readonly) {
            this.toggle.node.on(CCToggle.EventType.TOGGLE, this.onToggle, this);
            this.labelNode.node.on(Node.EventType.TOUCH_END, this._onClick, this);
        } else {
            this.toggle.enabled = false;
        }
    }

    onDestroy() {
        if (this.node.isValid && !this.readonly) {
            if (this.toggle.node && this.toggle.node.isValid) {
                this.toggle.node.off(CCToggle.EventType.TOGGLE, this.onToggle, this);
            }
            if (this.labelNode.node && this.labelNode.node.isValid) {
                this.labelNode.node.off(Node.EventType.TOUCH_END, this._onClick, this);
            }
        }
    }

    // 状态更改回调
    private async onToggle(event: CCToggle) {
        await this._playClickAnimation();
        this.checked = event.isChecked;
        if (this.onChange) {
            this.onChange(this.value, event.isChecked);
        }
    }

    /**
     * 设置选中状态
     * @param value
     */
    public setChecked(value: boolean) {
        this.checked = value;
        this.toggle.setIsCheckedWithoutNotify(value);
    }

    // 点击动画
    private async _onClick() {
        this.toggle.isChecked = !this.toggle.isChecked;
    }

    // 播放点击动画
    private _playClickAnimation(): Promise<void> {
        const originalScale = this.node.scale.clone();
        const targetScale = new Vec3(
            originalScale.x * this.clickScale,
            originalScale.y * this.clickScale,
            originalScale.z
        );

        return new Promise(resolve => {
            tween(this.node)
                .to(Toggle.ANIMATION_DURATION, { scale: targetScale }, { easing: 'sineOut' })
                .to(Toggle.ANIMATION_DURATION, { scale: originalScale }, { easing: 'sineIn' })
                .call(() => resolve(void 0))
                .start();
        });
    }
}
