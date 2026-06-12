import { IPageRequest, IPageResponse } from '@/types/http';
import { IPlayer } from '@/types/player';
import { IGameHistory, IRoom, IRoomOwner, IRoomSettings } from '@/types/room';
import { IUser } from '@/types/user';
import { Http } from '@/utils/Http';
import { stateManager } from './StateManager';

/**
 * API管理器
 */
export class APIManager {
    /**
     * 获取应用版本
     */
    public static async getAppVersion() {
        const key = 'app_version';

        let appVersion = stateManager.getItem<string>(key);

        if (!appVersion) {
            const res = await Http.instance.get<{ appVersion: string }>('/game-api/open/app_version');
            stateManager.setItem(key, res.data.appVersion);
            appVersion = res.data?.appVersion;
        }

        return appVersion;
    }

    /**
     * 注册
     */
    public static async register(userId: string) {
        return Http.instance.post<IUser>('/game-api/user/register', { userId }, { encrypt: true });
    }

    /**
     * 登录
     */
    public static async login() {
        return Http.instance.post<IUser>('/game-api/user/login', null, { encrypt: true });
    }

    /**
     * Telegram WebApp 登录
     */
    public static async loginTelegram(initData: string) {
        return Http.instance.post<IUser>(
            '/game-api/user/login_telegram',
            { initData },
            { encrypt: true }
        );
    }

    /**
     * 创建房间
     */
    public static createRoom(roomSettings: IRoomSettings) {
        return Http.instance.post<IRoom>('/game-api/game/create_room', roomSettings, { encrypt: true });
    }

    /**
     * 加入房间
     */
    public static joinRoom(roomNumber: string) {
        return Http.instance.post<IRoom>('/game-api/game/join_room', { roomNumber }, { encrypt: true });
    }

    /**
     * 获取房间状态
     */
    public static getRoomState(roomNumber: string) {
        return Http.instance.post<IRoom>('/game-api/game/get_room_state', { roomNumber }, { encrypt: true });
    }

    /**
     * 获取房主信息
     */
    public static getRoomOwner(roomNumber: string) {
        return Http.instance.post<IRoomOwner>(
            '/game-api/game/get_room_owner',
            { roomNumber },
            { encrypt: true }
        );
    }

    /** 获取公开房间列表 */
    public static getRoomList(pageRequest: IPageRequest) {
        return Http.instance.post<IPageResponse<IRoom>>('/game-api/game/get_room_list', pageRequest, {
            encrypt: true,
        });
    }

    /**
     * 获取加入的房间列表
     */
    public static getOvertRoomList(pageRequest: IPageRequest) {
        return Http.instance.post<IPageResponse<IRoom>>('/game-api/game/get_my_room_list', pageRequest, {
            encrypt: true
        });
    }

    /** 获取当前用户已加入房间列表 */
    public static getMyRoomList(pageRequest: IPageRequest) {
        return Http.instance.post<IPageResponse<IRoom>>('/game-api/game/get_my_room_list', pageRequest, {
            encrypt: true,
        });
    }

    /** 获取当前用户参与过的对局历史 */
    public static getGameHistory(pageRequest: IPageRequest) {
        return Http.instance.post<IPageResponse<IGameHistory>>('/game-api/game/get_game_history', pageRequest, {
            encrypt: true,
        });
    }

    /**
     * 获取房间玩家
     */
    public static async getRoomPlayers(roomNumber: string) {
        return Http.instance.post<IPlayer[]>(
            '/game-api/game/get_room_players',
            { roomNumber },
            { encrypt: true }
        );
    }

    /** 房主解散房间（房间仍保留在列表中直至调用此接口） */
    public static dissolveRoom(roomNumber: string) {
        return Http.instance.post<{ roomNumber: string }>(
            '/game-api/game/dissolve_room',
            { roomNumber },
            { encrypt: true }
        );
    }
}
