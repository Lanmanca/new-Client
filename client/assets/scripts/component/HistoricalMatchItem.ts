import { i18n, stateManager, uiManager, userManager } from '@/manager';
import { formatDuration } from '@/utils';
import { _decorator, Component, instantiate, Label, Node, Prefab, tween, Vec3 } from 'cc';
import { Button } from './Button';
import { Modal } from './Modal';
const { ccclass, property } = _decorator;

export interface HistoricalMatchChild {
    roomPlay: Label,
    chips: Label,
    time: Label,
    amount: Label
}

@ccclass('HistoricalMatchItem')
export class HistoricalMatchItem extends Component {

    @property({ type: Node, tooltip: '容器节点' })
    containerNode: Node = null!;

    @property({ type: Prefab, tooltip: '提示预制件' })
    promptModal: Prefab = null!;

    private rowData: any = null!;

    onLoad() {
        this.node.on(Node.EventType.TOUCH_END, this._onClick, this);
    }

    // 获取子节点
    private getChildNode(): HistoricalMatchChild {
        const roomPlay = this.containerNode.getChildByName('RoomPlay');
        const chips = this.containerNode.getChildByPath('Chips/chips');
        const time = this.containerNode.getChildByPath('TimeNode/time');
        const amount = this.containerNode.getChildByPath('Amount/amount');

        return {
            roomPlay: roomPlay.getComponent(Label),
            chips: chips.getComponent(Label),
            time: time.getComponent(Label),
            amount: amount.getComponent(Label)
        }
    }

    setData(data: any) {
        this.rowData = data;
        const childNode = this.getChildNode();
        const { profit_loss, small_blind, started_at, ended_at } = this.filterData(data);
        const times = formatDuration(Number(ended_at) - Number(started_at));
        childNode.roomPlay.string = i18n.t("TexasPoker");
        childNode.chips.string = `${small_blind.toString()}/${(small_blind * 2).toString()}`;
        childNode.time.string = times;
        childNode.amount.string = profit_loss > 0 ? '+' + profit_loss.toString() : profit_loss.toString();
    }

    private filterData(data: any) {
        const currentUserId = userManager.getUserInfo().userId;  // 正式环境下的用户ID

        if (!data) return null;

        // 找当前用户
        const player = data.players?.find(
            (p: any) => p.userId === currentUserId
        );

        return {
            profit_loss: player?.profitLoss ?? 0,
            small_blind: data.smallBlind,
            started_at: data.startedAtUnix,
            ended_at: data.settledAtUnix
        };
    }

    /**
     * 播放点击动画
     */
    private playClickAnimation(): Promise<void> {
        const originalScale = this.node.scale.clone();
        const targetScale = new Vec3(
            originalScale.x * 0.9,
            originalScale.y * 0.9,
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

    async _onClick() {
        await this.playClickAnimation();
        stateManager.setItem('HistoricalMatchDetail', this.rowData);
        uiManager.navigateTo({
            page: 'GameAnalysis', contentPrefab: 'GameAnalysis', btnList: [{
                icon: 'Help',
                onClick: async () => {
                    await uiManager.createModal('Modal', null, {
                        onLoad: (node) => {
                            const modal = node.getComponent(Modal);
                            const prompt = instantiate(this.promptModal);

                            if (!modal) return;

                            // 挂内容
                            modal.title = '提示';
                            modal.content = prompt;
                            modal.confirmText = '确定';
                        },
                        onConfirm: () => {
                            return true;
                        }
                    });
                }
            }]
        });
    }
}