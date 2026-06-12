import { imageManager, stateManager, uiManager } from '@/manager';
import { ITradeDetails } from '@/types/tradeDetails';
import { _decorator, Component, Label, Node, Sprite } from 'cc';
const { ccclass, property } = _decorator;

export interface TradeChild {
    tradeIcon: Sprite,
    tradeTitle: Label,
    tradeTime: Label,
    tradeAmountNode: Node,
    tradeHash: Label,
}

@ccclass('Trade')
export class Trade extends Component {

    @property({ type: Node, tooltip: '交易容器节点' })
    tradeContainerNode: Node = null!;

    currentTrade: ITradeDetails = null!;

    start() {
        this.node.on(Node.EventType.TOUCH_END, this._onClick, this);
    }

    private getTradeChild(): TradeChild {
        const tradeIcon = this.tradeContainerNode.getChildByPath('tarde-currency/Icon').getComponent(Sprite);
        const tradeTitle = this.tradeContainerNode.getChildByPath('MessageNode/tarde-title').getComponent(Label);
        const tradeTime = this.tradeContainerNode.getChildByPath('MessageNode/tarde-time').getComponent(Label);
        const tradeAmountNode = this.tradeContainerNode.getChildByPath('CurrencyNode/AmountNode');
        const tradeHash = this.tradeContainerNode.getChildByPath('CurrencyNode/Hash').getComponent(Label);

        return {
            tradeIcon,
            tradeTitle,
            tradeTime,
            tradeAmountNode,
            tradeHash
        }
    }

    setData(data: ITradeDetails) {
        const { tradeIcon, tradeTitle, tradeTime, tradeAmountNode, tradeHash } = this.getTradeChild();
        this.currentTrade = data;
        // 这里可以调用是否为空的方法  isNullOrEmpty()
        tradeIcon.spriteFrame = imageManager.getUIImage(data.icon);
        tradeTime.string = data.time;
        tradeHash.string = data.txid.slice(0, 8) + '...' + data.txid.slice(-6);
        tradeTitle.string = data.currency;
        if (data.results.includes('成功')) {
            tradeAmountNode.getChildByName('status').getChildByName('success').active = true;
        } else {
            tradeAmountNode.getChildByName('status').getChildByName('success').active = false;
            tradeAmountNode.getChildByName('status').getChildByName('fail').active = true;
        }
    }

    private _onClick() {
        stateManager.setItem('currentTrade', this.currentTrade);
        uiManager.navigateTo({ page: 'TradeDetails' });
    }
}