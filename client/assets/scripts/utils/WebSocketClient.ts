import config from '@/config';
import { i18n, uiManager, userManager } from '@/manager';
import {
    BaseMessage,
    EventMessage,
    Message,
    MessageType,
    RequestMessage,
    ResponseMessage,
} from '@/types/message';
import { PendingPromise, Queue, WSDisconnectReason } from '@/types/websocket';
import { AESCipher } from './AESCipher';
import { generateUUID, md5, sortJSONKeysByFirstLetter } from './index';
import { tServerErrorMessage } from './serverMessage';

/**
 * 创建一个异步队列
 */
export function createAsyncQueue(): Queue {
    const queue: any[] = [];
    let pending: (value: IteratorResult<any>) => void = null;

    return {
        push(value: any) {
            if (pending) {
                pending({ value, done: false });
                pending = null;
            } else {
                queue.push(value);
            }
        },
        async *[Symbol.asyncIterator](): AsyncIterableIterator<any> {
            while (true) {
                if (queue.length > 0) {
                    yield queue.shift();
                } else {
                    const value = await new Promise<IteratorResult<any>>(resolve => {
                        pending = resolve;
                    });
                    yield value.value;
                }
            }
        },
    };
}

export default class WebSocketClient {
    private conn: WebSocket | null = null;
    private _url: string;
    private _heartbeat: number = 30000;
    private _timeout: number = 10000;
    private _pendingPromises: Record<string, PendingPromise> = {};
    private _isInitialized: boolean = false;
    // ping超时定时器
    private pingTimeout: ReturnType<typeof setTimeout>;
    // 等待pong响应的超时定时器
    private pongTimeout: ReturnType<typeof setTimeout>;
    // 连续失败次数
    private consecutiveFailures: number = 0;
    // 最大连续失败次数
    private readonly maxFailures: number = 3;

    // 重试相关属性
    private retryCount: number = 0;
    private maxRetries: number = 3;
    private retryDelay: number = 3000; // 重试延迟3秒
    private isConnecting: boolean = false;
    private shouldReconnect: boolean = false;
    /** 同一次断线可能触发 error+close，只通知一次 onDisconnect */
    private disconnectNotified: boolean = false;

    constructor(private _roomId: string) { }

    /**
     * 连接断开时的回调函数
     */
    public onDisconnect?: (reason: WSDisconnectReason, event?: string) => void;

    /**
     * 接收到消息时的回调函数
     */
    public onMessage?: (message: ResponseMessage) => void;

    /** 每次连接成功（含重连）后调用，便于拉取最新 HTTP 房态 */
    public onConnected?: () => void;

    /**
     * 初始化WebSocket连接
     */
    async initialization() {
        const userId = userManager.user.userId;
        if (!userId) return false;

        if (this._isInitialized) return true;

        this._isInitialized = true;

        this._url = `${config.WS_URL}/game-api/game/ws`;

        const appVersion = await config.APP_VERSION();
        const deviceId = await config.DEVICE_ID();

        const timestamp = Date.now();

        const params: Record<string, string | number | boolean> = {
            user_agent: `CYPokerClient/${appVersion}`,
            user_id: userId,
            room_id: this._roomId,
            device_id: deviceId,
            language: config.LANGUAGE,
            timestamp,
        };

        const sortJson = sortJSONKeysByFirstLetter(params);
        const sign = md5(sortJson);
        const newParams = { ...params, sign };

        this._url += `?${new URLSearchParams(newParams)}`;
        return true;
    }

    // @TODO 同步房间玩家
    async syncRoomPlayer() {

    }

    /**
     * 连接WebSocket
     */
    async connect(): Promise<boolean> {
        // 如果正在连接中，直接返回
        if (this.isConnecting) {
            return false;
        }

        if (!(await this.initialization())) {
            return false;
        }

        this.isConnecting = true;
        this.shouldReconnect = true;

        return new Promise<boolean>(resolve => {
            try {
                this.conn = new WebSocket(this._url);
                this.conn.binaryType = 'arraybuffer';

                this.conn.onopen = () => {
                    this.isConnecting = false;
                    this.retryCount = 0;
                    this.consecutiveFailures = 0;
                    this.disconnectNotified = false;
                    this._setupMessageHandler();
                    this.ping();
                    try {
                        this.onConnected?.();
                    } catch {
                        /* ignore */
                    }
                    resolve(true);
                };

                this.conn.onerror = error => {
                    this.handleDisconnect(WSDisconnectReason.ERROR, `${error}`);
                    resolve(false);
                };

                this.conn.onclose = (event: Event) => {
                    const ce = event as CloseEvent;
                    const code = (ce as CloseEvent)?.code ?? 0;
                    const wasClean = !!(ce as CloseEvent)?.wasClean;
                    const abnormal = !wasClean || (code !== 1000 && code !== 1001);
                    this.handleDisconnect(
                        abnormal ? WSDisconnectReason.ERROR : WSDisconnectReason.CLOSE,
                        `code=${code}`
                    );
                    resolve(false);
                };
            } catch (error) {
                this.isConnecting = false;
                this.handleDisconnect(WSDisconnectReason.ERROR, `${error}`);
                resolve(false);
            }
        });
    }

    /**
     * 处理断开连接
     */
    private handleDisconnect(reason: WSDisconnectReason, event?: string) {
        // 清理资源
        this.clearAllTimeouts();
        this.rejectAllPending(`WebSocket ${reason}`);

        // 关闭现有连接
        if (this.conn) {
            this.conn.onopen = null;
            this.conn.onmessage = null;
            this.conn.onerror = null;
            this.conn.onclose = null;

            if (
                this.conn.readyState === WebSocket.OPEN ||
                this.conn.readyState === WebSocket.CONNECTING
            ) {
                this.conn.close();
            }
            this.conn = null;
        }

        // 调用外部断开回调（去重）
        if (!this.disconnectNotified) {
            this.disconnectNotified = true;
            this.onDisconnect?.(reason, event);
        }

        // 异常断线时尝试重连（与 onerror/onclose 策略一致）
        if (reason === WSDisconnectReason.ERROR && this.shouldReconnect) {
            this.reconnect();
        }
    }

    /**
     * 重试连接
     */
    private reconnect() {
        if (this.retryCount >= this.maxRetries) {
            this.shouldReconnect = false;
            this.retryCount = 0;
            return;
        }

        this.retryCount++;

        setTimeout(async () => {
            if (!this.shouldReconnect) {
                return;
            }

            await this.connect();
        }, this.retryDelay);
    }

    /**
     * 解密消息
     * @param message 消息
     */
    private async _decryptMessage<T>(message: ArrayBuffer | string): Promise<T> {
        const deviceId = await config.DEVICE_ID();
        if (message instanceof ArrayBuffer) {
            const uint8Array = new Uint8Array(message);
            const decryptedMessage = AESCipher.decrypt(uint8Array, deviceId);
            return JSON.parse(decryptedMessage);
        } else {
            try {
                const decryptedMessage = AESCipher.decryptFromBase64(message, deviceId);
                return JSON.parse(decryptedMessage);
            } catch {
                return JSON.parse(message);
            }
        }
    }

    /**
     * 设置消息处理程序
     */
    private _setupMessageHandler() {
        if (!this.conn) return;

        this.conn.onmessage = async event => {
            try {
                // 处理PONG响应
                if (typeof event.data === 'string' && event.data === 'PONG') {
                    // 清除pong超时定时器
                    if (this.pongTimeout) {
                        clearTimeout(this.pongTimeout);
                        this.pongTimeout = null;
                    }

                    // 重置连续失败计数
                    this.consecutiveFailures = 0;

                    return;
                }

                // const decryptedMessage = await this._decryptMessage<ResponseMessage>(event.data);
                // const { id, message, extra } = decryptedMessage;   取消加密

                const decryptedMessage = JSON.parse(event.data);   // 服务器发送的消息
                const { id, message, extra } = decryptedMessage;

                const pending = id != null && id !== '' ? this._pendingPromises[id] : undefined;
                // 有 pending 时由 send 调用方统一弹窗（tServerErrorMessage），避免此处 await 阻塞 onmessage 导致重复提示与后续回包超时
                if (extra?.show && !pending) {
                    const localizedMessage = message ? tServerErrorMessage(message) : '';
                    await uiManager.alert({ content: localizedMessage || message || '' });
                }

                // 根据ID找到对应的Promise
                if (pending) {
                    if (pending.timeout) clearTimeout(pending.timeout);

                    if (decryptedMessage.stream || pending.queue) {
                        if (!pending.queue) {
                            pending.queue = createAsyncQueue();
                        }

                        pending.queue.push(decryptedMessage);

                        if (decryptedMessage.end) {
                            delete this._pendingPromises[id];
                        }

                        pending.resolve(pending.queue);
                    } else {
                        delete this._pendingPromises[id];
                        pending.resolve(decryptedMessage);
                    }
                } else {
                    // 其他通知
                    this.onMessage?.(decryptedMessage);
                }
            } catch (error) {
                await uiManager.alert({
                    content: i18n.t('request.error.unknown', { error: error.message }),
                });
            }
        };
    }

    /**
     * 拒绝所有待定的承诺
     * @param reason 拒绝的原因
     */
    private rejectAllPending(reason: string) {
        Object.values(this._pendingPromises).forEach(pending => {
            if (pending.timeout) clearTimeout(pending.timeout);
            pending.resolve({ status: false, message: reason });
        });
        this._pendingPromises = {};
    }

    /**
     * 发送事件
     */
    public async sendEvent(data: Omit<EventMessage, 'type'>) {
        const response = await this.send({ type: MessageType.Event, ...data });
        return response && response.status;
    }

    /**
     * 发送消息
     */
    public async send<T = any>(
        message: Message,
        encrypt = false,  // true
        base64 = false
    ): Promise<ResponseMessage<T>> {
        const loading = uiManager.loading();

        const baseMessage: BaseMessage = {
            id: generateUUID(),
            type: message.type,
            user_id: userManager.user.userId,
            device_id: await config.DEVICE_ID(),
            timestamp: Date.now(),
        };

        try {
            const response: ResponseMessage<T> = await new Promise(resolve => {
                this._sendWithPromise({ ...baseMessage, ...message }, { resolve, encrypt, base64 });
            });
            return response;
        } catch (error) {
            await uiManager.alert({
                content: i18n.t('request.error.unknown', { error: error.message || error }),
            });
            // @ts-ignore
            return { status: false, message: error.message || error };
        } finally {
            loading.hide();
        }
    }

    /**
     * 发送消息
     */
    async _sendWithPromise(
        message: RequestMessage,
        options: {
            resolve: (value: any) => void;
            encrypt?: boolean;
            base64?: boolean;
        }
    ) {
        const { resolve, encrypt = false, base64 = false } = options;  // encrypt 默认为 true

        try {
            // 检查连接状态
            if (!this.conn || this.conn.readyState !== WebSocket.OPEN) {
                resolve({ status: false, message: i18n.t('request.error.not_connected') });
                return;
            }

            const originMessage: RequestMessage = message;
            let newMessage: RequestMessage | string | Uint8Array = message;

            if (encrypt) {
                const deviceId = await config.DEVICE_ID();
                newMessage = JSON.stringify(message);
                if (base64) {
                    newMessage = AESCipher.encryptToBase64(newMessage, deviceId);
                } else {
                    newMessage = AESCipher.encrypt(newMessage, deviceId);
                }
            } else {  // 新增
                newMessage = JSON.stringify(message);
            }

            // 发送消息
            // @ts-ignore
            this.conn.send(newMessage);

            // 设置超时
            const timeout = setTimeout(() => {
                delete this._pendingPromises[originMessage.id];
                resolve({
                    status: false,
                    message: i18n.t('request.error.timeout', { id: originMessage.id }),
                });
            }, this._timeout);

            // 存储待定的承诺
            this._pendingPromises[originMessage.id] = { resolve, timeout };
        } catch (error) {
            resolve({
                status: false,
                message: i18n.t('request.error.unknown', { error: error.message }),
            });
        }
    }

    /**
     * 发送心跳
     */
    private ping() {
        // 清理之前的定时器
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }

        const heartbeat = () => {
            // 检查连接状态
            if (!this.conn || this.conn.readyState !== WebSocket.OPEN) {
                this.consecutiveFailures++;

                // 如果连续失败多次，触发断开连接
                if (this.consecutiveFailures >= this.maxFailures) {
                    this.handleDisconnect(
                        WSDisconnectReason.ERROR,
                        'Heartbeat failed - connection not open'
                    );
                    return;
                }
            } else {
                // 发送PING
                try {
                    this.conn.send('PING');

                    // 设置PONG超时检测
                    if (this.pongTimeout) {
                        clearTimeout(this.pongTimeout);
                    }

                    this.pongTimeout = setTimeout(() => {
                        this.consecutiveFailures++;

                        if (this.consecutiveFailures >= this.maxFailures) {
                            this.handleDisconnect(
                                WSDisconnectReason.ERROR,
                                'Heartbeat failed - PONG timeout'
                            );
                        } else {
                            // 继续下一次心跳
                            this.scheduleNextPing();
                        }
                    }, 10000); // 10秒内没收到PONG就算超时
                } catch (error) {
                    this.consecutiveFailures++;
                    this.scheduleNextPing();
                }
            }

            // 继续下一次心跳
            this.scheduleNextPing();
        };

        // 启动心跳
        heartbeat();
    }

    /**
     * 安排下一次心跳
     */
    private scheduleNextPing() {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
        }

        this.pingTimeout = setTimeout(() => {
            this.ping();
        }, this._heartbeat);
    }

    /**
     * 清理所有定时器
     */
    private clearAllTimeouts() {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }

        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
        }
    }

    /**
     * 关闭WebSocket连接
     */
    async close() {
        // 停止重试
        this.shouldReconnect = false;
        this.isConnecting = false;

        // 清理所有定时器
        this.clearAllTimeouts();

        // 重置状态
        this.consecutiveFailures = 0;
        this.retryCount = 0;

        this.rejectAllPending('WebSocket close');

        if (this.conn) {
            // 移除所有事件监听
            this.conn.onopen = null;
            this.conn.onmessage = null;
            this.conn.onerror = null;
            this.conn.onclose = null;

            if (
                this.conn.readyState === WebSocket.OPEN ||
                this.conn.readyState === WebSocket.CONNECTING
            ) {
                this.conn.close();
            }
            this.conn = null;
        }
    }
}
