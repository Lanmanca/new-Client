export interface IUser {
    /**
     * 用户ID
     */
    userId: string;
    /**
     * 设备ID
     */
    deviceId: string;
    /**
     * 昵称
     */
    nickname: string;
    /**
     * 头像URL
     */
    avatarUrl: string;
    /**
     * 等级
     */
    level: number;
    /**
     * 钱包
     */
    wallet: number;
}
