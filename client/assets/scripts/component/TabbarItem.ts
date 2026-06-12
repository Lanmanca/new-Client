import { imageManager } from '@/manager';
import { Direction } from '@/types/game';
import { _decorator, Component, Enum, Label, Layout, Node, Sprite, UITransform, Widget } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TabbarItem')
export class TabbarItem extends Component {

    @property({ type: Node, tooltip: 'box' })
    box: Node = null!;

    @property({ type: String, tooltip: '图标' })
    icon: string = '';

    @property({ type: Sprite, tooltip: '图标节点' })
    iconSprite: Sprite = null!;

    @property({ type: Enum(Direction), tooltip: '图标位置' })
    iconPosition: Direction = Direction.LEFT;

    @property({ type: Sprite, tooltip: '背景节点' })
    backgroundSprite: Sprite = null!;

    @property({ type: String, tooltip: '背景图片' })
    background: string = '';

    @property({ type: Boolean, tooltip: '背景是否选中样式' })
    isSelectedBackground: boolean = false;

    @property({ type: String, tooltip: '标签文本' })
    label: string = '';

    @property({ type: Label, tooltip: '标签节点' })
    labelNode: Label = null!;

    @property({ type: Number, tooltip: '字号大小' })
    fontSize: number = 28;

    @property({ type: Node, tooltip: 'rect节点' })
    rectNode: Node = null!;

    @property({ type: Boolean, tooltip: '是否显示rect' })
    showRect: boolean = false;

    onClick: () => void | Promise<void> = null;

    start() {
        this.node.on(Node.EventType.TOUCH_END, this._onClick, this);

        this.init();
    }

    private async _onClick() {
        if (this.onClick) {
            const result = this.onClick();
            if (result instanceof Promise) {
                await result;
            }
        }
    }

    init() {
        this.labelNode.string = this.label;
        if (this.background && this.backgroundSprite) {
            this.backgroundSprite.spriteFrame = imageManager.getUIImage(this.background);
            this.backgroundSprite.type = Sprite.Type.SLICED;  // 图片四个角不拉伸
        }
        if (this.icon) {
            this.iconSprite.spriteFrame = imageManager.getUIImage(this.icon);
            this.iconSprite.getComponent(UITransform).setContentSize(this.fontSize, this.fontSize);
            switch (this.iconPosition) {
                case Direction.LEFT:
                    const boxLayout = this.box.getComponent(Layout);
                    const labelWidget = this.labelNode.getComponent(Widget);
                    labelWidget.isAlignVerticalCenter = true;
                    labelWidget.verticalCenter = 0;
                    boxLayout.type = Layout.Type.HORIZONTAL;
                    boxLayout.spacingX = this.fontSize / 2;
                    boxLayout.paddingLeft = this.fontSize;
                    boxLayout.paddingRight = this.fontSize;
                    break;

                default:
                    break;
            }
        } else {
            // 当没有图标时，标签垂直居中显示
            this.labelNode.getComponent(Widget).isAlignVerticalCenter = true;
            this.labelNode.getComponent(Widget).verticalCenter = 0;
        }
    }
}