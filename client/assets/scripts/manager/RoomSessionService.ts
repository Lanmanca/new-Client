import { EventType, MessageType, ResponseMessage } from '@/types/message';
import { IPlayer } from '@/types/player';
import { IRoom, IRoomOwner } from '@/types/room';
import { transformKeysToCamel } from '@/utils';
import WebSocketClient from '@/utils/WebSocketClient';
import { APIManager } from './APIManager';
import { roomSessionStore } from './RoomSessionStore';

class RoomSessionService {

    private conn: WebSocketClient | null = null;
    private roomId = '';
    private joining = false;
    private sessionVersion = 0;

    async joinRoom(room: IRoom): Promise<boolean> {
        if (this.joining) return false;
        this.joining = true;
        const version = ++this.sessionVersion;
        try {
            this.cleanupConnectionOnly();
            roomSessionStore.patch({
                type: 'sync',
                room: null,
                owner: null,
                players: [],
                lastSyncAt: null,
                connectionState: 'connecting',
            });

            // 先调用 joinRoom 通知后端恢复玩家在线状态（游戏进行中退出后重进的关键步骤）；
            // 若后端未找到该玩家（如首次进入尚未加入），再降级为 getRoomState 仅获取快照。
            let roomStateResp = await APIManager.joinRoom(room.roomNumber);
            if (!roomStateResp.status || !roomStateResp.data) {
                roomStateResp = await APIManager.getRoomState(room.roomNumber);
            }
            if (!roomStateResp.status || !roomStateResp.data) {
                roomSessionStore.patch({
                    type: 'sync',
                    room: null,
                    owner: null,
                    players: [],
                    lastSyncAt: null,
                    connectionState: 'disconnected',
                });
                return false;
            }
            const normalized = roomStateResp.data;
            this.roomId = normalized.roomNumber;
            roomSessionStore.patch({
                type: 'sync',
                room: normalized,
                owner: null,
                players: normalized.players || [],
                connectionState: 'connecting',
                lastSyncAt: Date.now(),
            });

            this.conn = new WebSocketClient(this.roomId);
            this.conn.onMessage = message => this.onMessage(message, version);  // 主要看这里，刚刚走到这里了
            this.conn.onDisconnect = () => {
                if (version !== this.sessionVersion) return;
                roomSessionStore.patch({
                    type: 'sync',
                    room: null,
                    owner: null,
                    players: [],
                    lastSyncAt: null,
                    connectionState: 'disconnected',
                });
            };
            // 房态增量由服务端 WS 推送（含连接建立后立刻下发的一份快照），此处不再用 HTTP 补拉。

            const ok = await this.conn.connect();
            if (version !== this.sessionVersion) return false;
            roomSessionStore.patch({
                type: 'sync',
                room: null,
                owner: null,
                players: [],
                lastSyncAt: null,
                connectionState: ok ? 'connected' : 'disconnected',
            });
            return ok;
        } finally {
            this.joining = false;
        }
    }

    async leaveRoom(): Promise<void> {
        try {
            if (this.conn) {
                await this.conn.sendEvent({ event: EventType.Leave });
            }
        } catch (error) {
            console.warn('[RoomSessionService] leave room event failed, disposing local session.', error);
        } finally {
            this.dispose();
        }
    }

    async sitDown(index: number, buyIn: number): Promise<boolean> {
        if (!this.conn) return false;
        const resp = await this.conn.send({
            type: MessageType.Event,
            event: EventType.SitDown,
            data: { index, buy_in: buyIn },
        });
        return !!resp?.status;
    }

    async standUp(): Promise<boolean> {
        if (!this.conn) return false;
        const resp = await this.conn.send({ type: MessageType.Event, event: EventType.StandUp });
        return !!resp?.status;
    }

    async ready(): Promise<{ ok: boolean; message?: string }> {
        if (!this.conn) return { ok: false };
        const resp = await this.conn.send({ type: MessageType.Event, event: EventType.Ready });
        return { ok: !!resp?.status, message: resp?.message };
    }

    async cancelReady(): Promise<boolean> {
        if (!this.conn) return false;
        const resp = await this.conn.send({ type: MessageType.Event, event: EventType.CancelReady });
        return !!resp?.status;
    }

    async startGame(): Promise<boolean> {
        if (!this.conn) return false;
        const resp = await this.conn.send({ type: MessageType.Event, event: EventType.StartGame });
        return !!resp?.status;
    }

    /** 对局内行动：fold / call / check / raise / all_in（raise 时 amount 为本街目标总下注额，服务端校验） */
    async sendTableAction(
        kind: 'fold' | 'call' | 'check' | 'raise' | 'all_in' | 'show_down',
        amount = 0
    ): Promise<{ ok: boolean; message?: string }> {
        if (!this.conn) return { ok: false };
        const resp = await this.conn.send({
            type: MessageType.Event,
            event: EventType.Action,
            data: { kind, amount },
        });
        return { ok: !!resp?.status, message: resp?.message };
    }

    async getOwner(): Promise<IRoomOwner | null> {
        const roomNumber = roomSessionStore.roomSnapshot?.roomNumber;
        if (!roomNumber) return null;
        const res = await APIManager.getRoomOwner(roomNumber);
        if (!res.status || !res.data) return null;
        roomSessionStore.patch({
            type: 'sync',
            owner: res.data,
        });
        return res.data;
    }

    async getPlayers(): Promise<IPlayer[] | null> {
        const roomNumber = roomSessionStore.roomSnapshot?.roomNumber;
        if (!roomNumber) return null;
        const res = await APIManager.getRoomPlayers(roomNumber);
        if (!res.status || !res.data) return null;
        roomSessionStore.patch({
            type: 'sync',
            players: res.data,
        });
        return res.data;
    }

    /** 同步房间状态（HTTP） */
    async syncRoomState(): Promise<IRoom | null> {
        const roomNumber = roomSessionStore.roomSnapshot?.roomNumber;
        if (!roomNumber) return null;
        const res = await APIManager.getRoomState(roomNumber);
        if (!res.status || !res.data) return null;
        roomSessionStore.patch({
            type: 'sync',
            room: res.data,
            players: res.data.players || [],
            lastSyncAt: Date.now(),
        });
        return res.data;
    }

    /** 房主解散当前房间（HTTP）；成功后应离开场景并 dispose 会话 */
    async dissolveRoom(): Promise<boolean> {
        const roomNumber = roomSessionStore.roomSnapshot?.roomNumber;
        if (!roomNumber) return false;
        const res = await APIManager.dissolveRoom(roomNumber);
        return !!res?.status;
    }

    dispose() {
        this.sessionVersion++;
        this.cleanupConnectionOnly();
        this.roomId = '';
        this.joining = false;
        roomSessionStore.reset();
    }

    private cleanupConnectionOnly() {
        if (this.conn) {
            this.conn.onMessage = undefined;
            this.conn.onDisconnect = undefined;
            this.conn.close();
            this.conn = null;
        }
        this.roomId = '';
    }

    private onMessage(message: ResponseMessage, version: number) {
        if (version !== this.sessionVersion) return;
        if (message.type !== MessageType.Event) return;

        switch (message.event) {
            case EventType.RoomStateSync: {
                const roomState = message.data?.roomState || message.data?.room_state;
                if (!roomState) return;
                const normalizedRoom = transformKeysToCamel(roomState) as IRoom;
                roomSessionStore.patch({
                    type: 'sync',
                    room: normalizedRoom,
                    lastSyncAt: Date.now(),
                });
                break;
            }
            case EventType.Leave: {
                const data = message.data || {};
                if (data.seat_index !== undefined && data.seat_index !== null && data.role === 'player') {
                    roomSessionStore.patch({ type: 'leave', role: data.role, seat_index: data.seat_index, user_id: data.user_id });
                }
                break;
            }
            case EventType.Prepare: {
                // 房间坐满事件
                const dealerSeatIndex = message.data?.dealer_seat_index || -1;
                const seatName = message.data?.seat_roles || [];
                roomSessionStore.patch({ type: 'prepare', prepare: true, dealerSeatIndex, seatName });
                break;
            }
            case EventType.GameOver: {
                // 游戏结束事件
                console.log("触发游戏结束事件", message);
                roomSessionStore.patch({ type: 'gameover', ...message.data });
                break;
            }
            case EventType.Recover: {
                // 游戏进行中重连恢复事件：用遮罩后的房态同步 store，并附带玩家自身信息
                const d = message.data || {};
                const rawRoomState = d.room_state || d.roomState;
                const normalizedRoom = rawRoomState
                    ? transformKeysToCamel(rawRoomState) as IRoom
                    : undefined;
                roomSessionStore.patch({
                    type: 'recover',
                    seat_index: d.seat_index,
                    cards: d.cards,
                    wallet: d.wallet,
                    current_bet: d.current_bet,
                    folded: d.folded,
                    all_in_hand: d.all_in_hand,
                    room_state: normalizedRoom,
                });
                break;
            }
            case EventType.Showdown: {
                // 摊牌亮牌事件：所有未弃牌玩家的手牌公开
                const sdData = message.data || {};
                const sdPlayers = sdData.players || sdData.Players || [];
                roomSessionStore.patch({
                    type: 'showdown',
                    players: sdPlayers,
                });
                break;
            }
        }
    }
}

export const roomSessionService = new RoomSessionService();
