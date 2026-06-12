import { _decorator, Button as CCButton, Component, EditBox, Label, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TransferInGame')
export class TransferInGame extends Component {

    @property({ type: Label, tooltip: '标题' })
    titleLabel: Label = null!;

    @property({ type: Label, tooltip: '转账数量文本' })
    transferAmountLabel: Label = null!;

    @property({ type: Node, tooltip: '可转账数量节点' })
    maxTransferAmountNode: Node = null!;

    @property({ type: EditBox, tooltip: '转账数量输入框' })
    editBox: EditBox = null!;

    @property({ type: Node, tooltip: '实际支付节点' })
    actualPayNode: Node = null!;

    @property({ type: Node, tooltip: '手续费节点' })
    feeNode: Node = null!;

    @property({ type: CCButton, tooltip: '确认转账按钮' })
    confirmBtn: CCButton = null!;

    start() {
        // 初始化数据
    }

}


