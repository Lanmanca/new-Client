export enum RoomType {
    /**
     * 公开房
     */
    Public = 'public',
    /**
     * 私人房
     */
    Private = 'private',
}

export interface IRoomSettings {
    /**
     * 房间类型
     */
    roomType: RoomType;
    /**
     * 最大玩家数
     */
    maxPlayers: number;
    /**
     * 最大观战者数
     */
    maxWatchers: number;
    /**
     * 离开超时（秒）
     */
    leaveTimeout: number;
    /**
     * 行动超时（秒）
     */
    actionTimeout: number;
    /**
     * 房主佣金，单位百分比
     */
    ownerCommission: number;
    /**
     * 小盲注金额，单位货币
     */
    smallBlind: number;
    /**
     * 前注金额，单位货币
     */
    ante: number;
    /**
     * 最大买入金额，单位货币
     */
    maxBuyIn: number;
    /**
     * 最小买入金额，单位货币
     */
    minBuyIn: number;
    /**
     * 是否允许观战
     */
    allowWatch: boolean;
    /**
     * 最大局数
     */
    maxRounds: number;
}

export enum RoomStatus {
    /**
     * 未激活，只有房主进入之后才激活
     */
    NotActivated = 'not_activated',
    /**
     * 已打开，等待玩家加入
     */
    Open = 'open',
    /**
     * 已关闭，会自动解散
     */
    Close = 'close',
    /**
     * 对局进行中
     */
    Playing = 'playing',
    /**
     * 对局已结束
     */
    Ended = 'ended',
}

export interface IPotState {
    mainPot: number;
    sidePot: number;
    /** 桌中筹码总计（与 main+side 一致，服务端真源） */
    total?: number;
}

export interface IActionState {
    currentTurnUserId: string;
    deadlineAt: number;
    lastAction: string;
    lastActionUserId: string;
    lastActionAmount: number;
}

export interface ILastHandPayout {
    userId: string;
    nickname: string;
    amount: number;
    /** 结算时赢家底牌编码（suit×100+rank），仅展示用 */
    holeCards?: number[];
}

/** 上一手按主池/边池分层派奖（服务端 last_hand_layers） */
export interface ILastHandLayer {
    tier: number;
    amount: number;
    payouts?: ILastHandPayout[];
}

/** 摊牌时服务端下发的该座最佳五张与牌型（showdown_best_hands） */
export interface IShowdownBestHand {
    userId: string;
    nickname?: string;
    seatIndex?: number;
    bestFive?: number[];
    handCategory?: string;
}

export interface IRoundState {
    handNo: number;
    stage: string;
    dealerSeatIndex: number;
    smallBlindAmount: number;
    bigBlindAmount: number;
    communityCards: number[];
    pot: IPotState;
    action: IActionState;
    /** 当前街最小再加注参照（与后端 last_raise_size 对齐） */
    lastRaiseSize?: number;
    /** 摊牌阶段服务端声明公开底牌的玩家 userId 列表（showdown_reveal_user_ids） */
    showdownRevealUserIds?: string[];
    /** 摊牌各未弃牌座位的最佳五张与牌型 */
    showdownBestHands?: IShowdownBestHand[];
    /** 上一手结算（服务端 last_hand_*，camel 由 transformKeysToCamel 转换） */
    lastHandKind?: string;
    lastHandPotTotal?: number;
    lastHandRake?: number;
    lastHandPayouts?: ILastHandPayout[];
    lastHandLayers?: ILastHandLayer[];
}

export interface IRoom extends IRoomSettings {
    /**
     * 房间号
     */
    roomNumber: string;
    /**
     * 房间所有者
     */
    owner: string;
    /**
     * 房主用户ID（与后端 owner_user_id 对齐）
     */
    ownerUserId?: string;
    /**
     * 服务端当前时间戳（秒）
     */
    serverNow?: number;
    /**
     * 房间状态
     */
    status: RoomStatus;
    /**
     * 创建时间
     */
    createdAt: number;
    /**
     * 当前玩家快照
     */
    players?: import('./player').IPlayer[];
    /**
     * 观战用户ID列表
     */
    watchers?: string[];
    /**
     * 当前牌局状态
     */
    round?: IRoundState;
    /**
     * 当前玩家数（缓存字段）
     */
    _currentPlayers?: number;
}

export interface IRoomOwner {
    userId: string;
    nickname: string;
    avatarUrl: string;
    status?: import('./player').PlayerStatus;
}

export interface IGameHistory {
    roomNumber: string;
    handNo: number;
    kind: string;
    communityCards?: number[];
    startedAtUnix?: number;
    endedAtUnix?: number;
    durationSec?: number;
    potTotal: number;
    rake: number;
    smallBlind?: number;
    owner?: {
        userId: string;
        nickname: string;
        avatarUrl: string;
    };
    payouts?: ILastHandPayout[];
    pot?: IPotState;
    layers?: ILastHandLayer[];
    players?: Array<{
        userId: string;
        nickname: string;
        avatarUrl: string;
        seatIndex: number;
        seatRole?: string;
        contributedThisHand: number;
        currentBet: number;
        wonAmount: number;
        profitLoss: number;
        isWinner: boolean;
        actions?: Array<{
            stage: string;
            action: string;
            amount: number;
            actionAtUnix: number;
        }>;
        bestFive?: number[];
        holeCards?: number[];
    }>;
    settledAtUnix: number;
}
