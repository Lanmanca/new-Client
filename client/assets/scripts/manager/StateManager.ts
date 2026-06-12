/**
 * 状态管理器
 */
class StateManager {
    private static _instance: StateManager;
    public static get instance(): StateManager {
        if (!this._instance) {
            this._instance = new StateManager();
        }
        return this._instance;
    }

    private data: Map<string, any> = new Map();

    /**
     * 设置数据，默认持久化到 localStorage
     * @param key 键
     * @param value 值
     * @param persist 是否持久化，默认 true
     */
    setItem<T>(key: string, value: T, persist: boolean = true) {
        this.data.set(key, value);
        if (persist) {
            localStorage.setItem(key, JSON.stringify(value));
        }
    }

    /**
     * 获取数据，优先从内存读取，没有则从 localStorage 读取
     * @param key 键
     */
    getItem<T>(key: string): T {
        if (this.data.has(key)) {
            return this.data.get(key);
        }

        const stored = localStorage.getItem(key);
        if (stored !== null) {
            try {
                const value = JSON.parse(stored);
                this.data.set(key, value);
                return value;
            } catch {
                return stored as T;
            }
        }
        return undefined;
    }

    /**
     * 删除数据
     * @param key 键
     */
    removeItem(key: string) {
        this.data.delete(key);
        localStorage.removeItem(key);
    }

    /**
     * 清空所有数据
     */
    clear() {
        this.data.clear();
        localStorage.clear();
    }
}

/**
 * 状态管理器
 */
export const stateManager = StateManager.instance;
