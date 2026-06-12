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