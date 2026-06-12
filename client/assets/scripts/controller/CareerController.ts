import { HistoricalMatchItem } from '@/component/HistoricalMatchItem';
import { APIManager, i18n, userManager } from '@/manager';
import { Pager } from '@/utils/Pager';
import { _decorator, Color, Component, instantiate, Label, Node, Prefab, ScrollView } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CareerController')
export class CareerController extends Component {

    @property({ type: Label, tooltip: '总盈亏文本' })
    totalProfitLabel: Label = null!;

    @property({ type: Node, tooltip: '总盈亏节点' })
    totalProfitNode: Node = null!;

    @property({ type: Node, tooltip: '历史对局容器节点' })
    historicalMatchNode: Node = null!;

    @property({ type: Prefab, tooltip: '历史对局项预制体' })
    historicalMatchItemPrefab: Prefab = null!;

    @property({ type: ScrollView, tooltip: '滚动视图' })
    scrollView: ScrollView = null!;

    private pageNo: number = 1;
    private pageSize: number = 20;
    loading: boolean = false;

    pager: Pager<any> = null!;

    async start() {
        this.init();

        const data = await this.getGameHistoryList();
        this.pager = new Pager<any>({
            data: data.data.list,
            pageSize: this.pageSize,
            maxCachePage: 2
        });

        const list = this.pager.next();
        this.render(list);
        this.setTotalProfit(list);

        this.scrollView.node.on('scroll-to-bottom', this.onScrollToBottom, this);
        this.scrollView.node.on('scroll-to-top', this.onScrollToTop, this);
    }

    init() {
        this.totalProfitLabel.string = i18n.t('pages.Career.totalProfitlabel')
    }

    render(list: any[]) {
        this.historicalMatchNode.removeAllChildren();

        list.forEach(item => {
            const tradeRecord = instantiate(this.historicalMatchItemPrefab);
            const tradeComponent = tradeRecord.getComponent(HistoricalMatchItem);
            tradeComponent.setData(item);
            this.historicalMatchNode.addChild(tradeRecord);
        });
    }

    onScrollToTop() {
        const list = this.pager.prev();
        this.render(list);
    }

    onScrollToBottom() {
        if (!this.pager.hasMore()) return;

        const list = this.pager.next();
        this.render(list);
    }

    private async getGameHistoryList() {
        const res = await APIManager.getGameHistory({
            pageNo: this.pageNo,
            pageSize: this.pageSize
        }) as any;

        if (res?.status && res?.data?.list) {
            return res;
        }

        return [];
    }

    // 计算总盈利
    setTotalProfit(list: any[]) {
        const currentUserId = userManager.getUserInfo().userId;  // 正式环境下的用户ID

        const totalProfit = list.reduce((total, item) => {
            const player = item.players?.find(
                (p: any) => p.userId === currentUserId
            );
            return total + (player?.profitLoss ?? 0);
        }, 0);

        if (totalProfit < 0) {
            this.totalProfitNode.getChildByName('green').active = false;
            this.totalProfitNode.getChildByName('red').active = true;
            this.totalProfitNode.getChildByName('moeny').getComponent(Label).color = new Color().fromHEX('#E43615');
            this.totalProfitNode.getChildByName('moeny').getComponent(Label).string = totalProfit.toString();
        } else {
            this.totalProfitNode.getChildByName('moeny').getComponent(Label).color = new Color().fromHEX('#08d271');
            this.totalProfitNode.getChildByName('moeny').getComponent(Label).string = '+' + totalProfit.toString();
        }
    }
}