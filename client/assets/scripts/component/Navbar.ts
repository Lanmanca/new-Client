import config from '@/config';
import { imageManager } from '@/manager';
import { INavItem } from '@/types/nav';
import { _decorator, Color, Component, instantiate, Node, Prefab } from 'cc';
import { NavbarItem } from './NavbarItem';

const { ccclass, property } = _decorator;

@ccclass('Navbar')
export class Navbar extends Component {
    @property({ type: Prefab, tooltip: '导航项预制体' })
    navbarItemPrefab: Prefab = null;

    @property({ type: Node, tooltip: '导航项渲染的容器节点' })
    container: Node = null;

    @property({ type: Color, tooltip: '导航项默认颜色' })
    defaultColor: Color = new Color().fromHEX(config.THEME_COLOR.secondary);

    @property({ type: Color, tooltip: '导航项选中颜色' })
    selectedColor: Color = new Color().fromHEX(config.THEME_COLOR.primary);

    navs: INavItem[] = [];

    // 跳转回调
    public onNavigate: (path: string) => boolean | Promise<boolean> = null;

    // 当前路径
    private _currentPath: string = '';
    private _navController: NavbarItem[] = [];

    start() {
        this.createNavbar();
    }

    // 创建导航栏
    private createNavbar() {
        this.navs.forEach(item => {
            const navbarItem = instantiate(this.navbarItemPrefab);
            const navbarItemController = navbarItem.getComponent(NavbarItem);
            navbarItemController.icon = imageManager.getNavbarIcon(item.icon);
            navbarItemController.path = item.path;
            navbarItemController.defaultColor = this.defaultColor;
            navbarItemController.selectedColor = this.selectedColor;
            navbarItemController.label = item.name;
            navbarItemController.showLabel = item.showLabel ?? true;
            navbarItemController.onClick = () => this.navigateTo(item.path);

            this._navController.push(navbarItemController);
            this.container.addChild(navbarItem);
        });
    }

    // 跳转到指定路由
    public async navigateTo(path: string) {
        if (this._currentPath === path) return;

        // 调用跳转回调
        if (this.onNavigate) {
            let result = this.onNavigate(path);
            if (result instanceof Promise) {
                result = await result;
            }

            if (!result) return;
        }

        // 选中当前导航项
        this._navController.forEach(item => {
            if (item.path === path) {
                item.selected();
            } else {
                item.unselected();
            }
        });

        this._currentPath = path;
    }
}
