export enum ButtonType {
    /**
     * 次要按钮
     */
    SECONDARY = 'secondary',
    /**
     * 主要按钮
     */
    PRIMARY = 'primary',
    /**
     * 警告按钮
     */
    WARNING = 'warning',
    /**
     * 错误按钮
     */
    ERROR = 'error',
    /**
     * 信息按钮
     */
    INFO = 'info',
}

export enum IconPosition {
    /**
     * 图标在左侧
     */
    LEFT = 'left',
    /**
     * 图标在右侧
     */
    RIGHT = 'right',
    /**
    * 图标在上方
    */
    TOP = 'top',
    /**
     * 图标在下方
     */
    BOTTOM = 'bottom',
}


/**
 * 按钮
 */
export interface IButton {
    /**
     * 按钮标签
     */
    label?: string;
    /**
     * 按钮类型
     */
    type?: ButtonType;
    /**
     * 文本颜色
     * 只有在 text 为 true 时有效
     */
    color?: string;
    /**
     * 按钮图标
     */
    icon?: string;
    /**
     * 文本按钮
     * 配合 icon 可使按钮只显示图标
     */
    text?: boolean;
    /**
     * 显示字体的大小，同时影响图标大小
     */
    fontSize?: number;
    /**
     * 按钮是否禁用
     */
    disabled?: boolean;
    /**
     * 按钮点击事件
     */
    onClick?: () => void | Promise<void>;
}
