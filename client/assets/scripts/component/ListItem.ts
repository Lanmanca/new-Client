import { APIManager, i18n, roomManager } from '@/manager';
import { IRoom, RoomStatus } from '@/types/room';
import { throttle } from '@/utils';
import { _decorator, Color, Component, Label, Node, Sprite, tween, Vec3 } from 'cc';
import { Button } from './Button';
const { ccclass, property } = _decorator;

interface RoomChildNode {
    roomTitle: Label,
    isVisual: Node,
    roomStateNode: Node,
    roomState: Label,
    roomStateIcon: Sprite,
    blind: Label,
    player: Label,
    minBuyIn: Label,
    blindText: Label,
    playerText: Label,
    buyInText: Label,
}

@ccclass('ListItem')
export class ListItem extends Component {

    @property({ type: Node, tooltip: '容器节点' })
    containerNode: Node = null!;

    onClick: () => void | Promise<void> = null!;
    private clickScale: number = 0.9;

    private childNodes: RoomChildNode = null;
    private currentRoomPlayer: number = 0;
    private roomPlayers: number = 0;
    private roomNumber: string = '';

    public init() {
        if (!this.childNodes) {
            this.childNodes = this.getChildNode();
            this.childNodes.blindText.string = i18n.t('pages.home.room_list.blinds');
            this.childNodes.playerText.string = i18n.t('pages.home.room_list.players');
            this.childNodes.buyInText.string = i18n.t('pages.home.room_list.Min Buy-In');
        }
    }

    onLoad() {
        this.node.on(Node.EventType.TOUCH_END, this._onClick, this);
    }

    private getChildNode(): RoomChildNode {
        return {
            roomTitle: this.containerNode.getChildByPath('Top/RoomTitle/title').getComponent(Label),
            isVisual: this.containerNode.getChildByPath('Top/isVisual'),
            roomStateNode: this.containerNode.getChildByPath('Top/RoomState'),
            roomState: this.containerNode.getChildByPath('Top/RoomState/state').getComponent(Label),
            roomStateIcon: this.containerNode.getChildByPath('Top/RoomState/icon').getComponent(Sprite),
            blind: this.containerNode.getChildByPath('Middle/BlindAnnotation/blindAnnotation').getComponent(Label),
            player: this.containerNode.getChildByPath('Middle/Players/players').getComponent(Label),
            minBuyIn: this.containerNode.getChildByPath('Middle/LowestPurchase/lowestPurchase').getComponent(Label),
            blindText: this.containerNode.getChildByPath('Bottom/blindTitle').getComponent(Label),
            playerText: this.containerNode.getChildByPath('Bottom/playersTitle').getComponent(Label),
            buyInText: this.containerNode.getChildByPath('Bottom/lowestTitle').getComponent(Label),
        }
    }

    async setData(data: IRoom | null) {
        this.roomNumber = data.roomNumber ?? '';
        this.currentRoomPlayer = data.players.length;

        if (!data) {
            this.node.active = false;
            return;
        }

        if (!this.node || !this.node.isValid) {
            return;
        }

        this.node.active = true;

        if (!this.childNodes.roomTitle || !this.childNodes.blind || !this.childNodes.player || !this.childNodes.minBuyIn || !this.childNodes.isVisual) {
            return;
        }

        this.childNodes.roomTitle.string = data.owner ?? '';

        this.setRoomStatusStyle(data.status);

        this.childNodes.blind.string = `${data.smallBlind ?? 0}/${(data.smallBlind ?? 0) * 2}(${data.smallBlind ?? 0})`;

        this.childNodes.player.string = `${this.currentRoomPlayer}/${data.maxPlayers}`;

        this.childNodes.minBuyIn.string = `${data.minBuyIn ?? 0}`;

        this.childNodes.isVisual.active = !!data.allowWatch;

        const playerCount = data._currentPlayers ?? data.players.length;
        this.currentRoomPlayer = playerCount;
    }

    // 获取房间玩家数量
    async getRoomPlayers(roomNumber: string) {
        const res = await APIManager.getRoomPlayers(roomNumber);
        return res.data;
    }

    private setRoomStatusStyle(status: RoomStatus) {
        this.childNodes.roomState.string = i18n.t(`pages.home.room_list.room_status.${status}`);

        const bgMap = {
            [RoomStatus.Open]: '#e9f7f0',          // 淡绿色
            [RoomStatus.Playing]: '#ecf4fc',
        };

        this.childNodes.roomStateNode.getComponent(Sprite).color = new Color().fromHEX(bgMap[status]);

        this.childNodes.roomState.color = new Color().fromHEX('#04964a');
        if (this.childNodes.roomStateIcon) {
            this.childNodes.roomStateIcon.getComponent(Sprite).color = new Color().fromHEX('#04964a');
        }

        if (status === RoomStatus.Playing) {
            const color = '#447cb3';
            if (this.childNodes.roomStateIcon) {
                this.childNodes.roomStateIcon.getComponent(Sprite).color = new Color().fromHEX(color);
            }
            this.childNodes.roomState.color = new Color().fromHEX(color);
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

    // 节流处理
    private _onClick = throttle(async () => {
        await this.playClickAnimation();
        if (this.onClick) {
            const result = this.onClick();
            if (result instanceof Promise) {
                await result;
            }
        }
        if (!this.roomNumber || this.roomNumber.length !== 6) return false;

        const result = await APIManager.joinRoom(this.roomNumber);
        if (!result.status) return false;

        return await roomManager.joinRoom(result.data);
    }, 300)

    // 增加玩家数
    public addPlayer() {
        this.currentRoomPlayer++;
        this.updatePlayerLabel();
    }

    // 减少玩家数
    public reducePlayer() {
        this.currentRoomPlayer--;
        this.updatePlayerLabel();
    }

    private updatePlayerLabel() {
        this.childNodes.player.string = `${this.currentRoomPlayer}/${this.roomPlayers}`;
    }
}
