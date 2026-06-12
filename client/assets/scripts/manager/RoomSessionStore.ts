import { IPlayer } from '@/types/player';
import { IRoom, IRoomOwner } from '@/types/room';

export type RoomConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected';

export interface RoomSessionState {
    type: 'sync';
    room?: IRoom | null;
    owner?: IRoomOwner | null;
    players?: IPlayer[];
    connectionState?: RoomConnectionState;
    lastSyncAt?: number;
}

export interface RoomSessionPrepare {
    type: 'prepare';
    prepare?: Boolean;
    dealerSeatIndex?: number;
    seatName?: { seat_index?: number, role?: string }[];
}

export interface leaveRoom {
    type: 'leave';
    role?: string;
    seat_index?: number;
    user_id?: string;
}

export interface GameOver {
    type: 'gameover';
    /** 本手结束类型：fold_win：有人弃牌后，最后剩余玩家直接赢池 showdown：摊牌比牌后分池 */
    kind?: 'fold_win' | 'showdown',
    /** 本手结算前的总底池金额 */
    pot_total?: number;
    /** 本手抽水金额 */
    rake?: number;
    /** 按玩家聚合后的最终派奖列表 */
    payouts?: {
        user_id?: string;
        nickname: string;
        amount?: number;
        hole_cards: number[];
    }[];
    /** 主池/边池的分层分配情况 */
    layers?: {
        /** 池子层级 0是主池 1/2/...是边池 */
        tier?: number;
        /** 该层实际可分配金额，依旧扣除对应比例抽水 */
        amount?: number;
        /** 该层池子分给了哪些玩家、各拿多少 */
        payouts?: {
            user_id?: string;
            nickname: string;
            amount?: number;
            hole_cards: number[];
        }[];
    }[];
    /** 给前端更方便展示赢家用的聚合字段 */
    winners?: {
        user_id?: string;
        nickname?: string;
        seat_index?: number;
        amount?: number;
        hole_cards?: number[];
        best_five?: number[];
        hand_category?: string;
    };
    showdown_best_hands?: {
        user_id?: string;
        nickname?: string;
        seat_index?: number;
        best_five?: number[];
        hand_category?: string;
    }[];
}

export interface RecoverSession {
    type: 'recover';
    seat_index: number;
    cards: number[];
    wallet: number;
    current_bet: number;
    folded: boolean;
    all_in_hand: boolean;
    room_state?: IRoom | null;
}

export type RoomSession = RoomSessionState | RoomSessionPrepare | leaveRoom | GameOver | RecoverSession;
export type RoomSessionSnapshot = RoomSession | null;

type Listener = (state: RoomSessionSnapshot) => void;

class RoomSessionStore {
    private state: RoomSessionSnapshot = null;
    private listeners = new Set<Listener>();

    get snapshot(): RoomSessionSnapshot {
        return this.state;
    }

    get roomSnapshot(): IRoom | null {
        return this.state?.type === 'sync' ? this.state.room || null : null;
    }

    /** 监听器 */
    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    /** 更新房间状态（部分更新） */
    patch(session: RoomSession) {
        if (session.type === 'sync' && this.state?.type === 'sync') {
            this.state = { ...this.state, ...session };
        } else {
            this.state = { ...session };
        }
        for (const l of this.listeners) l(this.state);
    }

    /** 重置房间状态 */
    reset() {
        this.state = null
        for (const l of this.listeners) l(this.state);
    }
}

export const roomSessionStore = new RoomSessionStore();
