import { Tabbar } from '@/component/Tabbar';
import { Trade } from '@/component/Trade';
import { ITradeDetails } from '@/types/tradeDetails';
import { isNullOrEmpty } from '@/utils';
import { Pager } from '@/utils/Pager';
import { _decorator, Component, instantiate, Node, Prefab, ScrollView } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TradeRecordController')
export class TradeRecordController extends Component {

    @property({ type: Node, tooltip: '交易记录列表容器' })
    listContainer: Node = null!;

    @property({ type: Node, tooltip: '列表容器' })
    tradeRecordContainer: Node = null!;

    @property({ type: Prefab, tooltip: '交易记录预制体' })
    tradePrefab: Prefab = null!;

    @property({ type: ScrollView, tooltip: '滚动视图' })
    scrollView: ScrollView = null!;

    currentPages: number = 1;
    pageSize: number = 10;

    pager: Pager<ITradeDetails> = null!;

    async start() {

        const res = await this.getTradeRecordList();
        if (!isNullOrEmpty(res?.data?.list)) {
            this.pager = new Pager<ITradeDetails>({
                data: res.data.list,
                pageSize: this.pageSize,
                maxCachePage: 2
            });

            const list = this.pager.next();
            this.render(list);
        }

        this.scrollView.node.on('scroll-to-bottom', this.onScrollToBottom, this);
        this.scrollView.node.on('scroll-to-top', this.onScrollToTop, this);

        this.createTradeRecordList();
    }

    createTradeRecordList() {
        const tabbar = this.listContainer.getComponent(Tabbar);
        tabbar.setData([
            {
                label: '全部',
                background: 'frame',
                isSelectedBackground: true,
                onClick: () => {
                }
            },
            {
                label: '充值',
                background: 'frame',
                isSelectedBackground: true,
                onClick: () => {
                }
            },
            {
                label: '提现',
                background: 'frame',
                isSelectedBackground: true,
                onClick: () => {
                }
            }
        ])
    }

    render(list: ITradeDetails[]) {
        this.tradeRecordContainer.removeAllChildren();

        list.forEach(item => {
            const tradeRecord = instantiate(this.tradePrefab);
            const tradeComponent = tradeRecord.getComponent(Trade);

            tradeComponent.setData(item);
            this.tradeRecordContainer.addChild(tradeRecord);
        });
    }

    onScrollToTop() {
        const list = this.pager.prev();
        this.render(list);
    }

    // ScrollView 滚动到底部回调
    onScrollToBottom() {
        if (!this.pager.hasMore()) return;

        const list = this.pager.next();
        this.render(list);
    }

    async getTradeRecordList() {
        // const res = await APIManager.getTradeDetails({ pageNo: this.currentPages, pageSize: this.pageSize }) as any;

        return [];
    }
}


