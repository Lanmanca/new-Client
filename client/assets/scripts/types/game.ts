import { IPlayer } from './player';

export enum Direction {
    /**
     * 上
     */
    TOP = 'top',
    /**
     * 下
     */
    BOTTOM = 'bottom',
    /**
     * 左
     */
    LEFT = 'left',
    /**
     * 右
     */
    RIGHT = 'right',
}

export interface IPlayerLocation {
    /**
     * x坐标
     */
    x: number;
    /**
     * y坐标
     */
    y: number;
    /**
     * 方向
     */
    direction: Direction;
    /**
     * 玩家
     */
    player?: IPlayer;
}
