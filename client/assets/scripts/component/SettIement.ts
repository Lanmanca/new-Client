import { i18n } from '@/manager';
import { loadRemoteSpriteFrame } from '@/utils/loadRemoteSpriteFrame';
import {
    _decorator,
    Component,
    instantiate,
    Label,
    Node,
    Sprite,
} from 'cc';
import { PokerCard } from './PokerCard';

const { ccclass, property } = _decorator;

@ccclass('SettIement')
export class SettIement extends Component {
    @property({ type: Label, tooltip: '总底池标题' })
    totalPotLabel: Label = null;

    @property({ type: Label, tooltip: '总底池值' })
    totalPot: Label = null;

    @property({ type: Node, tooltip: '内容节点' })
    content: Node = null;

    @property({ type: Node, tooltip: '赢家模板节点' })
    container: Node = null;

    @property({ type: Label, tooltip: '主池派奖文本' })
    potPayoutsText: Label = null;

    @property({ type: Label, tooltip: '主池派奖金额' })
    potPayouts: Label = null;

    @property({ type: Label, tooltip: '房主抽佣文本' })
    rakeText: Label = null;

    @property({ type: Label, tooltip: '房主抽佣金额' })
    rake: Label = null;

    public init(data: any) {
        console.log("预制件中接收的data", data);
        if (!data) return;

        const winners = data.winners || [];

        this.totalPotLabel.string = i18n.t('settlement.total_pot');
        this.totalPot.string = (data.pot_total ?? 0).toString();

        this.potPayoutsText.string = i18n.t('settlement.pot_payouts');
        this.potPayouts.string = winners[0]?.amount?.toString() ?? '0';

        this.rakeText.string = i18n.t('settlement.rake');
        this.rake.string = (data.rake ?? 0).toString();

        if (!winners.length) return;

        // 第一个赢家直接使用模板节点
        this.updateWinnerItem(this.container, winners[0]);

        // 多余赢家复制模板节点
        for (let i = 1; i < winners.length; i++) {
            const clone = instantiate(this.container);

            clone.name = `container${i + 1}`;

            clone.parent = this.content;

            this.updateWinnerItem(clone, winners[i]);
        }
    }

    /**
     * 更新赢家信息
     */
    private updateWinnerItem(container: Node, winner: any) {
        const winnerName = container
            .getChildByPath('Container/name')
            .getComponent(Label);

        const winnerAmount = container
            .getChildByPath('WinPoker/winAmount')
            .getComponent(Label);

        winnerName.string = winner.nickname ?? '';

        winnerAmount.string = `+${winner.amount?.toString()}`;

        const bestFive = winner.best_five ?? [];
        for (let i = 0; i < 5; i++) {
            const pokerNode = container.getChildByPath(
                `WinPoker/Poker/PokerCard${i + 1}`
            );
            const pokerComponent = pokerNode.getComponent(PokerCard);
            pokerComponent.poker = bestFive[i] ?? 0;
        }

        this.setAvatar(container, winner.avatar);
    }

    /**
     * 设置头像
     */
    private async setAvatar(
        container: Node,
        avatarUrl: string
    ) {
        try {
            const spriteFrame =
                await loadRemoteSpriteFrame(avatarUrl);

            const avatar = container
                .getChildByPath('Avatar')
                .getComponent(Sprite);

            avatar.spriteFrame = spriteFrame;
        } catch (error) {
            console.error('图片加载失败', error);
        }
    }
}