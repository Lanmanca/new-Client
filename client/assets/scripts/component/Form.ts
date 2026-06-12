import { IForm, IFormItem } from '@/types/form';
import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { FormItem } from './FormItem';
const { ccclass, property } = _decorator;

@ccclass('Form')
export class Form extends Component implements IForm {
    @property({ type: Number, tooltip: '间距' })
    spacing: number = 30;

    @property({ type: Prefab, tooltip: '表单项预制体' })
    itemPrefab: Prefab = null;

    items: IFormItem[] = [];

    /**
     * 表单项节点
     */
    private _itemNodes: Node[] = [];

    /**
     * 表单值
     */
    public get value() {
        return this._itemNodes.reduce((value, itemNode) => {
            const item = itemNode.getComponent(FormItem);
            return { ...value, ...item.value };
        }, {});
    }

    start() {
        this.items.forEach(item => this._addItem(item));
    }

    // 添加表单项
    private _addItem(item: IFormItem) {
        const itemNode = instantiate(this.itemPrefab);
        itemNode.getComponent(FormItem).props = item;
        this._itemNodes.push(itemNode);
        this.node.addChild(itemNode);
    }

    // 验证表单
    public async validate() {
        for (const itemNode of this._itemNodes) {
            const item = itemNode.getComponent(FormItem);
            if (!(await item.validate())) {
                return false;
            }
        }

        return true;
    }
}
