import { Currency } from '@/component/Currency';
import { Tabbar } from '@/component/Tabbar';
import { CurrencyType } from '@/types/currency';
import { Direction } from '@/types/game';
import { _decorator, Component, Node, Prefab } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('DepositController')
export class DepositController extends Component {

    @property({ type: Node, tooltip: '货币类型切换Tab节点' })
    currencyTabNode: Node = null!;

    @property({ type: Prefab, tooltip: '货币窗口预制体' })
    currencyPrefab: Prefab = null!;

    @property({ type: Node, tooltip: '货币窗口节点' })
    currencyWindowNode: Node = null!;

    private async onCurrencyClick(type: 'currency' | 'network') {
        if (type === 'currency') {
        }

        if (type === 'network') {
        }
    }

    start() {
        Currency.init(this.currencyPrefab, this.currencyWindowNode);

        this.createTabbar();

        Currency.show(CurrencyType.USDT, this.onCurrencyClick.bind(this));
    }

    createTabbar() {
        const currencyTabbar = this.currencyTabNode.getComponent(Tabbar);
        const handler = this.onCurrencyClick.bind(this);

        currencyTabbar.setData([
            {
                label: 'USDT',
                icon: 'USDT',
                iconPosition: Direction.LEFT,
                showRect: false,
                background: 'tab-bg',
                fontSize: 28,
                onClick: () => Currency.show(CurrencyType.USDT, handler)
            },
            {
                label: 'TON',
                icon: 'ton',
                iconPosition: Direction.LEFT,
                showRect: false,
                background: 'tab-bg',
                fontSize: 28,
                onClick: () => Currency.show(CurrencyType.TON, handler)
            },
            {
                label: 'Wallet',
                icon: 'Wallet',
                iconPosition: Direction.LEFT,
                showRect: false,
                background: 'tab-bg',
                fontSize: 28,
                onClick: () => Currency.show(CurrencyType.WALLET, handler)
            },
            {
                label: 'Okpay',
                icon: 'okpay',
                iconPosition: Direction.LEFT,
                showRect: false,
                background: 'tab-bg',
                fontSize: 28,
                onClick: () => Currency.show(CurrencyType.OKPAY, handler)
            }
        ]);
    }
}