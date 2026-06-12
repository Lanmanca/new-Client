import { ResManager } from '@/manager';
import { VirtualList } from '@/utils/VirtualList';
import { _decorator, Component, instantiate, Node, Prefab, ScrollView, Tween, tween, UIOpacity, UITransform, Vec2, Vec3 } from 'cc';
import { ListItem } from './ListItem';

const { ccclass, property } = _decorator;

export interface IVirtualScrollConfig<T> {
    data: T[];
    itemHeight: number;
    onRenderItem: (node: Node, data: T | null) => void;
    onNeedMoreData?: () => void;
}

@ccclass('VirtualScrollView')
export class VirtualScrollView extends Component {

    @property({ type: ScrollView })
    scrollView: ScrollView = null!;

    @property({ type: Node })
    contentNode: Node = null!;

    @property({ type: String })
    itemPrefabPath: string = 'components/ListItem';

    private config: IVirtualScrollConfig<any> = null!;
    private virtualData: VirtualList<any> = null!;

    private nodePool: Node[] = [];
    private pendingOps: (() => void)[] = [];
    private isUpdating: boolean = false;

    private itemMap: Map<number, Node> = new Map();
    private _itemPrefab: Prefab = null!;

    // 记录预制体的原始缩放，防止被动画污染
    private _originalScale: Vec3 = new Vec3(1, 1, 1);

    public async init<T>(config: IVirtualScrollConfig<T>) {
        try {
            this._itemPrefab = await ResManager.loadPrefab('prefabs', this.itemPrefabPath);
            if (this._itemPrefab && this._itemPrefab.data) {
                this._originalScale.set(this._itemPrefab.data.scale);
            }
        } catch (err) {
            console.log('加载预制体失败', err);
            throw err;
        }

        this.config = config;
        this.clear();

        const viewHeight = this.scrollView.node.getComponent(UITransform)!.height;
        // 可视区能容纳的件数，+1 是为了滚动时的缓冲
        const viewCount = Math.ceil(viewHeight / this.config.itemHeight) + 2;

        this.virtualData = new VirtualList({
            data: config.data,
            viewCount: viewCount
        });

        this.scrollView.brake = 1;
        this.scrollView.elastic = false;

        this.scrollView.node.off(ScrollView.EventType.SCROLLING, this.onScrolling, this);
        this.scrollView.node.on(ScrollView.EventType.SCROLLING, this.onScrolling, this);

        this.initList();
    }

    public clear() {
        this.contentNode.children.forEach(child => {
            // 停止一切可能还在播放的动画，防止污染复用池
            Tween.stopAllByTarget(child);
            const opacityComp = child.getComponent(UIOpacity);
            if (opacityComp) Tween.stopAllByTarget(opacityComp);

            child.active = false;
            this.nodePool.push(child);
        });
        this.contentNode.removeAllChildren();

        this.pendingOps = [];
        this.isUpdating = false;
        this.itemMap.clear();
        if (this.scrollView) {
            this.scrollView.scrollToTop(0);
        }
    }

    // 初始化列表：彻底去除了空节点机制
    private initList() {
        const data = this.virtualData.getInitialData();
        const total = this.virtualData.data.length;

        if (total === 0) return;

        // 【修改点】：用可视区域真实高度计算是否全屏，不能用加了缓冲的 viewCount
        const viewHeight = this.scrollView.node.getComponent(UITransform)!.height;
        const visibleCount = Math.ceil(viewHeight / this.config.itemHeight);
        const isNotFullScreen = total <= visibleCount;

        if (isNotFullScreen) {
            // 情况 A：数据不足一屏，直接渲染全部，并禁止滚动
            data.forEach((item, i) => {
                this.createItem(item, false, i);
            });
            this.scrollView.enabled = false;
        } else {
            // 情况 B：数据超过一屏，填满初始可视区域即可，滚动触发交给 onScrolling 的数学计算
            this.scrollView.enabled = true;
            data.forEach((item, i) => {
                this.createItem(item, false, i);
            });
        }
    }

    private onScrolling() {
        if (!this.virtualData || this.virtualData.data.length <= this.virtualData.viewCount) return;

        // 如果正在执行动画和回收，直接锁定，防止手指快速滑动导致逻辑击穿
        if (this.isUpdating) return;

        const offsetY = this.scrollView.getScrollOffset().y;

        // 【关键逻辑】：放弃碰壁触发，改为“缓冲区触发”
        // 当 offset 小于 0.5 个 itemHeight 时，说明快要触顶了，且如果有上文数据，则把底部节点搬到顶部
        if (offsetY < this.config.itemHeight * 0.5 && this.virtualData.canMoveUp()) {
            this.handleMoveUp();
        }
        // 当 offset 大于 1.5 个 itemHeight 时，说明快要触底了，且如果有下文数据，则把顶部节点搬到底部
        else if (offsetY > this.config.itemHeight * 1.5 && this.virtualData.canMoveDown()) {
            this.handleMoveDown();
        }
    }

    public appendData(newData: any[]) {
        if (!this.virtualData) return;

        const oldTotal = this.virtualData.data.length;
        this.virtualData.append(newData);
        const total = this.virtualData.data.length;
        const viewCount = this.virtualData.viewCount;

        // 从不足一屏变成超过一屏，重新初始化
        if (oldTotal <= viewCount && total > viewCount) {
            this.clear();
            this.initList();
        } else if (oldTotal <= viewCount && total <= viewCount) {
            // 依然不满足一屏，追加渲染
            newData.forEach((item, i) => {
                this.createItem(item, false, oldTotal + i);
            });
        }
    }

    private handleMoveDown() {
        if (!this.virtualData.canMoveDown() || this.isUpdating) return;

        const remaining = this.virtualData.data.length - (this.virtualData.startIndex + this.virtualData.viewCount);
        if (remaining <= 3 && this.config.onNeedMoreData) {
            this.config.onNeedMoreData(); // 数据快到底了，通知请求
        }

        if (!this.virtualData.canMoveDown() || this.isUpdating) return;

        const newData = this.virtualData.moveDown();
        if (!newData) return;

        this.isUpdating = true;

        this.pendingOps.push(() => {
            const newIndex = this.virtualData.startIndex + this.virtualData.viewCount - 1;
            // 1. 底部新增节点并附带动画
            this.createItem(newData, false, newIndex);

            // 2. 找到最顶部的真实节点并回收
            const children = this.contentNode.children;
            if (children.length > 0) {
                this.recycleNode(children[0]);
            }

            // 3. 抹平因删除顶部节点导致的高度塌陷，视觉上保持静止
            const offset = this.scrollView.getScrollOffset();
            const newOffsetY = offset.y - this.config.itemHeight;

            this.scrollView.scrollToOffset(new Vec2(offset.x, newOffsetY), 0);
            this.isUpdating = false;
        });
    }

    private handleMoveUp() {
        if (!this.virtualData.canMoveUp() || this.isUpdating) return;

        const newData = this.virtualData.moveUp();
        if (!newData) return;

        this.isUpdating = true;

        this.pendingOps.push(() => {
            const newIndex = this.virtualData.startIndex;
            // 1. 顶部新增节点并附带动画
            this.createItem(newData, true, newIndex);

            // 2. 找到最底部的真实节点并回收
            const children = this.contentNode.children;
            if (children.length > 0) {
                this.recycleNode(children[children.length - 1]);
            }

            // 3. 抹平因增加顶部节点导致的高度撑出，视觉上保持静止
            const offset = this.scrollView.getScrollOffset();
            const newOffsetY = offset.y + this.config.itemHeight;

            this.scrollView.scrollToOffset(new Vec2(offset.x, newOffsetY), 0);
            this.isUpdating = false;
        });
    }

    private createItem(data: any, insertToTop = false, index?: number) {
        let node = this.nodePool.length > 0 ? this.nodePool.pop()! : instantiate(this._itemPrefab);

        // 【关键修复】：强制重置从对象池里拿出来的节点的所有状态
        node.setScale(this._originalScale);
        let opacityComp = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        opacityComp.opacity = 255;
        node.active = true;
        // 保证内部的子节点全部处于激活状态（修复只有一条数据时变黑的 Bug）
        node.children.forEach(c => c.active = true);

        node.name = 'item';
        node.setParent(this.contentNode);

        const comp = node.getComponent(ListItem);
        if (comp) {
            comp.init();
            comp.setData(data);
        }

        if (index !== undefined) this.itemMap.set(index, node);

        if (insertToTop) {
            node.setSiblingIndex(0);
        } else {
            node.setSiblingIndex(this.contentNode.children.length);
        }

        this.playAppearAnimation(node);
    }

    private recycleNode(node: Node) {
        if (!node || !node.isValid) return;

        Tween.stopAllByTarget(node);
        const opacityComp = node.getComponent(UIOpacity);
        if (opacityComp) Tween.stopAllByTarget(opacityComp);

        for (const [key, value] of this.itemMap) {
            if (value === node) {
                this.itemMap.delete(key);
                break;
            }
        }

        node.removeFromParent();
        node.active = false;
        this.nodePool.push(node);
    }

    private playAppearAnimation(node: Node): Promise<void> {
        const startScale = new Vec3(this._originalScale.x * 0.9, this._originalScale.y * 0.9, this._originalScale.z);

        let opacityComp = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        opacityComp.opacity = 0;
        node.setScale(startScale);

        return new Promise(resolve => {
            tween(node)
                .parallel(
                    tween(node)
                        .to(0.12, { scale: this._originalScale }, { easing: 'sineOut' })
                        .to(0.08, { scale: this._originalScale }, { easing: 'sineIn' }),
                    tween(opacityComp).to(0.2, { opacity: 255 })
                )
                .call(() => {
                    // 强制校对
                    if (node && node.isValid) {
                        node.setScale(this._originalScale);
                        opacityComp.opacity = 255;
                    }
                    resolve();
                })
                .start();
        });
    }

    update() {
        if (this.pendingOps.length > 0) {
            const ops = this.pendingOps.slice();
            this.pendingOps.length = 0;
            ops.forEach(fn => fn());
        }
    }

    public reset() {
        this.virtualData = null!;
        this.clear();
        this.config = null!;
    }

    public refreshItem(index: number) {
        const item = this.getItemByIndex(index);
        if (!item || !item.isValid) return;

        const data = this.virtualData.data[index];
        const comp = item.getComponent(ListItem);
        if (comp) {
            comp.setData(data);
        }
    }

    private getItemByIndex(index: number): Node | null {
        return this.itemMap.get(index) || null;
    }

    // 电脑端 正常滚动 新增与销毁 手机端 不能正常滚动  向上翻不能新增，下翻可以
}