import { ITabBarItem } from '@/types/tabbar';
import { _decorator, Color, Component, instantiate, Label, Prefab, UITransform } from 'cc';
import { TabbarItem } from './TabbarItem';

const { ccclass, property } = _decorator;

@ccclass('Tabbar')
export class Tabbar extends Component {

    @property({ type: Prefab, tooltip: 'tabbar item 预制件' })
    tabbarItemPrefab: Prefab = null;

    private _currentIndex: number = -1;

    // 数据
    public itemData: ITabBarItem[] = [];

    // UI列表
    private _items: ITabBarItem[] = [];

    init(item: TabbarItem) {
        this.scheduleOnce(() => {
            const labelWidth =
                item.labelNode.getComponent(UITransform).contentSize.width;
            item.rectNode.getComponent(UITransform).width = labelWidth;
        }, 0);
    }

    public setData(data: ITabBarItem[]) {
        this.itemData = data;

        // 清空旧的（避免重复）
        this.node.removeAllChildren();
        this._items = [];

        this.createTabbarItem();
        this.selectTab(0);
    }

    /**
     * 创建TabbarItem
     */
    private createTabbarItem() {
        if (this.itemData.length === 0) return;
        this.itemData.forEach((data, index) => {

            const node = instantiate(this.tabbarItemPrefab);
            const tabbarItem = node.getComponent(TabbarItem);
            tabbarItem.label = data.label;
            tabbarItem.icon = data.icon;
            tabbarItem.isSelectedBackground = data.isSelectedBackground;
            tabbarItem.iconPosition = data.iconPosition;
            tabbarItem.showRect = data.showRect;
            tabbarItem.background = data.background;
            tabbarItem.fontSize = data.fontSize;
            tabbarItem.showRect = data.showRect;

            this.node.addChild(node);
            this.init(tabbarItem);

            tabbarItem.onClick = async () => {

                // 切换选中
                this.selectTab(index);

                // 执行业务点击
                if (data.onClick) {
                    await data.onClick();
                }
            };

            this._items.push(tabbarItem);
            this.setItemInactive(tabbarItem);
        });
    }

    /**
     * 选择标签
     */
    public selectTab(index: number) {

        if (index < 0 || index >= this._items.length || index === this._currentIndex) {
            return;
        }

        if (this._currentIndex >= 0) {
            this.setItemInactive(this._items[this._currentIndex]);
        }

        this.setItemActive(this._items[index]);

        this._currentIndex = index;
    }

    /**
     * 激活
     */
    private setItemActive(item: ITabBarItem) {
        item.labelNode.getComponent(Label).color = new Color().fromHEX('#03FF85');
        if (item.isSelectedBackground) {
            item.backgroundSprite.color = new Color().fromHEX('#03FF85');
        }
        if (!item.showRect) return;
        item.rectNode.active = true;
    }

    /**
     * 非激活
     */
    private setItemInactive(item: ITabBarItem) {
        item.labelNode.getComponent(Label).color = new Color().fromHEX('#FFFFFF');
        if (item.isSelectedBackground) {
            item.backgroundSprite.color = new Color().fromHEX('#FFFFFF');
        }
        item.rectNode.active = false;
    }

    public getCurrentIndex() {
        return this._currentIndex;
    }
}