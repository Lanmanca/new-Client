import { IRadioGroup, IToggle } from '@/types/form';
import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { Toggle } from './Toggle';
const { ccclass, property } = _decorator;

@ccclass('RadioGroup')
export class RadioGroup extends Component implements IRadioGroup {
    @property({ type: Prefab, tooltip: '单选项预制体' })
    radioPrefab: Prefab = null;

    readonly: boolean = false;
    items: IToggle[] = [];
    value: string | number | boolean = '';
    onChange?: (value: string | number | boolean) => void;

    // 单选项节点列表
    private nodes: Node[] = [];
    // 单选项组件列表
    private toggles: Toggle[] = [];

    start() {
        this.createRadio();
        this.toggles.forEach(toggle => {
            toggle.setChecked(toggle.value === this.value);
        });
    }

    onDestroy() {
        this.nodes.forEach(node => {
            if (node && node.isValid) {
                node.destroy();
            }
        });
        this.nodes = [];
        this.toggles = [];
    }

    // 创建单选项
    private createRadio() {
        this.items.forEach(item => {
            const radioNode = instantiate(this.radioPrefab);
            const radio = radioNode.getComponent(Toggle);
            radio.text = item.text;
            radio.value = item.value;
            radio.checked = this.value === item.value;
            radio.onChange = this.onToggle.bind(this);
            radio.readonly = this.readonly;
            this.toggles.push(radio);
            this.nodes.push(radioNode);
            this.node.addChild(radioNode);
        });
    }

    /**
     * 监听状态更改
     * @param value Toggle的值
     * @param isChecked 是否选中
     */
    public onToggle(value: string | number, isChecked: boolean) {
        if (this.value === value) return;

        if (isChecked) {
            this.value = value;
        }

        this.toggles.forEach(toggle => {
            toggle.setChecked(toggle.value === value);
        });

        if (this.onChange) {
            this.onChange(value);
        }
    }
}
