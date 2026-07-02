import { Response } from './http';

/**
 * 消息类型
 */
export enum MessageType {
    /**
     * 通知消息
     */
    Notice = 'notice',
    /**
     * 事件消息
     */
    Event = 'event',
    /**
     * 聊天消息
     */
    Chat = 'chat',
}

export interface BaseMessage {
    /**
     * 消息ID
     */
    id: string;
    /**
     * 消息类型
     */
    type: MessageType;
    /**
     * 用户ID
     */
    user_id: string;
    /**
     * 设备ID
     */
    device_id: string; // 设备ID
    /**
     * 时间戳
     */
    timestamp: number; // 时间戳
    /**
     * 是否为流式数据
     */
    stream?: boolean;
    /**
     * 是否结束，用于流式数据
     */
    end?: boolean;
}

/**
 * 通知消息
 */
export interface NoticeMessage extends BaseMessage {
    type: MessageType.Notice;
    /**
     * 消息内容
     */
    content: string;
}

/**
 * 事件类型
 */
export enum EventType {
    /**
     * 玩家坐下
     */
    SitDown = 'sit_down',
    /**
     * 玩家站起
     */
    StandUp = 'stand_up',
    /**
     * 玩家离开
     */
    Leave = 'leave',
    /**
     * 玩家准备
     */
    Ready = 'ready',
    /**
     * 房间坐满
     */
    Prepare = 'prepare',
    /**
     * 取消准备
     */
    CancelReady = 'cancel_ready',
    /**
     * 开始游戏
     */
    StartGame = 'start_game',
    /**
     * 游戏结束
     */
    GameOver = 'gameover',
    /**
     * 房态同步
     */
    RoomStateSync = 'room_state_sync',
    /**
     * 下注动作
     */
    Action = 'action',
    /**
     * 游戏进行中重连恢复
     */
    Recover = 'recover',
    /**
     * 摊牌亮牌
     */
    Showdown = 'showdown',
}

/**
 * 事件消息
 */
export interface EventMessage {
    type: MessageType.Event;
    /**
     * 事件内容
     */
    event: EventType;
    /**
     * 事件参数
     */
    data?: Record<string, any>;
}

export enum ChatMessageType {
    /**
     * 系统通知
     */
    Notice = 'notice',
    /**
     * 用户消息
     */
    User = 'user',
}

/**
 * 聊天消息
 */
export interface ChatMessage {
    type: MessageType.Chat;
    /**
     * 消息类型
     */
    message_type: ChatMessageType;
    /**
     * 聊天内容
     */
    content: string;
    /**
     * 提及的用户ID
     */
    at?: string[];
}

/**
 * 发送消息
 */
export type Message = EventMessage | ChatMessage;

/**
 * 请求消息
 */
export type RequestMessage = Message & BaseMessage;

/**
 * 响应消息
 */
export type ResponseMessage<T = any> = (NoticeMessage | Message) &
    BaseMessage &
    Omit<Response<T>, 'code' | 'data'> & { status: boolean };
