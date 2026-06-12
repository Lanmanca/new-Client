import { TweenEasing, Vec3 } from 'cc';

export interface IAnimationConfig {
    /**
     * 动画持续时间
     */
    duration?: number;
    /**
     * 动画延迟时间
     */
    delay?: number;
    /**
     * 动画缓动函数
     */
    easing?: TweenEasing | ((k: number) => number);
}

export interface IShowAnimationConfig extends IAnimationConfig {
    /**
     * 初始缩放
     */
    fromScale?: Vec3;
    /**
     * 目标缩放
     */
    toScale?: Vec3;
    /**
     * 初始不透明度
     */
    fromOpacity?: number;
    /**
     * 目标不透明度
     */
    toOpacity?: number;
}

export interface IHideAnimationConfig extends IAnimationConfig {
    /**
     * 目标缩放
     */
    toScale?: Vec3;
    /**
     * 目标不透明度
     */
    toOpacity?: number;
}

export interface ISlideUpAnimationConfig extends IAnimationConfig {
    /**
     * 移动距离
     */
    distance?: number;
    /**
     * 初始不透明度
     */
    fromOpacity?: number;
    /**
     * 目标不透明度
     */
    toOpacity?: number;
}

export interface IRotateAnimationConfig extends IAnimationConfig {
    /**
     * 初始角度
     */
    fromAngle?: number;
    /**
     * 目标角度
     */
    toAngle?: number;
    /**
     * 是否重复
     */
    repeat?: boolean;
}

export enum AnimationType {
    /**
     * 缩放动画
     */
    SCALE = 'scale',
    /**
     * 淡入淡出动画
     */
    FADE = 'fade',
    /**
     * 滑动动画
     */
    SLIDE = 'slide',
}
