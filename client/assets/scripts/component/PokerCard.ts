import { PokerFactory } from '@/factory/PokerFactory';
import Log from '@/utils/Log';
import { _decorator, Component, Sprite } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('PokerCard')
export class PokerCard extends Component {
    @property({ type: Sprite, tooltip: '扑克牌边框' })
    border: Sprite = null;

    @property({ type: Sprite, tooltip: '扑克牌背景' })
    background: Sprite = null;

    @property({ type: Sprite, tooltip: '扑克牌正面背景' })
    front: Sprite = null;

    @property({ type: Sprite, tooltip: '扑克牌点数' })
    number: Sprite = null;

    @property({ type: Sprite, tooltip: '扑克牌小花色' })
    smallSuit: Sprite = null;

    @property({ type: Sprite, tooltip: '扑克牌花色' })
    suit: Sprite = null;

    @property({ type: Sprite, tooltip: '遮罩' })
    mask: Sprite = null;

    @property({
        type: Number,
        tooltip: '扑克牌点数（101-113: 黑桃, 201-213: 红桃, 301-313: 梅花, 401-413: 方块）',
    })

    private _poker: number = 0;
    private _maskActive: boolean = false;

    get maskActive(): boolean {
        return this._maskActive;
    }

    set maskActive(value: boolean) {
        this._maskActive = value;
        // 如果mask存在，立即更新显示
        if (this.mask && this.mask.node) {
            this.mask.node.active = value;
        }
    }

    set poker(value: number) {
        this._poker = value;
        // 如果组件已经初始化过，立即更新显示
        if (this.initialized) {
            this.initialize();
        }
    }

    get poker(): number {
        return this._poker;
    }

    private initialized: boolean = false;

    // 初始化完成回调
    public onInitialized: (() => void) | null = null;

    // 底部的点数，自动复制number显示
    _numberBottom: Sprite = null;


    start() {
        this.initialize();
        this.initialized = true;
    }

    async initialize() {
        // 遮罩
        this.mask.node.active = this.maskActive;

        this.background.node.active = true;
        this.front.node.active = false;
        this.border.node.active = false;
        this.number.node.active = false;
        this.smallSuit.node.active = false;
        this.suit.node.active = false;

        if (this.poker === 0) {
            this.background.spriteFrame = PokerFactory.pokerBack;
        } else {
            const poker = PokerFactory.getPoker(this.poker);
            if (poker) {
                this.background.spriteFrame = poker;
            } else {
                Log.w('PokerCard', `无效的扑克牌点数: ${this.poker}`);
            }
        }

        // 初始化完成，调用回调
        if (this.onInitialized) {
            this.onInitialized();
        }

        // 将遮罩节点设置到最后一层（确保遮罩在最上面）
        if (this.mask && this.mask.node) {
            this.mask.node.setSiblingIndex(Number.MAX_VALUE);
        }
    }
}
