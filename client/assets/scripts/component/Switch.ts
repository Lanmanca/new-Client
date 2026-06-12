import { _decorator, Component, Node, Sprite, tween, UIOpacity, UITransform, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Switch')
export class Switch extends Component {

    @property({ type: Sprite, tooltip: 'off状态图片' })
    bgOff: Sprite = null!;

    @property({ type: Sprite, tooltip: 'on状态图片' })
    bgOn: Sprite = null!;

    @property({ type: Node, tooltip: '开关节点' })
    switchNode: Node = null!;

    private isOn: boolean = false;
    private offPos: Vec3 = new Vec3();

    private bgOnOpacity!: UIOpacity;
    private bgOffOpacity!: UIOpacity;

    // 状态变化回调
    private onChangeCallback: ((state: boolean) => void) | null = null;

    onLoad() {
        // 初始位置
        this.offPos = this.switchNode.position.clone();

        // 透明组件
        this.bgOnOpacity = this.bgOn.node.getComponent(UIOpacity) || this.bgOn.node.addComponent(UIOpacity);
        this.bgOffOpacity = this.bgOff.node.getComponent(UIOpacity) || this.bgOff.node.addComponent(UIOpacity);
    }

    start() {
        // 初始状态
        this.refreshUI(true);

        this.node.on(Node.EventType.TOUCH_END, this.onClick, this);
    }

    onClick() {
        this.setState(!this.isOn);
    }

    // 外部设置状态
    public setState(state: boolean, immediate: boolean = false) {
        if (this.isOn === state) return;

        this.isOn = state;
        this.refreshUI(immediate);

        // 通知外部
        this.onChangeCallback?.(this.isOn);
    }

    // 外部获取状态
    public getState(): boolean {
        return this.isOn;
    }

    // 外部监听状态变化
    public onChange(callback: (state: boolean) => void) {
        this.onChangeCallback = callback;
    }

    // UI刷新
    private refreshUI(immediate: boolean = false) {

        // 自动计算滑动范围
        const bgWidth = this.bgOn.node.getComponent(UITransform)!.width;
        const bgHeight = this.bgOn.node.getComponent(UITransform)!.height;
        const knobWidth = this.switchNode.getComponent(UITransform)!.width;
        const knobHeight = this.switchNode.getComponent(UITransform)!.height;

        // 左右边界
        const minX = this.offPos.x;
        const maxX = this.offPos.x + (bgWidth - knobWidth) + (knobHeight - bgHeight);

        const targetX = this.isOn ? maxX : minX;

        const targetPos = new Vec3(targetX, this.offPos.y, this.offPos.z);

        // 滑块移动
        if (immediate) {
            this.switchNode.setPosition(targetPos);
        } else {
            tween(this.switchNode)
                .to(0.2, { position: targetPos }, { easing: 'quadOut' })
                .start();
        }

        // 背景渐变
        const onOpacity = this.isOn ? 255 : 0;
        const offOpacity = this.isOn ? 0 : 255;

        if (immediate) {
            this.bgOnOpacity.opacity = onOpacity;
            this.bgOffOpacity.opacity = offOpacity;
        } else {
            tween(this.bgOnOpacity)
                .to(0.2, { opacity: onOpacity })
                .start();

            tween(this.bgOffOpacity)
                .to(0.2, { opacity: offOpacity })
                .start();
        }
    }
}