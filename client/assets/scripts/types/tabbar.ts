import { Label, Node, Sprite } from "cc";
import { Direction } from "./game";

export interface ITabBarItem {
    /**
     * 图标
     */
    icon?: string;
    /**
     * 图标位置
     */
    iconPosition?: Direction;
    /**
     * 背景图片
     */
    background?: string;
    /**
     * 背景节点
     */
    backgroundSprite?: Sprite;
    /**
     * 标签节点
     */
    labelNode?: Label;
    /**
     * 标签文本
     */
    label: string;
    /**
     * 背景是否选中样式
     */
    isSelectedBackground?: boolean;
    /**
     * 字号大小，也同时影响icon大小
     */
    fontSize?: number;
    /**
     * rect节点
     */
    rectNode?: Node;
    /**
     * 是否显示rect
     */
    showRect?: boolean;
    /**
     * 点击事件
     */
    onClick: () => void | Promise<void>;
}


