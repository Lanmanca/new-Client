interface ListenerItem {
    callback: Function;
    once: boolean;
}

/**
 * 事件管理器
 */
class EventManager {
    private static _instance: EventManager;
    public static get instance(): EventManager {
        if (!this._instance) {
            this._instance = new EventManager();
        }
        return this._instance;
    }

    // 事件监听器
    private listeners: Map<string, ListenerItem[]> = new Map();

    /**
     * 监听事件
     * @param event 事件名
     * @param callback 回调函数
     */
    public on(event: string, callback: Function) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }

        // 检查是否已经存在相同的监听
        const exists = this.listeners.get(event).some(item => item.callback === callback);

        if (!exists) {
            this.listeners.get(event).push({
                callback,
                once: false,
            });
        }
    }

    /**
     * 监听一次
     * @param event 事件名
     * @param callback 回调函数
     */
    public once(event: string, callback: Function) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }

        this.listeners.get(event).push({
            callback,
            once: true,
        });
    }

    /**
     * 移除监听
     * @param event 事件名
     * @param callback 回调函数
     */
    public off(event: string, callback: Function) {
        if (!this.listeners.has(event)) {
            return;
        }

        const items = this.listeners.get(event);
        const filtered = items.filter(item => item.callback !== callback);

        if (filtered.length === 0) {
            this.listeners.delete(event);
        } else {
            this.listeners.set(event, filtered);
        }
    }

    /**
     * 触发事件
     * @param event 事件名
     * @param args 参数
     */
    public emit(event: string, ...args: any[]) {
        if (!this.listeners.has(event)) {
            return;
        }

        const items = this.listeners.get(event);
        const itemsCopy = [...items];

        // 先收集要移除的 once 监听
        const toRemove: Function[] = [];

        for (const item of itemsCopy) {
            try {
                item.callback(...args);

                if (item.once) {
                    toRemove.push(item.callback);
                }
            } catch (error) {
                console.error(`事件 ${event} 执行回调出错:`, error);
            }
        }

        // 移除 once 监听
        if (toRemove.length > 0) {
            const remaining = items.filter(item => !toRemove.includes(item.callback));
            if (remaining.length === 0) {
                this.listeners.delete(event);
            } else {
                this.listeners.set(event, remaining);
            }
        }
    }

    /**
     * 移除指定事件的所有监听
     * @param event 事件名
     */
    public removeAllListeners(event?: string) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * 获取事件监听数量
     */
    public listenerCount(event: string): number {
        return this.listeners.has(event) ? this.listeners.get(event).length : 0;
    }
}

/**
 * 事件管理器
 */
export const eventManager = EventManager.instance;
