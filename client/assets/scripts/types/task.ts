export type TaskFn = (...args: any[]) => any;
export type TaskCallback = (result?: any) => void;

export enum TaskType {
    /**
     * 一次性任务
     */
    ONCE = 'once',
    /**
     * 定时循环任务
     */
    INTERVAL = 'interval',
    /**
     * 延时任务
     */
    DELAY = 'delay',
}

export enum TaskStatus {
    /**
     * 待执行
     */
    PENDING = 'pending',
    /**
     * 正在执行
     */
    RUNNING = 'running',
    /**
     * 暂停
     */
    PAUSED = 'paused',
    /**
     * 取消
     */
    CANCELLED = 'cancelled',
    /**
     * 完成
     */
    COMPLETED = 'completed',
}

export interface TaskSnapshot {
    /**
     * 任务 ID
     */
    id: string;
    /**
     * 任务类型
     */
    type: TaskType;
    /**
     * 任务状态
     */
    status: TaskStatus;
}

export interface InternalTask {
    /**
     * 任务 ID
     */
    id: string;
    /**
     * 任务类型
     */
    type: TaskType;
    /**
     * 任务函数
     */
    fn: TaskFn;
    /**
     * 任务参数
     */
    args: any[];
    /**
     * 任务回调
     */
    callback?: TaskCallback;
    /**
     * 任务状态
     */
    status: TaskStatus;
    /**
     * 定时任务间隔时间（毫秒）
     */
    intervalMs?: number;
    /**
     * 延时任务延迟时间（毫秒）
     */
    delayMs?: number;
    /**
     * 定时器 ID
     */
    timerId?: ReturnType<typeof setTimeout>;
    /**
     * 定时器类型
     */
    timerType?: 'timeout' | 'interval';
    /**
     * 剩余时间（毫秒）
     */
    remainingTime?: number;
    /**
     * 当前计时器的起始时间戳，用于暂停时计算剩余时间
     */
    startTime?: number;
}
