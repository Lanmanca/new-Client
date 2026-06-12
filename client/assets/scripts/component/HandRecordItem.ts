import { userManager } from '@/manager';
import { isNullOrEmpty } from '@/utils';
import { loadRemoteSpriteFrame } from '@/utils/loadRemoteSpriteFrame';
import { _decorator, Color, Component, Label, Node, Sprite } from 'cc';
import { PokerCard } from './PokerCard';
const { ccclass, property } = _decorator;

interface HandRecordItemChild {
    nickname: Label,
    avatar: Sprite,
    pokerCard1: Node,
    pokerCard2: Node,
    pokerCard3: Node,
    pokerCard4: Node,
    pokerCard5: Node,
    pokerCard6: Node,
    pokerCard7: Node,
    totalAmount: Label,
    userLocation: Node,
    first: Node,
    second: Node,
    third: Node,
    fourth: Node
}

export interface PlayerData {
    userId: string;
    nickname: string;
    avatarUrl: string;
    holeCards: number[];
    profitLoss: number;
    bestFive?: number[];
    actions: {
        action: string;
        amount: number;
        stage: string;
    }[];
    seatRole: string;
}

@ccclass('HandRecordItem')
export class HandRecordItem extends Component {

    @property({ type: Node, tooltip: '容器节点' })
    containerNode: Node = null!;

    private getChildNodes(): HandRecordItemChild {
        const container = this.containerNode;
        return {
            nickname: container.getChildByPath('Top/nickname').getComponent(Label),
            avatar: container.getChildByPath('Middle/Avatar/avatar').getComponent(Sprite),
            pokerCard1: container.getChildByPath('Middle/Poker/StartingHand/PokerCard1'),
            pokerCard2: container.getChildByPath('Middle/Poker/StartingHand/PokerCard2'),
            pokerCard3: container.getChildByPath('Middle/Poker/FirstPublic/PokerCard3'),
            pokerCard4: container.getChildByPath('Middle/Poker/FirstPublic/PokerCard4'),
            pokerCard5: container.getChildByPath('Middle/Poker/FirstPublic/PokerCard5'),
            pokerCard6: container.getChildByPath('Middle/Poker/PokerCard6'),
            pokerCard7: container.getChildByPath('Middle/Poker/PokerCard7'),
            totalAmount: container.getChildByPath('Middle/Poker/Income/amount').getComponent(Label),
            userLocation: container.getChildByPath('PhaseOperations/UserLocation'),
            first: container.getChildByPath('PhaseOperations/First'),
            second: container.getChildByPath('PhaseOperations/Second'),
            third: container.getChildByPath('PhaseOperations/Third'),
            fourth: container.getChildByPath('PhaseOperations/Fourth')
        }
    }

    renderData(player: PlayerData, communityCards: number[]) {
        const currentUserId = userManager.getUserInfo().userId;

        const childNodes = this.getChildNodes();
        if (player.userId === currentUserId) {
            childNodes.nickname.color = new Color().fromHEX('#dece7b');
        }
        childNodes.nickname.string = player.nickname;

        this.setAvatar(player.avatarUrl);

        this.setPokerCards(player.holeCards, communityCards);
        this.setSeatRole(player.seatRole);

        if (player.profitLoss > 0) {
            childNodes.totalAmount.color = new Color().fromHEX('#00FF00');
            childNodes.totalAmount.string = '+' + player.profitLoss;
        } else {
            childNodes.totalAmount.color = new Color().fromHEX('#E43615');
            childNodes.totalAmount.string = String(player.profitLoss);
        }

        if (player.actions) {
            this.setActions(player.actions);
        }

        if (player.bestFive) {
            this.setMaskCards(player.bestFive);
        }
    }

    private setSeatRole(seatRole?: string) {
        console.log('setSeatRole', seatRole);
        const childNodes = this.getChildNodes();
        const locationLabel = childNodes.userLocation.getChildByName('location').getComponent(Label);

        if (!locationLabel) return;

        if (isNullOrEmpty(seatRole)) {
            locationLabel.destroy();
            return;
        }

        locationLabel.string = seatRole;
    }

    private setActions(actions: any[]) {
        const childNodes = this.getChildNodes();

        const nodes = [
            childNodes.first,
            childNodes.second,
            childNodes.third,
            childNodes.fourth,
        ];

        nodes.forEach(node => node.active = false);

        if (!actions || actions.length === 0) return;

        const start = Math.max(0, actions.length - nodes.length);
        const validActions = actions.slice(start);

        for (let i = 0; i < validActions.length; i++) {
            const actionData = validActions[i];
            const node = nodes[i];

            node.active = true;

            const label = node.getChildByPath('Tips/Label')!.getComponent(Label)!;
            const bg = node.getChildByPath('Tips')!.getComponent(Sprite)!;
            const amount = node.getChildByName('amount').getComponent(Label);

            const { text, color } = this.getActionStyle(actionData.action);

            label.string = text;
            bg.color = new Color().fromHEX(color);
            amount.string = String(actionData.amount);
        }
    }

    private getActionStyle(action: string): { text: string; color: string } {
        switch (action) {
            case 'post_sb':
                return { text: 'PSB', color: '#F6C344' };

            case 'post_bb':
                return { text: 'PBB', color: '#E8A23C' };

            case 'ante':
                return { text: 'ANT', color: '#D8B4FE' };

            case 'check':
                return { text: 'CK', color: '#54D5AE' };

            case 'call':
                return { text: 'C', color: '#69E255' };

            case 'raise':
                return { text: 'R', color: '#5DA9E9' };

            case 'all_in':
                return { text: 'A', color: '#E35C59' };

            case 'fold':
                return { text: 'F', color: '#B1B1B1' };

            default:
                return { text: '', color: '#FFFFFF' };
        }
    }

    private setPokerCards(handCards: number[], publicCards: number[]) {
        if (!handCards || handCards.length === 0) return;

        const childNodes = this.getChildNodes();

        if (handCards.length > 0) {
            childNodes.pokerCard1.getComponent(PokerCard).poker = handCards[0];
        }
        if (handCards.length > 1) {
            childNodes.pokerCard2.getComponent(PokerCard).poker = handCards[1];
        }

        const publicCardNodes = [
            childNodes.pokerCard3,
            childNodes.pokerCard4,
            childNodes.pokerCard5,
            childNodes.pokerCard6,
            childNodes.pokerCard7,
        ];

        for (let i = 0; i < publicCardNodes.length && i < publicCards.length; i++) {
            publicCardNodes[i].getComponent(PokerCard).poker = publicCards[i];
        }
    }

    private setMaskCards(bestFive?: number[]) {
        const childNodes = this.getChildNodes();
        const allCardNodes = [
            childNodes.pokerCard1,
            childNodes.pokerCard2,
            childNodes.pokerCard3,
            childNodes.pokerCard4,
            childNodes.pokerCard5,
            childNodes.pokerCard6,
            childNodes.pokerCard7,
        ];

        if (!bestFive || bestFive.length === 0) {
            allCardNodes.forEach(node => {
                const pokerCard = node.getComponent(PokerCard);
                if (pokerCard) {
                    pokerCard.maskActive = false;
                }
            });
            return;
        }

        allCardNodes.forEach(node => {
            const pokerCard = node.getComponent(PokerCard);
            if (pokerCard) {
                const isBestFive = bestFive.includes(pokerCard.poker);
                pokerCard.maskActive = !isBestFive;
            }
        });
    }

    private async setAvatar(avatarUrl: string) {
        const childNodes = this.getChildNodes();
        const spriteFrame = await loadRemoteSpriteFrame(avatarUrl);
        childNodes.avatar.spriteFrame = spriteFrame;
    }
}
