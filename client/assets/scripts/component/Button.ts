import config from '@/config';
import { imageManager } from '@/manager';
import { ButtonType, IButton, IconPosition } from '@/types/button';
import { noConcurrent } from '@/utils';
import {
    _decorator,
    Button as CButton,
    Color,
    Component,
    Enum,
    Label,
    Layout,
    Node,
    Sprite,
    tween,
    UITransform,
    Vec3,
    Widget
} from 'cc';

const { ccclass, property } = _decorator;

// 按钮子节点结构接口
interface ButtonChildNodes {
    box: Node;
    label: Label;
    icon: Node;
    iconSprite: Sprite;
    boxLayout: Layout;
    boxWidget: Widget;
}

@ccclass('Button')
export class Button extends Component implements IButton {
    @property({ type: Enum(ButtonType), tooltip: '按钮类型' })
    type: ButtonType = ButtonType.PRIMARY;

    @property({ type: String, tooltip: '按钮标签' })
    label: string = '';

    @property({ type: String, tooltip: '按钮图标' })
    icon: string = '';

    @property({ type: Enum(IconPosition), tooltip: '图标位置' })
    iconPosition: IconPosition = IconPosition.LEFT;

    @property({ type: Boolean, tooltip: '是否为文本按钮' })
    text: boolean = false;

    @property({ type: Number, tooltip: '按钮字体大小' })
    fontSize: number = 28;

    @property({ type: String, tooltip: '按钮文本颜色' })
    color: string = '';

    @property({ type: Boolean, tooltip: '按钮是否禁用' })
    disabled: boolean = false;

    @property({ type: Number, tooltip: '按钮点击缩放比例' })
    clickScale: number = 0.9;

    onClick: () => void | Promise<void> = null;

    // 缓存按钮组件引用
    private sprite: Sprite = null;
    private button: CButton = null;
    private layout: Layout = null;

    // 常量定义
    public static readonly ANIMATION_DURATION = 0.1;

    start() {
        this.node.on(Node.EventType.TOUCH_END, this._onClick, this);

        // 初始化组件引用
        this.sprite = this.getComponent(Sprite);
        this.button = this.getComponent(CButton);
        this.layout = this.getComponent(Layout);

        const children = this.getChildNodes();

        if (!this.text) {
            this.setupNormalButton(children);
        } else {
            this.setupTextButton(children);
        }
    }

    onDestroy() {
        if (this.node?.isValid) {
            this.node.off(Node.EventType.TOUCH_END, this._onClick, this);
        }
    }

    /**
     * 获取子节点
     */
    private getChildNodes(): ButtonChildNodes {
        const box = this.node.getChildByPath('Node');
        const labelNode = box.getChildByPath('Label');
        const icon = box.getChildByPath('Icon');

        return {
            box,
            label: labelNode.getComponent(Label),
            icon,
            iconSprite: icon.getComponent(Sprite),
            boxLayout: box.getComponent(Layout),
            boxWidget: box.getComponent(Widget)
        };
    }

    /**
     * 设置正常按钮（带背景）
     */
    private setupNormalButton(children: ButtonChildNodes): void {
        const { icon, boxLayout } = children;

        this.setButtonBackground();
        this.setIconAndLabelColor(children);
        this.setupLabel(children);
        this.setupIcon(children);

        // 根据是否有图标和标签调整布局
        if (!this.icon) {
            icon.active = false;
            boxLayout.alignHorizontal = true;
            boxLayout.resizeMode = this.label
                ? Layout.ResizeMode.CHILDREN
                : Layout.ResizeMode.CONTAINER;
        } else {
            icon.active = true;
            switch (this.iconPosition) {
                case IconPosition.LEFT:
                    break;
                case IconPosition.RIGHT:
                    boxLayout.horizontalDirection = Layout.HorizontalDirection.RIGHT_TO_LEFT;
                    break;
                case IconPosition.TOP:
                    boxLayout.type = Layout.Type.VERTICAL;
                    boxLayout.resizeMode = Layout.ResizeMode.CONTAINER;
                    boxLayout.paddingTop = this.fontSize;
                    boxLayout.paddingBottom = this.fontSize;
                    boxLayout.spacingY = this.fontSize / 2;
                    this.sprite.type = Sprite.Type.SLICED;
                    this.layout.type = Layout.Type.VERTICAL;
                    this.layout.resizeMode = Layout.ResizeMode.CONTAINER;
                    break;
                case IconPosition.BOTTOM:
                    break;
                default:
                    break;
            }
        }
    }

    /**
     * 设置文本按钮（无背景）
     */
    private setupTextButton(children: ButtonChildNodes): void {
        const { icon, iconSprite, label, boxLayout } = children;

        this.clearButtonBackground();
        this.setTextButtonColors(children);

        if (this.icon) {
            icon.active = true;
            iconSprite.spriteFrame = imageManager.getUIImage(this.icon);
            this.setIconSize(icon, this.fontSize);
        } else {
            icon.active = false;
        }

        if (this.label) {
            label.string = this.label;
            label.fontSize = this.fontSize;
        } else {
            label.node.active = false;
        }

        // 统一布局设置
        boxLayout.alignHorizontal = true;
        boxLayout.resizeMode = Layout.ResizeMode.CONTAINER;
    }

    /**
     * 设置按钮背景
     */
    private setButtonBackground(): void {

        const spriteFrame = imageManager.getUIImage(`Button-${this.type}`);

        this.sprite.spriteFrame = spriteFrame;
        this.button.normalSprite = spriteFrame;
        this.button.hoverSprite = spriteFrame;
        this.button.pressedSprite = spriteFrame;
        this.button.disabledSprite = spriteFrame;
    }

    /**
     * 清除按钮背景
     */
    private clearButtonBackground(): void {
        this.sprite.spriteFrame = undefined;
        this.button.normalSprite = undefined;
        this.button.hoverSprite = undefined;
        this.button.pressedSprite = undefined;
        this.button.disabledSprite = undefined;
    }

    /**
     * 设置图标和标签颜色
     */
    private setIconAndLabelColor(children: ButtonChildNodes): void {
        const { iconSprite, label } = children;
        const colorMap = {
            [ButtonType.PRIMARY]: config.THEME_COLOR.dark,
            [ButtonType.WARNING]: config.THEME_COLOR.dark,
            [ButtonType.ERROR]: config.THEME_COLOR.dark,
            [ButtonType.SECONDARY]: config.THEME_COLOR.light,
            [ButtonType.INFO]: config.THEME_COLOR.light,
        };

        const colorHex =
            this.text && this.color ? this.color : colorMap[this.type] || config.THEME_COLOR.light;
        const color = new Color().fromHEX(colorHex);

        iconSprite.color = color;
        label.color = color;
    }

    /**
     * 设置文本按钮颜色
     */
    private setTextButtonColors(children: ButtonChildNodes): void {
        const { iconSprite, label } = children;
        const colorMap = {
            [ButtonType.PRIMARY]: config.THEME_COLOR.primary,
            [ButtonType.WARNING]: config.THEME_COLOR.warning,
            [ButtonType.ERROR]: config.THEME_COLOR.error,
            [ButtonType.SECONDARY]: config.THEME_COLOR.secondary,
            [ButtonType.INFO]: config.THEME_COLOR.info,
        };

        const colorHex =
            this.text && this.color
                ? this.color
                : colorMap[this.type] || config.THEME_COLOR.primary;
        const color = new Color().fromHEX(colorHex);

        iconSprite.color = color;
        label.color = color;
    }

    /**
     * 设置图标
     */
    private setupIcon(children: ButtonChildNodes): void {
        const { icon, iconSprite } = children;

        if (this.icon) {
            icon.active = true;
            iconSprite.spriteFrame = imageManager.getUIImage(this.icon);
            if (this.iconPosition === IconPosition.TOP || this.iconPosition === IconPosition.BOTTOM) {
                this.setIconSize(icon, this.fontSize * 1.2);
            } else {
                this.setIconSize(icon, this.fontSize);
            }
        } else {
            icon.active = false;
        }
    }

    /**
     * 设置标签
     */
    private setupLabel(children: ButtonChildNodes): void {
        const { label } = children;

        if (this.label) {
            label.node.active = true;
            label.string = this.label;
            label.fontSize = this.fontSize;
        } else {
            label.node.active = false;
        }
    }

    /**
     * 设置图标大小
     */
    private setIconSize(icon: Node, size: number): void {
        const uiTransform = icon.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.width = size;
            uiTransform.height = size;
        }
    }

    /**
     * 播放点击动画
     */
    private playClickAnimation(): Promise<void> {
        const originalScale = this.node.scale.clone();
        const targetScale = new Vec3(
            originalScale.x * this.clickScale,
            originalScale.y * this.clickScale,
            originalScale.z
        );

        return new Promise(resolve => {
            tween(this.node)
                .to(Button.ANIMATION_DURATION, { scale: targetScale }, { easing: 'sineOut' })
                .to(Button.ANIMATION_DURATION, { scale: originalScale }, { easing: 'sineIn' })
                .call(() => resolve(void 0))
                .start();
        });
    }

    // 点击事件
    private _onClick = noConcurrent(async () => {
        if (this.disabled) return;

        await this.playClickAnimation();

        if (this.onClick) {
            const result = this.onClick();
            if (result instanceof Promise) {
                await result;
            }
        }
    });
}
