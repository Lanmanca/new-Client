import { Button } from '@/component/Button';
import { uiManager } from '@/manager';
import { SlideDirection } from '@/types/sidebar';
import { _decorator, Button as CCButton, Component, EditBox, Label, Prefab } from 'cc';
import { Sidebar } from './Sidebar';
const { ccclass, property } = _decorator;

@ccclass('Transfer')
export class Transfer extends Component {

    @property({ type: Label, tooltip: '标题' })
    titleLabel: Label = null!;

    @property({ type: EditBox, tooltip: '用户ID输入框' })
    userIdInput: EditBox = null!;

    @property({ type: CCButton, tooltip: '确认提现按钮' })
    confirmBtn: CCButton = null!;

    @property({ type: Prefab, tooltip: '游戏内转账面板' })
    transferInGamePrefab: Prefab = null!;

    start() {
        this.titleLabel.string = '转账';

        const btn = this.confirmBtn.getComponent(Button);
        btn.onClick = () => {
            uiManager.createSidebar('Sidebar', Sidebar, SlideDirection.TOP, this.transferInGamePrefab);
        };
    }
}