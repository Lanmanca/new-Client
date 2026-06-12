import { Button, Modal, PokerPile, Sidebar } from '@/component';
import { RoomInfo } from '@/component/RoomInfo';
import { SettIement } from '@/component/SettIement';
import config from '@/config';
import { PokerFactory } from '@/factory/PokerFactory';
import {
    i18n,
    imageManager,
    roomManager,
    uiManager,
    userManager,
} from '@/manager';
import { roomSessionService } from '@/manager/RoomSessionService';
import { roomSessionStore } from '@/manager/RoomSessionStore';
import { FormItemType, IFormItem, InputType } from '@/types/form';
import { Direction, IPlayerLocation } from '@/types/game';
import { IRoom, RoomStatus } from '@/types/room';
import { SlideDirection } from '@/types/sidebar';
import Log from '@/utils/Log';
import { tServerErrorMessage } from '@/utils/serverMessage';
import {
    _decorator,
    Color,
    Component,
    Graphics,
    instantiate,
    isValid,
    Label,
    Layout,
    Node,
    Prefab,
    Sprite,
    tween,
    Tween,
    UITransform,
    Vec3,
} from 'cc';

const { ccclass, property } = _decorator;

class SeatLayout {
    constructor(private _pokerTable: Node, private _playerPrefab: Prefab) { }

    /**
     * 计算玩家位置
     *
     * 按钮位(BTN)开始逆时针的位置信息：
     * + 2人: BTN(按钮位) -> BB(大盲位)
     * + 3人: BTN(按钮位) -> SB(小盲位) -> BB(大盲位)
     * + 4人: BTN(按钮位) -> SB(小盲位) -> BB(大盲位) -> UTG(枪口位)
     * + 5人: BTN(按钮位) -> SB(小盲位) -> BB(大盲位) -> UTG(枪口位) -> CO(关煞位)
     * + 6人: BTN(按钮位) -> SB(小盲位) -> BB(大盲位) -> UTG(枪口位) -> MP(中间位) -> CO(关煞位)
     * + 7人: BTN(按钮位) -> SB(小盲位) -> BB(大盲位) -> UTG(枪口位) -> UTG+1 -> MP(中间位) -> CO(关煞位)
     * + 8人: BTN(按钮位) -> SB(小盲位) -> BB(大盲位) -> UTG(枪口位) -> UTG+1 -> UTG+2 -> MP(中间位) -> CO(关煞位)
     * + 9人: BTN(按钮位) -> SB(小盲位) -> BB(大盲位) -> UTG(枪口位) -> UTG+1 -> UTG+2 -> MP(中间位) -> MP+1 -> CO(关煞位)
     */
    calculatePlayerLocations(playerCount: number) {
        const positions: IPlayerLocation[] = [];

        // 从节点获取牌桌宽高
        const tableUiTransform = this._pokerTable.getComponent(UITransform);
        const tableWidth = tableUiTransform.width;
        const tableHeight = tableUiTransform.height;

        // 获取牌堆的宽高
        const player = instantiate(this._playerPrefab);
        const pokerDeckUiTransform = player.getComponent(UITransform);
        const pokerHeapWidth = pokerDeckUiTransform.width;
        const pokerHeapHeight = pokerDeckUiTransform.height;

        // 获取布局配置
        const layout = this.getLayout(playerCount);

        // BOTTOM 保持不变：永远是一个，绝对居中
        if (layout.bottom > 0) {
            positions.push({
                x: 0,
                y: -(tableHeight / 2 - pokerHeapHeight / 2),
                direction: Direction.BOTTOM,
            });
        }

        // RIGHT 保持不变：依据数量纵向等分（9人时循环3次）
        if (layout.right > 0) {
            const rightSpacing = tableHeight / (layout.right + 1);
            for (let i = layout.right - 1; i >= 0; i--) {
                const yPos = tableHeight / 2 - rightSpacing * (i + 1);
                positions.push({
                    x: tableWidth / 2 - pokerHeapWidth / 2,
                    y: yPos,
                    direction: Direction.RIGHT,
                });
            }
        }

        // TOP 改造：支持多个座位横向等分排列（9人时放2个）
        if (layout.top > 0) {
            if (layout.top === 1) {
                // 如果只有 1 个座位（兼容低人数），依然绝对居中
                positions.push({
                    x: 0,
                    y: tableHeight / 2 - pokerHeapHeight / 2,
                    direction: Direction.TOP,
                });
            } else {
                // 如果有多个座位（比如 2 个），进行横向（X轴）等分算法
                const topSpacing = tableWidth / (layout.top + 1);
                // 逆时针添加：从右往左排
                for (let i = layout.top - 1; i >= 0; i--) {
                    const xPos = tableWidth / 2 - topSpacing * (i + 1);
                    positions.push({
                        x: xPos,
                        y: tableHeight / 2 - pokerHeapHeight / 2, // Y轴固定在顶部
                        direction: Direction.TOP,
                    });
                }
            }
        }

        // LEFT 保持不变：依据数量纵向等分（9人时循环3次）
        if (layout.left > 0) {
            const leftSpacing = tableHeight / (layout.left + 1);
            for (let i = 0; i < layout.left; i++) {
                const yPos = tableHeight / 2 - leftSpacing * (i + 1);
                positions.push({
                    x: -(tableWidth / 2 - pokerHeapWidth / 2),
                    y: yPos,
                    direction: Direction.LEFT,
                });
            }
        }

        player.destroy();
        return positions;
    }

    /**
     * 获取布局配置
     */
    getLayout(playerCount: number) {
        const configs = [
            { top: 1, bottom: 1, left: 0, right: 0 }, // 2人
            { top: 0, bottom: 1, left: 1, right: 1 }, // 3人
            { top: 1, bottom: 1, left: 1, right: 1 }, // 4人
            { top: 1, bottom: 1, left: 2, right: 1 }, // 5人
            { top: 1, bottom: 1, left: 2, right: 2 }, // 6人
            { top: 1, bottom: 1, left: 3, right: 2 }, // 7人
            { top: 1, bottom: 1, left: 3, right: 3 }, // 8人

            // 9人桌改为 -> 顶2、底1、左3、右3 (2 + 1 + 3 + 3 = 9)
            { top: 2, bottom: 1, left: 3, right: 3 }, // 9人
        ];

        return configs[playerCount - 2] || configs[2];
    }
}

@ccclass('PokerController')
export class PokerController extends Component {
    @property({ type: Sprite, tooltip: '牌桌背景节点' })
    tableBackgroundNode: Sprite;

    @property({ type: String, tooltip: '牌桌背景名称' })
    tableBackground: string = 'Table5';

    @property({ type: Button, tooltip: '退出按钮' })
    exitButton: Button;

    @property({ type: Button, tooltip: '房间信息按钮' })
    roomInfoButton: Button;

    @property({ type: Button, tooltip: '设置按钮' })
    settingButton: Button;

    @property({ type: Button, tooltip: '聊天按钮' })
    chatButton: Button;

    @property({ type: Node, tooltip: '开始游戏节点' })
    startGameNode: Node;

    @property({ type: Node, tooltip: '总奖池' })
    totalBet: Node;

    @property({ type: Node, tooltip: '当前回合总奖池' })
    currentRoundBet: Node;

    @property({ type: Node, tooltip: '主池节点' })
    mainPot: Node;

    @property({ type: Node, tooltip: '边池节点' })
    sidePot: Node;

    @property({ type: Node, tooltip: '下注节点' })
    betNode: Node;

    @property({ type: Node, tooltip: '牌桌节点' })
    tableNode: Node;

    @property({ type: Prefab, tooltip: '牌堆预制体' })
    pokerPilePrefab: Prefab;

    @property({ type: Prefab, tooltip: '牌预制体' })
    pokerPrefab: Prefab;

    @property({ type: Prefab, tooltip: '聊天预制件' })
    chatPrefab: Prefab;

    @property({ type: Number, tooltip: '每次发牌数量' })
    cardsPerDeal: number = 1;

    @property({ type: Number, tooltip: '玩家需持有的扑克牌数量' })
    pokerCount: number = 2;

    @property({ type: Number, tooltip: '每张牌飞行的持续时间' })
    duration: number = 0.4;

    @property({ type: Number, tooltip: '每轮发牌的间隔时间' })
    interval: number = 0.2;

    @property({ type: Number, tooltip: '牌之间的偏移量' })
    pokerOffset: number = 80;

    @property({ type: Number, tooltip: '座位信息/倒计时相对牌堆：牌堆半高 + 该间距（与牌堆 UITransform 高度相关）' })
    seatAnchorGap: number = 20;

    @property({ type: Number, tooltip: '顶部座位整体下移偏移' })
    topSeatDownOffset: number = 36;

    @property({ type: Prefab, tooltip: '上一手结算预制体' })
    settlementPrefab: Prefab;

    /**
     * 房间信息
     */
    room: IRoom;
    /**
     * 牌工厂
     */
    pokerFactory: PokerFactory;
    /**
     * 座位布局
     */
    seatLayout: SeatLayout;
    /** 房间状态订阅取消函数 */
    private _unsubscribeRoomState?: () => void;

    /** 牌堆节点 */
    private _pokerPile: Node | null = null;
    /** 公开牌堆节点 */
    private _publicPokerPile: Node[] = [];
    /** 座位牌堆节点 */
    private _seatPiles: PokerPile[] = [];
    /** 是否销毁 */
    private _disposed = false;
    /** 游戏是否已开始 */
    private _gameStarted = false;
    /** 已发牌节点 */
    private _dealtCards: Node[] = [];
    /** 庄家座位索引（-1 表示未开始） */
    private _dealerSeatIndex = -1;
    /** 倒计时渲染定时器 */
    private _countdownRenderTimer: ReturnType<typeof setInterval> | null = null;
    /** 阶段超时定时器 */
    private _stageTimeouts: Array<ReturnType<typeof setTimeout>> = [];
    /** 倒计时标签节点 */
    private _countdownLabelNode: Node | null = null;
    /** 倒计时标签 */
    private _countdownLabel: Label | null = null;
    /** 座位角色标签 */
    private _seatRoleLabels: Array<Label | null> = [];
    /** 座位正上方离线超时文字；玩家操作倒计时改由 PokerPile.actionCountdown 显示 */
    private _seatTimerLabels: Array<Label | null> = [];
    /** 座位信息卡片 */
    private _seatInfoCards: Array<{
        root: Node;
        level: Label;
        bet: Label;
        role: Label;
    } | null> = [];
    /** 阶段标题 + 底池 垂直排列容器（Layout） */
    private _stagePotHostNode: Node | null = null;
    /** 阶段标题节点 */
    private _stageLabelNode: Node | null = null;
    /** 阶段标题 */
    private _stageLabel: Label | null = null;
    /** 底池标签节点 */
    private _potLabelNode: Node | null = null;
    /** 底池标签 */
    private _potLabel: Label | null = null;
    /** 离开渲染定时器 */
    private _leaveRenderTimer: ReturnType<typeof setInterval> | null = null;
    /** 当前玩家独立读秒 Label 节点 */
    private _selfCountdownLabel: Node | null = null;
    /** 当前玩家读秒是否激活 */
    private _isSelfCountdownActive: boolean = false;
    /** 最后一次房间日志快照 */
    private _lastRoomLogSnapshot: string = '';
    /** 服务器时间偏移（毫秒） */
    private _serverTimeOffsetMs = 0;
    /** 是否服务器时间偏移已初始化 */
    private _serverOffsetInited = false;
    /** 是否进入场景时已开始游戏 */
    private _enteredSceneWithPlaying = false;
    /** 最后一次房间状态 */
    private _lastKnownRoomStatus: string = '';
    /** 是否接收房间状态 */
    private _hasReceivedRoomState = false;
    /** 是否需要恢复游戏视图 */
    private _shouldRestorePlayingView = false;
    /** 上次开始倒计时截止时间 */
    private _lastStartCountdownDeadline = 0;
    /** 仅当房态里的 server_now 更新时再校时，避免 getOwner/getPlayers 等 patch 用陈旧 serverNow 把偏移拉爆、读秒回滚 */
    private _lastAppliedServerNowForClock = 0;
    /** 已渲染的对局快照（手数/阶段/公共牌/各座手牌），用于 WS 增量同步，避免重连后仍停留在离开时的画面 */
    private _lastAppliedRoundSignature = '';
    /** 动态克隆的边池节点 */
    private _sidePotClones: Node[] = [];
    /** "等待游戏开始"提示文本节点 */
    private _waitingTextNode: Node | null = null;
    private _waitingTextLabel: Label | null = null;

    /** 防止连点：请求发出后到返回前不再接受下注操作 */
    private _betActionLocked = false;
    /** 加注弹出层节点 */
    private _raisePopupNode: Node | null = null;
    /** 加注弹出层按钮回调（按按钮名索引） */
    private _raisePresetActions = new Map<string, () => void>();
    /** betNode 子节点当前是否处于可见状态（用于控制入场动画只触发一次） */
    private _betNodesVisible = false;
    /** betNode 子节点的原始坐标缓存，避免 tween 浮点误差导致位置漂移 */
    private _betNodeOriginalPositions = new Map<string, Vec3>();
    /** 上次同步的各座位下注金额快照，用于检测下注变化触发筹码飞行动画 */
    private _lastPlayerBets = new Map<number, number>();
    /** 上次同步的底池总额快照，用于回合结束（currentBet 被重置）时回推下注额 */
    private _lastPotTotal = 0;
    /** 当前用户发起下注时记录的金额和座位号（sync 回包后用于精确定位跟注者） */
    private _pendingBetAmount = 0;
    private _pendingBetSeat = -1;
    /** 避免同一手结算重复弹窗 */
    private _lastSettlementAlertKey = '';
    /** 上一手已渲染的公共牌张数（同手内递增时用动画；换 hand_no 或清桌重置） */
    private _lastRenderedCommunityCount = 0;
    /** 上一手已渲染的公共牌手号 */
    private _lastCommunityHandNo = -1;
    /** 防重复续买提示：同一手号只提示一次 */
    private _lastRebuyPromptHandNo = -1;
    /** 当“离开房间”流程正在运行时为真，用于防止重复退出。 */
    private _isLeavingRoom = false;
    // 在类中新增一个属性，用于缓存你在编辑器里严格拖拽设计好的完美坐标
    private _originalSeatPositions: Vec3[] = null;
    private currentPlayerSeat = -1; // 当前玩家座位索引，用于准备操作

    /**
     * 组件初始化入口，设置牌桌背景、注册按钮事件、初始化工厂与布局、订阅房间状态、创建座位和UI等。
     * 进入场景时会自动调用。
     */
    start() {
        this.room = roomSessionStore.roomSnapshot;
        this._disposed = false;

        // 游戏进行中重进房间：从房间快照恢复当前玩家的座位号，
        // 避免 currentPlayerSeat 停留在 -1 导致手牌不可见、容器不隐藏等问题
        if (this.room?.players) {
            const me = this.getCurrentPlayer();
            if (me) {
                const seat = this.effectiveSeatIndex(me);
                if (seat > 0) {
                    this.currentPlayerSeat = seat;
                }
            }
        }

        this._enteredSceneWithPlaying = this.room?.status === RoomStatus.Playing;
        this._lastKnownRoomStatus = this.room?.status || '';

        this.startGameNode.on(Node.EventType.TOUCH_END, this.clickStartGame, this);

        // 设置牌桌背景
        if (this.tableBackgroundNode && isValid(this.tableBackgroundNode.node)) {
            const bg = imageManager.getTableBackground(this.tableBackground);
            this.tableBackgroundNode.spriteFrame = bg || null;
        }

        // 注册按钮事件
        this.exitButton.onClick = this.exitRoom.bind(this);
        this.roomInfoButton.onClick = this.showRoomInfo.bind(this);
        this.chatButton.onClick = this.showChat.bind(this);

        this.pokerFactory = new PokerFactory(this.pokerPrefab);
        this.seatLayout = new SeatLayout(this.tableNode, this.pokerPilePrefab);
        this._unsubscribeRoomState = roomSessionStore.subscribe(async state => {
            if (!state) {
                this.room = null;
                this._hasReceivedRoomState = false;
                this._lastKnownRoomStatus = '';
                return;
            }
            switch (state.type) {
                case 'sync':
                    if (this._disposed || !isValid(this.node)) return;
                    this.logRoomTimeline(this.room, state.room);
                    const prevStatus = this._lastKnownRoomStatus;
                    const prevGameStarted = this._gameStarted;
                    const hadState = this._hasReceivedRoomState;
                    // 快照旧下注额和旧底池，用于检测本轮变化触发筹码飞行动画
                    this.snapshotCurrentBets();
                    const prevPotTotal = this.getPotTotal();
                    const prevRoundTotal = this.getCurrentRoundTotal();
                    const wasRoundBetActive = !!(this.currentRoundBet?.active);
                    this.room = state.room;
                    this._lastKnownRoomStatus = this.room?.status || '';
                    this._hasReceivedRoomState = true;

                    // 首次同步时恢复当前玩家座位号（重进房间场景，快照可能为空）
                    if (this.currentPlayerSeat <= 0 && this.room?.players) {
                        const me = this.getCurrentPlayer();
                        if (me) {
                            const seat = this.effectiveSeatIndex(me);
                            if (seat > 0) {
                                this.currentPlayerSeat = seat;
                            }
                        }
                    }

                    if (
                        this.room?.status === RoomStatus.Ended &&
                        prevStatus !== RoomStatus.Ended
                    ) {
                        void uiManager
                            .alert({ content: i18n.t('ROOM_ENDED_MESSAGE') || '房间局数已满，已结束。' })
                            .then(() => this.exitRoom());
                    }
                    if (this.room && this.room.status !== RoomStatus.Playing) {
                        this._lastAppliedRoundSignature = '';
                    }

                    // 首次收到房态就已经是 playing，视为“重连恢复场景”。
                    if (!hadState && this.room?.status === RoomStatus.Playing) {
                        this._shouldRestorePlayingView = true;
                    }
                    const serverNowSec = this.room?.serverNow || 0;
                    if (serverNowSec > 0 && serverNowSec !== this._lastAppliedServerNowForClock) {
                        this._lastAppliedServerNowForClock = serverNowSec;
                        this.syncServerClockOffset();
                    }
                    this.refreshSeatPiles();
                    this.detectBetChangesAndAnimate(prevPotTotal, prevRoundTotal, wasRoundBetActive);
                    this.evaluateServerCountdown();
                    if (prevStatus && prevStatus !== RoomStatus.Playing && this.room?.status === RoomStatus.Playing) {
                        this._enteredSceneWithPlaying = false;
                    }
                    // 游戏进行中：签名变化时重建桌面视图（手牌、公共牌、底池等）
                    // 不要求 prevGameStarted，以覆盖 gameover→新手牌衔接、他人离开后
                    // 房态变化等场景，避免手牌残留或显示为牌背
                    if (
                        this.room?.status === RoomStatus.Playing &&
                        this._gameStarted
                    ) {
                        const sig = this.computeRoundViewSignature(this.room);
                        if (sig && sig !== this._lastAppliedRoundSignature) {
                            this._lastAppliedRoundSignature = sig;
                            this.rebuildStaticPlayingViewFromRoom();
                        }
                    }

                    void this.maybePromptRebuyWhenBusted(prevStatus);

                    break;
                case 'prepare':
                    if (state.prepare) {
                        if (this.currentPlayerSeat == state.dealerSeatIndex) {
                            this.startGameNode.active = true;
                            // 当前玩家是开局位，隐藏等待文本
                            this.hideWaitingText();
                        } else {
                            this.startGameNode.active = false;
                            // 非开局位，显示等待文本
                            this.showWaitingText();
                        }

                        // 解析座位名称（BTN/SB、BB 等）并显示
                        if (state.seatName && Array.isArray(state.seatName)) {
                            for (const entry of state.seatName) {
                                const seatIdx = entry.seat_index;
                                if (!seatIdx || seatIdx <= 0) continue;
                                const pile = this._seatPiles[seatIdx - 1];
                                if (pile && isValid(pile.node)) {
                                    pile.setSeatName(entry.role || '');
                                }
                            }
                        }
                    } else {
                        this.startGameNode.active = false;
                    }
                    break;
                case 'leave':
                    if (state.role === 'player') {
                        this.startGameNode.active = false;
                    }
                    break;
                case 'gameover':
                    console.log('gameover', state);
                    // 立即重置游戏状态并清除桌面 UI（手牌、公共牌、底池等）
                    this._gameStarted = false;
                    this.clearPlayingTableArtifacts();
                    // 游戏结束后，恢复当前玩家的 container 节点（显示头像和名称）
                    if (this.currentPlayerSeat > 0 && this._seatPiles[this.currentPlayerSeat - 1]) {
                        this._seatPiles[this.currentPlayerSeat - 1].restoreContainer();
                    }
                    // 游戏结束后统一显示等待文本，不做 dealer 判断
                    // 等待服务器发送 prepare 消息后，再由 prepare 逻辑决定隐藏/显示
                    if (this.currentPlayerSeat > 0) {
                        this.showWaitingText();
                    }
                    // 弹出结算弹窗（桌面已清除，弹窗仅展示结算信息）
                    await uiManager.createModal('Modal', null, {
                        onLoad: (node) => {
                            const modal = node.getComponent(Modal);
                            const settlement = instantiate(this.settlementPrefab);
                            const settlementComponent = settlement.getComponent(SettIement);
                            console.log("state data", state);
                            settlementComponent.init(state);

                            if (!settlement) return;

                            // 挂内容
                            modal.title = '上一手结算';
                            modal.content = settlement;
                            modal.confirmText = '确定';
                            modal.titleColor = new Color().fromHEX('#f9d972');
                        },
                        onConfirm: () => {
                            return true;
                        }
                    });
                    break;
                case 'recover': {
                    // 游戏进行中重连恢复：设置自己的座位号，用遮罩后的房态重建视图
                    if (state.seat_index > 0) {
                        this.currentPlayerSeat = state.seat_index;
                    }
                    if (state.room_state) {
                        this.room = state.room_state;
                        this._lastKnownRoomStatus = this.room?.status || '';
                        this._hasReceivedRoomState = true;
                    }
                    // 强制完整重建对局视图（手牌、公共牌、底池等）
                    this._gameStarted = false;
                    this._shouldRestorePlayingView = false;
                    this.restoreCurrentRoundView();
                    this.refreshSeatPiles();
                    this.evaluateServerCountdown();
                    break;
                }
            }
        });

        this.createPlayerPokerPile();
        this.refreshSeatPiles();
        this.ensureCountdownUI();
        this.ensureStageUI();
        this.ensureSeatTimerLabels();
        this.ensureSeatRoleLabels();
        this.ensurePotUI();
        this.initBetNodeHandlers();
        this.updateSeatInfoCards();
        this.updateSeatTimerOverlayLabels();
        this.startLeaveRenderLoop();

        // 如果是房主，首次进入时自动打开房间信息弹窗
        if (
            this.room &&
            this.room.owner === userManager.user.userId &&
            this.room.status === RoomStatus.NotActivated
        ) {
            this.showRoomInfo();
        }
    }

    /**
     * 自己在座且桌上筹码为 0 时，提示是否继续买入。
     * 触发时机：一手结束后最常见（playing -> open），同一 hand_no 仅提示一次。
     */
    private async maybePromptRebuyWhenBusted(prevStatus: string) {
        if (this._disposed || !this.room) return;
        const me = this.getCurrentPlayer();
        if (!me) return;
        const mySeat = this.effectiveSeatIndex(me);
        if (mySeat <= 0) return; // 未入座不提示
        const stack = this.playerWalletAmount(me);
        if (stack > 0.01) return; // 还有桌上筹码
        if (this.room.status === RoomStatus.Playing) return; // 对局进行中不打断

        const handNo = Number(this.room.round?.handNo || 0);
        if (handNo > 0 && this._lastRebuyPromptHandNo === handNo) return;
        // 优先在一手刚结束时触发；首次进房若本来就 0 也允许提示一次
        const justFinished = prevStatus === RoomStatus.Playing && this.room.status === RoomStatus.Open;
        if (!justFinished && this._lastRebuyPromptHandNo >= 0) return;

        this._lastRebuyPromptHandNo = handNo;
        const ok = await uiManager.confirm({
            content:
                i18n.t('REBUY_CONFIRM_MESSAGE') ||
                i18n.t('BUY_IN_RETRY_PROMPT') ||
                '你的桌上筹码已用尽，是否继续买入筹码？',
            confirmText: i18n.t('CONFIRM') || '确认',
            cancelText: i18n.t('CANCEL') || '取消',
        });
        if (!ok) return;
        await this.sitDown(mySeat);
    }

    // ────────────── betNode 操作节点 ──────────────

    /** 获取 betNode 下的操作子节点（节点名与操作名的映射由编辑器决定） */
    private getBetChildNode() {
        return {
            fold: this.betNode.getChildByName('Fold'),
            check: this.betNode.getChildByName('Check'),
            call: this.betNode.getChildByName('Call'),
            raise: this.betNode.getChildByName('Raise'),
            allIn: this.betNode.getChildByName('AllIn'),
            showDown: this.betNode.getChildByName('ShowDownNode')
        };
    }

    /** 查找节点中的 Label */
    private findNodeLabel(node: Node | null): Label | null {
        if (!node) return null;
        return node.getComponent(Label)
            || node.getChildByName('Label')?.getComponent(Label)
            || null;
    }

    /** 初始化 betNode 子节点的点击事件（start 中调用一次） */
    private initBetNodeHandlers() {
        if (!this.betNode) return;
        this.betNode.active = false;
        const n = this.getBetChildNode();
        const bind = (node: Node | null) => {
            if (node) node.on(Node.EventType.TOUCH_END, this._onBetNodeClick, this);
        };
        bind(n.fold);
        bind(n.check);
        bind(n.call);
        bind(n.raise);
        bind(n.allIn);
    }

    /** betNode 子节点触摸回调，按节点名分发到各操作 */
    private _onBetNodeClick(event: any) {
        if (this._disposed || this._betActionLocked) return;
        const name = event?.currentTarget?.name || '';
        switch (name) {
            case 'Fold': void this.onBetFold(); break;          // 弃牌
            case 'Check': void this.onBetCallOrCheck(); break;   // 过牌
            case 'Call': void this.onBetCallOrCheck(); break;   // 跟注
            case 'Raise': this.toggleRaisePopup(); break;        // 加注 → 弹出预设选项
            case 'AllIn': void this.onBetAllIn(); break;         // 全下
        }
    }

    /** 切换加注弹出层 */
    private toggleRaisePopup() {
        if (this._raisePopupNode && isValid(this._raisePopupNode)) {
            this.hideRaisePopup();
        } else {
            this.showRaisePopup();
        }
    }

    /** 在加注节点上方弹出预设加注选项（圆形灰色按钮 + 弧度排列 + 缩放动画） */
    private showRaisePopup() {
        if (!this.betNode) return;
        const me = this.getCurrentPlayer();
        if (!me || !this.room) return;
        const snap = this.computeBetRaiseSnapshot(me);
        if (!snap?.canRaise) return;

        this.hideRaisePopup();
        this._raisePresetActions.clear();

        const raiseNode = this.getBetChildNode().raise;
        if (!raiseNode) return;

        const btnSize = 88;
        const radius = btnSize / 2;
        const spacing = 98;
        const r = (n: number) => Math.round(n);
        const presets: Array<{ label: string; kind: string; fn: () => void }> = [
            { label: `${i18n.t('Bet.Min') || '最小'}\n${r(snap.minT)}`, kind: 'min', fn: () => void this.onBetRaisePreset('min') },
            { label: `2BB\n${r(snap.bb2T)}`, kind: 'bb2', fn: () => void this.onBetRaisePreset('bb2') },
            { label: `${i18n.t('Bet.Half') || '半池'}\n${r(snap.halfT)}`, kind: 'half', fn: () => void this.onBetRaisePreset('half') },
            { label: `${i18n.t('Bet.Pot') || '满池'}\n${r(snap.potT)}`, kind: 'pot', fn: () => void this.onBetRaisePreset('pot') },
            { label: i18n.t('Bet.Custom') || '自定义', kind: 'custom', fn: () => { this.hideRaisePopup(); void this.onBetRaiseCustom(); } },
        ];
        const count = presets.length;
        const arcY = [6, 2, 0, 2, 6]; // 弧度：中间高两边低
        const totalW = (count - 1) * spacing + btnSize;

        // 弹出层父节点
        const popup = new Node('RaisePopup');
        popup.addComponent(UITransform);
        this.betNode.addChild(popup);
        const raiseHeight = raiseNode.getComponent(UITransform)?.height ?? 80;
        const raisePos = raiseNode.position;
        popup.setPosition(raisePos.x, raisePos.y + raiseHeight + 30, 0);

        // 半透明深色背景板
        const bgNode = new Node('PopupBg');
        const bgUi = bgNode.addComponent(UITransform);
        bgUi.setContentSize(totalW + 40, btnSize + 40);
        const bgGfx = bgNode.addComponent(Graphics);
        bgGfx.fillColor = new Color(0, 0, 0, 140);
        bgGfx.roundRect(-totalW / 2 - 20, -btnSize / 2 - 20, totalW + 40, btnSize + 40, 20);
        bgGfx.fill();
        bgNode.setPosition(0, 0, -1); // 置于按钮下层
        popup.addChild(bgNode);

        for (let i = 0; i < count; i++) {
            const name = `RP_${presets[i].kind}`;
            const btn = new Node(name);
            const ui = btn.addComponent(UITransform);
            ui.setContentSize(btnSize, btnSize);

            // 用 Graphics 画灰色圆形背景
            const gfx = btn.addComponent(Graphics);
            gfx.fillColor = new Color(70, 70, 70, 230);
            gfx.circle(0, 0, radius);
            gfx.fill();
            // 浅色描边
            gfx.strokeColor = new Color(120, 120, 120, 200);
            gfx.lineWidth = 1.5;
            gfx.circle(0, 0, radius - 1);
            gfx.stroke();

            // 文本标签
            const lblNode = new Node('Label');
            lblNode.addComponent(UITransform).setContentSize(btnSize - 12, btnSize - 12);
            const lbl = lblNode.addComponent(Label);
            lbl.string = presets[i].label;
            lbl.fontSize = 14;
            lbl.lineHeight = 18;
            lbl.overflow = Label.Overflow.SHRINK;
            lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
            lbl.verticalAlign = Label.VerticalAlign.CENTER;
            lbl.color = Color.WHITE;
            btn.addChild(lblNode);

            btn.setPosition((i - (count - 1) / 2) * spacing, -(arcY[i] ?? 0), 0);
            btn.setScale(0, 0, 1);

            // 存储回调 & 绑定事件
            this._raisePresetActions.set(name, presets[i].fn);
            btn.on(Node.EventType.TOUCH_END, this._onRaisePresetClick, this);
            popup.addChild(btn);

            // 延迟缩放动画
            tween(btn)
                .delay(i * 0.04)
                .to(0.15, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();
        }

        // 背景板淡入动画
        bgNode.setScale(0.6, 0.6, 1);
        tween(bgNode).to(0.12, { scale: new Vec3(1, 1, 1) }).start();

        this._raisePopupNode = popup;
    }

    /** 加注预设按钮点击回调 */
    private _onRaisePresetClick(event: any) {
        if (this._disposed) return;
        const fn = this._raisePresetActions.get(event?.currentTarget?.name || '');
        if (fn) { this.hideRaisePopup(); fn(); }
    }

    /** 关闭加注弹出层 */
    private hideRaisePopup() {
        this._raisePresetActions.clear();
        if (this._raisePopupNode && isValid(this._raisePopupNode)) {
            this._raisePopupNode.destroy();
        }
        this._raisePopupNode = null;
    }

    /**
     * 创建发牌牌堆
     */
    createPokerHeap() {
        const pokerHeap = this.pokerFactory.createPokerBack();
        // 略低于桌心，与上方阶段/底池、两侧座位留出更多空隙
        pokerHeap.setPosition(0, -32, 0);
        this._pokerPile = pokerHeap;
        this.tableNode.addChild(this._pokerPile);
    }

    /**
     * 创建 Flop、Turn、River 公共牌占位节点，并添加到牌桌。
     */
    createFlopTurnRiverPokerHeap() {
        if (!this._pokerPile || !isValid(this._pokerPile)) return;
        const pokerHeap = this._pokerPile.getPosition();
        const pokerHeapUiTransform = this._pokerPile.getComponent(UITransform);
        const cardWidth = pokerHeapUiTransform?.width || 72;
        const cardHeight = pokerHeapUiTransform?.height || 96;
        const cardSpacing = 10; // 牌之间的间隔（负值表示重叠）
        const verticalGap = 22; // 公共牌区与中心牌堆的上下间距（略加大，避免与标题区挤在一起）

        const createPublicPokerSlot = (name: string, x: number, y: number) => {
            const slot = new Node(name);
            slot.addComponent(UITransform).setContentSize(cardWidth, cardHeight);
            slot.setPosition(x, y);
            this._publicPokerPile.push(slot);
            this.tableNode.addChild(slot);
        };

        // 在牌堆的上方创建 Flop 空节点占位，3 张牌
        const flopCount = 3;
        const flopTotalWidth = flopCount * cardWidth + (flopCount - 1) * cardSpacing;
        for (let i = 0; i < flopCount; i++) {
            createPublicPokerSlot(
                `PublicPokerSlot_Flop_${i + 1}`,
                pokerHeap.x - flopTotalWidth / 2 + i * (cardWidth + cardSpacing) + cardWidth / 2,
                pokerHeap.y + cardHeight + verticalGap
            );
        }

        // 在牌堆的下方创建 Turn 和 River 空节点占位，2 张牌
        const turnCount = 2;
        const turnTotalWidth = turnCount * cardWidth + (turnCount - 1) * cardSpacing;
        for (let i = 0; i < turnCount; i++) {
            createPublicPokerSlot(
                `PublicPokerSlot_TurnRiver_${i + 1}`,
                pokerHeap.x - turnTotalWidth / 2 + i * (cardWidth + cardSpacing) + cardWidth / 2,
                pokerHeap.y - (cardHeight + verticalGap)
            );
        }
    }

    /**
     * 创建所有玩家座位。
     *
     * 座位总数来自房间数据 this.room.maxPlayers，这里会根据 maxPlayers
     * 计算座位位置，并循环创建对应数量的 PokerPile 预制体。
     */
    createPlayerPokerPile() {
        // 防止重复创建座位节点（重进房间等场景下 _seatPiles 可能已有数据）
        if (this._seatPiles.length > 0) return;

        if (
            !this.room ||
            !this.room.maxPlayers ||
            this.room.maxPlayers > 10 ||
            this.room.maxPlayers < 2
        ) {
            Log.e('PokerController', '无效的玩家数量');
            return;
        }

        // this.room.maxPlayers 就是当前牌桌一共有多少个座位。
        const playerLocations = this.seatLayout.calculatePlayerLocations(this.room.maxPlayers);
        for (let i = 0; i < this.room.maxPlayers; i++) {
            const playerPokerPile = instantiate(this.pokerPilePrefab);
            const loc = playerLocations[i];
            const y = loc.direction === Direction.TOP ? loc.y - this.topSeatDownOffset : loc.y;
            playerPokerPile.setPosition(loc.x, y);
            // 绑定坐下按钮
            const pile = playerPokerPile.getComponent(PokerPile);
            pile.setSeatStatus('空');
            pile.joinGame = this.sitDown.bind(this, i + 1);
            this._seatPiles.push(pile);
            this.tableNode.addChild(playerPokerPile);
        }
    }

    /**
     * 刷新所有座位牌堆的状态（是否可加入、显示头像、筹码等）。
     * 根据房间玩家数据动态更新。
     */
    private refreshSeatPiles() {
        if (this._disposed || !this.room || !this._seatPiles.length) return;

        // 同步数据时，确保视角永远以“自己”为基准对齐底座
        const me = this.getCurrentPlayer();
        const mySeat = this.effectiveSeatIndex(me);
        if (mySeat > 0) {
            // 如果自己已经入座，强制把自己的逻辑座位转到底部
            // 因为我们用的是固定坐标缓存，如果视角已在底部，这里的 tween 不会产生任何肉眼可见的多余移动。
            this.rotateSeatsToBottom(mySeat);
        }

        const occupied = new Set<number>();
        for (const p of this.room.players || []) {
            const seat = this.effectiveSeatIndex(p);
            if (seat > 0) {
                occupied.add(seat);
            }
        }

        for (let i = 0; i < this._seatPiles.length; i++) {
            const seat = i + 1;
            const pile = this._seatPiles[i];
            if (!pile || !isValid(pile.node)) continue;

            const isOccupied = occupied.has(seat);
            pile.allowJoin = !isOccupied;

            if (isOccupied) {
                pile.hideJoinBtn();
                pile.showChip();
                const player = (this.room.players || []).find(p => this.effectiveSeatIndex(p) === seat);
                void pile.setAvatar(player?.avatarUrl || player?.user?.avatarUrl || '');

                // 离线遮罩：标识该玩家已断开连接
                if (player?.offline) {
                    pile.showOfflineOverlay();
                } else {
                    pile.hideOfflineOverlay();
                }

                // 对局进行中检测弃牌，否则隐藏座位状态文字
                if (this._gameStarted && player?.folded) {
                    pile.setSeatStatus('弃牌');
                } else {
                    pile.hideSeatStatus();
                }
            } else {
                pile.showJoinBtn();
                pile.hideChip();
                pile.hideActionCountdown();
                pile.clearAvatar();
                pile.hideHandPileBg();
                pile.hideOfflineOverlay();
                pile.setSeatStatus('空');
            }
        }

        this.updateSeatInfoCards();
        this.updateSeatTimerOverlayLabels();
        this.updatePotLabel();
        this.updatePotDisplay();
        this.updateBettingBarVisibility();
    }

    /**
     * 弹窗显示当前房间信息，包括房主、玩家列表等。
     */
    async showRoomInfo() {
        const room = this.room;
        if (!room) return;
        const owner = await roomSessionService.getOwner();
        if (!owner) {
            return;
        }

        const players = await roomSessionService.getPlayers();
        const ownerIsAway = owner.status === 'leave';
        const ownerLeftTag =
            i18n.t('PLAYER_LEFT_TAG') || i18n.t('game.room_info.owner_left_tag') || '离开';
        const playersNames =
            players
                ?.filter(player => {
                    // 仅房主“离开”状态时，不在“房间内玩家”列表里重复展示房主。
                    if (!ownerIsAway) return true;
                    return (player.userId || player.user?.userId) !== owner.userId;
                })
                ?.map(player => player.nickname || player.user?.nickname || player.userId || '')
                .filter(Boolean)
                .join(', ') || '';

        const roomInfo = {
            roomType: room.roomType,
            roomNumber: room.roomNumber,
            owner:
                (owner.nickname || owner.userId) +
                (ownerIsAway ? ` [${ownerLeftTag}]` : ''),
            players: playersNames,
        };

        await uiManager.createModal('RoomInfo', null, {
            onLoad(node) {
                const _roomInfo = node.getComponent(RoomInfo);
                _roomInfo.roomInfo = roomInfo;
            },
        });
    }

    /**
     * 打开聊天侧边栏。
     */
    showChat() {
        uiManager.createSidebar('Sidebar', Sidebar, SlideDirection.LEFT, this.chatPrefab);
    }

    /**
     * 退出房间
     */
    async exitRoom() {
        if (this._isLeavingRoom) return;
        const roomNumber = this.room.roomNumber;
        if (!roomNumber) return;

        try {
            if (this.room.status === RoomStatus.Playing) {
                // 判断当前是否轮到自己行动（下注回合）
                const uid = userManager.user?.userId;
                const turn = this.room?.round?.action?.currentTurnUserId;
                const me = this.getCurrentPlayer();
                const isMyTurn = !!(
                    uid && turn && turn === uid &&
                    !me?.folded && !this.playerAllInThisHand(me)
                );

                // 让用户确认，确认成功后再离开
                const confirmed = await new Promise<boolean>((resolve) => {
                    uiManager.createModal('Modal', null, {
                        onLoad: (node) => {
                            const modal = node.getComponent(Modal);
                            modal.title = '提示';
                            modal.content = i18n.t('GAME_PLAYING_LEAVE') || '这局已经开始，是否确认离开？';
                            modal.showCancel = true;
                        },
                        onConfirm: async () => {
                            resolve(true);
                            return true; // Modal 会开始 hide 流程
                        },
                        onCancel: () => {
                            resolve(false);
                            return true;
                        }
                    });
                });

                if (!confirmed) return; // 用户取消，直接返回

                // 用户确认退出：如果当前是自己的回合，先发送 fold 再离开
                // 这样服务端立即处理弃牌并推进到下一位玩家，无需等待超时
                if (isMyTurn) {
                    try {
                        await roomSessionService.sendTableAction('fold');
                    } catch (e) {
                        Log.w('exitRoom , send fold before leave failed', e);
                    }
                }

                // 此时 Modal 已经在隐藏动画中或已关闭，安全离开
                await roomManager.leaveRoom(roomNumber);
            } else {
                await roomManager.leaveRoom(roomNumber);
            }

            this._isLeavingRoom = true;
            if (this.exitButton) {
                this.exitButton.disabled = true;
            }
        } finally {
            if (isValid(this.node)) {
                this._isLeavingRoom = false;
                if (this.exitButton) {
                    this.exitButton.disabled = false;
                }
            }
        }
    }

    /** 买入/账外不足时打控制台，便于对照「账外 vs 桌上」 */
    private logBuyInBalance(tag: string, o: {
        userId?: string;
        accountBalance: number;
        tableWallet: number;
        maxAfford?: number;
        minBuy?: number;
        maxBuyCfg?: number;
        buyIn?: number;
        seatIndex?: number;
    }) {
        const parts = [
            `userId=${o.userId ?? ''}`,
            `账外(account_balance)=${o.accountBalance}`,
            `桌上(wallet)=${o.tableWallet}`,
        ];
        if (o.maxAfford !== undefined) parts.push(`maxAfford=${o.maxAfford}`);
        if (o.minBuy !== undefined) parts.push(`minBuy=${o.minBuy}`);
        if (o.maxBuyCfg !== undefined) parts.push(`maxBuyCfg=${o.maxBuyCfg}`);
        if (o.buyIn !== undefined) parts.push(`buyIn=${o.buyIn}`);
        if (o.seatIndex !== undefined) parts.push(`seat=${o.seatIndex}`);
        Log.w('PokerController/BuyIn', `[${tag}] ${parts.join(' | ')}`);
    }

    /**
     * 坐下（买入金额由弹窗表单收集；牌局逻辑与筹码以服务端为准，客户端仅展示与发 WS 事件）
     */
    async sitDown(index: number) {
        if (this.isGameLocked()) {
            await uiManager.alert({ content: i18n.t('GAME_ACTION_LOCKED') || '对局进行中，不能操作' });
            return false;
        }
        await roomSessionService.syncRoomState();  // 同步房间状态，确保客户端与服务端一致
        this.room = roomSessionStore.roomSnapshot;  // 更新当前房间状态
        const me = this.getCurrentPlayer();
        const mySeat = this.effectiveSeatIndex(me);
        const sameSeat = mySeat > 0 && mySeat === index;
        if (!sameSeat) {
            const meFresh = this.getCurrentPlayer();
            const accFresh = this.playerAccountBalance(meFresh);
            if (accFresh < 1) {
                await uiManager.alert({
                    content: i18n.t('BUY_IN_NO_BALANCE') || '账外余额不足，无法买入上桌',
                });
                return false;
            }
        }
        if (sameSeat) {
            const acc = this.playerAccountBalance(me);
            const stack = this.playerWalletAmount(me);
            if (acc < 1) {
                this.logBuyInBalance('同座账外不足', {
                    userId: userManager.user?.userId,
                    accountBalance: acc,
                    tableWallet: stack,
                    seatIndex: index,
                });
                await uiManager.alert({
                    content:
                        stack > 0.01
                            ? i18n.t('BUY_IN_NEED_STAND_FIRST')
                            : i18n.t('BUY_IN_NO_BALANCE'),
                });
                return false;
            }
        }
        const buyIn = await this.promptBuyInChips();
        if (buyIn == null || buyIn <= 0) {
            return false;
        }
        this.currentPlayerSeat = index;
        const ok = await roomSessionService.sitDown(index, buyIn);
        if (!ok) {
            this.currentPlayerSeat = -1;
            const meFail = this.getCurrentPlayer();
            this.logBuyInBalance('服务端买入失败', {
                userId: userManager.user?.userId,
                accountBalance: this.playerAccountBalance(meFail),
                tableWallet: this.playerWalletAmount(meFail),
                buyIn,
                minBuy: Number(this.room?.minBuyIn) || 0,
                maxBuyCfg: Number(this.room?.maxBuyIn) || 0,
                seatIndex: index,
            });
            await uiManager.alert({ content: i18n.t('BUY_IN_FAILED') || '买入失败，请检查余额与限额' });
        } else {
            // 坐下成功，隐藏座位状态文字（"空"字消失）
            const seatPile = this._seatPiles[index - 1];
            if (seatPile) seatPile.hideSeatStatus();
            // 坐下成功后显示"等待游戏开始"提示
            this.showWaitingText();
        }

        this.rotateSeatsToBottom(index);

        return ok;
    }

    /**
     * 旋转座位视角，使点击的玩家移动到底部，其它玩家顺时针/逆时针旋转。
     * index 为玩家的逻辑座位号（1-based）。
     */
    private rotateSeatsToBottom(clickedIndex: number) {
        if (!this._seatPiles || !this._seatPiles.length) return;

        const seatCount = this._seatPiles.length;

        // 提取并缓存初始坐标
        if (!this._originalSeatPositions) {
            this._originalSeatPositions = this._seatPiles.map(pile => pile.node.position.clone());
        }

        // 假设 _seatPiles[0] 就是物理屏幕正下方的那个座位（底部位置）
        const visualBottomIndex = 0;

        // 将逻辑座位号(1-based)转为数组索引(0-based)
        const clickArrayIndex = clickedIndex - 1;

        // 计算需要旋转的偏移量
        const offset = visualBottomIndex - clickArrayIndex;

        // 让所有座位去寻找他们对应的“完美坐标”
        for (let i = 0; i < seatCount; i++) {
            const pile = this._seatPiles[i];
            if (!pile || !isValid(pile.node)) continue;

            // 计算当前节点 i 在旋转后，应该落在你设计的哪个视觉位置上
            let targetVisualIndex = (i + offset) % seatCount;
            if (targetVisualIndex < 0) {
                targetVisualIndex += seatCount; // 处理负数取模
            }

            // 直接从完美坐标库中取值
            const targetPos = this._originalSeatPositions[targetVisualIndex];

            // 动画平滑过渡
            tween(pile.node)
                .to(
                    0.5,
                    { position: new Vec3(targetPos.x, targetPos.y, targetPos.z) }
                )
                .start();
        }
    }

    /**
     * 获取某个座位（1-based seatIndex）经过 rotateSeatsToBottom 旋转后的最终坐标。
     * 用于在 tween 尚未完成时，提前计算牌面应放置的目标位置，避免牌与座位错位。
     */
    private getSeatVisualPosition(seatIndex: number): Vec3 {
        if (!this._originalSeatPositions || !this._seatPiles.length || this.currentPlayerSeat <= 0) {
            const pile = this._seatPiles[seatIndex - 1];
            return pile ? pile.node.position.clone() : new Vec3();
        }
        const seatCount = this._seatPiles.length;
        const offset = -(this.currentPlayerSeat - 1);
        let visualIndex = (seatIndex - 1 + offset) % seatCount;
        if (visualIndex < 0) visualIndex += seatCount;
        return this._originalSeatPositions[visualIndex].clone();
    }

    /**
     * 公共 Modal + Form 预制体收集买入额（限额来自房间配置，最终以服务端为准）
     * 在玩家准备坐下或补充筹码时，弹出一个输入框（Modal），让玩家输入他们想要带多少钱（买入额）上桌。
     * 为了防止玩家作弊或输错，这段代码在弹出输入框之前，做了非常严密的额度合法性校验（拦截机制）。如果校验通过，才会弹出界面；如果玩家成功提交，最终返回买入的筹码数，否则返回 null
     */
    private async promptBuyInChips(): Promise<number | null> {
        if (!this.room) return null;
        const minBuy = Number(this.room.minBuyIn) || 0;
        const maxBuyCfg = Number(this.room.maxBuyIn) || 0;
        const me = this.getCurrentPlayer();
        const stack = this.playerWalletAmount(me);
        const account = this.playerAccountBalance(me);
        let maxAfford = account;
        if (maxBuyCfg > 0) {
            maxAfford = Math.min(maxAfford, maxBuyCfg);
        }
        if (maxAfford < 1) {
            this.logBuyInBalance('弹窗前置:账外可买不足', {
                userId: me ? me.userId || me.user?.userId : userManager.user?.userId,
                accountBalance: account,
                tableWallet: stack,
                maxAfford,
                minBuy,
                maxBuyCfg,
            });
            if (stack > 0.01) {
                await uiManager.alert({
                    content: i18n.t('BUY_IN_NEED_STAND_FIRST'),
                });
            } else {
                await uiManager.alert({
                    content: i18n.t('BUY_IN_NO_BALANCE'),
                });
            }
            return null;
        }
        let suggested = minBuy > 0 ? minBuy : Math.min(1000, maxAfford);
        if (suggested > maxAfford) suggested = maxAfford;
        if (minBuy > 0 && suggested < minBuy) {
            if (maxAfford + 1e-6 < minBuy) {
                this.logBuyInBalance('弹窗前置:低于最小买入', {
                    userId: me ? me.userId || me.user?.userId : userManager.user?.userId,
                    accountBalance: account,
                    tableWallet: stack,
                    maxAfford,
                    minBuy,
                    maxBuyCfg,
                });
                if (stack > 0.01) {
                    await uiManager.alert({ content: i18n.t('BUY_IN_NEED_STAND_FIRST') });
                } else {
                    await uiManager.alert({
                        content: i18n.t('BUY_IN_NO_BALANCE'),
                    });
                }
                return null;
            }
            suggested = minBuy;
        }
        suggested = Math.round(suggested);

        let buyIn: number | undefined;
        const confirmed = await uiManager.showFormModal({
            title: i18n.t(`${config.BUY_IN_MODAL_KEY}.title`),
            confirmText: i18n.t(`${config.BUY_IN_MODAL_KEY}.confirm`),
            items: config.buildBuyInFormItems({
                minBuy,
                maxAfford,
                suggested,
                account,
            }),
            onConfirm: (data: Record<string, unknown>) => {
                const v = data?.buyIn;
                if (typeof v === 'number' && !Number.isNaN(v)) {
                    buyIn = Math.round(v);
                }
                return buyIn != null && buyIn > 0;
            },
        });
        return confirmed && buyIn != null && buyIn > 0 ? buyIn : null;
    }

    /**
     * 站起
     */
    async standUp() {
        if (this.isGameLocked()) {
            await uiManager.alert({ content: i18n.t('GAME_ACTION_LOCKED') || '对局进行中，不能操作' });
            return false;
        }
        return await roomSessionService.standUp();
    }

    /**
     * 准备
     */
    async ready() {
        if (this.isGameLocked()) {
            await uiManager.alert({ content: i18n.t('GAME_ACTION_LOCKED') || '对局进行中，不能操作' });
            return false;
        }
        const me = this.getCurrentPlayer();
        if (me?.status === 'ready') {
            return await roomSessionService.cancelReady();
        }
        const r = await roomSessionService.ready();
        if (!r.ok) {
            const msg =
                tServerErrorMessage(r.message) || i18n.t('READY_FAILED') || '准备失败';
            await uiManager.alert({ content: msg });
            return false;
        }
        return true;
    }

    // 点击开始游戏按钮
    async clickStartGame() {
        try {
            const originalScale = this.startGameNode.scale.clone();
            const targetScale = new Vec3(
                originalScale.x * 0.9,
                originalScale.y * 0.9,
                originalScale.z
            );

            await new Promise(resolve => {
                tween(this.startGameNode)
                    .to(Button.ANIMATION_DURATION, { scale: targetScale }, { easing: 'sineOut' })
                    .to(Button.ANIMATION_DURATION, { scale: originalScale }, { easing: 'sineIn' })
                    .call(() => resolve(void 0))
                    .start();
            });

            await roomSessionService.startGame();
            await this.startGame();
        } catch (error) {
            console.error('点击开始游戏按钮失败', error);
        } finally {
            this.startGameNode.active = false;
        }
    }

    /**
     * 是否为隐藏手牌（对手）
     */
    private isHiddenOpponentCard(player: any): boolean {
        if (!player) return false;

        const currentUserId = userManager.user?.userId;
        const playerUserId = player.userId || player.user?.userId;

        const me = this.getCurrentPlayer();
        let mySeat = me ? this.effectiveSeatIndex(me) : -1;
        // 防御性 fallback：与 resolveHoleCardValue 保持一致
        if (mySeat <= 0 && this.currentPlayerSeat > 0) {
            mySeat = this.currentPlayerSeat;
        }
        const playerSeat = this.effectiveSeatIndex(player);

        const isSelfByUserId =
            !!currentUserId &&
            playerUserId === currentUserId;

        const isSelfBySeat =
            mySeat > 0 &&
            playerSeat > 0 &&
            mySeat === playerSeat;

        if (isSelfByUserId || isSelfBySeat) {
            return false;
        }

        const cards: number[] = player.cards || [];

        return (
            cards.length >= 2 &&
            cards[0] === 0 &&
            cards[1] === 0
        );
    }

    /**
     * 开始游戏
     * 由服务器触发，满足以下条件时，客户端将开始游戏：
     * 房间座位坐满
     */
    async startGame() {
        if (this._gameStarted || this._disposed || !this.room) return;
        if (!this._seatPiles.length) {
            this.createPlayerPokerPile();
            // 重建座位节点后立即同步“可坐下/已占座”状态，避免默认可点击
            this.refreshSeatPiles();
        }
        if (!this._seatPiles.length) return;
        const readySeatIndices = this.getReadySeatIndices();
        if (readySeatIndices.length < 2) return;

        this._gameStarted = true;
        this.hideWaitingText();

        this.clearDealtCards();
        this.hideAllHandPileBgs();
        if (!this._pokerPile || !isValid(this._pokerPile)) {
            this.createPokerHeap();
        }
        if (!this._publicPokerPile.length) {
            this.createFlopTurnRiverPokerHeap();
        }
        this.updatePotLabelLayout();

        const activeSeatIndices = readySeatIndices;
        this._dealerSeatIndex = this.room.round?.dealerSeatIndex || activeSeatIndices[0] || -1;
        this.updateSeatRoleLabels(activeSeatIndices, this._dealerSeatIndex);

        const delayUnit = Math.max(0.05, this.interval);
        let order = 0;
        const seatPlayers = this.getSeatPlayerMap();

        // 隐藏当前玩家视角的牌堆容器（便于看牌）
        const me = this.getCurrentPlayer();
        let mySeat = me ? this.effectiveSeatIndex(me) : -1;
        // 防御性 fallback：与 rebuild / resolveHoleCardValue 保持一致
        if (mySeat <= 0 && this.currentPlayerSeat > 0) {
            mySeat = this.currentPlayerSeat;
        }
        if (mySeat > 0 && this._seatPiles[mySeat - 1]) {
            this._seatPiles[mySeat - 1].hideContainer();
        }

        // 1) 发两轮手牌（从小盲位 SB 开始顺时针）
        const sbSeat = this.getSmallBlindSeat(activeSeatIndices, this._dealerSeatIndex);
        const dealingOrder = this.sortByDealerClockwise(activeSeatIndices, sbSeat);
        for (let round = 0; round < this.pokerCount; round++) {
            for (const seatIndex of dealingOrder) {
                const pile = this._seatPiles[seatIndex - 1];
                if (!pile || !isValid(pile.node)) continue;
                const player = seatPlayers.get(seatIndex) || null;
                // 判断是否是当前玩家自己的牌
                const isSelf = seatIndex === this.currentPlayerSeat;
                // 使用旋转后的最终位置放置牌，避免 tween 期间座位与牌面错位
                const basePos = this.getSeatVisualPosition(seatIndex);
                const targetPos = this.getHandCardTargetPos(basePos, round, isSelf);
                const isHiddenOpponent = this.isHiddenOpponentCard(player);
                const pokerNum = this.resolveHoleCardValue(player, round);

                // 是否是牌背
                const isHiddenCard = isHiddenOpponent && pokerNum === 0;

                this.createPokerWithAnimation(
                    pokerNum,
                    targetPos,
                    order * delayUnit,
                    node => {

                        // 保存自己的真实牌（隐藏牌背由 destroyAfterArrive 自动销毁，无需追踪）
                        if (node && !isHiddenCard) {
                            this._dealtCards.push(node);
                        }

                        // 第一张
                        if (
                            isHiddenOpponent &&
                            round === 0 &&
                            pile
                        ) {
                            pile.showHandPileBg();
                            pile.showStartingHand();
                        }

                        // 第二张
                        if (
                            isHiddenOpponent &&
                            round === 1 &&
                            pile
                        ) {
                            pile.showHoleCards();
                        }

                        if (
                            round === this.pokerCount - 1 &&
                            !isHiddenOpponent
                        ) {
                            this.showOpponentHandPileBgBySeat(
                                seatIndex,
                                activeSeatIndices
                            );
                        }
                    },
                    undefined,
                    isHiddenCard
                );
                order++;
            }
        }

        // 2) 公共牌与各街文案完全跟服务端：preflop 时 community_cards 全 0，进 flop/turn/river 后由 WS 推送再 rebuild。
        this.setStageText(i18n.t('STAGE_PREFLOP') || '翻牌前');
        this._lastAppliedRoundSignature = this.computeRoundViewSignature(this.room);
    }

    /**
     * 发牌动画入口（兼容旧实现，当前为空实现）。
     * @param cards 发牌编号数组
     */
    async dealCards(cards: number[]) {
        // 先保留为安全空实现，避免旧发牌渲染链在场景销毁后继续访问无效 Sprite 资源导致崩溃。
        void cards;
        return;
    }

    /**
     * 创建一张牌并执行发牌动画。
     * @param pokerNum 牌编号，0为牌背
     * @param targetPos 目标位置
     * @param delay 动画延迟
     * @param onComplete 动画完成回调
     */
    private createPokerWithAnimation(
        pokerNum: number,
        targetPos: Vec3,
        delay: number,
        onComplete?: (node?: Node) => void,
        finalParent?: Node,
        destroyAfterArrive: boolean = false
    ) {
        if (this._disposed || !this._pokerPile || !isValid(this._pokerPile) || !isValid(this.tableNode)) {
            return;
        }

        const pokerNode =
            pokerNum > 0
                ? this.pokerFactory.createPoker(pokerNum)
                : this.pokerFactory.createPokerBack();

        if (!pokerNode || !isValid(pokerNode)) {
            return;
        }

        const position = this._pokerPile.position.clone();

        pokerNode.setPosition(position.x, position.y);
        pokerNode.setScale(new Vec3(0, 0, 0));

        tween(pokerNode)
            .delay(delay)
            .to(
                this.duration,
                {
                    position: targetPos,
                    scale: new Vec3(
                        this._pokerPile.scale.x,
                        this._pokerPile.scale.y,
                        1
                    ),
                },
                { easing: 'expoOut' }
            )
            .call(() => {

                // 到达后直接销毁
                if (destroyAfterArrive) {

                    if (onComplete) {
                        onComplete();
                    }

                    pokerNode.destroy();
                    return;
                }

                if (finalParent && isValid(finalParent)) {
                    finalParent.addChild(pokerNode);
                    pokerNode.setPosition(0, 0, 0);
                }

                if (onComplete) {
                    onComplete(pokerNode);
                }
            })
            .start();

        this.tableNode.addChild(pokerNode);
    }

    /**
     * 清理已发出的牌节点和相关计时器。
     * @param destroyNodes 是否销毁节点
     */
    private clearDealtCards(destroyNodes = true) {
        for (const timer of this._stageTimeouts) {
            clearTimeout(timer);
        }
        this._stageTimeouts = [];
        if (!destroyNodes) {
            this._dealtCards = [];
            return;
        }
        for (const node of this._dealtCards) {
            if (node && isValid(node, true)) node.destroy();
        }
        this._dealtCards = [];
    }

    /**
     * 清理对局相关UI（公共牌、手牌、阶段文案等）。
     * 一手结束或离开对局时调用。
     */
    private clearPlayingTableArtifacts() {
        for (const timer of this._stageTimeouts) {
            clearTimeout(timer);
        }
        this._stageTimeouts = [];
        this.clearDealtCards();

        // 构建已占座位集合，与 refreshSeatPiles 保持一致
        const occupiedSeats = new Set<number>();
        for (const p of this.room?.players || []) {
            const seat = this.effectiveSeatIndex(p);
            if (seat > 0) occupiedSeats.add(seat);
        }

        for (let i = 0; i < this._seatPiles.length; i++) {
            const pile = this._seatPiles[i];
            pile?.hideActionCountdown();
            // 有人坐着的座位隐藏状态文字，空座位显示"空"
            if (occupiedSeats.has(i + 1)) {
                pile?.hideSeatStatus();
            } else {
                pile?.setSeatStatus('空');
            }
        }
        this.hideAllHandPileBgs();
        for (const n of this._publicPokerPile) {
            if (n && isValid(n, true)) n.destroy();
        }
        this._publicPokerPile = [];
        if (this._pokerPile && isValid(this._pokerPile, true)) {
            this._pokerPile.destroy();
            this._pokerPile = null;
        }
        if (this._stageLabel) {
            this._stageLabel.string = '';
        }
        if (this._potLabel) {
            this._potLabel.string = '';
        }

        // 重置所有 label 值为 $0 并隐藏四个节点
        if (this.totalBet) {
            const lbl = this.totalBet.getChildByName('totalBet')?.getComponent(Label);
            if (lbl) lbl.string = '$0';
            this.totalBet.active = false;
        }
        if (this.currentRoundBet) {
            const lbl = this.currentRoundBet.getChildByName('currentRoundBet')?.getComponent(Label);
            if (lbl) lbl.string = '$0';
            this.currentRoundBet.active = false;
        }
        if (this.mainPot?.isValid) {
            const lbl = this.mainPot.getChildByName('mainPot')?.getComponent(Label);
            if (lbl) lbl.string = '$0';
            this.mainPot.active = false;
        }
        if (this.sidePot?.isValid) {
            const lbl = this.sidePot.getChildByName('sidePot')?.getComponent(Label);
            if (lbl) lbl.string = '$0';
            this.sidePot.active = false;
        }
        this.cleanupSidePotClones();

        // 隐藏 betNode 和加注弹出层
        if (this.betNode) this.betNode.active = false;
        this._betNodesVisible = false;
        this._lastPlayerBets.clear();
        this._lastPotTotal = 0;
        this._pendingBetAmount = 0;
        this._pendingBetSeat = -1;
        this.hideRaisePopup();

        this._lastRenderedCommunityCount = 0;
        this._lastCommunityHandNo = -1;
        this._dealerSeatIndex = -1;
        this.updateSeatRoleLabels([], -1);
    }

    /**
     * 获取玩家本轮下注金额。
     */
    private playerStreetBet(p: any): number {
        if (!p) return 0;
        const raw = p as Record<string, unknown>;
        const v = p.currentBet ?? raw['current_bet'] ?? p.bet;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    /**
     * 读取玩家桌上筹码。
     *
     * 座位信息里的“筹码 xxx”就是通过这个方法取值，
     * 优先读 player.wallet，其次兼容 raw['wallet'] 和 player.user.wallet。
     */
    private playerWalletAmount(p: any): number {
        if (!p) return 0;
        const raw = p as Record<string, unknown>;
        const v = p.wallet ?? raw['wallet'] ?? p.user?.wallet;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    /** 服务端 all_in_hand：本手已显式全下，不应再出现行动 UI/读秒 */
    private playerAllInThisHand(p: any): boolean {
        if (!p) return false;
        const raw = p as Record<string, unknown>;
        return raw['allInHand'] === true || raw['all_in_hand'] === true;
    }

    /** 账外可买入余额（game_users.wallet），与桌上 wallet 无关 */
    private playerAccountBalance(p: any): number {
        if (!p) return 0;
        const raw = p as Record<string, unknown>;
        const v = p.accountBalance ?? raw['account_balance'];
        const n = Number(v);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    }

    /**
     * 获取玩家本手总投入。
     */
    private playerContributedThisHand(p: any): number {
        if (!p) return 0;
        const raw = p as Record<string, unknown>;
        const v = p.contributedThisHand ?? raw['contributed_this_hand'];
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    /**
     * 获取所有已准备玩家的座位号。
     */
    private getReadySeatIndices(): number[] {
        if (!this.room) return [];
        return (this.room.players || [])
            .filter(p => this.effectiveSeatIndex(p) > 0 && p.status === 'ready')
            .map(p => this.effectiveSeatIndex(p))
            .filter(seat => seat > 0)
            .sort((a, b) => a - b);
    }

    /**
     * 获取所有已占座玩家的座位号。
     */
    private getOccupiedSeatIndices(): number[] {
        if (!this.room) return [];
        return (this.room.players || [])
            .filter(p => this.effectiveSeatIndex(p) > 0 && p.status !== 'leave')
            .map(p => this.effectiveSeatIndex(p))
            .filter(seat => seat > 0)
            .sort((a, b) => a - b);
    }

    /**
     * 隐藏所有玩家手牌背景。
     */
    private hideAllHandPileBgs() {
        for (const pile of this._seatPiles) {
            if (pile && isValid(pile.node)) {
                pile.hideHandPileBg();
            }
        }
    }

    /**
     * 只显示对手的手牌背景（自己不显示）。
     * @param seatIndex 座位号
     * @param activeSeatIndices 活跃座位号数组
     */
    private showOpponentHandPileBgBySeat(seatIndex: number, activeSeatIndices: number[]) {
        const st = (this.room?.round?.stage || '').toLowerCase();
        const canShow =
            this.room?.status === RoomStatus.Playing ||
            (this.room?.status === RoomStatus.Open && st === 'showdown');
        if (this._disposed || !this._gameStarted || !canShow) return;
        if (!activeSeatIndices.includes(seatIndex)) return;
        const player = this.getSeatPlayerMap().get(seatIndex);
        if (!player) return;
        const me = this.getCurrentPlayer();
        const mySeat = me ? this.effectiveSeatIndex(me) : -1;
        if (seatIndex === mySeat) return;
        const pile = this._seatPiles[seatIndex - 1];
        if (pile && isValid(pile.node)) {
            pile.showHandPileBg();
        }
    }

    /**
     * 按庄家顺时针排序座位号。
     */
    private sortByDealerClockwise(seats: number[], dealerSeat: number): number[] {
        if (!seats.length || dealerSeat <= 0) return seats;
        const start = seats.indexOf(dealerSeat);
        if (start < 0) return seats;
        return seats.slice(start).concat(seats.slice(0, start));
    }

    /**
     * 获取小盲位座位号。
     */
    private getSmallBlindSeat(seats: number[], dealerSeat: number): number {
        if (!seats.length) return -1;
        if (seats.length === 2) {
            // heads-up: BTN 同时是 SB
            return dealerSeat > 0 ? dealerSeat : seats[0];
        }
        const ordered = this.sortByDealerClockwise(seats, dealerSeat);
        return ordered.length > 1 ? ordered[1] : ordered[0];
    }

    /**
     * 获取座位号到玩家对象的映射。
     */
    private getSeatPlayerMap() {
        const map = new Map<number, any>();
        for (const p of this.room?.players || []) {
            const seat = this.effectiveSeatIndex(p);
            if (seat > 0) map.set(seat, p);
        }
        return map;
    }

    /**
     * 判断摊牌阶段该玩家手牌是否对所有人可见。
     */
    private isShowdownHoleRevealedForUser(playerUserId: string | undefined): boolean {
        const r = this.room?.round;
        if (!r || (r.stage || '').toLowerCase() !== 'showdown') return false;
        const ids = r.showdownRevealUserIds || [];
        return !!playerUserId && ids.includes(playerUserId);
    }

    /**
     * 获取玩家第 round 张手牌的牌面值（自己或摊牌时可见）。
     */
    private resolveHoleCardValue(player: any, round: number): number {
        if (!player) return 0;
        const currentUserId = userManager.user?.userId;
        const playerUserId = player.userId || player.user?.userId;
        // 只有自己展示真实手牌；摊牌阶段服务端在 showdown_reveal 名单内的座位对全员公开。
        // 重连场景下若 userId 临时不一致，回退用“当前玩家座位”匹配，避免自己手牌被全遮罩。
        const me = this.getCurrentPlayer();
        let mySeat = me ? this.effectiveSeatIndex(me) : -1;
        // 防御性 fallback：若 getCurrentPlayer() 返回 null 但 currentPlayerSeat 已缓存，
        // 使用缓存座位号识别自己（覆盖 WS 断连/重连、房态快照异常等边界场景）
        if (mySeat <= 0 && this.currentPlayerSeat > 0) {
            mySeat = this.currentPlayerSeat;
        }
        const playerSeat = this.effectiveSeatIndex(player);
        const isSelfByUserId = !!currentUserId && playerUserId === currentUserId;
        const isSelfBySeat = mySeat > 0 && playerSeat > 0 && mySeat === playerSeat;
        if (!isSelfByUserId && !isSelfBySeat) {
            if (!this.isShowdownHoleRevealedForUser(playerUserId)) return 0;
        }
        const cards: number[] = player.cards || [];
        const value = cards[round];
        return typeof value === 'number' && value > 0 ? value : 0;
    }

    /**
     * 获取当前房间的公共牌数组。
     */
    private getCommunityCardsFromRoom(): number[] {
        const cards = this.room?.round?.communityCards || [];
        const out = [0, 0, 0, 0, 0];
        for (let i = 0; i < Math.min(cards.length, out.length); i++) {
            const c = cards[i];
            out[i] = typeof c === 'number' && c > 0 ? c : 0;
        }
        return out;
    }

    /**
     * 计算手牌目标位置（用于动画）。
     * @param base 基础位置
     * @param cardIndex 牌的索引（0或1）
     * @param isSelf 是否是当前玩家自己的牌
     */
    private getHandCardTargetPos(base: Vec3, cardIndex: number, isSelf: boolean = false): Vec3 {
        // 当前玩家的牌使用固定间隔100，其他玩家使用原有逻辑
        const spacing = isSelf ? 100 : Math.max(18, this.pokerOffset * 0.45);
        const offset = (cardIndex - (this.pokerCount - 1) / 2) * spacing;
        // 当前玩家的牌向上偏移50像素，使其位置更美观
        const yOffset = isSelf ? 50 : 0;
        return new Vec3(base.x + offset, base.y + yOffset, base.z);
    }

    /**
     * 静态创建一张牌并放置到目标位置。
     */
    private createPokerStatic(
        pokerNum: number,
        targetPos: Vec3,
        onComplete?: (node?: Node) => void,
        parentNode?: Node,
        skipPokerBack: boolean = false
    ) {
        if (skipPokerBack && pokerNum === 0) return;
        if (this._disposed || !isValid(this.tableNode)) return;
        const pokerNode =
            pokerNum > 0
                ? this.pokerFactory.createPoker(pokerNum)
                : this.pokerFactory.createPokerBack();
        if (!pokerNode || !isValid(pokerNode)) return;
        pokerNode.setPosition(targetPos);
        if (parentNode && isValid(parentNode)) {
            parentNode.addChild(pokerNode);
        } else {
            this.tableNode.addChild(pokerNode);
        }
        if (onComplete) onComplete(pokerNode);
    }

    /** 与当前房态一致的对局可视化签名（不含行动倒计时，避免每秒重建） */
    private computeRoundViewSignature(room: IRoom | null): string {
        if (!room?.round) return '';
        const round = room.round;
        const seats = (room.players || [])
            .map(p => ({
                s: this.effectiveSeatIndex(p),
                c: (p.cards || []).join(','),
                st: p.status || '',
                off: !!p.offline,
                f: !!p.folded,
            }))
            .filter(x => x.s > 0)
            .sort((a, b) => a.s - b.s);
        return JSON.stringify({
            h: round.handNo,
            st: (round.stage || '').toLowerCase(),
            cc: round.communityCards || [],
            d: round.dealerSeatIndex,
            t: round.action?.currentTurnUserId || '',
            sr: [...(round.showdownRevealUserIds || [])].sort(),
            p: seats,
        });
    }

    /** 按服务端快照铺手牌（静态）+ 公共牌（本手内新露出的槽位播放发牌动画） */
    private rebuildStaticPlayingViewFromRoom() {
        console.log('deal community card');
        if (this._disposed || !this.room) return;
        const st = (this.room.round?.stage || '').toLowerCase();
        const allowTable =
            this.room.status === RoomStatus.Playing ||
            (this.room.status === RoomStatus.Open && st === 'showdown');
        if (!allowTable) return;
        if (!this._seatPiles.length) {
            this.createPlayerPokerPile();
            this.refreshSeatPiles();
        }
        if (!this._seatPiles.length) return;

        for (const t of this._stageTimeouts) {
            clearTimeout(t);
        }
        this._stageTimeouts = [];

        this.clearDealtCards();
        // 清理所有座位的牌背背景 + 自己的容器节点，与 startGame() 保持一致
        // 防止重建视图时旧的牌背 sprite 残留遮挡新创建的牌面
        this.hideAllHandPileBgs();
        const meForRebuild = this.getCurrentPlayer();
        let mySeatForRebuild = meForRebuild ? this.effectiveSeatIndex(meForRebuild) : -1;
        // 防御性 fallback：getCurrentPlayer() 返回 null 时使用缓存的座位号
        if (mySeatForRebuild <= 0 && this.currentPlayerSeat > 0) {
            mySeatForRebuild = this.currentPlayerSeat;
        }

        // ---- 调试日志：追踪 rebuild 时的关键数据 ----
        const _dbgUid = userManager.user?.userId || '(null)';
        const _dbgPlayers = (this.room.players || []).map(p => ({
            uid: p.userId || p.user?.userId || '?',
            seat: this.effectiveSeatIndex(p),
            cards: p.cards || [],
            off: !!p.offline,
            f: !!p.folded,
        }));
        console.log('[rebuild] uid=', _dbgUid, 'currentPlayerSeat=', this.currentPlayerSeat,
            'meForRebuild=', meForRebuild ? `seat=${mySeatForRebuild}` : 'NULL',
            'players=', JSON.stringify(_dbgPlayers));
        // ---- 调试日志结束 ----

        if (mySeatForRebuild > 0 && this._seatPiles[mySeatForRebuild - 1]) {
            this._seatPiles[mySeatForRebuild - 1].hideContainer();
        }
        if (!this._pokerPile || !isValid(this._pokerPile)) this.createPokerHeap();
        if (!this._publicPokerPile.length) this.createFlopTurnRiverPokerHeap();

        const activeSeatIndices = this.getOccupiedSeatIndices();
        this._dealerSeatIndex = this.room.round?.dealerSeatIndex || activeSeatIndices[0] || -1;
        this.updateSeatRoleLabels(activeSeatIndices, this._dealerSeatIndex);

        const seatPlayers = this.getSeatPlayerMap();
        const sbSeat = this.getSmallBlindSeat(activeSeatIndices, this._dealerSeatIndex);
        const dealingOrder = this.sortByDealerClockwise(activeSeatIndices, sbSeat);
        for (let round = 0; round < this.pokerCount; round++) {
            for (const seatIndex of dealingOrder) {
                const pileIndex = seatIndex - 1;
                if (pileIndex < 0 || pileIndex >= this._seatPiles.length) {
                    continue;
                }
                const pile = this._seatPiles[pileIndex];
                if (!pile || !isValid(pile.node)) {
                    continue;
                }
                const player = seatPlayers.get(seatIndex) || null;
                // 判断是否是当前玩家自己的牌
                const isSelf = seatIndex === this.currentPlayerSeat;
                // 使用旋转后的最终位置放置牌，避免 tween 期间座位与牌面错位
                const basePos = this.getSeatVisualPosition(seatIndex);
                const targetPos = this.getHandCardTargetPos(basePos, round, isSelf);
                const pokerNum = this.resolveHoleCardValue(player, round);

                const isHiddenOpponent = this.isHiddenOpponentCard(player);

                // ---- 调试日志：每个座位的牌判定结果 ----
                if (round === 0) {
                    console.log(`[rebuild] seat=${seatIndex} isSelf=${isSelf} pokerNum=${pokerNum} isHidden=${isHiddenOpponent}`,
                        `playerUid=${player?.userId || player?.user?.userId || '?'} cards=${JSON.stringify(player?.cards || [])}`);
                }
                // ---- 调试日志结束 ----

                if (!isHiddenOpponent) {
                    this.createPokerStatic(
                        pokerNum,
                        targetPos,
                        node => {
                            if (node) {
                                this._dealtCards.push(node);
                            }
                        }
                    );
                }

                if (round === this.pokerCount - 1) {

                    if (isHiddenOpponent) {
                        pile.showHoleCards();
                    } else {
                        this.showOpponentHandPileBgBySeat(
                            seatIndex,
                            activeSeatIndices
                        );
                    }
                }
            }
        }

        const communityCards = this.getCommunityCardsFromRoom();
        const revealCount = this.getEffectiveCommunityRevealCount();
        const handNo = this.room.round?.handNo ?? 0;
        if (this._lastCommunityHandNo !== handNo) {
            this._lastCommunityHandNo = handNo;
            this._lastRenderedCommunityCount = 0;
        }
        const lastRendered = this._lastRenderedCommunityCount;
        for (let i = 0; i < Math.min(revealCount, this._publicPokerPile.length); i++) {
            const pile = this._publicPokerPile[i];
            if (!pile || !isValid(pile)) continue;
            const pos = pile.position.clone();
            const num = communityCards[i] || 0;
            if (i < lastRendered) {
                this.createPokerStatic(num, new Vec3(0, 0, 0), node => {
                    if (node) this._dealtCards.push(node);
                }, pile);
            } else {
                this.createPokerWithAnimation(num, pos, (i - lastRendered) * this.interval, node => {
                    if (node) this._dealtCards.push(node);
                }, pile);
            }
        }
        this._lastRenderedCommunityCount = revealCount;
        this.setStageText(this.getStageTextByStage(this.room.round?.stage || ''));
        this.updatePotLabelLayout();
    }

    /**
     * 恢复当前对局视图（重连或倒计时结束时）。
     */
    private restoreCurrentRoundView() {
        if (this._gameStarted || this._disposed || !this.room) return;
        if (!this._seatPiles.length) {
            this.createPlayerPokerPile();
            // 重连恢复时同样先同步占座状态，防止已坐下位置显示可点击
            this.refreshSeatPiles();
        }
        if (!this._seatPiles.length) return;
        this._gameStarted = true;
        this.rebuildStaticPlayingViewFromRoom();
        this._lastAppliedRoundSignature = this.computeRoundViewSignature(this.room);
    }

    /** 以服务端 community_cards 连续非 0 前缀为准；全 0 时回退按阶段推断（兼容旧包） */
    private getEffectiveCommunityRevealCount(): number {
        const cards = this.room?.round?.communityCards || [];
        let n = 0;
        for (let i = 0; i < 5 && i < cards.length; i++) {
            const c = cards[i];
            if (typeof c === 'number' && c > 0) n++;
            else break;
        }
        if (n > 0) return Math.min(n, 5);
        return this.getCommunityRevealCountByStage(this.room?.round?.stage || '');
    }

    /**
     * 根据阶段返回应展示的公共牌数量。
     */
    private getCommunityRevealCountByStage(stage: string): number {
        switch ((stage || '').toLowerCase()) {
            case 'flop':
                return 3;
            case 'turn':
                return 4;
            case 'river':
            case 'showdown':
                return 5;
            case 'preflop':
            default:
                return 0;
        }
    }

    /**
     * 根据阶段返回对应的阶段文本。
     */
    private getStageTextByStage(stage: string): string {
        switch ((stage || '').toLowerCase()) {
            case 'flop':
                return i18n.t('STAGE_FLOP') || '翻牌圈';
            case 'turn':
                return i18n.t('STAGE_TURN') || '转牌圈';
            case 'river':
                return i18n.t('STAGE_RIVER') || '河牌圈';
            case 'showdown':
                return i18n.t('STAGE_SHOWDOWN') || '摊牌';
            case 'preflop':
            default:
                return i18n.t('STAGE_PREFLOP') || '翻牌前';
        }
    }

    /**
     * 评估并渲染服务器倒计时。
     */
    private evaluateServerCountdown() {
        if (this._disposed || !this.room) return;
        const playing = this.room.status === RoomStatus.Playing;
        const deadlineAt =
            !playing && this.room.round?.action ? this.room.round.action.deadlineAt || 0 : 0;
        const prev = this._lastStartCountdownDeadline;
        this._lastStartCountdownDeadline = deadlineAt;
        if (deadlineAt !== prev && this._countdownRenderTimer) {
            clearInterval(this._countdownRenderTimer);
            this._countdownRenderTimer = null;
        }

        const nowSec = this.getSyncedNowSec();
        const remain = deadlineAt > 0 ? Math.max(0, deadlineAt - nowSec) : 0;
        if (remain <= 0) {
            this.setCountdownText('');
            if (this._countdownRenderTimer) {
                clearInterval(this._countdownRenderTimer);
                this._countdownRenderTimer = null;
            }
            if (this.room.status === RoomStatus.Playing && !this._gameStarted) {
                const likelyReconnectRecover =
                    this._shouldRestorePlayingView || this.getReadySeatIndices().length < 2;
                if (this._enteredSceneWithPlaying || likelyReconnectRecover) {
                    this._shouldRestorePlayingView = false;
                    this.restoreCurrentRoundView();
                } else {
                    this.startGame();
                }
            }
            return;
        }
        this.setCountdownText(`${remain}`);
        if (this._countdownRenderTimer) return;
        this._countdownRenderTimer = setInterval(() => {
            if (this._disposed || !this.room) return;
            const inLobby = this.room.status !== RoomStatus.Playing;
            const ddl = inLobby && this.room.round?.action ? this.room.round.action.deadlineAt || 0 : 0;
            const sec = this.getSyncedNowSec();
            const left = ddl > 0 ? Math.max(0, ddl - sec) : 0;
            if (left <= 0) {
                this.setCountdownText('');
                if (this._countdownRenderTimer) {
                    clearInterval(this._countdownRenderTimer);
                    this._countdownRenderTimer = null;
                }
                return;
            }
            this.setCountdownText(`${left}`);
        }, 1000);
    }

    /**
     * 添加开始游戏倒计时文本
     */
    private ensureCountdownUI() {
        if (this._disposed || !this.tableNode || !isValid(this.tableNode, true)) return;
        if (this._countdownLabelNode && isValid(this._countdownLabelNode)) return;
        this._countdownLabelNode = new Node('StartCountdownLabel');
        this._countdownLabel = this._countdownLabelNode.addComponent(Label);
        this._countdownLabel.fontSize = 32;
        this._countdownLabel.color = new Color(255, 220, 120, 255);
        this._countdownLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._countdownLabel.string = '';
        this._countdownLabelNode.setPosition(new Vec3(0, 268, 0));
        this.tableNode.addChild(this._countdownLabelNode);
    }

    /**
     * 确保阶段UI存在。
     */
    private ensureStageUI() {
        this.ensureStagePotColumn();
    }

    /**
     * 确保底池UI存在。
     */
    private ensurePotUI() {
        0
        this.ensureStagePotColumn();
    }

    /**
     * 阶段标题在上、底池在下，用垂直 Layout 排布，避免两行文字重叠。
     */
    private ensureStagePotColumn() {
        if (this._disposed || !this.tableNode || !isValid(this.tableNode, true)) return;
        if (this._stagePotHostNode && isValid(this._stagePotHostNode)) return;

        // 旧版曾把标题/底池直接挂在 table 下，升级时拆掉以免与新版重复
        if (this._stageLabelNode && isValid(this._stageLabelNode) && this._stageLabelNode.parent === this.tableNode) {
            this._stageLabelNode.destroy();
            this._stageLabelNode = null;
            this._stageLabel = null;
        }
        if (this._potLabelNode && isValid(this._potLabelNode) && this._potLabelNode.parent === this.tableNode) {
            this._potLabelNode.destroy();
            this._potLabelNode = null;
            this._potLabel = null;
        }

        const host = new Node('StagePotColumn');
        const hostUi = host.addComponent(UITransform);
        hostUi.setAnchorPoint(0.5, 0.5);
        hostUi.setContentSize(440, 88);

        const col = host.addComponent(Layout);
        col.type = Layout.Type.VERTICAL;
        col.resizeMode = Layout.ResizeMode.CONTAINER;
        col.spacingY = 10;
        col.paddingTop = 4;
        col.paddingBottom = 4;
        col.paddingLeft = 12;
        col.paddingRight = 12;
        col.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;
        col.affectedByScale = true;

        const stageNode = new Node('GameStageLabel');
        stageNode.addComponent(UITransform).setContentSize(416, 38);
        const stageLabel = stageNode.addComponent(Label);
        stageLabel.fontSize = 30;
        stageLabel.color = new Color(170, 230, 255, 255);
        stageLabel.string = '';
        stageLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        stageLabel.verticalAlign = Label.VerticalAlign.CENTER;
        stageLabel.overflow = Label.Overflow.CLAMP;

        const potNode = new Node('PotLabel');
        potNode.addComponent(UITransform).setContentSize(416, 30);
        const potLabel = potNode.addComponent(Label);
        potLabel.fontSize = 24;
        potLabel.color = new Color(255, 230, 145, 255);
        potLabel.string = '';
        potLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        potLabel.verticalAlign = Label.VerticalAlign.CENTER;
        potLabel.overflow = Label.Overflow.CLAMP;

        host.addChild(stageNode);
        host.addChild(potNode);
        this.tableNode.addChild(host);
        host.setPosition(0, 228, 0);

        this._stagePotHostNode = host;
        this._stageLabelNode = stageNode;
        this._stageLabel = stageLabel;
        this._potLabelNode = potNode;
        this._potLabel = potLabel;

        this.updatePotLabelLayout();
    }

    /**
     * 确保当前玩家独立读秒 Label 存在
     */
    private ensureSelfCountdownLabel() {
        if (this._disposed || !this.tableNode || !isValid(this.tableNode, true)) return;
        if (this._selfCountdownLabel && isValid(this._selfCountdownLabel)) return;

        // 创建 Label 节点
        const labelNode = new Node('SelfCountdownLabel');
        const label = labelNode.addComponent(Label);
        label.fontSize = 36;
        label.lineHeight = 40;
        label.color = new Color().fromHEX('#f9d972');
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        const uiTransform = labelNode.getComponent(UITransform) || labelNode.addComponent(UITransform);
        uiTransform.setContentSize(100, 50);

        this.tableNode.addChild(labelNode);
        this._selfCountdownLabel = labelNode;
        labelNode.active = false;
    }

    /**
     * 启动当前玩家独立读秒
     * @param totalTime 总时间
     * @param remainingTime 剩余时间
     * @param seatPosition 座位位置（用于计算读秒显示位置）
     */
    public startSelfCountdown(totalTime: number, remainingTime: number, seatPosition: Vec3) {
        if (remainingTime <= 0) {
            this.stopSelfCountdown();
            return;
        }

        this.ensureSelfCountdownLabel();
        if (!this._selfCountdownLabel || !isValid(this._selfCountdownLabel)) return;
        this._isSelfCountdownActive = true;

        // 设置位置：手牌上方150像素
        const label = this._selfCountdownLabel.getComponent(Label);
        if (label) {
            label.string = Math.ceil(remainingTime).toString();
        }

        // 向上偏移150像素
        this._selfCountdownLabel.setPosition(seatPosition.x, seatPosition.y + 150, seatPosition.z);
        this._selfCountdownLabel.active = true;
    }

    /**
     * 更新当前玩家独立读秒（严格根据后端同步的行动时间）
     * @param remainingTime 后端同步的剩余时间
     */
    public updateSelfCountdownFromServer(remainingTime: number) {
        if (!this._isSelfCountdownActive || !this._selfCountdownLabel || !isValid(this._selfCountdownLabel)) {
            return;
        }

        if (remainingTime <= 0) {
            // 倒计时结束
            this.stopSelfCountdown();
        } else {
            // 更新显示
            const label = this._selfCountdownLabel.getComponent(Label);
            if (label) {
                label.string = Math.ceil(remainingTime).toString();
            }
        }
    }

    /**
     * 停止当前玩家独立读秒
     */
    public stopSelfCountdown() {
        this._isSelfCountdownActive = false;
        if (this._selfCountdownLabel && isValid(this._selfCountdownLabel)) {
            this._selfCountdownLabel.active = false;
        }
    }

    /**
     * 更新 betNode 操作节点的可见性和子节点状态。
     */
    private updateBettingBarVisibility() {
        if (!this.betNode) return;
        const uid = userManager.user?.userId;
        const turn = this.room?.round?.action?.currentTurnUserId;
        const playing = this.room?.status === RoomStatus.Playing;
        const me = this.getCurrentPlayer();
        const stack = this.playerWalletAmount(me);
        const allInHand = this.playerAllInThisHand(me);
        // 无剩余筹码、已全下或已弃牌：不再显示；连点锁避免全下后房态未回包前误触
        const show = !!(
            playing &&
            uid &&
            turn &&
            turn === uid &&
            stack > 0.01 &&
            !allInHand &&
            !me?.folded &&
            !this._betActionLocked
        );
        if (show && !this._betNodesVisible) {
            this.betNode.active = true;
            this._betNodesVisible = true;
            this.animateBetNodesIn();
        } else if (!show && this._betNodesVisible) {
            this.betNode.active = false;
            this._betNodesVisible = false;
            this.hideRaisePopup();
        } else if (!show) {
            this.betNode.active = false;
        }
        if (!show) return;

        // ── betNode 子节点文案与显隐更新 ──
        const maxB = Math.max(
            0,
            ...(this.room?.players || []).map(p => this.playerStreetBet(p))
        );
        const mine = this.playerStreetBet(me);
        const toCall = Math.max(0, maxB - mine);
        const bn = this.getBetChildNode();
        const setLbl = (node: Node | null, text: string) => {
            const l = this.findNodeLabel(node);
            if (l) l.string = text;
        };
        setLbl(bn.fold, i18n.t('Bet.Fold') || '弃牌');
        setLbl(bn.raise, i18n.t('Bet.Raise') || '加注');
        setLbl(bn.allIn, i18n.t('Bet.AllIn') || '全下');
        if (toCall < 0.01) {
            setLbl(bn.check, i18n.t('Bet.Check') || '过牌');
            if (bn.check) bn.check.active = true;
            if (bn.call) bn.call.active = false;
        } else {
            setLbl(bn.call, `${i18n.t('Bet.Call') || '跟注'} ${Math.round(toCall)}`);
            if (bn.check) bn.check.active = false;
            if (bn.call) bn.call.active = true;
        }

        // ShowDownNode 仅在 showdown 阶段显示
        const _stage = (this.room?.round?.stage || '').toLowerCase();
        if (bn.showDown) bn.showDown.active = (_stage === 'showdown');

        // 不可加注时关闭弹出层
        const snap = this.computeBetRaiseSnapshot(me);
        if (!snap?.canRaise) this.hideRaisePopup();
    }

    /**
     * betNode 子节点入场动画：从下方滑出到各自位置，依次展开。
     * 首次调用时缓存原始坐标，后续动画始终回归缓存位置，避免浮点漂移。
     */
    private animateBetNodesIn() {
        if (!this.betNode) return;
        const stage = (this.room?.round?.stage || '').toLowerCase();
        const isShowdown = stage === 'showdown';
        const children = this.betNode.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (!child || child.name === 'RaisePopup') continue;

            // ShowDownNode 仅在 showdown 阶段显示，其余阶段始终隐藏
            if (child.name === 'ShowDownNode') {
                child.active = isShowdown;
                if (!isShowdown) continue;
            }

            // 首次记录原始坐标（只记一次，之后永远用缓存值）
            let originalPos = this._betNodeOriginalPositions.get(child.name);
            if (!originalPos) {
                originalPos = child.position.clone();
                this._betNodeOriginalPositions.set(child.name, originalPos);
            }

            // 先停掉残留 tween，防止上一轮动画未结束叠加
            Tween.stopAllByTarget(child);

            // 起始位置：目标位置下方 80px，同时缩小
            child.setScale(0.6, 0.6, 1);
            child.setPosition(originalPos.x, originalPos.y - 80, originalPos.z);
            child.active = true;

            tween(child)
                .delay(i * 0.05)
                .to(
                    0.3,
                    { scale: new Vec3(1, 1, 1), position: new Vec3(originalPos.x, originalPos.y, originalPos.z) },
                    { easing: 'backOut' }
                )
                .start();
        }
    }

    /**
     * 快照当前各座位的本阶段下注额（sync 回包前调用）。
     */
    private snapshotCurrentBets() {
        this._lastPlayerBets.clear();
        this._lastPotTotal = this.getPotTotal();
        if (!this.room?.players) return;
        for (const p of this.room.players) {
            const seat = this.effectiveSeatIndex(p);
            if (seat > 0) this._lastPlayerBets.set(seat, this.playerStreetBet(p));
        }
    }

    /** 读取当前底池总额（pot.total 优先，否则 mainPot + sidePot） */
    private getPotTotal(): number {
        const pot = this.room?.round?.pot;
        if (!pot) return 0;
        const total = Number(pot.total);
        if (Number.isFinite(total) && total > 0) return total;
        return Number(pot.mainPot || 0) + Number(pot.sidePot || 0);
    }

    /** 计算当前回合所有玩家的本阶段下注总和 */
    private getCurrentRoundTotal(): number {
        if (!this.room?.players) return 0;
        let total = 0;
        for (const p of this.room.players) total += this.playerStreetBet(p);
        return total;
    }

    /**
     * 对比前后两次下注快照，为每位下注增加的玩家播放筹码飞行动画。
     * 当回合结束时 currentBet 会被服务端重置为 0，此时用 _pendingBet 或底池增量回推。
     * 回合结算完成后，播放筹码从 currentRoundBet 飞入 totalBet 的动画。
     */
    private detectBetChangesAndAnimate(
        prevPotTotal: number,
        prevRoundTotal: number,
        wasRoundBetActive: boolean
    ) {
        if (!this.room?.players) {
            this._pendingBetAmount = 0;
            this._pendingBetSeat = -1;
            return;
        }
        const hasAllIn = this.room.players.some(p => p.allInHand);
        let anyAnimated = false;

        // ── 正常情况：检测各座位 currentBet 增量 ──
        for (const p of this.room.players) {
            const seat = this.effectiveSeatIndex(p);
            if (seat <= 0) continue;
            const currentBet = this.playerStreetBet(p);
            const prevBet = this._lastPlayerBets.get(seat) || 0;
            const diff = currentBet - prevBet;
            if (diff > 0.5) {
                const target = (hasAllIn && this.mainPot?.active) ? this.mainPot : this.currentRoundBet;
                this.animateChipFly(seat, diff, target);
                anyAnimated = true;
            }
        }

        // ── Fallback：回合结束后 currentBet 被重置 ──
        if (!anyAnimated) {
            const newPotTotal = this.getPotTotal();
            const potIncrease = newPotTotal - prevPotTotal;
            if (potIncrease > 0.5) {
                // 优先使用当前用户发起下注时记录的座位和金额
                let actorSeat = this._pendingBetSeat;
                let betAmount = this._pendingBetAmount;
                // 兜底：用上一快照中下注最多的玩家
                if (actorSeat <= 0) {
                    let maxPrevBet = 0;
                    for (const [seat, bet] of this._lastPlayerBets) {
                        if (bet > maxPrevBet) { maxPrevBet = bet; actorSeat = seat; }
                    }
                    betAmount = potIncrease;
                }
                if (actorSeat > 0) {
                    const target = this.totalBet?.active ? this.totalBet
                        : (hasAllIn && this.mainPot?.active) ? this.mainPot
                            : this.currentRoundBet;
                    this.animateChipFly(actorSeat, betAmount || potIncrease, target);
                }
            }
        }

        // 清除已消费的下注记录
        this._pendingBetAmount = 0;
        this._pendingBetSeat = -1;

        // ── 回合结算：currentRoundBet 收归 totalBet 的飞行动画 ──
        if (wasRoundBetActive && prevRoundTotal > 0.5 && this.totalBet?.active) {
            this.animateChipFlyBetweenNodes(this.currentRoundBet, this.totalBet, prevRoundTotal);
        }

        // 更新快照
        this.snapshotCurrentBets();
    }

    /**
     * 筹码飞行动画：
     *   1) 筹码出现在座位旁边（根据座位方向偏移到靠桌内侧）
     *   2) 短暂停留 1s 展示筹码图片 + 金额
     *   3) 快速飞向目标 pot 节点
     *   4) 到达后筹码销毁，目标节点播放缩放回弹动画
     * @param seatIndex  下注玩家座位号（1-based）
     * @param amount     下注金额
     * @param targetNode 目标节点（currentRoundBet / mainPot / sidePot）
     */
    private animateChipFly(seatIndex: number, amount: number, targetNode: Node | null) {
        if (!this.tableNode || !targetNode || !isValid(targetNode)) return;
        const pile = this._seatPiles[seatIndex - 1];
        if (!pile?.node) return;

        const chipFrame = imageManager.getIcon('chips');
        if (!chipFrame) return;

        const chip = new Node('ChipFly');
        this.tableNode.addChild(chip);

        // 筹码图标
        const sprite = chip.addComponent(Sprite);
        sprite.spriteFrame = chipFrame;
        chip.addComponent(UITransform).setContentSize(48, 48);

        // 金额标签（筹码右侧）
        const labelNode = new Node('ChipAmount');
        labelNode.setParent(chip);
        const labelUI = labelNode.addComponent(UITransform);
        labelUI.setContentSize(120, 24);
        const label = labelNode.addComponent(Label);
        label.string = `$${Math.round(amount)}`;
        label.fontSize = 22;
        label.color = new Color(255, 255, 255, 255);
        label.isBold = true;
        labelNode.setPosition(30, 18, 0);

        // ── 计算坐标（统一到 tableNode 本地空间） ──
        const tableUT = this.tableNode.getComponent(UITransform)!;
        const seatWorld = pile.node.parent!.getComponent(UITransform)!
            .convertToWorldSpaceAR(pile.node.position);
        const seatLocal = tableUT.convertToNodeSpaceAR(seatWorld);

        // 根据座位 X 坐标判断筹码出现在哪侧（哪侧离屏幕边缘空间大就出现在哪侧）
        // tableNode 本地空间中心为 (0, 0)
        const offset = 100;
        let stageX = seatLocal.x;
        const stageY = seatLocal.y;
        if (seatLocal.x <= 0) {
            // 座位在桌面中心偏左 → 右侧空间更大 → 筹码出现在右边
            stageX += offset;
        } else {
            // 座位在桌面中心偏右 → 左侧空间更大 → 筹码出现在左边
            stageX -= offset;
        }
        const stagePos = new Vec3(stageX, stageY, seatLocal.z);

        // 目标节点坐标
        const targetWorld = targetNode.parent!.getComponent(UITransform)!
            .convertToWorldSpaceAR(targetNode.position);
        const targetLocal = tableUT.convertToNodeSpaceAR(targetWorld);

        chip.setScale(0, 0, 1);
        chip.setPosition(seatLocal);

        // 缓存目标节点引用，用于到达后的缩放动画
        const bounceTarget = targetNode;

        // 动画：出现 → 滑到旁边 → 停留 1s → 快速飞向目标 → 销毁 + 目标缩放
        tween(chip)
            .to(0.15, { scale: new Vec3(1, 1, 1), position: stagePos })    // 弹出到旁边
            .delay(1.0)                                                      // 停留展示金额
            .to(0.25, { position: new Vec3(targetLocal.x, targetLocal.y, targetLocal.z) }, { easing: 'sineIn' }) // 快速飞向目标
            .to(0.08, { scale: new Vec3(0.2, 0.2, 1) })                   // 缩小
            .call(() => {
                chip.destroy();
                // 目标节点缩放回弹动画（同 startGameNode 点击效果）
                if (bounceTarget && isValid(bounceTarget)) {
                    const orig = bounceTarget.scale.clone();
                    const smaller = new Vec3(orig.x * 0.9, orig.y * 0.9, orig.z);
                    tween(bounceTarget)
                        .to(0.1, { scale: smaller }, { easing: 'sineOut' })
                        .to(0.1, { scale: orig }, { easing: 'sineIn' })
                        .start();
                }
            })
            .start();
    }

    /**
     * 节点间筹码飞行动画（用于回合结算：currentRoundBet → totalBet）。
     * 筹码从源节点飞向目标节点，到达后销毁，目标节点播放缩放回弹。
     */
    private animateChipFlyBetweenNodes(fromNode: Node | null, toNode: Node | null, amount: number) {
        if (!this.tableNode || !fromNode || !toNode || !isValid(fromNode) || !isValid(toNode)) return;

        const chipFrame = imageManager.getIcon('chips');
        if (!chipFrame) return;

        const chip = new Node('ChipFlySettle');
        this.tableNode.addChild(chip);

        const sprite = chip.addComponent(Sprite);
        sprite.spriteFrame = chipFrame;
        chip.addComponent(UITransform).setContentSize(48, 48);

        const labelNode = new Node('ChipAmount');
        labelNode.setParent(chip);
        const labelUI = labelNode.addComponent(UITransform);
        labelUI.setContentSize(120, 24);
        const label = labelNode.addComponent(Label);
        label.string = `$${Math.round(amount)}`;
        label.fontSize = 22;
        label.color = new Color(255, 255, 255, 255);
        label.isBold = true;
        labelNode.setPosition(30, 18, 0);

        // 坐标转换
        const tableUT = this.tableNode.getComponent(UITransform)!;
        const fromWorld = fromNode.parent!.getComponent(UITransform)!
            .convertToWorldSpaceAR(fromNode.position);
        const toWorld = toNode.parent!.getComponent(UITransform)!
            .convertToWorldSpaceAR(toNode.position);
        const startPos = tableUT.convertToNodeSpaceAR(fromWorld);
        const endPos = tableUT.convertToNodeSpaceAR(toWorld);

        chip.setScale(1, 1, 1);
        chip.setPosition(startPos);

        const bounceTarget = toNode;
        tween(chip)
            .delay(0.3)
            .to(0.35, { position: new Vec3(endPos.x, endPos.y, endPos.z) }, { easing: 'sineIn' })
            .to(0.08, { scale: new Vec3(0.2, 0.2, 1) })
            .call(() => {
                chip.destroy();
                if (bounceTarget && isValid(bounceTarget)) {
                    const orig = bounceTarget.scale.clone();
                    const smaller = new Vec3(orig.x * 0.9, orig.y * 0.9, orig.z);
                    tween(bounceTarget)
                        .to(0.1, { scale: smaller }, { easing: 'sineOut' })
                        .to(0.1, { scale: orig }, { easing: 'sineIn' })
                        .start();
                }
            })
            .start();
    }

    /**
     * 计算加注相关的金额快照（最小、2BB、半池、满池等）。
     */
    private computeBetRaiseSnapshot(me: any): {
        minT: number;
        bb2T: number;
        halfT: number;
        potT: number;
        canRaise: boolean;
        floor: number;
        cap: number;
    } | null {
        if (!this.room || !me) return null;
        const players = this.room.players || [];
        const maxB = Math.max(0, ...players.map(p => this.playerStreetBet(p)));
        const mine = this.playerStreetBet(me);
        const stack = this.playerWalletAmount(me);
        const cap = mine + stack;
        const bb = Number(
            this.room.round?.bigBlindAmount ?? (this.room.smallBlind ? this.room.smallBlind * 2 : 2)
        );
        const lr = Number(this.room.round?.lastRaiseSize);
        const minInc = Math.max(1, (Number.isFinite(lr) && lr > 0.01 ? lr : bb) || 1);
        const floor = maxB + minInc;
        const canRaise = cap + 1e-6 >= floor;
        const toCall = Math.max(0, maxB - mine);
        const pot = this.room.round?.pot;
        const totalField = Number(pot?.total);
        const potTotal =
            Number.isFinite(totalField) && totalField > 0
                ? totalField
                : Number(pot?.mainPot || 0) + Number(pot?.sidePot || 0);
        const clamp = (t: number) => Math.min(Math.max(t, floor), cap);
        const minT = clamp(maxB + minInc);
        const bb2T = clamp(maxB + Math.max(minInc, bb * 2));
        const halfExtra = Math.max(minInc, Math.round((potTotal + toCall) * 0.5));
        const halfT = clamp(mine + toCall + halfExtra);
        const potExtra = Math.max(minInc, Math.round(potTotal + toCall));
        const potT = clamp(mine + toCall + potExtra);
        return { minT, bb2T, halfT, potT, canRaise, floor, cap };
    }

    /**
     * 构建自定义加注表单项。
     */
    private buildCustomRaiseFormItems(snap: {
        floor: number;
        cap: number;
        minT: number;
    }): IFormItem[] {
        const minInput = Math.max(1, Math.ceil(snap.floor - 1e-6));
        const maxInput = Math.max(minInput, Math.floor(snap.cap + 1e-6));
        const def = Math.min(maxInput, Math.max(minInput, Math.round(snap.minT)));
        return [
            {
                label: i18n.t('BET_RAISE_CUSTOM_LABEL') || '本街目标总下注',
                key: 'raiseTarget',
                type: FormItemType.Input,
                inputType: InputType.Number,
                isInteger: true,
                placeholder: i18n.t('BET_RAISE_CUSTOM_PLACEHOLDER') || '',
                defaultValue: def,
                minValue: minInput,
                maxValue: maxInput,
                required: true,
                help: i18n.t('BET_RAISE_CUSTOM_HELP') || '',
            },
        ];
    }

    /**
     * 执行带锁的桌面操作（防止连点）。
     */
    private async runLockedTableAction(
        send: () => Promise<boolean | { ok: boolean; message?: string }>
    ) {
        if (this._betActionLocked) return;
        this._betActionLocked = true;
        this.updateBettingBarVisibility();
        try {
            const raw = await send();
            const ok = typeof raw === 'boolean' ? raw : raw.ok;
            const msg = typeof raw === 'boolean' ? undefined : raw.message;
            if (!ok) {
                await uiManager.alert({
                    content: tServerErrorMessage(msg) || i18n.t('BET_ACTION_FAILED') || '操作失败',
                });
            }
        } finally {
            this._betActionLocked = false;
            this.updateBettingBarVisibility();
        }
    }

    /**
     * 弃牌操作。
     */
    private async onBetFold() {
        await this.runLockedTableAction(() => roomSessionService.sendTableAction('fold'));
    }

    /**
     * 跟注或过牌操作。
     */
    private async onBetCallOrCheck() {
        const me = this.getCurrentPlayer();
        if (!me || !this.room) return;
        const maxB = Math.max(
            0,
            ...(this.room.players || []).map(p => this.playerStreetBet(p))
        );
        const mine = this.playerStreetBet(me);
        const toCall = Math.max(0, maxB - mine);
        const kind = toCall < 0.01 ? 'check' : 'call';
        if (kind === 'call') {
            this._pendingBetAmount = toCall;
            this._pendingBetSeat = this.effectiveSeatIndex(me);
        }
        await this.runLockedTableAction(() => roomSessionService.sendTableAction(kind));
    }

    /**
     * 预设加注操作。
     * @param kind 加注类型
     */
    private async onBetRaisePreset(kind: 'min' | 'bb2' | 'half' | 'pot') {
        const me = this.getCurrentPlayer();
        if (!me || !this.room) return;
        const snap = this.computeBetRaiseSnapshot(me);
        if (!snap?.canRaise) return;
        let target = snap.minT;
        if (kind === 'bb2') target = snap.bb2T;
        else if (kind === 'half') target = snap.halfT;
        else if (kind === 'pot') target = snap.potT;
        const rounded = Math.round(target * 100) / 100;
        this._pendingBetAmount = rounded;
        this._pendingBetSeat = this.effectiveSeatIndex(me);
        await this.runLockedTableAction(() => roomSessionService.sendTableAction('raise', rounded));
    }

    /**
     * 自定义加注操作。
     */
    private async onBetRaiseCustom() {
        if (this._disposed || this._betActionLocked) return;
        const me = this.getCurrentPlayer();
        if (!me || !this.room) return;
        const snap = this.computeBetRaiseSnapshot(me);
        if (!snap?.canRaise) return;
        const items = this.buildCustomRaiseFormItems(snap);
        await uiManager.showFormModal({
            title: i18n.t('BET_RAISE_CUSTOM_TITLE') || '自定义加注',
            items,
            onConfirm: async (data: Record<string, unknown>) => {
                if (this._betActionLocked) return false;
                const v = data?.raiseTarget;
                const n = typeof v === 'number' ? v : Number(v);
                if (!Number.isFinite(n)) return false;
                const rounded = Math.round(n * 100) / 100;
                this._betActionLocked = true;
                this.updateBettingBarVisibility();
                try {
                    const r = await roomSessionService.sendTableAction('raise', rounded);
                    if (!r.ok) {
                        await uiManager.alert({
                            content:
                                tServerErrorMessage(r.message) ||
                                i18n.t('BET_ACTION_FAILED') ||
                                '操作失败',
                        });
                    }
                    return r.ok;
                } finally {
                    this._betActionLocked = false;
                    this.updateBettingBarVisibility();
                }
            },
        });
    }

    /**
     * 全下操作。
     */
    private async onBetAllIn() {
        const me = this.getCurrentPlayer();
        if (me) {
            this._pendingBetAmount = this.playerWalletAmount(me);
            this._pendingBetSeat = this.effectiveSeatIndex(me);
        }
        await this.runLockedTableAction(() => roomSessionService.sendTableAction('all_in'));
    }

    /**
     * 确保座位计时器标签存在。
     */
    private ensureSeatTimerLabels() {
        if (this._seatTimerLabels.length === this._seatPiles.length) {
            const p0 = this._seatPiles[0];
            if (p0?.node?.getChildByName('SeatLeaveCountdownLabel')) return;
            this._seatTimerLabels = [];
        }
        this._seatTimerLabels = this._seatPiles.map((pile, idx) => {
            if (!pile || !isValid(pile.node)) return null;
            const legacyAction = pile.node.getChildByName('SeatActionCountdownLabel');
            if (legacyAction && isValid(legacyAction)) legacyAction.destroy();
            const legacyOverlay = pile.node.getChildByName('SeatTimerOverlay');
            if (legacyOverlay && isValid(legacyOverlay)) legacyOverlay.destroy();
            let timerNode = pile.node.getChildByName('SeatLeaveCountdownLabel');
            if (!timerNode) {
                timerNode = new Node('SeatLeaveCountdownLabel');
                pile.node.addChild(timerNode);
            }
            const label = timerNode.getComponent(Label) || timerNode.addComponent(Label);
            label.fontSize = 22;
            label.color = new Color(255, 230, 150, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.string = '';
            return label;
        });
    }

    /**
     * 刷新座位计时器覆盖标签。
     */
    private updateSeatTimerOverlayLabels() {
        this.ensureSeatTimerLabels();
        const now = this.getSyncedNowSec();
        const timeout = this.room?.leaveTimeout || 0;
        const playing = this.room?.status === RoomStatus.Playing;
        const deadlineAt = this.room?.round?.action?.deadlineAt || 0;
        const currentTurnUserId = this.room?.round?.action?.currentTurnUserId || '';
        const actionRemain =
            playing && deadlineAt > 0 ? Math.max(0, deadlineAt - now) : 0;
        const actionTotal = Math.max(1, Number(this.room?.actionTimeout || actionRemain || 1));

        const seatMap = new Map<number, any>();
        for (const p of this.room?.players || []) {
            const seat = this.effectiveSeatIndex(p);
            if (seat > 0) seatMap.set(seat, p);
        }

        for (let i = 0; i < this._seatTimerLabels.length; i++) {
            const label = this._seatTimerLabels[i];
            const pile = this._seatPiles[i];
            pile?.hideActionCountdown();
            if (!label) continue;
            const p = seatMap.get(i + 1);
            const uid = p?.userId || p?.user?.userId || '';

            if (playing && uid && uid === currentTurnUserId && actionRemain > 0) {
                label.string = '';
                // 玩家操作倒计时不再创建 Label 渲染，直接交给 PokerPile 上绑定的 CountDown。
                if (!this.playerAllInThisHand(p)) {
                    // 判断是否是当前玩家
                    const isSelf = (i + 1) === this.currentPlayerSeat;
                    if (isSelf) {
                        // 当前玩家使用独立读秒显示在手牌上方
                        const pile = this._seatPiles[i];
                        if (pile && isValid(pile.node)) {
                            // 如果读秒还未启动，则启动；否则更新现有读秒
                            if (!this._isSelfCountdownActive) {
                                this.startSelfCountdown(actionTotal, actionRemain, pile.node.position.clone());
                            } else {
                                // 严格根据后端同步的时间更新读秒
                                this.updateSelfCountdownFromServer(actionRemain);
                            }
                        }
                    } else {
                        // 其他玩家使用原有的倒计时组件
                        pile?.startActionCountdown(actionTotal, actionRemain);
                    }
                }
                continue;
            }
            if (p?.offline && p?.offlineAt && timeout > 0) {
                const leaveRemain = Math.max(0, timeout - (now - p.offlineAt));
                if (leaveRemain > 0) {
                    label.string = `${leaveRemain}`;
                    continue;
                }
                // 对局中：离开超时后不再清理座位，读秒处改为固定文案
                if (playing) {
                    label.string = `[${i18n.t('PLAYER_LEFT_TAG') || '离开'}]`;
                    continue;
                }
            }
            label.string = '';
        }

        // 如果当前玩家的读秒还在激活状态，但已经不是当前回合，则停止读秒
        if (this._isSelfCountdownActive) {
            const currentPlayerPile = this.currentPlayerSeat > 0 ? this._seatPiles[this.currentPlayerSeat - 1] : null;
            const currentPlayerPlayer = currentPlayerPile ? seatMap.get(this.currentPlayerSeat) : null;
            const currentPlayerUid = currentPlayerPlayer?.userId || currentPlayerPlayer?.user?.userId || '';

            // 如果不是当前玩家回合，或者行动时间为0，则停止读秒
            if (!playing || !currentTurnUserId || currentPlayerUid !== currentTurnUserId || actionRemain <= 0) {
                this.stopSelfCountdown();
            }
        }
    }

    /**
     * 整块「阶段+底池」列：Layout 已错开两行；此处只移动父节点，使整列底边高于翻牌区顶，顶边低于开局倒计时区。
     */
    private updatePotLabelLayout() {
        if (this._disposed || !this._stagePotHostNode || !isValid(this._stagePotHostNode) || !this.tableNode) {
            return;
        }
        const layoutComp = this._stagePotHostNode.getComponent(Layout);
        layoutComp?.updateLayout(true);
        const hostUi = this._stagePotHostNode.getComponent(UITransform);
        if (!hostUi) return;
        const colH = hostUi.height;

        const cardTopSafety = 72;
        let flopTopY = -1e9;
        for (let i = 0; i < 3; i++) {
            const n = this._publicPokerPile[i];
            if (!n || !isValid(n)) continue;
            const h = n.getComponent(UITransform)?.height ?? 72;
            flopTopY = Math.max(flopTopY, n.position.y + h * 0.5);
        }

        // 列中心 Y：默认居中在桌心偏上；有翻牌时保证列的下半部分底边高于公共牌顶
        let centerY = 228;
        if (flopTopY > -1e8) {
            const minCenter = flopTopY + cardTopSafety + colH * 0.5;
            centerY = Math.max(centerY, minCenter);
        }
        // 开局倒计时约在 y=268，整列顶不要顶穿
        const topMarginBelowCountdown = 14;
        const countdownY = 268;
        const maxCenter = countdownY - topMarginBelowCountdown - colH * 0.5;
        if (centerY > maxCenter) {
            centerY = maxCenter;
        }
        this._stagePotHostNode.setPosition(0, centerY, 0);
    }

    /**
     * 更新总池
     */
    private updatePotLabel() {
        this.ensurePotUI();
        this.updatePotLabelLayout();
        if (!this._potLabel) return;
        const pot = this.room?.round?.pot;
        const mainPot = Number(pot?.mainPot || 0);
        const sidePot = Number(pot?.sidePot || 0);
        const totalField = Number(pot?.total);
        const total =
            Number.isFinite(totalField) && totalField > 0 ? totalField : mainPot + sidePot;
        if (total <= 0) {
            this._potLabel.string = '';
            return;
        }
        if (sidePot > 0.5) {
            this._potLabel.string = `主池 ${Math.round(mainPot)} · 边池 ${Math.round(sidePot)}（共 ${Math.round(total)}）`;
        } else {
            this._potLabel.string = `底池 ${Math.round(total)}`;
        }
    }

    /**
     * 更新底池显示（totalBet / currentRoundBet / mainPot / sidePot）。
     *
     * - totalBet（总奖池）：跨回合累计，每当回合结束时将 currentRoundBet 并入。
     * - currentRoundBet（当前回合总奖池）：当前阶段所有玩家下注筹码的总和，回合结束时清零。
     * - mainPot（主池）：有玩家 all-in 时显示，= 最小 all-in 金额 × 当前下注玩家数。
     * - sidePot（边池）：有玩家 all-in 时显示，超出 all-in 的部分按层级累加；多个 all-in 产生多个边池节点。
     */
    private updatePotDisplay() {
        if (!this.room) return;

        const players = this.room.players || [];
        const isPlaying = this.room.status === RoomStatus.Playing;

        // ── 非对局状态：隐藏所有四个节点 ──
        if (!isPlaying) {
            if (this.totalBet?.isValid) this.totalBet.active = false;
            if (this.currentRoundBet?.isValid) this.currentRoundBet.active = false;
            if (this.mainPot?.isValid) this.mainPot.active = false;
            if (this.sidePot?.isValid) this.sidePot.active = false;
            this.cleanupSidePotClones();
            return;
        }

        // ── 收集各玩家当前街下注金额 ──
        const playerBets: number[] = [];
        for (const p of players) {
            const seat = this.effectiveSeatIndex(p);
            if (seat <= 0) continue;
            if (p.folded || p.status === 'leave') continue;
            playerBets.push(this.playerStreetBet(p));
        }

        // ── 1. totalBet：直接读取服务器 pot 数据（与 updatePotLabel 同源，不会丢失筹码） ──
        const pot = this.room.round?.pot;
        const mainPotServer = Number(pot?.mainPot || 0);
        const sidePotServer = Number(pot?.sidePot || 0);
        const totalField = Number(pot?.total);
        const totalBetValue =
            Number.isFinite(totalField) && totalField > 0 ? totalField : mainPotServer + sidePotServer;

        // ── 2. currentRoundBet：当前回合（阶段）所有玩家下注总和 ──
        let currentRoundTotal = 0;
        for (const bet of playerBets) currentRoundTotal += bet;

        // 游戏进行中，只要有过下注就一直显示
        const hasAnyBet = currentRoundTotal > 0 || totalBetValue > 0;

        // 更新 totalBet Label
        if (this.totalBet) {
            this.totalBet.active = hasAnyBet;
            if (hasAnyBet) {
                const lbl = this.totalBet.getChildByName('totalBet')?.getComponent(Label);
                if (lbl) lbl.string = `$${Math.round(totalBetValue)}`;
            }
        }

        // 更新 currentRoundBet Label（当前回合）
        if (this.currentRoundBet) {
            this.currentRoundBet.active = hasAnyBet;
            const lbl = this.currentRoundBet.getChildByName('currentRoundBet')?.getComponent(Label);
            if (lbl) lbl.string = currentRoundTotal > 0 ? `$${Math.round(currentRoundTotal)}` : '$0';
        }

        // ── 3. All-in 检测 ──
        const allInPlayers: Array<{ player: any; bet: number }> = [];
        for (const p of players) {
            const seat = this.effectiveSeatIndex(p);
            if (seat <= 0) continue;
            if (p.folded || p.status === 'leave') continue;
            if (p.allInHand) {
                allInPlayers.push({ player: p, bet: this.playerStreetBet(p) });
            }
        }

        const hasAllIn = allInPlayers.length > 0;

        // ── 4. 主池 mainPot ──
        if (this.mainPot?.isValid) {
            if (hasAllIn) {
                this.mainPot.active = true;
                const minAllIn = Math.min(...allInPlayers.map(a => a.bet));
                const activePlayerCount = playerBets.length;
                const mainPotValue = minAllIn * activePlayerCount;
                const lbl = this.mainPot.getChildByName('mainPot')?.getComponent(Label);
                if (lbl) lbl.string = `$${Math.round(mainPotValue)}`;
            } else {
                this.mainPot.active = false;
            }
        }

        // ── 5. 边池 sidePot ──
        // 先清理上一次动态克隆的边池节点
        this.cleanupSidePotClones();

        if (this.sidePot?.isValid) {
            if (!hasAllIn) {
                this.sidePot.active = false;
            } else {
                // 按 all-in 金额从小到大排序
                allInPlayers.sort((a, b) => a.bet - b.bet);
                const allInAmounts = allInPlayers.map(a => a.bet);
                const activePlayerCount = playerBets.length;

                // 计算各层边池值
                const sidePotValues: number[] = [];
                for (let i = 1; i < allInAmounts.length; i++) {
                    const delta = allInAmounts[i] - allInAmounts[i - 1];
                    const remaining = activePlayerCount - i;
                    if (delta > 0 && remaining > 0) {
                        sidePotValues.push(delta * remaining);
                    }
                }
                // 最后一层：超出最大 all-in 的部分，按剩余正常玩家各自超出金额累加
                const maxAllIn = allInAmounts[allInAmounts.length - 1];
                let lastLayer = 0;
                for (const bet of playerBets) {
                    if (bet > maxAllIn) {
                        lastLayer += bet - maxAllIn;
                    }
                }
                if (lastLayer > 0) {
                    sidePotValues.push(lastLayer);
                }

                // 如果没有边池层
                if (sidePotValues.length === 0) {
                    this.sidePot.active = false;
                } else if (sidePotValues.length === 1) {
                    // 单个边池：直接使用编辑器模板节点
                    this.sidePot.active = true;
                    const titleLbl = this.sidePot.getChildByName('SPTitle')?.getComponent(Label);
                    if (titleLbl) titleLbl.string = 'SPTitle';
                    const valueLbl = this.sidePot.getChildByName('sidePot')?.getComponent(Label);
                    if (valueLbl) valueLbl.string = `$${Math.round(sidePotValues[0])}`;
                } else {
                    // 多个边池：隐藏编辑器模板，动态克隆
                    this.sidePot.active = false;
                    const parent = this.sidePot.parent;
                    if (parent) {
                        for (let i = 0; i < sidePotValues.length; i++) {
                            const clone = instantiate(this.sidePot);
                            clone.active = true;
                            parent.addChild(clone);
                            this._sidePotClones.push(clone);

                            const titleName = i === 0 ? 'SPTitle' : `SPTitle${i + 1}`;
                            const titleLbl = clone.getChildByName('SPTitle')?.getComponent(Label);
                            if (titleLbl) titleLbl.string = titleName;
                            const valueLbl = clone.getChildByName('sidePot')?.getComponent(Label);
                            if (valueLbl) valueLbl.string = `$${Math.round(sidePotValues[i])}`;
                        }
                    }
                }
            }
        }
    }

    /**
     * 清理动态克隆的边池节点。
     */
    private cleanupSidePotClones() {
        for (const clone of this._sidePotClones) {
            if (clone && isValid(clone, true)) clone.destroy();
        }
        this._sidePotClones = [];
    }

    /**
     * 确保"等待游戏开始"提示文本节点存在（屏幕居中、蛋黄色）。
     */
    private ensureWaitingText() {
        if (this._disposed || !this.tableNode || !isValid(this.tableNode, true)) return;
        if (this._waitingTextNode && isValid(this._waitingTextNode)) return;

        const node = new Node('WaitingForGameText');
        const ui = node.addComponent(UITransform);
        ui.setAnchorPoint(0.5, 0.5);
        ui.setContentSize(600, 60);

        const label = node.addComponent(Label);
        label.string = i18n.t('WAITING_FOR_THE_GAME_TO_START') || '等待游戏开始';
        label.fontSize = 36;
        label.lineHeight = 40;
        label.color = new Color().fromHEX('#f9d972');
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.CLAMP;

        node.setPosition(0, 0, 0);
        node.active = false;
        this.tableNode.addChild(node);

        this._waitingTextNode = node;
        this._waitingTextLabel = label;
    }

    /**
     * 显示"等待游戏开始"提示文本。
     */
    private showWaitingText() {
        this.ensureWaitingText();
        if (this._waitingTextNode && isValid(this._waitingTextNode)) {
            this._waitingTextNode.active = true;
        }
    }

    /**
     * 隐藏"等待游戏开始"提示文本。
     */
    private hideWaitingText() {
        if (this._waitingTextNode && isValid(this._waitingTextNode)) {
            this._waitingTextNode.active = false;
        }
    }

    /**
     * 刷新座位上的玩家名称、等级、筹码和下注信息。
     *
     * 这里会根据 room.players 里的 seatIndex 找到对应座位玩家，
     * Name/Stack 直接写到 PokerPile，Level/Bet/Role 仍写到座位信息卡。
     */
    private updateSeatInfoCards() {
        const seatMap = new Map<number, any>();
        const tableTransform = this.tableNode?.getComponent(UITransform);
        const halfW = tableTransform ? tableTransform.width / 2 : 0;
        for (const p of this.room?.players || []) {
            const seat = this.effectiveSeatIndex(p);
            if (seat > 0) {
                seatMap.set(seat, p);
            }
        }
        for (let i = 0; i < this._seatPiles.length; i++) {
            const pile = this._seatPiles[i];
            const info = this._seatInfoCards[i];
            const player = seatMap.get(i + 1);
            if (!player) {
                if (info?.root && isValid(info.root)) {
                    info.root.active = false;
                }
                pile?.setName('');
                pile?.setChip(null);
                continue;
            }
            const playerUserId = player.userId || player.user?.userId || '';
            // 玩家名称：优先用 player.nickname，其次用 player.user.nickname，最后回退到 userId。
            let nickname = player.nickname || player.user?.nickname || playerUserId || '';
            if (player.status === 'busy') {
                nickname = `${nickname} [${i18n.t('PLAYER_BUSY_TAG') || '忙碌'}]`;
            }
            // 玩家等级：来自 player.user.level，没有等级时默认显示 Lv.1。
            const level = player.user?.level || 1;
            // 玩家筹码：通过 playerWalletAmount() 统一读取 player.wallet / wallet / user.wallet。
            const stack = this.playerWalletAmount(player);
            const streetBet = this.playerStreetBet(player);
            const contributed = this.playerContributedThisHand(player);
            const playing = this.room?.status === RoomStatus.Playing;
            const fmtInt = (v: number) =>
                Number.isFinite(v) ? Math.round(v).toLocaleString('zh-CN') : '0';

            // 设置 Name：直接传给 PokerPile 预制体里绑定的 playerName。
            pile?.setName(nickname);

            // 设置 Stack：直接传给 PokerPile 预制体里绑定的 playerChip。
            pile?.setChip(stack);

            if (!info || !isValid(info.root)) continue;
            info.root.active = true;
            this.updateSeatInfoCardPlacement(i, info.root);
            const px = pile?.node?.position?.x || 0;
            const isCenterColumn = halfW > 0 ? Math.abs(px) <= halfW * 0.28 : true;
            if (!isCenterColumn) {
                const isRightSide = px > 0;
                info.level.horizontalAlign = isRightSide
                    ? Label.HorizontalAlign.RIGHT
                    : Label.HorizontalAlign.LEFT;
                info.role.horizontalAlign = isRightSide
                    ? Label.HorizontalAlign.RIGHT
                    : Label.HorizontalAlign.LEFT;
                info.bet.horizontalAlign = isRightSide
                    ? Label.HorizontalAlign.RIGHT
                    : Label.HorizontalAlign.LEFT;
            } else {
                info.level.horizontalAlign = Label.HorizontalAlign.LEFT;
                info.role.horizontalAlign = Label.HorizontalAlign.LEFT;
                info.bet.horizontalAlign = Label.HorizontalAlign.LEFT;
            }

            // 设置 Level：座位信息卡上显示的玩家等级。
            info.level.string = `Lv.${level}`;

            if (playing) {
                if (contributed > streetBet + 0.01) {
                    // 设置 Bet：对局中显示本轮下注和本手总投入。
                    info.bet.string = `本轮 ${fmtInt(streetBet)} · 本手投入 ${fmtInt(contributed)}`;
                } else {
                    // 设置 Bet：对局中只显示本轮下注。
                    info.bet.string = `本轮下注 ${fmtInt(streetBet)}`;
                }
            } else {
                // 设置 Bet：非对局状态不显示下注信息。
                info.bet.string = '';
            }
            const isMe = playerUserId && playerUserId === userManager.user?.userId;
            const isReady = player.status === 'ready';
            if (isReady && isMe) {
                info.level.color = new Color(255, 226, 140, 255);
            } else if (isReady) {
                info.level.color = new Color(126, 214, 162, 255);
            } else if (isMe) {
                info.level.color = new Color(255, 210, 120, 255);
            } else {
                info.level.color = new Color(172, 196, 224, 255);
            }
        }
    }

    /**
     * 更新座位信息卡片的位置
     */
    private updateSeatInfoCardPlacement(index: number, cardNode: Node) {
        const pile = this._seatPiles[index];
        const tableTransform = this.tableNode?.getComponent(UITransform);
        if (!pile || !isValid(pile.node) || !tableTransform || !isValid(cardNode)) return;
        const pileTransform = pile.node.getComponent(UITransform);
        const cardTransform = cardNode.getComponent(UITransform);
        if (!pileTransform || !cardTransform) return;
        const pos = pile.node.position;
        const halfW = tableTransform.width / 2;

        const pileW = pileTransform.width;
        const cardW = cardTransform.width;
        const alignOffset = Math.max(0, (cardW - pileW) / 2);
        const handStep = Math.max(18, this.pokerOffset * 0.45);
        const edgeCardCenterOffset = ((this.pokerCount - 1) / 2) * handStep;

        const isCenterColumn = Math.abs(pos.x) <= halfW * 0.28;

        let x = 0;
        if (!isCenterColumn) {
            if (pos.x < 0) {
                x = alignOffset - edgeCardCenterOffset;
            } else {
                x = -alignOffset + edgeCardCenterOffset;
            }
        }

        const halfPileH = pileTransform.height * 0.5;
        const gap = this.seatAnchorGap;
        const cardHalfH = cardTransform.height * 0.5;
        const yBelow = -(halfPileH + gap + cardHalfH);
        cardNode.setPosition(new Vec3(x, yBelow, 0));
    }

    /**
     * 启动离开渲染循环（定时刷新座位计时器）。
     */
    private startLeaveRenderLoop() {
        if (this._leaveRenderTimer) return;
        this._leaveRenderTimer = setInterval(() => {
            if (this._disposed || !this.room) return;
            this.updateSeatTimerOverlayLabels();
        }, 1000);
    }

    /**
     * 刷新座位角色标签（BTN/SB/BB等）。
     */
    private updateSeatRoleLabels(activeSeats: number[], dealerSeat: number) {
        this.ensureSeatRoleLabels();
        for (const label of this._seatRoleLabels) {
            if (label) label.string = '';
        }
        if (!activeSeats.length || dealerSeat <= 0) return;
        const n = activeSeats.length;
        if (n === 2) {
            const btnSeat = dealerSeat;
            const sbSeat = this.getSmallBlindSeat(activeSeats, dealerSeat);
            const bbSeat = this.getBigBlindSeat(activeSeats, sbSeat);
            this.addSeatRole(btnSeat, 'BTN');
            this.addSeatRole(sbSeat, 'SB');
            this.addSeatRole(bbSeat, 'BB');
            return;
        }
        const ordered = this.sortByDealerClockwise(activeSeats, dealerSeat);
        if (ordered.length < 3) return;
        this.addSeatRole(ordered[0], 'BTN');
        this.addSeatRole(ordered[1], 'SB');
        this.addSeatRole(ordered[2], 'BB');
        const postBb = this.getPostBbRoleLabels(n);
        for (let i = 0; i < postBb.length && 3 + i < ordered.length; i++) {
            this.addSeatRole(ordered[3 + i], postBb[i]);
        }
    }

    /**
     * 获取大盲位座位号。
     */
    private getBigBlindSeat(seats: number[], sbSeat: number): number {
        const ordered = this.sortByDealerClockwise(seats, sbSeat);
        return ordered.length > 1 ? ordered[1] : ordered[0] || -1;
    }

    /**
     * 庄家顺时针在 SB、BB 之后各座位的展示标签（与文件头座位说明一致；仅 n>=4 时有）。
     * numActive 为本桌活跃座位数（含庄）。
     */
    private getPostBbRoleLabels(numActive: number): string[] {
        const k = numActive - 3;
        if (k <= 0) return [];
        const byK: Record<number, string[]> = {
            1: ['UTG'],
            2: ['UTG', 'CO'],
            3: ['UTG', 'MP', 'CO'],
            4: ['UTG', 'UTG+1', 'MP', 'CO'],
            5: ['UTG', 'UTG+1', 'UTG+2', 'MP', 'CO'],
            6: ['UTG', 'UTG+1', 'UTG+2', 'MP', 'MP+1', 'CO'],
            7: ['UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'MP', 'MP+1', 'CO'],
        };
        return byK[k] ?? [];
    }

    /**
     * 给指定座位添加角色标签。
     */
    private addSeatRole(seat: number, role: string) {
        if (seat <= 0) return;
        const label = this._seatRoleLabels[seat - 1];
        if (!label) return;
        // 设置 Role：这里把 BTN/SB/BB/UTG 等座位角色写到 Role Label。
        if (!label.string) {
            label.string = role;
            return;
        }
        const parts = label.string.split('/').map(v => v.trim()).filter(Boolean);
        if (!parts.includes(role)) {
            parts.push(role);
        }
        label.string = parts.join('/');
    }

    /**
     * 确保座位角色标签数组与座位数一致。
     */
    private ensureSeatRoleLabels() {
        if (this._seatRoleLabels.length === this._seatPiles.length) return;
        this._seatRoleLabels = this._seatInfoCards.map(info => {
            if (!info || !isValid(info.root)) return null;
            return info.role;
        });
    }

    /**
     * 控制台打印房间时间线变更（玩家进出、阶段切换等）。
     */
    private logRoomTimeline(prevRoom: IRoom | undefined, nextRoom: IRoom | undefined) {
        if (!nextRoom) return;
        const snapshot = JSON.stringify({
            status: nextRoom.status,
            stage: nextRoom.round?.stage || '',
            action: nextRoom.round?.action || {},
            players: (nextRoom.players || []).map(p => ({
                uid: p.userId || p.user?.userId || '',
                name: p.nickname || p.user?.nickname || '',
                status: p.status,
                seat: this.effectiveSeatIndex(p),
                offline: !!p.offline,
                currentBet: this.playerStreetBet(p),
            })),
        });
        if (snapshot === this._lastRoomLogSnapshot) return;
        this._lastRoomLogSnapshot = snapshot;

        const prevPlayers = new Map<string, any>();
        const nextPlayers = new Map<string, any>();
        for (const p of prevRoom?.players || []) {
            const uid = p.userId || p.user?.userId || '';
            if (uid) prevPlayers.set(uid, p);
        }
        for (const p of nextRoom.players || []) {
            const uid = p.userId || p.user?.userId || '';
            if (uid) nextPlayers.set(uid, p);
        }

        for (const [uid, np] of nextPlayers.entries()) {
            const name = np.nickname || np.user?.nickname || uid;
            const pp = prevPlayers.get(uid);
            if (!pp) {
                Log.i('RoomTimeline', `玩家进入: ${name}`);
                continue;
            }
            if (!!pp.offline && !np.offline) Log.i('RoomTimeline', `玩家回来: ${name}`);
            if (!pp.offline && !!np.offline) Log.i('RoomTimeline', `玩家离开: ${name}`);
            const prevSeat = this.effectiveSeatIndex(pp);
            const nextSeat = this.effectiveSeatIndex(np);
            if (prevSeat <= 0 && nextSeat > 0) Log.i('RoomTimeline', `玩家坐下: ${name} 座位${nextSeat}`);
            if (pp.status !== 'ready' && np.status === 'ready') Log.i('RoomTimeline', `玩家准备: ${name}`);
        }
        for (const [uid, pp] of prevPlayers.entries()) {
            if (nextPlayers.has(uid)) continue;
            const name = pp.nickname || pp.user?.nickname || uid;
            Log.i('RoomTimeline', `玩家离开房间: ${name}`);
        }

        const prevStatus = prevRoom?.status || '';
        if (prevStatus !== 'playing' && nextRoom.status === 'playing') {
            Log.i('RoomTimeline', `游戏开始: 手数${nextRoom.round?.handNo || 0}`);
        }

        const prevStage = prevRoom?.round?.stage || '';
        const nextStage = nextRoom.round?.stage || '';
        if (nextStage && prevStage !== nextStage) {
            Log.i('RoomTimeline', `阶段切换: ${nextStage}`);
        }

        const action = nextRoom.round?.action;
        const prevAction = prevRoom?.round?.action;
        if (action && action.lastAction && action.lastAction !== prevAction?.lastAction) {
            const uid = action.lastActionUserId || '';
            const p = nextPlayers.get(uid);
            const name = p?.nickname || p?.user?.nickname || uid || '未知玩家';
            Log.i('RoomTimeline', `玩家行动: ${name} ${action.lastAction} ${action.lastActionAmount || 0}`);
        }
    }

    /**
     * 校准本地与服务器时间偏移。
     */
    private syncServerClockOffset() {
        const serverNowSec = this.room?.serverNow || 0;
        if (!serverNowSec || serverNowSec <= 0) return;
        const nowMs = Date.now();
        const targetOffset = serverNowSec * 1000 - nowMs;
        if (!this._serverOffsetInited) {
            this._serverTimeOffsetMs = targetOffset;
            this._serverOffsetInited = true;
            return;
        }
        const drift = Math.abs(targetOffset - this._serverTimeOffsetMs);
        // 偏差过大时快速校正（如设备休眠恢复、时间被手动调整）
        if (drift > 3000) {
            this._serverTimeOffsetMs = targetOffset;
            return;
        }
        // 常规网络抖动使用低通滤波，避免倒计时跳动。
        const alpha = 0.18;
        this._serverTimeOffsetMs = this._serverTimeOffsetMs * (1 - alpha) + targetOffset * alpha;
    }

    /**
     * 获取校准后的当前时间戳（秒）。
     */
    private getSyncedNowSec() {
        return Math.floor((Date.now() + this._serverTimeOffsetMs) / 1000);
    }

    /**
     * 设置倒计时文本。
     */
    private setCountdownText(text: string) {
        if (this._disposed) return;
        this.ensureCountdownUI();
        if (!this._countdownLabel) return;
        this._countdownLabel.string = text || '';
    }

    /**
     * 设置阶段文本。
     */
    private setStageText(text: string) {
        if (this._disposed) return;
        this.ensureStageUI();
        if (!this._stageLabel) return;
        this._stageLabel.string = text || '';
    }

    /**
     * 更新操作按钮（准备/站起）可见性。
     */
    // private updateActionButtonsVisibility() {
    //     const visible = !this.isGameLocked();
    //     if (this.standUpButton?.node && isValid(this.standUpButton.node)) {
    //         this.standUpButton.node.active = visible;
    //         this.standUpButton.disabled = !visible;
    //         const inner = this.standUpButton.node.getChildByName('Node');
    //         if (inner && isValid(inner)) inner.active = visible;
    //     }
    //     if (this.readyButton?.node && isValid(this.readyButton.node)) {
    //         this.readyButton.node.active = visible;
    //         this.readyButton.disabled = !visible;
    //         const inner = this.readyButton.node.getChildByName('Node');
    //         if (inner && isValid(inner)) inner.active = visible;
    //     }
    // }

    /**
     * 判断游戏是否锁定（进行中或已结束）。
     */
    private isGameLocked() {
        return (
            this._gameStarted ||
            this.room?.status === RoomStatus.Playing ||
            this.room?.status === RoomStatus.Ended
        );
    }

    /**
     * 仅使用服务端下发的 seat_index / seatIndex，不把 IPlayer.index 等其它含义的 index 当作座位。
     */
    private effectiveSeatIndex(p: any): number {
        if (!p) return -1;
        const raw = p as Record<string, unknown>;
        const v = p.seatIndex ?? raw['seat_index'];
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        const n = Number(v);
        return Number.isFinite(n) ? n : -1;
    }

    /**
     * 获取当前玩家
     */
    private getCurrentPlayer() {
        const uid = userManager.user?.userId;
        if (!uid || !this.room?.players) return null;
        const hits = this.room.players.filter(p => (p.userId || p.user?.userId) === uid);
        // 多条同 userId（如未登录均为 guest）时，以列表末尾为当前会话本人（与 join 追加顺序一致）
        return hits.length ? hits[hits.length - 1] : null;
    }

    /**
     * 刷新准备按钮文本。
     */
    // private updateReadyButtonText() {
    //     if (!this.readyButton || !this.readyButton.node || !isValid(this.readyButton.node)) return;
    //     const me = this.getCurrentPlayer();
    //     const nextLabel = me?.status === 'ready' ? (i18n.t('CANCEL_READY') || '取消准备') : (i18n.t('READY') || '准备');
    //     this.readyButton.label = nextLabel;
    //     const labelNode = this.readyButton.node.getChildByPath('Node/Label');
    //     const label = labelNode?.getComponent(Label);
    //     if (label) label.string = nextLabel;
    // }

    /**
     * 每帧更新
     */
    update(dt: number) {
        // 当前玩家读秒不再使用本地递减，严格根据后端同步时间更新
    }

    /**
     * 组件销毁时清理所有定时器和引用。
     */
    onDestroy() {
        this._disposed = true;
        if (this._countdownRenderTimer) {
            clearInterval(this._countdownRenderTimer);
            this._countdownRenderTimer = null;
        }
        if (this._unsubscribeRoomState) this._unsubscribeRoomState();
        this._unsubscribeRoomState = undefined;
        this.clearDealtCards(false);
        this._seatPiles = [];
        this._seatRoleLabels = [];
        this._seatTimerLabels = [];
        this._seatInfoCards = [];
        // 场景卸载时节点会统一销毁，这里只做引用清理，避免重复 destroy 警告。
        this._countdownLabelNode = null;
        this._countdownLabel = null;
        this._stagePotHostNode = null;
        this._stageLabelNode = null;
        this._stageLabel = null;
        this._potLabelNode = null;
        this._potLabel = null;
        this._betActionLocked = false;
        this._lastSettlementAlertKey = '';
        if (this._leaveRenderTimer) {
            clearInterval(this._leaveRenderTimer);
            this._leaveRenderTimer = null;
        }
        // 清理当前玩家独立读秒
        this.stopSelfCountdown();
        if (this._selfCountdownLabel && isValid(this._selfCountdownLabel)) {
            this._selfCountdownLabel.destroy();
            this._selfCountdownLabel = null;
        }
    }
}
