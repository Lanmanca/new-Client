
// 滑动方向
export enum SlideDirection {
    // 从右向左滑出
    LEFT = 'RightToLeft',
    RIGHT = 'LeftToRight',
    TOP = 'BottomToTop',
    BOTTOM = 'TopToBottom'
}

export interface ISidebar {
    /**
     * 侧边栏标题
     */
    title: string;
    /**
     * 侧边栏滑动方向
     */
    direction: SlideDirection;
}

