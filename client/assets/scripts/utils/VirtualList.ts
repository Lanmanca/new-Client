/** 
 * 虚拟列表数据管理
 */
export interface IVirtual<T> {
    data: T[];
    viewCount: number; // 可视区域能放多少个
}

export class VirtualList<T> {
    public data: T[] = [];

    /** 当前窗口起点 */
    public startIndex: number = 0;

    /** 可视数量 */
    public viewCount: number = 0;

    constructor(options: IVirtual<T>) {
        this.data = options.data;
        this.viewCount = options.viewCount;
    }

    /** 初始数据 */
    getInitialData(): T[] {
        return this.data.slice(0, this.viewCount);
    }

    /** 下滑：窗口后移一位 */
    moveDown(): T | null {
        if (this.startIndex + this.viewCount >= this.data.length) {
            return null;
        }

        this.startIndex++;

        const nextIndex = this.startIndex + this.viewCount - 1;
        return this.data[nextIndex];
    }

    /** 上滑：窗口前移一位 */
    moveUp(): T | null {
        if (this.startIndex <= 0) {
            return null;
        }

        this.startIndex--;
        return this.data[this.startIndex];
    }

    canMoveDown() {
        return this.startIndex + this.viewCount < this.data.length;
    }

    canMoveUp() {
        return this.startIndex > 0;
    }

    /** 新增：向后追加新一页的数据 */
    public append(newData: T[]) {
        this.data = this.data.concat(newData);
    }
}