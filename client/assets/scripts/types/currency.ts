import { SpriteFrame } from "cc";

export enum CurrencyType {
    USDT = 'USDT',
    TON = 'TON',
    WALLET = 'WALLET',
    OKPAY = 'OKPAY',
}

export interface ICurrency {
    /**
     * 货币标题
     */
    currencyTitle: string;
    /**
     * 网络标题
     */
    networkTitle: string;
    /**
     * 地址标题
     */
    addressTitle: string;
    /**
     * 地址二维码
     */
    addressQRCode: SpriteFrame;
    /**
     * 地址
     */
    addressCode: string;
    /**
     * 货币图标
     */
    currencyIcon: SpriteFrame;
    /**
     * 货币名称
     */
    currencyName: string;
    /**
     * 网络名称
     */
    networkName: string;
}
