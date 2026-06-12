import { InformationData, InformationItem } from '@/component/InformationItem';
import { uiManager } from '@/manager';
import { isNullOrEmpty } from '@/utils';
import { Pager } from '@/utils/Pager';
import { _decorator, Component, instantiate, Node, Prefab, ScrollView } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MessageController')
export class MessageController extends Component {

    @property({ type: Node, tooltip: '内容节点' })
    contentNode: Node = null!;

    @property({ type: Prefab, tooltip: '消息项预制体' })
    informationPrefab: Prefab = null!;

    @property({ type: ScrollView, tooltip: '滚动视图' })
    scrollView: ScrollView = null!;

    currentPages: number = 1;
    pageSize: number = 10;

    pager: Pager<InformationData> = null!;

    private isDeleteMode: boolean = false;
    private itemList: InformationItem[] = [];

    async start() {
        const res = await this.getInformationList();
        if (!isNullOrEmpty(res?.data?.list)) {
            this.pager = new Pager<InformationData>({
                data: res.data.list,
                pageSize: this.pageSize,
                maxCachePage: 2
            });

            this.render(this.pager.next());
        }

        this.scrollView.node.on('scroll-to-bottom', this.onScrollToBottom, this);
        this.scrollView.node.on('scroll-to-top', this.onScrollToTop, this);
    }

    render(list: InformationData[]) {
        this.contentNode.removeAllChildren();
        this.itemList = [];

        list.forEach(item => {
            const node = instantiate(this.informationPrefab);
            const comp = node.getComponent(InformationItem);

            comp.setData(item);
            comp.setDeleteMode(this.isDeleteMode);

            this.contentNode.addChild(node);
            this.itemList.push(comp);
        });
    }

    private updateAllItemState() {
        this.itemList.forEach(item => {
            item.setDeleteMode(this.isDeleteMode);
        });
    }

    // /** 判断是否有选中项 */
    // private hasSelectedItem(): boolean {
    //     return this.itemList.some(item => item.isSelected());
    // }

    // private async onDeleteClick() {
    //     const { deleteLine, deleteFill } = this.getChildNode();

    //     // 如果在删除模式 且 有选中项
    //     if (this.isDeleteMode && this.hasSelectedItem()) {
    //         await uiManager.createModal('Modal', null, {
    //             onLoad: (node) => {
    //                 const modal = node.getComponent(Modal);
    //                 if (modal) {
    //                     modal.title = '确认操作';
    //                     modal.content = '确定要删除选中的消息吗？';
    //                     modal.confirmText = '确定';
    //                     modal.cancelText = '取消';
    //                     modal.showCancel = true;
    //                 }
    //             },
    //             onConfirm: () => {
    //                 return true;
    //             },
    //             onCancel: () => {
    //                 return true;
    //             }
    //         })
    //         return;
    //     }

    //     // 正常切换删除模式
    //     this.isDeleteMode = !this.isDeleteMode;

    //     deleteLine.node.active = !this.isDeleteMode;
    //     deleteFill.node.active = this.isDeleteMode;

    //     this.updateAllItemState();
    // }

    onScrollToTop() {
        this.render(this.pager.prev());
    }

    onScrollToBottom() {
        if (!this.pager.hasMore()) return;
        this.render(this.pager.next());
    }

    private onBackClick() {
        uiManager.navigateBack();
    }

    async getInformationList() {
        // return await APIManager.getInformationList({
        //     pageNo: this.currentPages,
        //     pageSize: this.pageSize
        // }) as any;
        return [];
    }
}