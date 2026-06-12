import config from '@/config';
import { noConcurrent } from '@/utils';
import { _decorator, Color, Component, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('NavbarItem')
export class NavbarItem extends Component {
    @property({ type: SpriteFrame, tooltip: '图标' })
    icon: SpriteFrame = null;

    @property({ type: String, tooltip: '文本标签' })
    label: string = '';

    @property({ type: Boolean, tooltip: '是否显示标签' })
    showLabel: boolean = true;

    @property({ type: Number, tooltip: '无标签时图标的缩放比例' })
    iconScale: number = 1.2;

    // 点击事件
    public onClick: (...args: any[]) => void | Promise<void> = null;
    // 是否选中
    public isSelected: boolean = false;
    // 导航路径
    public path: string = '';
    // 默认颜色
    public defaultColor: Color = new Color().fromHEX(config.THEME_COLOR.secondary);
    // 选中颜色
    public selectedColor: Color = new Color().fromHEX(config.THEME_COLOR.primary);

    private _boxNode: Node = null;
    private _labelNode: Label = null;
    private _iconNode: Sprite = null;

    /**
     * 选中导航项
     */
    selected() {
        this.isSelected = true;
        this._iconNode.color = this.selectedColor;
        if (this.showLabel) {
            this._labelNode.color = this.selectedColor;
        }
    }

    /**
     * 取消选中导航项
     */
    unselected() {
        this.isSelected = false;
        this._iconNode.color = this.defaultColor;
        if (this.showLabel) {
            this._labelNode.color = this.defaultColor;
        }
    }

    start() {
        this._boxNode = this.node.getChildByName('Node');
        this._labelNode = this._boxNode.getChildByName('Label').getComponent(Label);
        this._iconNode = this._boxNode.getChildByName('Icon').getComponent(Sprite);

        // 设置默认图标和文本标签
        this._iconNode.spriteFrame = this.icon;
        this._iconNode.color = this.defaultColor;

        if (this.showLabel) {
            this._labelNode.string = this.label;
            this._labelNode.color = this.defaultColor;
        } else {
            this._labelNode.destroy();
            const uiTransform = this._iconNode.getComponent(UITransform);
            uiTransform.setContentSize(
                uiTransform.contentSize.width * this.iconScale,
                uiTransform.contentSize.height * this.iconScale
            );
        }

        // 注册点击事件
        this._boxNode.on(Node.EventType.TOUCH_END, this._onClick, this);
    }

    onDestroy() {
        if (this._boxNode && this._boxNode.isValid) {
            this._boxNode.off(Node.EventType.TOUCH_END, this._onClick, this);
        }
    }

    // 点击事件
    private _onClick = noConcurrent(() => {
        if (this.onClick) {
            this.onClick();
        }
    });
}
