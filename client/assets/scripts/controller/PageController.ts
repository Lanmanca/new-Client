import { Navbar } from '@/component';
import config from '@/config';
import { uiManager } from '@/manager';
import { _decorator, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('PageController')
export class PageController extends Component {
    @property({ type: Node, tooltip: '页面容器' })
    pageContainer: Node;

    @property({ type: Node, tooltip: '导航栏' })
    navBar: Node;

    // 导航控制器
    navController: Navbar;

    // 当前页面
    currentPage: string;

    start() {
        this._init();
    }

    // 初始化
    private async _init() {
        this.navController = this.navBar.getComponent(Navbar);
        this.navController.navs = config.NAVBAR;
        this.navController.onNavigate = this.navigateTo.bind(this);
        const defaultPath =
            uiManager.currentPage || uiManager.currentNav || this.navController.navs[0].path;
        this.navController.navigateTo(defaultPath);
    }

    // 导航到页面
    public async navigateTo(path: string) {
        if (this.currentPage === path) return false;
        if (!(await uiManager.navigateTo({ page: path, parent: this.pageContainer, isNav: true }))) {
            return false;
        }

        this.currentPage = path;
        return true;
    }
}
