import { uiManager } from '@/manager';
import { _decorator, Component } from 'cc';
import { Button } from './Button';
const { ccclass, property } = _decorator;

@ccclass('Help')
export class Help extends Component {
    @property({ type: String, tooltip: '提示内容' })
    content: string = '';

    start() {
        const button = this.node.getComponent(Button);
        button.onClick = this.showHelp.bind(this);
    }

    showHelp() {
        uiManager.toast(this.content);
    }
}
