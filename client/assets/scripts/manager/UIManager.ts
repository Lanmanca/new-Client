import { BaseUI, Form, Loading, Mask, Modal, PageBase, Sidebar, Toast } from '@/component';
import { IFormItem } from '@/types/form';
import { IAlert, IConfirm, IModalOptions } from '@/types/modal';
import { ISidebar, SlideDirection } from '@/types/sidebar';
import { IState } from '@/types/state';
import Log from '@/utils/Log';
import { AssetManager, assetManager, director, find, instantiate, Layout, Node, Prefab, UITransform, Vec3, Widget } from 'cc';
import { animationManager } from './AnimationManager';
import { i18n } from './I18nManager';
import { taskManager } from './TaskManager';

/**
 * UI管理器
 */
class UIManager {
    private static _instance: UIManager;
    public static get instance(): UIManager {
        if (!this._instance) {
            this._instance = new UIManager();
        }
        return this._instance;
    }

    // 组件缓存
    private components: Map<string, Prefab> = new Map();
    // 页面缓存
    private pages: Map<string, Prefab> = new Map();
    // 导航缓存
    private navPages: Map<string, Node> = new Map();
    // 页面堆栈
    private history: { page: Node; path: string }[] = [];
    // 当前导航
    public currentNav: string = '';
    // 当前页面
    public currentPage: string = '';
    // 任务管理器
    private tasks: Map<string, string> = new Map();

    /**
     * 初始化
     */
    public init() {
        return new Promise<IState>(resolve =>
            assetManager.loadBundle('prefabs', async (err, bundle) => {
                if (err) {
                    resolve({ status: false, message: err.message });
                    return;
                }

                try {
                    await this.loadPrefabs(bundle, 'components', this.components);
                    await this.loadPrefabs(bundle, 'pages', this.pages);

                    resolve({ status: true });
                } catch (error) {
                    resolve({ status: false, message: error.message });
                }
            })
        );
    }

    /**
     * 加载预制体
     */
    private loadPrefabs(
        bundle: AssetManager.Bundle,
        dir: string,
        cache: Map<string, Prefab>
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            bundle.loadDir(dir, Prefab, (err, prefabs) => {
                if (err) {
                    reject(err);
                    return;
                }

                prefabs.forEach(prefab => {
                    cache.set(prefab.name, prefab);
                });
                resolve();
            });
        });
    }

    /**
     * 切换场景
     * @param scene 场景名称
     */
    public async switchScene(scene: string) {
        return new Promise<boolean>(resolve => {
            director.loadScene(scene, async err => {
                if (err) {
                    await uiManager.alert({ content: err.message });
                    resolve(false);
                    return;
                }
                const currentScene = director.getScene();
                if (!currentScene) {
                    await uiManager.alert({ content: i18n.t('scenes.error.not_found') });
                    resolve(false);
                }
                resolve(true);
            });
        });
    }

    /**
     * 返回上一页面
     */
    public async navigateBack() {
        if (this.history.length > 0) {
            const { page } = this.history.pop();
            if (page && page.isValid) {
                page.destroy();
            }

            if (this.history.length > 0) {
                const prevPage = this.history[this.history.length - 1];
                this.currentPage = prevPage.path;

                prevPage.page.active = true;
            }
        } else {
            if (this.currentNav) {
                const navPage = this.navPages.get(this.currentNav);
                navPage.active = true;
            }
        }
    }

    /**
    * 跳转到页面
    * 如果是导航，将会清空堆栈，否则将会压入堆栈
    * @param options 导航选项
    */
    public async navigateTo(options: {
        /** 页面名称 */
        page: string,
        /** 父节点 */
        parent?: Node,
        /** 是否是导航 */
        isNav?: boolean,
        /** 导航前回调 */
        before?: () => boolean | Promise<boolean>,
        /** 页面内容预制体（用于非导航页面，将通过Pages壳子加载）可以是 Prefab 对象或预制体名称字符串 */
        contentPrefab?: Prefab | string,
        /** 功能按钮列表*/
        btnList?: { icon: string, onClick: () => void }[],
    }) {
        if (options.before && typeof options.before === 'function') {
            const loading = uiManager.loading();
            let result = null;
            if (options.before instanceof Promise) {
                result = await options.before();
                if (!result) {
                    loading.hide();
                    return;
                }
            }
            loading.hide();
        }

        options.parent = options.parent || this.getRootNode();
        const clearTimeout = 5;

        // 如果是导航页面
        if (options.isNav) {
            const key = `page_${options.page}`;
            if (this.tasks.has(key)) {
                taskManager.cancel(this.tasks.get(key));
            }
        }

        let node: Node;
        if (this.navPages.has(options.page)) {
            node = this.navPages.get(options.page);

            // 如果页面因为场景切换导致销毁，这里将其标记为 undefined，确保正常重新加载
            if (!node.name) {
                node = undefined;
                this.navPages.delete(options.page);
            } else {
                node.active = true;
            }
        }

        if (!node) {
            // 如果不是导航页面且提供了内容预制体，使用Pages壳子
            if (!options.isNav && options.contentPrefab) {
                // 如果 contentPrefab 是字符串，从 components 中获取
                let contentPrefab = options.contentPrefab;
                if (typeof contentPrefab === 'string') {
                    contentPrefab = this.components.get(contentPrefab);
                    if (!contentPrefab) {
                        await uiManager.alert({ content: i18n.t('pages.error.not_found') });
                        return false;
                    }
                }

                const pagesPrefab = this.components.get('PageBase');
                if (pagesPrefab) {
                    node = instantiate(pagesPrefab);
                    const pagesComponent = node.getComponent(PageBase);
                    if (pagesComponent) {
                        pagesComponent.setContent(contentPrefab as Prefab);
                        pagesComponent.setFunCBtn(options.btnList);
                        if (options.page) {
                            pagesComponent.setTitle(options.page);
                        }
                    }
                } else {
                    // Pages预制体不存在，降级到原来的逻辑
                    const prefab = this.pages.get(options.page);
                    if (!prefab) {
                        await uiManager.alert({ content: i18n.t('pages.error.not_found') });
                        return false;
                    }
                    node = instantiate(prefab);
                }
            } else {
                // 导航页面或没有提供内容预制体，使用原来的逻辑
                const prefab = this.pages.get(options.page);
                if (!prefab) {
                    await uiManager.alert({ content: i18n.t('pages.error.not_found') });
                    return false;
                }
                node = instantiate(prefab);
            }

            options.parent.addChild(node);
        }

        // 缓存页面
        if (options.isNav) {
            // 延迟清理旧导航页面，避免用户快速切换页面
            if (this.currentNav && this.currentNav !== options.page) {
                const oldPage = this.currentNav;
                const taskId = taskManager.submitDelay(
                    () => {
                        const navPage = this.navPages.get(oldPage);
                        if (navPage && navPage.isValid) {
                            navPage.destroy();
                        }
                        this.navPages.delete(oldPage);
                        Log.d('UIManager', `Deleted old page: ${oldPage}`);
                    },
                    [],
                    clearTimeout
                );

                // 隐藏旧导航页面
                if (this.navPages.has(oldPage)) {
                    this.navPages.get(oldPage).active = false;
                }

                this.tasks.set(`page_${oldPage}`, taskId);
            }

            if (!this.navPages.has(options.page)) {
                this.navPages.set(options.page, node);
            }

            this.history = [];

            // 设置当前导航
            this.currentNav = options.page;
        } else {
            // 隐藏上一页面
            if (this.history.length > 0) {
                const prevPage = this.history[this.history.length - 1];
                prevPage.page.active = false;
            } else {
                if (this.currentNav) {
                    const navPage = this.navPages.get(this.currentNav);
                    navPage.active = false;

                    this.history.push({
                        page: navPage,
                        path: this.currentNav
                    });
                }
            }

            this.history.push({ page: node, path: options.page });

            // 设置当前页面
            this.currentPage = options.page;
        }

        return true;
    }

    /**
     * 创建并显示弹窗
     */
    public createPopLayer(
        name: string,
        position?: Vec3
    ) {
        const prefab = this.components.get(name);
        if (!prefab) return;

        const node = instantiate(prefab);

        const root = this.getRootNode();
        node.setParent(root);

        const widget = node.getComponent(Widget);
        if (widget) widget.enabled = false;

        const parentLayout = root.getComponent(Layout);
        if (parentLayout) parentLayout.enabled = false;

        node.setPosition(position ?? new Vec3(0, 0, 0));

        return node;
    }

    /**
     * 销毁弹窗节点
     * @param node 要销毁的节点
     */
    public destroyPopLayer(node: Node | null) {
        if (node && node.isValid) {
            node.destroy();
        }
    }

    /**
     * 创建侧边栏
     */
    public createSidebar(
        name: string,
        component?: new (...args: any[]) => BaseUI,
        direction?: SlideDirection,
        contentPrefab?: Prefab
    ): Promise<boolean> {

        return new Promise(async resolve => {

            // 获取 Sidebar 预制体
            const sidebar = this.components.get(name);

            if (!sidebar) {
                console.warn('Sidebar 未注册:', name);
                resolve(false);
                return;
            }

            // 创建节点
            const node = instantiate(sidebar);
            // 挂载到 Canvas
            this.getRootNode().addChild(node);

            // 获取组件
            const ui = node.getComponent(component ?? Sidebar) as ISidebar & BaseUI;

            if (ui) {
                ui.direction = direction;

                if (contentPrefab && ui instanceof Sidebar) {
                    ui.init(contentPrefab);
                }

                ui['onClose'] = () => {
                    resolve(false);
                }
            }

            await animationManager.playSlideIn(node, direction);
        });
    }

    /**
     * 关闭侧边栏
     */
    public closeSidebar(node: Node, direction: SlideDirection) {
        const transform = node.getComponent(UITransform);
        const width = transform.width;
        const height = transform.height;

        let targetX = 0;
        let targetY = 0;

        if (direction === SlideDirection.RIGHT) {
            targetX = -width;
        } else if (direction === SlideDirection.LEFT) {
            targetX = width;
        } else if (direction === SlideDirection.TOP) {
            targetY = -height;
        } else if (direction === SlideDirection.BOTTOM) {
            targetY = height;
        }

        node.pauseSystemEvents(true);

        animationManager.playSlideOut(node, direction);
    }

    /**
     * 获取根节点
     */
    private getRootNode() {
        return find('Canvas');
    }

    /**
     * 创建并显示遮罩
     */
    public createMask(isOpacity: boolean = false) {
        const mask = this.components.get('Mask');
        const maskNode = instantiate(mask);
        maskNode.getComponent(Mask).isOpacity = isOpacity;
        return maskNode;
    }

    /**
     * 创建并显示模态框
     */
    public createModal(
        name: string,
        component?: new (...args: any[]) => BaseUI,
        options?: IModalOptions
    ): Promise<boolean> {
        return new Promise(resolve => {
            const { onLoad, onConfirm, onCancel } = options;

            const modal = this.components.get(name);
            if (!modal) {
                return;
            }

            const node = instantiate(modal);

            if (onLoad) {
                onLoad(node);
            }

            const ui = node.getComponent(component ?? Modal) as IModalOptions & BaseUI;

            const maskNode = this.createMask();

            ui.onConfirm = async (...args: any) => {
                if (onConfirm) {
                    let shouldClose = onConfirm(...args);
                    if (shouldClose instanceof Promise) {
                        shouldClose = await shouldClose;
                    }
                    if (!shouldClose) {
                        return false;
                    }
                }

                maskNode.destroy();
                resolve(true);

                return true;
            };

            ui.onCancel = async () => {
                if (onCancel) {
                    let shouldClose = onCancel();
                    if (shouldClose instanceof Promise) {
                        shouldClose = await shouldClose;
                    }
                    if (!shouldClose) {
                        return false;
                    }
                }

                maskNode.destroy();
                resolve(false);

                return true;
            };

            this.getRootNode().addChild(maskNode);
            this.getRootNode().addChild(node);
        });
    }

    /**
     * 公共弹窗 Modal + Form 预制体（与创房用的 RoomSettings 页面无关）
     */
    public showFormModal(option: {
        title: string;
        items: IFormItem[];
        confirmText?: string;
        cancelText?: string;
        showCancel?: boolean;
        onConfirm: (data: Record<string, unknown>) => boolean | Promise<boolean>;
        onCancel?: () => boolean | Promise<boolean>;
    }): Promise<boolean> {
        return new Promise(resolve => {
            const formPrefab = this.components.get('Form');
            const modalPrefab = this.components.get('Modal');
            if (!formPrefab || !modalPrefab) {
                Log.e('UIManager.showFormModal', 'Form 或 Modal 预制体未加载');
                resolve(false);
                return;
            }

            const formNode = instantiate(formPrefab);
            const form = formNode.getComponent(Form);
            form.items = option.items;

            // Form 预制件设计尺寸为 720×1280（全屏页面），直接塞进 Modal 的 content（视口高约 320）
            // 会被 ScrollView 误判为内容溢出而出现多余的滚动条。此处压成一个紧凑高度，
            // 并禁用其 Widget 全方位对齐（避免它把自身拉回 1280），让 content 仅按实际表单项高度自适应。
            const formUi = formNode.getComponent(UITransform);
            if (formUi) {
                const itemCount = Math.max(1, option.items?.length ?? 1);
                // 每项约 90 + 间距 30，预留顶部留白
                const compactHeight = itemCount * 90 + (itemCount - 1) * 30 + 40;
                formUi.setContentSize(560, compactHeight);
            }
            const formWidget = formNode.getComponent(Widget);
            if (formWidget) {
                formWidget.alignMode = Widget.AlignMode.ALWAYS;
                formWidget.alignFlags = 0;
                formWidget.updateAlignment();
            }

            const modalNode = instantiate(modalPrefab);
            const modalCmp = modalNode.getComponent(Modal);
            const maskNode = this.createMask();

            modalCmp.title = option.title;
            modalCmp.showCancel = option.showCancel !== false;
            modalCmp.showConfirm = true;
            modalCmp.showClose = false;
            modalCmp.confirmText = option.confirmText ?? i18n.t('modal.confirm');
            modalCmp.cancelText = option.cancelText ?? i18n.t('modal.cancel');
            modalCmp.content = formNode;

            modalCmp.onConfirm = async () => {
                const valid = await form.validate();
                if (!valid) {
                    return false;
                }
                const data = form.value as Record<string, unknown>;
                const ok = await Promise.resolve(option.onConfirm(data));
                if (ok) {
                    maskNode.destroy();
                    resolve(true);
                }
                return ok;
            };

            modalCmp.onCancel = async () => {
                if (option.onCancel) {
                    const c = await Promise.resolve(option.onCancel());
                    if (!c) {
                        return false;
                    }
                }
                maskNode.destroy();
                resolve(false);
                return true;
            };

            this.getRootNode().addChild(maskNode);
            this.getRootNode().addChild(modalNode);
        });
    }

    /**
     * 确认对话框
     */
    public async confirm(option: IConfirm): Promise<boolean> {
        return new Promise(resolve => {
            const {
                title,
                content,
                confirmText,
                cancelText,
                onConfirm = () => true,
                onCancel = () => true,
            } = option;

            const modal = this.components.get('Modal');
            const node = instantiate(modal);
            const confirm = node.getComponent(Modal);

            const maskNode = this.createMask();

            // 设置模态框属性
            confirm.showClose = false;
            confirm.showCancel = true;
            confirm.title = title ? title : i18n.t('modal.title');
            confirm.confirmText = confirmText ? confirmText : i18n.t('modal.confirm');
            confirm.cancelText = cancelText ? cancelText : i18n.t('modal.cancel');
            confirm.content = content;

            // 设置回调函数
            confirm.onConfirm = async () => {
                let shouldClose = onConfirm();
                if (shouldClose instanceof Promise) {
                    shouldClose = await shouldClose;
                }
                if (!shouldClose) {
                    resolve(false);
                } else {
                    resolve(true);
                    maskNode.destroy();
                }

                return shouldClose;
            };

            confirm.onCancel = async () => {
                let shouldClose = onCancel();
                if (shouldClose instanceof Promise) {
                    shouldClose = await shouldClose;
                }
                if (!shouldClose) {
                    resolve(false);
                } else {
                    resolve(true);
                    maskNode.destroy();
                }

                return shouldClose;
            };

            // 显示模态框
            this.getRootNode().addChild(maskNode);
            this.getRootNode().addChild(node);
        });
    }

    /**
     * 提示框
     */
    public alert(option: IAlert): Promise<boolean> {
        return new Promise(resolve => {
            const { title, content, confirmText, onConfirm = () => true } = option;

            const modal = this.components.get('Modal');
            const node = instantiate(modal);
            const alert = node.getComponent(Modal);

            const maskNode = this.createMask();

            // 设置模态框属性
            alert.showClose = false;
            alert.showCancel = false;
            alert.title = title ? title : i18n.t('modal.title');
            alert.confirmText = confirmText ? confirmText : i18n.t('modal.confirm');
            alert.content = content;

            // 设置回调函数
            alert.onConfirm = async () => {
                let shouldClose = onConfirm();
                if (shouldClose instanceof Promise) {
                    shouldClose = await shouldClose;
                }
                if (!shouldClose) {
                    resolve(false);
                } else {
                    resolve(true);
                    maskNode.destroy();
                }

                return shouldClose;
            };

            // 显示模态框
            this.getRootNode().addChild(maskNode);
            this.getRootNode().addChild(node);
        });
    }

    /**
     * 轻提示
     */
    public toast(message: string) {
        const prefab = this.components.get('Toast');
        const node = instantiate(prefab);
        const toast = node.getComponent(Toast);

        const maskNode = this.createMask(true);

        toast.content = message;
        toast.callBack = () => {
            maskNode.destroy();
        };

        this.getRootNode().addChild(maskNode);
        this.getRootNode().addChild(node);
    }

    /**
     * 加载中
     */
    public loading() {
        const prefab = this.components.get('Loading');
        const node = instantiate(prefab);
        const loading = node.getComponent(Loading);
        const maskNode = this.createMask();

        this.getRootNode().addChild(maskNode);
        this.getRootNode().addChild(node);

        const loadingController = {
            hide: async () => {
                await loading.hideAndWait();
                maskNode.destroy();
                node.destroy();
            },
        };

        return loadingController;
    }

    /**
     * 获取已缓存的组件预制体（prefabs/components 目录下资源的 name，如 Button）
     */
    public getComponentPrefab(name: string): Prefab | undefined {
        return this.components.get(name);
    }
}

export const uiManager = UIManager.instance;