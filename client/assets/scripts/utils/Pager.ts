/**
 * 分页工具类
 */
export class Pager<T> {
    // 总数据
    private totalData: T[] = [];
    private pageSize: number = 10;
    // 缓存
    private pageCache: Map<number, T[]> = new Map();

    private minPage: number = 1;
    private maxPage: number = 0;
    // 最大缓存页数
    private maxCachePage: number = 2;

    constructor(options: {
        data: T[],
        pageSize?: number,
        maxCachePage?: number
    }) {
        this.totalData = options.data;
        this.pageSize = options.pageSize ?? 10;
        this.maxCachePage = options.maxCachePage ?? 2;
    }

    // 获取某一页
    getPage(page: number) {

        const start = (page - 1) * this.pageSize;
        const end = start + this.pageSize;

        const pageData = this.totalData.slice(start, end);

        if (pageData.length === 0) return [];

        // 存缓存
        this.pageCache.set(page, pageData);

        // 更新范围
        this.minPage = this.minPage === 0 ? page : Math.min(this.minPage, page);
        this.maxPage = Math.max(this.maxPage, page);

        // 控制缓存大小
        if (this.pageCache.size > this.maxCachePage) {

            if (page > this.maxPage - 1) {
                this.pageCache.delete(this.minPage);
                this.minPage++;
            } else {
                this.pageCache.delete(this.maxPage);
                this.maxPage--;
            }
        }

        return this.getAllCache();
    }

    // 获取下一页
    next() {
        return this.getPage(this.maxPage + 1 || 1);
    }

    // 获取上一页
    prev() {
        if (this.minPage <= 1) return this.getAllCache();
        return this.getPage(this.minPage - 1);
    }

    // 返回当前缓存（给UI用）
    getAllCache(): T[] {
        const pages = Array.from(this.pageCache.keys()).sort((a, b) => a - b);

        let result: T[] = [];

        pages.forEach(p => {
            result = result.concat(this.pageCache.get(p)!);
        });

        return result;
    }

    // 是否还有下一页
    hasMore(): boolean {
        return this.maxPage * this.pageSize < this.totalData.length;
    }

    // 重置（比如刷新）
    reset(data: T[]) {
        this.totalData = data;
        this.pageCache.clear();
        this.minPage = 1;
        this.maxPage = 0;
    }
}