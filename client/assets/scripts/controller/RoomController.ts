import { APIManager } from '@/manager';
import {
    BaseMessage,
    EventMessage,
    EventType,
    MessageType,
    ResponseMessage,
} from '@/types/message';
import { IPlayer } from '@/types/player';
import { IRoom, IRoomOwner } from '@/types/room';
import { transformKeysToCamel } from '@/utils';
import WebSocketClient from '@/utils/WebSocketClient';

/**
 * 房间控制器
 */
export class RoomController {
    public onRoomStateChange?: (room: IRoom) => void;
    /**
     * 房间房主
     */
    private _owner: IRoomOwner;
    /**
     * 房间玩家
     */
    private _players: IPlayer[];
    private current_player_index: number = 0; // 当前玩家索引，用于准备操作

    /**
     * @param room 房间信息
     * @param conn WebSocket连接
     */
    constructor(public room: IRoom, public conn: WebSocketClient) {
        this.conn.onMessage = this.onMessage.bind(this);
        console.log('??????????', this.conn.onMessage);
    }

    /**
     * 释放房间控制器与 UI 的绑定，避免场景销毁后被旧 ws 回调触发
     */
    public dispose() {
        this.onRoomStateChange = undefined;
        if (this.conn) {
            this.conn.onMessage = undefined;
            this.conn.onDisconnect = undefined;
        }
    }

    /**
     * 处理服务器发送消息
     * @param message 响应消息内容
     */
    private onMessage(message: ResponseMessage) {
        console.log('Received message: ', message);
        switch (message.type) {
            case MessageType.Notice:
                console.log('Notice: ', message.content, message.timestamp);
                break;
            case MessageType.Chat:
                console.log('Chat: ', message.user_id, message.timestamp, message.content);
                break;
            case MessageType.Event:
                console.log('Event: ', message.event, message.timestamp, message.data);
                this.eventHandler(message);
                break;
        }
    }

    /**
     * 处理事件消息
     */
    private eventHandler(message: EventMessage & BaseMessage) {
        switch (message.event) {
            case EventType.RoomStateSync: {
                const roomState = message.data?.roomState || message.data?.room_state;
                if (roomState) {
                    const normalizedRoom = transformKeysToCamel(roomState) as IRoom;
                    this.room = normalizedRoom;
                    this._players = (normalizedRoom.players || []) as IPlayer[];
                    const ownerPlayer = this._players.find(p => p.isOwner);
                    if (ownerPlayer) {
                        this._owner = {
                            userId: ownerPlayer.userId || ownerPlayer.user?.userId,
                            nickname:
                                ownerPlayer.nickname ||
                                ownerPlayer.user?.nickname ||
                                ownerPlayer.userId,
                            avatarUrl:
                                ownerPlayer.avatarUrl ||
                                ownerPlayer.user?.avatarUrl ||
                                '',
                        };
                    }
                    this.onRoomStateChange?.(this.room);
                }
                break;
            }
            case EventType.SitDown:
                const { index } = message.data;
                break;
            case EventType.StandUp:
                console.log('StandUp: ', message.data);
                break;
            case EventType.Ready:
                console.log('Ready: ', message.data);
                const data = message.data;
                if (data.dealer_seat_index == this.current_player_index) {
                    data.seat_roles;
                }
                break;
            case EventType.Leave:
                console.log('Leave: ', message.data);
                break;
        }
    }

    /**
     * 获取房主信息
     */
    async getOwner() {
        if (this._owner) return this._owner;
        if (!this.room?.roomNumber) return null;

        const result = await APIManager.getRoomOwner(this.room.roomNumber);
        if (!result.status) {
            return null;
        }

        this._owner = result.data;
        return this._owner;
    }

    /**
     * 获取房间玩家
     */
    async getPlayers() {
        if (!this.room?.roomNumber) return null;
        const response = await APIManager.getRoomPlayers(this.room.roomNumber);
        if (!response.status) {
            return null;
        }

        this._players = response.data;
        return response.data;
    }

    /**
     * 坐下
     */
    async sitDown(index: number, buyIn: number) {
        if (!this.room || !this.conn) return false;

        // 移除return：将坐下跟准备合并为一个事件，坐下成功后直接发送准备事件，简化用户操作流程
        if (await this.conn.sendEvent({
            event: EventType.SitDown,
            data: { index, buy_in: buyIn },
        })) {
            this.current_player_index = index;
            // return this.ready();
        }

        return false;
    }

    /**
     * 站起
     */
    async standUp() {
        if (!this.room || !this.conn) return false;

        return await this.conn.sendEvent({ event: EventType.StandUp });
    }

    /**
     * 准备
     */
    async ready() {
        if (!this.room || !this.conn) return false;

        return await this.conn.sendEvent({ event: EventType.Ready });
    }

    /**
     * 离开
     */
    async leave() {
        if (!this.room || !this.conn) return false;

        return await this.conn.sendEvent({ event: EventType.Leave });
    }
}
