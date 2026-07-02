import { i18n } from '@/manager/I18nManager';
import { _decorator, Color, Component, instantiate, Label, Node, tween, UITransform, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('SlideSwitch')
export class SlideSwitch extends Component {
    @property({ type: Node, tooltip: '滑动节点' })
    slideNode: Node = null;
    @property({ type: Node, tooltip: '按钮模板' })
    slideControlBtn: Node = null;
    @property({ type: Node, tooltip: '按钮父节点' })
    container: Node = null;

    public onTabChange: ((index: number) => void) | null = null;

    // 国际化键前缀
    private _keyPrefix = 'pages.home';
    private slideItems: string[] = [];
    private btnList: Node[] = [];
    private currentIndex = 0;

    start() {
        this.createSlideItems();
        this.updateSlideWidth();
        this.scheduleOnce(() => {
            this.moveSlide(0, true);
            this.updateLabelColor();
        }, 0);
    }

    private createSlideItems() {
        this.slideItems = [i18n.t(`${this._keyPrefix}.slide_switch.current_room`), i18n.t(`${this._keyPrefix}.slide_switch.hall`)];

        for (let i = 0; i < this.slideItems.length; i++) {
            const btn = instantiate(this.slideControlBtn);
            btn.setParent(this.container);
            btn.active = true;

            // 设置文本
            const label = btn.getComponentInChildren(Label);
            if (label) label.string = this.slideItems[i];

            // 点击事件
            btn.on(Node.EventType.TOUCH_END, () => {
                this.onClickTab(i);
            })

            this.btnList.push(btn);
        }
    }

    private onClickTab(index: number) {
        if (index === this.currentIndex) return;
        this.currentIndex = index;
        this.moveSlide(index);
        this.updateLabelColor();

        this.onTabChange?.(index);
    }

    // 计算滑块宽度
    private updateSlideWidth() {
        const containerTrans = this.container.getComponent(UITransform);
        const slideTrans = this.slideNode.getComponent(UITransform);

        if (!containerTrans || !slideTrans) return;

        const padding = 10;
        const gap = 10; // 中间缝隙（可选）

        const width = (containerTrans.width - padding * 2 - gap) / 2;

        slideTrans.width = width;
    }

    private updateLabelColor() {
        for (let i = 0; i < this.btnList.length; i++) {
            const btn = this.btnList[i];
            const label = btn.getComponentInChildren(Label);
            if (label) {
                label.color = i === this.currentIndex ? new Color().fromHEX('#FFFFFF') : new Color().fromHEX('#acacacff');
            }
        }
    }

    // 移动滑动条 动画
    private moveSlide(index: number, instant = false) {
        const targetBtn = this.btnList[index];
        if (!targetBtn) return;

        const slideTrans = this.slideNode.getComponent(UITransform);
        const btnTrans = targetBtn.getComponent(UITransform);

        if (!slideTrans || !btnTrans) return;

        // 滑块尺寸
        slideTrans.width = btnTrans.width;
        slideTrans.height = btnTrans.height * 0.9;

        // 按钮世界坐标转本地坐标
        const worldPos = targetBtn.worldPosition.clone();
        const localPos = new Vec3();
        this.container.inverseTransformPoint(localPos, worldPos);
        // padding
        const padding = 0;

        let targetX = localPos.x;

        if (index === 0) {
            targetX += padding;
        } else {
            targetX -= padding;
        }

        const targetPos = new Vec3(targetX, this.slideNode.position.y, 0);

        if (instant) {
            this.slideNode.setPosition(targetPos);
            return;
        }

        tween(this.slideNode)
            .to(0.25, { position: targetPos }, { easing: 'quartOut' })
            .start();
    }

}


