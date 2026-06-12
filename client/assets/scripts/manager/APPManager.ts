import { generateDeviceId } from '@/utils';
import { APIManager } from './APIManager';
import { stateManager } from './StateManager';

/**
 * APP 管理器
 */
export class APPManager {
    /**
     * 获取设备唯一标识
     */
    public static async getDeviceId() {
        const key = 'device_id';

        let deviceId = stateManager.getItem<string>(key);
        if (!deviceId) {
            deviceId = await generateDeviceId();
            stateManager.setItem(key, deviceId);
        }

        return deviceId;
    }

    /**
     * 获取应用版本
     */
    public static async getAppVersion() {
        return await APIManager.getAppVersion();
    }
}
