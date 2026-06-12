import { IUser } from './user';

/**
 * 玩家状态
 */
export enum PlayerStatus {
    /**
     * 离开
     */
    Leave = 'leave',
    /**
     * 忙碌（离线保留状态中）
     */
    Busy = 'busy',
    /**
     * 坐下
     */
    SitDown = 'sit_down',
    /**
     * 已准备
     */
    Ready = 'ready',
    /**
     * 正在发言，即下注
     */
    Speaking = 'speaking',
    /**
     * 等待中
     */
    Waiting = 'waiting',
}

/**
 * 玩家
 */
export interface IPlayer {
    /**
     * 用户ID（与后端 seat 对齐）
     */
    userId?: string;
    /**
     * 用户信息
     */
    user?: IUser;
    /**
     * 昵称
     */
    nickname?: string;
    /**
     * 头像URL
     */
    avatarUrl?: string;
    /**
     * 是否是房主
     */
    isOwner: boolean;
    /**
     * 角色
     */
    role: string;
    /**
     * 状态
     */
    status: PlayerStatus;
    /**
     * 手牌（其他玩家的牌用0填充）
     */
    cards: number[];
    /**
     * 下注金额
     */
    bet?: number;
    /**
     * 当前回合下注金额（后端 current_bet）
     */
    currentBet?: number;
    /**
     * 本手累计投入底池（后端 contributed_this_hand）
     */
    contributedThisHand?: number;
    /**
     * 座位索引
     */
    index?: number;
    /**
     * 座位索引（后端 seat_index）
     */
    seatIndex?: number;
    /**
     * 桌上筹码（后端 wallet）
     */
    wallet?: number;
    /**
     * 账外余额（可买入），仅本人可见时由服务端下发
     */
    accountBalance?: number;
    /**
     * 是否是机器人
     */
    isBot?: boolean;
    /**
     * 用户客户端语言
     */
    lang?: string;
    /**
     * 加入时间
     */
    joinAt?: number;
    /**
     * 离开时间
     */
    leaveAt?: number;
    /**
     * 最后更新时间
     */
    lastUpdateAt?: number;
    /**
     * 本手是否已弃牌
     */
    folded?: boolean;
    /**
     * 本手是否已无剩余可下注筹码（服务端 all_in_hand）
     */
    allInHand?: boolean;
    /**
     * 是否离线
     */
    offline?: boolean;
    /**
     * 离线时间戳
     */
    offlineAt?: number;
}
