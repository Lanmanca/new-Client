/**
 * WebSocket断开原因
 */
export enum WSDisconnectReason {
    CLOSE = 'close',
    ERROR = 'error',
}

/**
 * 异步队列
 */
export interface Queue {
    push<T>(value: T): void;
    [Symbol.asyncIterator](): AsyncIterableIterator<any>;
}

/**
 * 带队列的待定承诺
 */
export interface PendingPromise {
    resolve: (value: any) => void;
    timeout: ReturnType<typeof setTimeout>;
    queue?: Queue;
}
