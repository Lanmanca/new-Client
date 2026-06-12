import {
    IHideAnimationConfig,
    IRotateAnimationConfig,
    IShowAnimationConfig,
    ISlideUpAnimationConfig,
} from '@/types/animation';
import { SlideDirection } from '@/types/sidebar';
import { Node, tween, TweenEasing, UIOpacity, UITransform, Vec3 } from 'cc';

/**
 * 动画管理器
 */
class AnimationManager {
    private static _instance: AnimationManager;
    public static get instance(): AnimationManager {
        if (!this._instance) {
            this._instance = new AnimationManager();
        }
        return this._instance;
    }

    // 默认动画配置
    private defaultShowConfig: Required<Pick<IShowAnimationConfig, 'duration' | 'easing'>> & {
        fromScale: Vec3;
        toScale: Vec3;
    } = {
            duration: 0.3,
            fromScale: new Vec3(0, 0, 1),
            toScale: new Vec3(1, 1, 1),
            easing: 'backOut',
        };

    private defaultHideConfig: Required<Pick<IHideAnimationConfig, 'duration' | 'easing'>> & {
        toScale: Vec3;
    } = {
            duration: 0.2,
            toScale: new Vec3(0, 0, 1),
            easing: 'backIn',
        };

    /**
     * 播放显示动画
     */
    public playShow(node: Node, config?: IShowAnimationConfig): Promise<void> {
        const finalConfig = { ...this.defaultShowConfig, ...config };

        return new Promise(resolve => {
            // 设置初始状态
            if (finalConfig.fromScale) {
                node.setScale(finalConfig.fromScale);
            }

            // 如果有透明度动画
            let opacity = node.getComponent(UIOpacity);
            if (finalConfig.fromOpacity !== undefined && !opacity) {
                opacity = node.addComponent(UIOpacity);
            }
            if (opacity && finalConfig.fromOpacity !== undefined) {
                opacity.opacity = finalConfig.fromOpacity;
            }

            // 构建动画
            const tweenAction = tween(node);

            // 创建目标属性
            const toProps: any = {};
            if (finalConfig.toScale) {
                toProps.scale = finalConfig.toScale;
            }

            // 播放动画
            tweenAction.to(finalConfig.duration, toProps, {
                easing: finalConfig.easing,
            });

            // 如果有透明度动画
            if (opacity && finalConfig.toOpacity !== undefined) {
                tweenAction.parallel(
                    tween(opacity).to(
                        finalConfig.duration,
                        {
                            opacity: finalConfig.toOpacity,
                        },
                        {
                            easing: finalConfig.easing,
                        }
                    )
                );
            }

            tweenAction
                .delay(finalConfig.delay || 0)
                .call(() => {
                    resolve();
                })
                .start();
        });
    }

    /**
     * 滑入动画
     */
    public playSlideIn(node: Node, direction: SlideDirection = SlideDirection.RIGHT, duration: number = 0.3): Promise<void> {
        return new Promise(resolve => {

            const uiTransform = node.getComponent(UITransform);
            if (!uiTransform) {
                console.warn('Node 没有 UITransform 组件，无法播放滑入动画');
                resolve();
                return;
            }

            const width = uiTransform.width;
            const height = uiTransform.height;

            // 记录目标位置
            const targetPos = node.position.clone();
            let startPos = targetPos.clone();

            // 根据方向设置初始位置
            if (direction === SlideDirection.RIGHT) {
                startPos.x = -width;
            } else if (direction === SlideDirection.LEFT) {
                startPos.x = width;
            } else if (direction === SlideDirection.TOP) {
                startPos.y = -height;
            } else if (direction === SlideDirection.BOTTOM) {
                startPos.y = height;
            }

            node.setPosition(startPos);

            // 播放滑入动画，并在动画完成时 resolve
            tween(node)
                .to(duration, { position: targetPos }, { easing: 'sineOut' })
                .call(() => {
                    resolve();
                })
                .start();
        });
    }

    /**
     * 滑出动画
     */
    public playSlideOut(
        node: Node,
        direction: SlideDirection = SlideDirection.RIGHT,
        duration: number = 0.3
    ): Promise<void> {

        return new Promise(resolve => {

            const uiTransform = node.getComponent(UITransform);
            if (!uiTransform) {
                console.warn('Node 没有 UITransform 组件，无法播放滑出动画');
                resolve();
                return;
            }

            const width = uiTransform.width;
            const height = uiTransform.height;

            // 当前目标位置
            const startPos = node.position.clone();
            const endPos = startPos.clone();

            // 根据方向计算滑出位置
            if (direction === SlideDirection.RIGHT) {
                endPos.x = -width;
            } else if (direction === SlideDirection.LEFT) {
                endPos.x = width;
            } else if (direction === SlideDirection.TOP) {
                endPos.y = -height;
            } else if (direction === SlideDirection.BOTTOM) {
                endPos.y = height;
            }

            // 播放滑出动画
            tween(node)
                .to(duration, { position: endPos }, { easing: 'sineIn' })
                .call(() => {
                    resolve()
                    node.destroy();
                })
                .start();
        });
    }

    /**
     * 播放隐藏动画
     */
    public playHide(node: Node, config?: IHideAnimationConfig): Promise<void> {
        const finalConfig = { ...this.defaultHideConfig, ...config };

        return new Promise(resolve => {
            const tweenAction = tween(node);

            // 创建目标属性
            const toProps: any = {};
            if (finalConfig.toScale) {
                toProps.scale = finalConfig.toScale;
            }

            // 播放动画
            tweenAction.to(finalConfig.duration, toProps, {
                easing: finalConfig.easing,
            });

            // 如果有透明度动画
            const opacity = node.getComponent(UIOpacity);
            if (opacity && finalConfig.toOpacity !== undefined) {
                tweenAction.parallel(
                    tween(opacity).to(
                        finalConfig.duration,
                        {
                            opacity: finalConfig.toOpacity,
                        },
                        {
                            easing: finalConfig.easing,
                        }
                    )
                );
            }

            tweenAction
                .delay(finalConfig.delay || 0)
                .call(() => {
                    node.active = false;
                    resolve();
                })
                .start();
        });
    }

    /**
     * 播放弹窗抖动动画
     */
    public playShake(
        node: Node,
        config?: { intensity?: number; duration?: number }
    ): Promise<void> {
        const intensity = config?.intensity ?? 10;
        const totalDuration = config?.duration ?? 0.3;

        return new Promise(resolve => {
            const originalPos = node.position.clone();
            const shakeTimes = 6; // 抖动次数
            const stepDuration = totalDuration / shakeTimes;

            let tweenAction = tween(node);

            // 左右交替抖动，幅度逐渐减小
            for (let i = 0; i < shakeTimes; i++) {
                const direction = i % 2 === 0 ? -1 : 1;
                const currentIntensity = intensity * (1 - (i / shakeTimes) * 0.5);

                tweenAction = tweenAction.to(
                    stepDuration,
                    {
                        position: new Vec3(
                            originalPos.x + direction * currentIntensity,
                            originalPos.y,
                            originalPos.z
                        ),
                    },
                    { easing: 'sineOut' }
                );
            }

            // 回到原位
            tweenAction
                .to(stepDuration, { position: originalPos }, { easing: 'sineOut' })
                .call(() => {
                    resolve();
                })
                .start();
        });
    }

    /**
     * 播放上移动画（淡入 + 上移）
     */
    public playSlideUp(node: Node, config?: ISlideUpAnimationConfig): Promise<void> {
        const finalConfig = {
            duration: 0.3,
            distance: 20,
            fromOpacity: 0,
            toOpacity: 255,
            easing: 'sineOut' as TweenEasing,
            delay: 0,
            ...config,
        };

        return new Promise(resolve => {
            const originalPos = node.position.clone();

            // 设置初始状态
            node.setPosition(originalPos.x, originalPos.y - finalConfig.distance, originalPos.z);

            // 设置透明度
            let opacity = node.getComponent(UIOpacity);
            if (finalConfig.fromOpacity !== undefined && !opacity) {
                opacity = node.addComponent(UIOpacity);
            }
            if (opacity && finalConfig.fromOpacity !== undefined) {
                opacity.opacity = finalConfig.fromOpacity;
            }

            node.active = true;

            // 并行动画：上移 + 淡入
            const tweenAction = tween(node);

            // 上移
            tweenAction.to(
                finalConfig.duration,
                {
                    position: new Vec3(originalPos.x, originalPos.y, originalPos.z),
                },
                { easing: finalConfig.easing }
            );

            // 淡入
            if (opacity && finalConfig.toOpacity !== undefined) {
                tweenAction.parallel(
                    tween(opacity).to(
                        finalConfig.duration,
                        { opacity: finalConfig.toOpacity },
                        { easing: finalConfig.easing }
                    )
                );
            }

            tweenAction
                .delay(finalConfig.delay)
                .call(() => resolve())
                .start();
        });
    }

    /**
     * 播放下滑隐藏动画
     */
    public playSlideDown(node: Node, config?: ISlideUpAnimationConfig): Promise<void> {
        const finalConfig = {
            duration: 0.2,
            distance: 20,
            toOpacity: 0,
            easing: 'sineIn' as TweenEasing,
            delay: 0,
            ...config,
        };

        return new Promise(resolve => {
            const originalPos = node.position.clone();

            // 获取透明度组件
            const opacity = node.getComponent(UIOpacity);

            // 并行动画：下滑 + 淡出
            const tweenAction = tween(node);

            // 下滑
            tweenAction.to(
                finalConfig.duration,
                {
                    position: new Vec3(
                        originalPos.x,
                        originalPos.y - finalConfig.distance,
                        originalPos.z
                    ),
                },
                { easing: finalConfig.easing }
            );

            // 淡出
            if (opacity && finalConfig.toOpacity !== undefined) {
                tweenAction.parallel(
                    tween(opacity).to(
                        finalConfig.duration,
                        { opacity: finalConfig.toOpacity },
                        { easing: finalConfig.easing }
                    )
                );
            }

            tweenAction
                .delay(finalConfig.delay)
                .call(() => {
                    node.active = false;
                    node.setPosition(originalPos); // 恢复位置
                    resolve();
                })
                .start();
        });
    }

    /**
     * 播放旋转动画
     */
    public playRotate(node: Node, config?: IRotateAnimationConfig): Promise<void> {
        const finalConfig = {
            duration: 1,
            fromAngle: 0,
            toAngle: 360,
            easing: 'linear' as TweenEasing,
            repeat: false,
            delay: 0,
            ...config,
        };

        return new Promise(resolve => {
            // 设置初始角度
            node.setRotationFromEuler(new Vec3(0, 0, finalConfig.fromAngle));

            const tweenAction = tween(node);

            // 旋转动画
            tweenAction.to(
                finalConfig.duration,
                { angle: finalConfig.toAngle },
                { easing: finalConfig.easing }
            );

            // 如果需要重复
            if (finalConfig.repeat) {
                tweenAction.repeatForever();
            }

            tweenAction
                .delay(finalConfig.delay)
                .call(() => resolve())
                .start();
        });
    }

    /**
     * 播放无限旋转动画
     */
    public playRotateForever(
        node: Node,
        duration: number = 1,
        clockwise: boolean = true
    ): { stop: () => void } {
        const angle = clockwise ? -360 : 360; // 顺时针/逆时针

        const tweenAction = tween(node)
            .repeatForever(tween().by(duration, { angle: angle }, { easing: 'linear' }))
            .start();

        return {
            stop: () => {
                tweenAction.stop();
            },
        };
    }

    /**
     * 播放弹跳动画
     */
    public playBounce(node: Node, config?: { height?: number; duration?: number }): Promise<void> {
        const height = config?.height ?? 10;
        const duration = config?.duration ?? 0.3;

        return new Promise(resolve => {
            const originalPos = node.position.clone();

            tween(node)
                .to(
                    duration / 2,
                    {
                        position: new Vec3(originalPos.x, originalPos.y + height, originalPos.z),
                    },
                    { easing: 'sineOut' }
                )
                .to(
                    duration / 2,
                    {
                        position: originalPos,
                    },
                    { easing: 'sineIn' }
                )
                .call(() => resolve())
                .start();
        });
    }

    /**
     * 播放淡入动画
     */
    public playFadeIn(node: Node, duration: number = 0.3): Promise<void> {
        let opacity = node.getComponent(UIOpacity);
        if (!opacity) {
            opacity = node.addComponent(UIOpacity);
        }
        opacity.opacity = 0;
        node.active = true;

        return new Promise(resolve => {
            tween(opacity)
                .to(duration, { opacity: 255 }, { easing: 'sineOut' })
                .call(() => {
                    resolve();
                })
                .start();
        });
    }

    /**
     * 播放淡出动画
     */
    public playFadeOut(node: Node, duration: number = 0.3): Promise<void> {
        const opacity = node.getComponent(UIOpacity);
        if (!opacity) return Promise.resolve();

        return new Promise(resolve => {
            tween(opacity)
                .to(duration, { opacity: 0 }, { easing: 'sineOut' })
                .call(() => {
                    node.active = false;
                    resolve();
                })
                .start();
        });
    }

    /**
     * 停止所有动画
     */
    public stopAll(node: Node) {
        tween(node).stop();
        const opacity = node.getComponent(UIOpacity);
        if (opacity) {
            tween(opacity).stop();
        }
    }
}

/**
 * 动画管理器
 */
export const animationManager = AnimationManager.instance;
