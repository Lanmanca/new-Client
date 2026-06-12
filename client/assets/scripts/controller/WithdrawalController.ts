import { i18n, imageManager, uiManager } from '@/manager';
import { isNullOrEmpty } from '@/utils';
import { _decorator, Button as CCButton, Component, EditBox, Label, Node, Sprite, UITransform } from 'cc';
const { ccclass, property } = _decorator;

interface WithdrawalChild {
    back: Node,
    title: Label,
    currencyNode: Node,
    currencyText: Label,
    currencyIcon: Sprite,
    currencyName: Label,
    networkText: Label,
    networkName: Label,
    networkNode: Node,
    addressText: Label,
    addressEditBox: EditBox,
    amountText: Label,
    amountEditBox: EditBox,
    setPasswordText: Label,
    setPasswordEditBox: EditBox,
    amountReceived: Label,  // 后面 + 货币名称
    handlingFee: Label,     // 后面 + 货币名称
    confirmButton: CCButton,
}

@ccclass('WithdrawalController')
export class WithdrawalController extends Component {

    @property({ type: Node, tooltip: '容器节点' })
    containerNode: Node = null!;

    private childNodes: WithdrawalChild = null!;
    private feeRate: number = 0.02;  // 手续费 2%

    start() {
        this.childNodes = this.getChildNode();
        this.childNodes.back.on(Node.EventType.TOUCH_END, this.back, this);
        this.childNodes.currencyNode.on(Node.EventType.TOUCH_END, this.selectCurrency, this);
        this.childNodes.networkNode.on(Node.EventType.TOUCH_END, this.selectNetwork, this);
        this.childNodes.confirmButton.node.on(Node.EventType.TOUCH_END, this.confirm, this);
        this.childNodes.amountEditBox.node.on('text-changed', this.onAmountChanged, this);

        this.init();
    }

    private getChildNode(): WithdrawalChild {
        const container = this.containerNode;
        return {
            back: container.getChildByPath('Top/Back'),
            title: container.getChildByPath('Top/title').getComponent(Label),
            currencyNode: container.getChildByPath('window/Currency/selectCurrency'),
            currencyText: container.getChildByPath('window/Currency/textTitle').getComponent(Label),
            currencyIcon: container.getChildByPath('window/Currency/selectCurrency/Icon').getComponent(Sprite),
            currencyName: container.getChildByPath('window/Currency/selectCurrency/Label').getComponent(Label),
            networkText: container.getChildByPath('window/Container/Content/textTitle').getComponent(Label),
            networkNode: container.getChildByPath('window/Container/Content/selectNetwork'),
            networkName: container.getChildByPath('window/Container/Content/selectNetwork/Label').getComponent(Label),
            addressText: container.getChildByPath('window/Container/Content/Address/textTitle').getComponent(Label),
            addressEditBox: container.getChildByPath('window/Container/Content/Address/Node/address').getComponent(EditBox),
            amountText: container.getChildByPath('window/Container/Content/WithdrawalAmount/textTitle').getComponent(Label),
            amountEditBox: container.getChildByPath('window/Container/Content/WithdrawalAmount/Node/amount').getComponent(EditBox),
            setPasswordText: container.getChildByPath('window/Container/Content/SetPassword/textTitle').getComponent(Label),
            setPasswordEditBox: container.getChildByPath('window/Container/Content/SetPassword/Node/password').getComponent(EditBox),
            amountReceived: container.getChildByPath('window/Container/Content/Amount/AmountReceived/amountReceived').getComponent(Label),   // 实际到账 后面 + 货币名称
            handlingFee: container.getChildByPath('window/Container/Content/Amount/HandlingFee/handlingfee').getComponent(Label),   // 手续费 后面 + 货币名称
            confirmButton: container.getChildByPath('window/Bottom/Button').getComponent(CCButton),
        }
    }

    init() {
        this.childNodes.title.string = i18n.t('pages.withdrawal.title');
        this.childNodes.currencyText.string = i18n.t('pages.withdrawal.currencyText');
        this.childNodes.currencyIcon.spriteFrame = imageManager.getUIImage('USDT');
        this.childNodes.currencyIcon.getComponent(UITransform).setContentSize(50, 50);
        this.childNodes.currencyName.string = 'USDT';
        this.childNodes.networkText.string = i18n.t('pages.withdrawal.networkText');
        this.childNodes.networkName.string = 'Tron-(TRC20)';
        this.childNodes.addressText.string = i18n.t('pages.withdrawal.addressText');
        this.childNodes.amountText.string = i18n.t('pages.withdrawal.amountText');
    }

    private back() {
        uiManager.navigateBack();
    }

    private selectCurrency() {
    }

    private selectNetwork() {
    }

    private confirm() {
        const address = this.childNodes.addressEditBox.string;
        const amount = this.childNodes.amountEditBox.string;
        const password = this.childNodes.setPasswordEditBox.string;
    }

    private onAmountChanged(editBox: EditBox) {
        const input = editBox.string;
        if (!isNullOrEmpty(input)) {
            this.childNodes.amountReceived.string = (parseInt(input) * (1 - this.feeRate)).toFixed(2);
            this.childNodes.handlingFee.string = (parseInt(input) * this.feeRate).toFixed(2);
        } else {
            this.childNodes.amountReceived.string = '0.00';
            this.childNodes.handlingFee.string = '0.00';
        }
    }
}