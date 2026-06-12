import {
    InternalTask,
    TaskCallback,
    TaskFn,
    TaskSnapshot,
    TaskStatus,
    TaskType,
} from '@/types/task';

/**
 * 任务管理器
 */
export class TaskManager {
    private static _instance: TaskManager;
    public static get instance(): TaskManager {
        if (!this._instance) {
            this._instance = new TaskManager();
        }
        return this._instance;
    }

    private tasks = new Map<string, InternalTask>();
    private idCounter = 0;

    private generateId(): string {
        return `task_${++this.idCounter}_${Date.now()}`;
    }

    /**
     * 提交一次性任务（异步执行，可在执行前取消 / 暂停）
     * @param fn       任务函数
     * @param args     函数参数（数组格式）
     * @param callback 完成回调，接收函数返回值作为参数（可选）
     * @returns taskId
     */
    public submit(fn: TaskFn, args: any[] = [], callback?: TaskCallback): string {
        const id = this.generateId();
        const task: InternalTask = {
            id,
            type: TaskType.ONCE,
            fn,
            args,
            callback,
            status: TaskStatus.PENDING,
        };
        this.tasks.set(id, task);
        // 放入下一个宏任务，保留取消 / 暂停窗口
        task.timerId = setTimeout(() => this.onTimerFire(task), 0);
        task.timerType = 'timeout';
        return id;
    }

    /**
     * 提交定时循环任务
     * @param fn       任务函数
     * @param args     函数参数（数组格式）
     * @param interval 执行间隔（秒）
     * @param callback 每次执行完成的回调（可选）
     * @returns taskId
     */
    public submitInterval(
        fn: TaskFn,
        args: any[] = [],
        interval: number,
        callback?: TaskCallback
    ): string {
        const id = this.generateId();
        const intervalMs = interval * 1000;
        const task: InternalTask = {
            id,
            type: TaskType.INTERVAL,
            fn,
            args,
            callback,
            status: TaskStatus.RUNNING,
            intervalMs,
        };
        this.tasks.set(id, task);
        this.startInterval(task);
        return id;
    }

    /**
     * 提交延时任务
     * @param fn       任务函数
     * @param args     函数参数（数组格式）
     * @param delay    延时时间（秒）
     * @param callback 完成回调（可选）
     * @returns taskId
     */
    public submitDelay(
        fn: TaskFn,
        args: any[] = [],
        delay: number,
        callback?: TaskCallback
    ): string {
        const id = this.generateId();
        const delayMs = delay * 1000;
        const task: InternalTask = {
            id,
            type: TaskType.DELAY,
            fn,
            args,
            callback,
            status: TaskStatus.PENDING,
            delayMs,
            remainingTime: delayMs,
        };
        this.tasks.set(id, task);
        task.startTime = Date.now();
        task.timerId = setTimeout(() => this.onTimerFire(task), delayMs);
        task.timerType = 'timeout';
        return id;
    }

    /**
     * 取消任务
     */
    public cancel(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) return false;
        if (task.status === TaskStatus.CANCELLED || task.status === TaskStatus.COMPLETED)
            return false;

        this.clearTimer(task);
        task.status = TaskStatus.CANCELLED;
        return true;
    }

    /**
     * 暂停任务
     */
    public pause(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) return false;
        if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.RUNNING) return false;

        this.clearTimer(task);

        // 计算并保存剩余时间
        if (task.type === TaskType.DELAY && task.startTime != null) {
            const elapsed = Date.now() - task.startTime;
            task.remainingTime = Math.max(0, (task.remainingTime ?? task.delayMs ?? 0) - elapsed);
        } else if (task.type === TaskType.INTERVAL && task.startTime != null) {
            const elapsed = Date.now() - task.startTime;
            task.remainingTime = Math.max(0, (task.intervalMs ?? 0) - elapsed);
        }

        task.status = TaskStatus.PAUSED;
        return true;
    }

    /**
     * 恢复已暂停的任务
     */
    public resume(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== TaskStatus.PAUSED) return false;

        switch (task.type) {
            case TaskType.ONCE:
                task.status = TaskStatus.PENDING;
                task.timerId = setTimeout(() => this.onTimerFire(task), 0);
                task.timerType = 'timeout';
                break;

            case TaskType.DELAY:
                task.status = TaskStatus.PENDING;
                task.startTime = Date.now();
                task.timerId = setTimeout(() => this.onTimerFire(task), task.remainingTime ?? 0);
                task.timerType = 'timeout';
                break;

            case TaskType.INTERVAL:
                task.status = TaskStatus.RUNNING;
                task.startTime = Date.now();
                // 先等完剩余时间，再切回常规 interval
                task.timerId = setTimeout(() => {
                    if (task.status !== TaskStatus.RUNNING) return;
                    this.invokeTask(task);
                    if (task.status === TaskStatus.RUNNING) {
                        this.startInterval(task);
                    }
                }, task.remainingTime ?? 0);
                task.timerType = 'timeout';
                break;
        }

        return true;
    }

    /**
     * 立即执行任务
     */
    public executeNow(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) return false;
        if (task.status === TaskStatus.CANCELLED || task.status === TaskStatus.COMPLETED)
            return false;

        switch (task.type) {
            case TaskType.ONCE:
            case TaskType.DELAY:
                this.clearTimer(task);
                this.invokeTask(task);
                task.status = TaskStatus.COMPLETED;
                break;

            case TaskType.INTERVAL:
                if (task.status === TaskStatus.RUNNING) {
                    // 清除旧计时器 → 执行 → 重启 interval
                    this.clearTimer(task);
                    this.invokeTask(task);
                    if (task.status === TaskStatus.RUNNING) {
                        this.startInterval(task);
                    }
                } else if (task.status === TaskStatus.PAUSED) {
                    // 仅执行一次，保持暂停状态
                    this.invokeTask(task);
                }
                break;
        }

        return true;
    }

    /**
     * 获取任务状态
     */
    public getStatus(taskId: string): TaskStatus | null {
        return this.tasks.get(taskId)?.status ?? null;
    }

    /**
     * 获取任务信息
     */
    public getTaskInfo(taskId: string): TaskSnapshot | null {
        const task = this.tasks.get(taskId);
        if (!task) return null;
        return { id: task.id, type: task.type, status: task.status };
    }

    /**
     * 获取所有任务 ID
     */
    public getAllTaskIds(): string[] {
        return Array.from(this.tasks.keys());
    }

    /**
     * 判断任务是否存在
     */
    public has(taskId: string): boolean {
        return this.tasks.has(taskId);
    }

    /**
     * 移除任务
     */
    public remove(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) return false;
        this.clearTimer(task);
        task.status = TaskStatus.CANCELLED;
        return this.tasks.delete(taskId);
    }

    /**
     * 移除所有任务
     */
    public clearAll(): void {
        for (const task of this.tasks.values()) {
            this.clearTimer(task);
            task.status = TaskStatus.CANCELLED;
        }
        this.tasks.clear();
    }

    /**
     * 清理已完成 / 已取消的任务
     */
    public cleanup(): void {
        for (const [id, task] of this.tasks) {
            if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
                this.tasks.delete(id);
            }
        }
    }

    // 定时器触发
    private onTimerFire(task: InternalTask): void {
        if (
            task.status === TaskStatus.CANCELLED ||
            task.status === TaskStatus.COMPLETED ||
            task.status === TaskStatus.PAUSED
        ) {
            return;
        }

        this.invokeTask(task);

        if (task.type !== TaskType.INTERVAL) {
            task.status = TaskStatus.COMPLETED;
        }
    }

    // 执行任务函数
    private invokeTask(task: InternalTask): void {
        try {
            const result = task.fn(...task.args);
            if (result instanceof Promise) {
                result.then(
                    res => task.callback?.(res),
                    err => console.error(`[TaskManager] Task "${task.id}" rejected:`, err)
                );
            } else {
                task.callback?.(result);
            }
        } catch (error) {
            console.error(`[TaskManager] Task "${task.id}" threw:`, error);
        }
    }

    // 启动定时器
    private startInterval(task: InternalTask): void {
        task.startTime = Date.now();
        task.timerId = setInterval(() => {
            task.startTime = Date.now();
            if (task.status === TaskStatus.RUNNING) {
                this.invokeTask(task);
            }
        }, task.intervalMs!);
        task.timerType = 'interval';
    }

    // 清除当前定时器
    private clearTimer(task: InternalTask): void {
        if (task.timerId != null) {
            if (task.timerType === 'interval') {
                clearInterval(task.timerId);
            } else {
                clearTimeout(task.timerId);
            }
            task.timerId = undefined;
            task.timerType = undefined;
        }
    }
}

/**
 * 任务管理器
 */
export const taskManager = TaskManager.instance;
