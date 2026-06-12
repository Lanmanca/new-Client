export interface ITradeDetails {
    /**
     * 交易货币图标
     */
    icon: string;
    /**
     * 交易类型
     */
    type: string;
    /**
     * 交易金额
     */
    amount: number;
    /**
     * 交易货币
     */
    currency: string;
    /**
     * 交易结果
     */
    results: string;
    /**
     * 交易时间
     */
    time: string;
    /**
     * 单号
     */
    orderNumber: string;
    /**
     * 网络
     */
    network: string;
    /**
     * 实际到账
     */
    actual: number;
    /**
     * 手续费
     */
    fee: number;
    /**
     * 地址
     */
    address: string;
    /**
     * 交易hash值
     */
    txid: string;
    /**
     * 地址名称
     */
    addressName: string;
}