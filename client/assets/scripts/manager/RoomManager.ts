import { IRoom } from '@/types/room';
import { i18n } from './I18nManager';
import { roomSessionService } from './RoomSessionService';
import { uiManager } from './UIManager';

/**
 * 房间管理器
 */
class RoomManager {
    private static _instance: RoomManager;
    public static get instance(): RoomManager {
        if (!this._instance) {
            this._instance = new RoomManager();
        }
        return this._instance;
    }

    public activeRoomNumber = '';

    /**
     * 加入房间
     * @param room 房间信息
     */
    public async joinRoom(room: IRoom) {
        const loading = uiManager.loading();
        const gameScene = 'Table';
        const ok = await roomSessionService.joinRoom(room);
        if (!ok) {
            await uiManager.alert({ content: i18n.t('request.error.join_room') });
            await loading.hide();
            return false;
        }
        this.activeRoomNumber = room.roomNumber;
        await loading.hide();
        return await uiManager.switchScene(gameScene);
    }

    /**
     * 离开房间
     * @param roomId 房间ID
     */
    public async leaveRoom(roomId: string) {
        if (!this.activeRoomNumber || this.activeRoomNumber !== roomId) {
            await uiManager.alert({ content: i18n.t('game.room.not_found') });
            return true;
        }
        await roomSessionService.leaveRoom();
        this.activeRoomNumber = '';
        return await uiManager.switchScene('MainUI');
    }

    /**
     * 关闭并清理房间
     * @param roomId 房间ID
     */
    public async exitRoom(roomId: string) {
        if (this.activeRoomNumber === roomId) {
            roomSessionService.dispose();
            this.activeRoomNumber = '';
        }
    }
}

/**
 * 房间管理器
 */
export const roomManager = RoomManager.instance;