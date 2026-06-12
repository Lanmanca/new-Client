import { i18n } from '@/manager/I18nManager';
import { imageManager } from '@/manager/ImageManager';
import { CurrencyType, ICurrency } from '@/types/currency';
import { _decorator, Button as CCButton, Component, instantiate, isValid, Label, Node, Prefab, Sprite, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Currency')
export class Currency extends Component {

    @property({ type: Node })
    topNode: Node = null!;

    @property({ type: Node })
    containerNode: Node = null!;

    onClick: (type: 'currency' | 'network') => void | Promise<void> = null;

    private static prefab: Prefab;
    private static container: Node;
    private static instance: Currency | null = null;

    static init(prefab: Prefab, container: Node) {
        this.prefab = prefab;
        this.container = container;
    }

    static show(
        type: CurrencyType,
        onClick?: (type: 'currency' | 'network') => void | Promise<void>
    ) {
        if (!this.prefab || !this.container) {
            console.error('Currency 未初始化');
            return;
        }

        if (!this.instance || !isValid(this.instance.node)) {
            const node = instantiate(this.prefab);
            this.container.addChild(node);
            this.instance = node.getComponent(Currency)!;
        }

        if (onClick) {
            this.instance.onClick = onClick;
        }

        const data = this.getCurrencyData(type);
        this.instance.setData(data);
    }

    private static getCurrencyData(type: CurrencyType): ICurrency {

        const base = {
            currencyTitle: i18n.t('pages.deposit.currencyTitle') || '',
            networkTitle: i18n.t('pages.deposit.networkTitle') || '',
            addressTitle: i18n.t('pages.deposit.addressTitle') || '',
            addressQRCode: null,
        };

        switch (type) {
            case CurrencyType.USDT:
                return {
                    ...base,
                    addressCode: 'THJdo1bDNWZ56TcfAg2ai2SNg8hzDqCj3J',
                    currencyIcon: imageManager.getUIImage('USDT') || null,
                    currencyName: 'USDT',
                    networkName: 'Tron-(TRC20)',
                };

            case CurrencyType.TON:
                return {
                    ...base,
                    addressCode: 'TON_xxxxxxxxxxxxxxxxxxxxx',
                    currencyIcon: imageManager.getUIImage('ton') || null,
                    currencyName: 'TON',
                    networkName: 'Ton Blockchain',
                };

            case CurrencyType.WALLET:
                return {
                    ...base,
                    addressCode: 'USER_WALLET_ID',
                    currencyIcon: imageManager.getUIImage('TON') || null,
                    currencyName: 'TON',
                    networkName: 'Ton Blockchain',
                };

            case CurrencyType.OKPAY:
                return {
                    ...base,
                    addressCode: 'OKPAY_xxxxxxxxxxxxxxxxx',
                    currencyIcon: imageManager.getUIImage('TON') || null,
                    currencyName: 'TON',
                    networkName: 'Ton Blockchain',
                };

            default:
                throw new Error('未知的 CurrencyType');
        }
    }

    start() {
        const { currencyNode, networkNode } = this.getChildNode();

        currencyNode?.on(Node.EventType.TOUCH_END, () => this._onClick('currency'), this);
        networkNode?.on(Node.EventType.TOUCH_END, () => this._onClick('network'), this);
    }

    private getChildNode() {
        return {
            currencyTitle: this.topNode.getChildByPath('Left/leftTitle')?.getComponent(Label),
            currencyNode: this.topNode.getChildByPath('Left/Currency'),
            currencyIcon: this.topNode.getChildByPath('Left/Currency/Icon')?.getComponent(Sprite),
            currencyName: this.topNode.getChildByPath('Left/Currency/Name')?.getComponent(Label),
            networkTitle: this.topNode.getChildByPath('Right/rightTitle')?.getComponent(Label),
            networkNode: this.topNode.getChildByPath('Right/Network'),
            networkName: this.topNode.getChildByPath('Right/Network/Name')?.getComponent(Label),
            QRCodeSprite: this.containerNode.getChildByPath('Content/QRcode/QR')?.getComponent(Sprite),
            addressTitle: this.containerNode.getChildByPath('Content/Address/addressTitle')?.getComponent(Label),
            addressCode: this.containerNode.getChildByPath('Content/Address/address/addressCode')?.getComponent(Label),
            copyAddressBtn: this.containerNode.getChildByPath('Content/Address/Button')?.getComponent(CCButton),
        }
    }

    private async _onClick(type: 'currency' | 'network') {
        if (this.onClick) {
            const result = this.onClick(type);
            if (result instanceof Promise) {
                await result;
            }
        }
    }

    setData(currency: ICurrency) {
        const node = this.getChildNode();

        node.currencyTitle && (node.currencyTitle.string = currency.currencyTitle || '');
        node.networkTitle && (node.networkTitle.string = currency.networkTitle || '');
        node.addressTitle && (node.addressTitle.string = currency.addressTitle || '');
        node.addressCode && (node.addressCode.string = currency.addressCode || '');
        node.currencyName && (node.currencyName.string = currency.currencyName || '');
        node.networkName && (node.networkName.string = currency.networkName || '');

        if (node.currencyIcon && currency.currencyIcon) {
            node.currencyIcon.spriteFrame = currency.currencyIcon;
            node.currencyIcon.getComponent(UITransform)?.setContentSize(40, 40);
        }

        if (node.QRCodeSprite && currency.addressQRCode) {
            node.QRCodeSprite.spriteFrame = currency.addressQRCode;
        }
    }
}