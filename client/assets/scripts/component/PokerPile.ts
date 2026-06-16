import { imageManager } from '@/manager';
import { noConcurrent } from '@/utils';
import { loadRemoteSpriteFrame } from '@/utils/loadRemoteSpriteFrame';
import { _decorator, Color, Component, isValid, Label, Node, Size, Sprite, tween, UITransform, Vec3 } from 'cc';
import { Button } from './Button';
import { Countdown } from './CountDown';
const { ccclass, property } = _decorator;

@ccclass('PokerPile')
export class PokerPile extends Component {
    @property({ type: Sprite, tooltip: '加入按钮图标' })
    joinBtn: Sprite = null;

    @property({ type: Sprite, tooltip: '玩家头像' })
    avatar: Sprite = null;

    @property({ type: Node, tooltip: '玩家手牌背景' })
    handPileBg: Node = null;

    @property({ type: Node, tooltip: '玩家名称' })
    nameNode: Node = null;

    @property({ type: Node, tooltip: '容器节点' })
    containerNode: Node = null;

    @property({ type: Node, tooltip: '座位名称节点' })
    seatNameNode: Node = null;

    @property({ type: Label, tooltip: '座位状态文本' })
    seatStatus: Label = null;

    @property({ type: Node, tooltip: '玩家筹码' })
    playerChip: Node = null;

    @property({ type: Countdown, tooltip: '玩家操作倒计时' })
    actionCountdown: Countdown = null;

    @property({ type: Number, tooltip: '点击缩放比例' })
    clickScale: number = 0.98;

    /**
     * 是否允许加入
     */
    allowJoin: boolean = true;

    /**
     * 加入游戏
     */
    joinGame: () => boolean | Promise<boolean> = null;
    private _avatarUrl = '';
    private _avatarLoadToken = 0;
    private _offlineOverlay: Node | null = null;

    start() {
        this.node.on(Node.EventType.TOUCH_START, this._joinGame, this);
    }

    onDestroy() {
        if (this.node && this.node.isValid) {
            this.node.off(Node.EventType.TOUCH_START, this._joinGame, this);
        }
    }

    /**
     * 加入游戏
     */
    private _joinGame = noConcurrent(async () => {
        if (!this.allowJoin) return;

        await this.playClickAnimation();

        if (this.joinGame) {
            let result = this.joinGame();
            if (result instanceof Promise) {
                result = await result;
            }

            if (!result) return;

            this.hideJoinBtn();
        }

        this.allowJoin = false;
    });

    /**
     * 隐藏加入按钮
     */
    hideJoinBtn() {
        if (this.joinBtn?.node?.isValid) {
            this.joinBtn.node.active = false;
        }
    }

    /**
     * 显示加入按钮
     */
    showJoinBtn() {
        if (this.joinBtn?.node?.isValid) {
            this.joinBtn.node.active = true;
        }
    }

    /**
     * 清除玩家头像
     */
    clearAvatar() {
        this._avatarUrl = '';
        this._avatarLoadToken++;
        if (this.avatar?.node?.isValid) {
            this.avatar.spriteFrame = null;
            this.avatar.node.active = false;
        }
    }

    /**
     * 播放点击动画
     */
    private playClickAnimation(): Promise<void> {
        const originalScale = this.node.scale.clone();
        const targetScale = new Vec3(
            originalScale.x * this.clickScale,
            originalScale.y * this.clickScale,
            originalScale.z
        );

        return new Promise(resolve => {
            tween(this.node)
                .to(Button.ANIMATION_DURATION, { scale: targetScale }, { easing: 'sineOut' })
                .to(Button.ANIMATION_DURATION, { scale: originalScale }, { easing: 'sineIn' })
                .call(() => resolve(void 0))
                .start();
        });
    }

    // 设置玩家头像
    public async setAvatar(avatar: string) {
        if (!avatar) {
            this.clearAvatar();
            return;
        }
        if (avatar === this._avatarUrl && this.avatar?.spriteFrame) return;
        this._avatarUrl = avatar;
        const loadToken = ++this._avatarLoadToken;
        try {
            const spriteFrame = await loadRemoteSpriteFrame(avatar);
            if (loadToken !== this._avatarLoadToken || avatar !== this._avatarUrl) return;
            if (!this.avatar?.node?.isValid) return;
            this.avatar.spriteFrame = spriteFrame;
            this.avatar.node.active = true;
        } catch (error) {
            console.error('图片加载失败', error);
        }
    }

    /**
     * 隐藏玩家手牌节点
     */
    public hideHandPileBg() {
        if (this.handPileBg?.isValid) {
            this.handPileBg.active = false;
        }
    }

    /**
     * 显示玩家手牌节点
     */
    public showHandPileBg() {
        if (this.handPileBg?.isValid) {
            this.handPileBg.active = true;
        }
    }

    /**
     * 显示玩家起手牌背景
     */
    public showStartingHand() {
        const spriteBg = this.handPileBg.getComponent(Sprite);
        if (spriteBg) {
            spriteBg.spriteFrame = imageManager.getIcon('startingHand');
        }
    }

    /**
     * 显示玩家底牌背景
     */
    public showHoleCards() {
        const spriteBg = this.handPileBg.getComponent(Sprite);
        if (spriteBg) {
            spriteBg.spriteFrame = imageManager.getIcon('holeCards');
        }
    }

    /**
     * 设置玩家名称
     * @param name 玩家名称
     */
    public setName(name: string) {
        const nameLabel = this.nameNode?.getChildByName('name').getComponent(Label);
        if (nameLabel) {
            nameLabel.string = name;
            nameLabel.overflow = Label.Overflow.CLAMP;
            nameLabel.enableWrapText = false;
        }
    }

    /**
     * 显示玩家筹码
     */
    public showChip() {
        if (this.playerChip?.isValid) {
            this.playerChip.active = true;
        }
    }

    /**
     * 隐藏玩家筹码
     */
    public hideChip() {
        if (this.playerChip?.isValid) {
            this.playerChip.active = false;
        }
    }

    /**
     * 隐藏座位状态
     */
    public hideSeatStatus() {
        if (this.seatStatus?.node?.isValid) {
            this.seatStatus.node.active = false;
        }
    }

    /**
     * 设置座位状态
     */
    public setSeatStatus(status: '弃牌' | '空') {
        this.seatStatus.node.active = true;
        if (status === '弃牌') {
            this.actionCountdown.node.active = false;
        }
        this.seatStatus.string = status;
    }

    /**
     * 设置座位名称（如 BTN/SB、BB 等）
     * @param name 座位名称
     */
    public setSeatName(name: string) {
        if (!this.seatNameNode?.isValid) return;
        this.seatNameNode.active = true;
        const lbl = this.seatNameNode.getChildByName('seatName')?.getComponent(Label);
        if (lbl) lbl.string = name;
    }

    /**
     * 隐藏座位名称节点
     */
    public hideSeatName() {
        if (this.seatNameNode?.isValid) {
            this.seatNameNode.active = false;
        }
    }

    /**
     * 隐藏当前玩家名称 内容节点
     * 保持 Layout 始终为 VERTICAL 不动，仅切换子节点 active。
     * Layout 会自动跳过 inactive 子节点，避免关闭再开启布局导致子节点位置漂移。
     */
    public hideContainer() {
        this.nameNode.active = false;
        this.containerNode.active = false;
    }

    /**
     * 恢复当前玩家名称 内容节点
     */
    public restoreContainer() {
        this.nameNode.active = true;
        this.containerNode.active = true;
    }

    /**
     * 开始倒计时
     * @param totalTime 总时间
     * @param remainingTime 剩余时间
     */
    public startActionCountdown(totalTime: number, remainingTime: number) {
        if (this.actionCountdown?.node?.isValid) {
            this.actionCountdown.startCountdown(totalTime, remainingTime);
        }
    }

    /**
     * 隐藏倒计时遮罩层
     */
    public hideActionCountdown() {
        if (this.actionCountdown?.node?.isValid) {
            this.actionCountdown.hide();
        }
    }

    /**
     * 显示离线遮罩（覆盖在头像上方的半透明暗色层 + "离线"文字）
     */
    public showOfflineOverlay() {
        if (!this.avatar?.node?.isValid) return;
        if (this._offlineOverlay && isValid(this._offlineOverlay)) {
            this._offlineOverlay.active = true;
            return;
        }
        const parent = this.avatar.node.parent;
        if (!parent || !isValid(parent)) return;

        const overlay = new Node('offlineOverlay');
        const ut = overlay.addComponent(UITransform);
        const avatarUt = this.avatar.node.getComponent(UITransform);
        ut.setContentSize(avatarUt ? avatarUt.contentSize : new Size(80, 80));
        ut.setAnchorPoint(0.5, 0.5);

        const sp = overlay.addComponent(Sprite);
        sp.type = Sprite.Type.SIMPLE;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = new Color(0, 0, 0, 160);

        const labelNode = new Node('offlineLabel');
        const labelUt = labelNode.addComponent(UITransform);
        labelUt.setContentSize(ut.contentSize);
        const label = labelNode.addComponent(Label);
        label.string = '离线';
        label.fontSize = 18;
        label.color = new Color(255, 255, 255, 230);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.CLAMP;
        overlay.addChild(labelNode);

        overlay.setPosition(0, 0, 1);
        parent.addChild(overlay);
        this._offlineOverlay = overlay;
    }

    /**
     * 隐藏离线遮罩
     */
    public hideOfflineOverlay() {
        if (this._offlineOverlay && isValid(this._offlineOverlay)) {
            this._offlineOverlay.active = false;
        }
    }

    /**
     * 设置玩家筹码
     * @param chip 玩家筹码
     */
    public setChip(chip: number | null) {
        if (!this.playerChip) return;
        const text = chip == null ? '' : `$${chip.toString()}`;

        // 1. 先尝试 playerChip 自身是否有 Label
        const selfLabel = this.playerChip.getComponent(Label);
        if (selfLabel) {
            selfLabel.string = text;
            return;
        }

        // 2. 遍历所有子节点，找到第一个带 Label 的
        for (const child of this.playerChip.children) {
            const label = child.getComponent(Label);
            if (label) {
                label.string = text;
                return;
            }
        }

        console.warn('[setChip] playerChip 节点上及子节点均未找到 Label 组件',
            'children:', this.playerChip.children.map(c => c.name));
    }
}