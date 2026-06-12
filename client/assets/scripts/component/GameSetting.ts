import { _decorator, Component, Node } from 'cc';
import { Switch } from './index';
const { ccclass, property } = _decorator;

interface GameSettingChild {
    gameSoundEffect: Node,
    shock: Node
}

@ccclass('GameSetting')
export class GameSetting extends Component {

    @property({ type: Node, tooltip: '容器节点' })
    containerNode: Node = null!;

    private childNodes: GameSettingChild = null!;

    start() {
        this.childNodes = this.getChildNode();
        this.init();
    }

    private getChildNode(): GameSettingChild {
        return {
            gameSoundEffect: this.containerNode.getChildByPath('GameSoundEffects/Node/Switch'),
            shock: this.containerNode.getChildByPath('Shock/Node/Switch')
        }
    }

    init() {
        // 游戏音效开关
        const switchComponent = this.childNodes.gameSoundEffect.getComponent(Switch);
        switchComponent.onChange((state: boolean) => {
        });
        switchComponent.setState(true);
        // 震动开关
        const shockComponent = this.childNodes.shock.getComponent(Switch);
        shockComponent.onChange((state: boolean) => {
        });
        shockComponent.setState(true);
    }
}