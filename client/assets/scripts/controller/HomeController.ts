import { ListItem } from '@/component/index';
import { SlideSwitch } from '@/component/SlideSwitch';
import { VirtualScrollView } from '@/component/VirtualScrollView';
import { APIManager } from '@/manager';
import {
    _decorator,
    Component,
    Node
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('HomeController')
export class HomeController extends Component {

    @property({ type: VirtualScrollView, tooltip: '滚动视图配置' })
    virtualList: VirtualScrollView = null!;

    @property({ type: Node, tooltip: '滑块节点' })
    slideSwitch: Node = null!;

    // 核心状态锁
    private pageNo: number = 1;
    private pageSize: number = 20;
    private isLoading: boolean = false; // 防止重复请求
    private hasMore: boolean = true;    // 标记是否所有数据都拿完了

    // 保存当前数据列表的引用（用于快速查询和更新）
    private dataList: any[] = [];
    // 玩家数临时记录（房间号 -> 当前玩家数）
    private roomIndexMap: Map<number, number> = new Map();

    private currentType: 'hall' | 'room' = 'room';

    async start() {

        // 初始化重置状态
        this.pageNo = 1;
        this.hasMore = true;

        const slide = this.slideSwitch.getComponent(SlideSwitch);
        slide.onTabChange = (index) => {
            this.onTabChange(index);
        };

        // 开始拉取第一页数据
        await this.loadData(true);
    }

    /**
     * 获取数据并渲染 (第一页初始化，后续追加)
     */
    private async loadData(isFirst: boolean = false) {
        // 如果正在加载中，或者已经没数据了，直接打断，防止无限循环！
        if (this.isLoading || !this.hasMore) return;

        this.isLoading = true;

        // 请求数据
        const dataList = await this.fetchRoomList();
        // 如果后台给的数据小于我们期望的一页数量，说明到底了
        if (dataList.length < this.pageSize) {
            this.hasMore = false;
        }

        if (dataList.length > 0) {
            if (isFirst) {
                this.dataList = dataList;
                // 第一页：初始化组件
                this.virtualList.init({
                    data: dataList,
                    itemHeight: 150,
                    onRenderItem: (node, itemData) => {
                        const comp = node.getComponent(ListItem);
                        if (comp) comp.setData(itemData as any);
                    },
                    // 触发预加载的回调
                    onNeedMoreData: () => {
                        this.loadData(false); // 触发下一页加载
                    }
                });
            } else {
                this.dataList.push(...dataList);
                // 第二、三...页：往组件里悄悄塞数据
                this.virtualList.appendData(dataList);
            }

            dataList.forEach((item, i) => {
                const index = isFirst ? i : this.dataList.length - dataList.length + i;
                this.roomIndexMap.set(item.roomNumber, index);
            })

            // 数据成功加上去了，页码才加 1
            this.pageNo++;
        }

        // 解除锁，允许下一次请求
        this.isLoading = false;
    }

    private async fetchRoomList(): Promise<any[]> {
        let res: any;

        if (this.currentType === 'hall') {
            res = await APIManager.getRoomList({
                pageNo: this.pageNo,
                pageSize: this.pageSize
            });
        } else {
            res = await APIManager.getOvertRoomList({
                pageNo: this.pageNo,
                pageSize: this.pageSize
            });
        }

        if (res.status) {
            return res.data.list;
        }

        return [];
    }

    private async onTabChange(index: number) {

        // 0 = 当前房间，1 = 大厅（按你定义）
        this.currentType = index === 0 ? 'room' : 'hall';

        // 重置分页状态（非常关键）
        this.pageNo = 1;
        this.hasMore = true;
        this.isLoading = false;

        // 清空旧数据
        this.virtualList.reset();

        // 重新加载
        await this.loadData(true);
    }

    // 更新房间玩家数
    // 玩家加入 updateRoomPlayer(roomNumber, +1)  玩家退出 updateRoomPlayer(roomNumber, -1)
    public updateRoomPlayer(roomNumber: number, delta: number) {
        const index = this.roomIndexMap.get(roomNumber);

        if (index === undefined) return;

        const item = this.dataList[index];

        if (!item) return;

        // 初始化缓存字段
        if (item._currentPlayers === undefined) {
            item._currentPlayers = item.players.length;
        }

        // 更新人数
        item._currentPlayers += delta;

        // 安全保护
        item._currentPlayers = Math.max(0, item._currentPlayers);

        // 局部刷新 UI（关键）
        this.virtualList.refreshItem(index);
    }
}