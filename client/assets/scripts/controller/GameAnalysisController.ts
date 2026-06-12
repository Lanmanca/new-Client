import { Modal } from '@/component';
import { HandRecordItem, PlayerData } from '@/component/HandRecordItem';
import { stateManager, uiManager } from '@/manager';
import { _decorator, Component, instantiate, Label, Node, Prefab } from 'cc';
const { ccclass, property } = _decorator;

interface childNodes {
    roomNumberTitle: Label,
    roomNumber: Label,
    roomOwnerTitle: Label,
    roomOwner: Label,
    mainPotTitle: Label,
    mainPot: Label,
    sidePotTitle: Label,
    sidePot: Label,
    totalPotTitle: Label,
    totalPot: Label,
}

@ccclass('GameAnalysisController')
export class GameAnalysisController extends Component {

    @property({ type: Node, tooltip: '信息节点' })
    information: Node = null!;

    @property({ type: Node, tooltip: '历史手牌列表容器' })
    handRecordList: Node = null!;

    @property({ type: Prefab, tooltip: '历史手牌项预制件' })
    handRecordItem: Prefab = null!;

    @property({ type: Prefab, tooltip: '提示模态框' })
    promptModal: Prefab = null!;

    private _childNodes: childNodes = null!;

    start() {
        this._childNodes = this.getChildNodes();
        this.initialize();
    }

    private getChildNodes(): childNodes {
        return {
            roomNumberTitle: this.information.getChildByPath('RoomNumber/title').getComponent(Label),
            roomNumber: this.information.getChildByPath('RoomNumber/roomNumber').getComponent(Label),
            roomOwnerTitle: this.information.getChildByPath('RoomOwner/title').getComponent(Label),
            roomOwner: this.information.getChildByPath('RoomOwner/roomOwner').getComponent(Label),
            mainPotTitle: this.information.getChildByPath('MainPot/title').getComponent(Label),
            mainPot: this.information.getChildByPath('MainPot/mainPot').getComponent(Label),
            sidePotTitle: this.information.getChildByPath('SidePot/title').getComponent(Label),
            sidePot: this.information.getChildByPath('SidePot/sidePot').getComponent(Label),
            totalPotTitle: this.information.getChildByPath('TotalPot/title').getComponent(Label),
            totalPot: this.information.getChildByPath('TotalPot/totalPot').getComponent(Label),
        }
    }

    private initialize() {
        const data = stateManager.getItem('HistoricalMatchDetail') as any;
        this._childNodes.roomNumber.string = data.roomNumber.toString();
        this._childNodes.roomOwner.string = data.owner.nickname;
        this._childNodes.mainPot.string = data.pot.mainPot.toString();
        this._childNodes.sidePot.string = data.pot.sidePot.toString();
        this._childNodes.totalPot.string = data.pot.total.toString();

        this.renderPlayers(data.players, data.communityCards);
    }

    /**
     * 渲染单个玩家项
     * @param player 玩家数据（players数组中的一个）
     * @param communityCards 公共牌
     */
    renderItem(player: PlayerData, communityCards: number[]) {
        const node = instantiate(this.handRecordItem);
        const comp = node.getComponent(HandRecordItem);
        if (comp) {
            comp.renderData(player, communityCards);
        }

        node.setParent(this.handRecordList);
    }

    private onBackClick() {
        stateManager.removeItem('HistoricalMatchDetail');
        uiManager.navigateBack();
    }

    /**
     * 渲染玩家列表
     * @param players 玩家数组
     * @param communityCards 公共牌
     */
    private renderPlayers(players: PlayerData[], communityCards: number[]) {
        // 防止重复创建（很重要）
        this.handRecordList.removeAllChildren();

        players.forEach(player => {
            const node = instantiate(this.handRecordItem);
            const comp = node.getComponent(HandRecordItem);

            if (comp) {
                comp.renderData(player, communityCards);
            }

            node.setParent(this.handRecordList);
        });
    }

    private async onPromptClick() {
        await uiManager.createModal('Modal', null, {
            onLoad: (node) => {
                const modal = node.getComponent(Modal);
                const prompt = instantiate(this.promptModal);

                if (!modal) return;

                // 挂内容
                modal.title = '提示';
                modal.content = prompt;
                modal.confirmText = '确定';
            },
            onConfirm: () => {
                return true;
            }
        });
    }
}