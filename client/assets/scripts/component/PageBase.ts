import { i18n, imageManager, uiManager } from '@/manager';
import { _decorator, Component, instantiate, Label, Node, Prefab, Sprite } from 'cc';
const { ccclass, property } = _decorator;

interface PagesChild {
    back: Node,
    title: Label,
    funCBtn: Node,
}

@ccclass('PageBase')
export class PageBase extends Component {

    @property({ type: Node, tooltip: '容器节点' })
    container: Node = null!;

    @property({ type: Node, tooltip: '内容节点' })
    content: Node = null!;

    start() {
        const { back } = this.getChildNode();
        back.on(Node.EventType.TOUCH_END, () => {
            uiManager.navigateBack();
        }, this);
    }

    private getChildNode(): PagesChild {
        return {
            back: this.container.getChildByPath('TopNode/Back'),
            title: this.container.getChildByPath('TopNode/title').getComponent(Label),
            funCBtn: this.container.getChildByPath('TopNode/FunCBtn'),
        }
    }

    public setTitle(titleValue: string) {
        const { title } = this.getChildNode();
        title.string = i18n.t(`pages.${titleValue}.title`);
    }

    public setContent(prefab: Prefab) {
        this.content.removeAllChildren();
        const node = instantiate(prefab);
        node.setParent(this.content);
    }

    public setFunCBtn(BtnList: { icon: string, onClick: () => void }[]) {
        if (!BtnList || BtnList.length === 0) return;
        const { funCBtn } = this.getChildNode();

        // 获取第一个 Btn 节点作为模板
        const templateBtn = funCBtn.getChildByName('Btn');
        if (!templateBtn) {
            console.warn('未找到 Btn 模板节点');
            return;
        }

        // 获取 funCBtn 下所有 Btn 节点
        let btnNodes = funCBtn.children.filter(child => child.name === 'Btn');

        // 如果已有的 Btn 节点数少于需要的数量，就克隆新的 Btn 节点
        if (btnNodes.length < BtnList.length) {
            const needCloneCount = BtnList.length - btnNodes.length;
            for (let i = 0; i < needCloneCount; i++) {
                // 克隆第一个 Btn 节点
                const clonedBtn = instantiate(templateBtn);
                // 添加到 funCBtn 中
                clonedBtn.setParent(funCBtn);
            }
            // 更新 btnNodes 列表
            btnNodes = funCBtn.children.filter(child => child.name === 'Btn');
        }
        // 配置每个按钮
        BtnList.forEach((btnConfig, index) => {
            if (index >= btnNodes.length) return;

            const btnNode = btnNodes[index];

            // 获取 icon 子节点并设置图片
            const iconNode = btnNode.getChildByName('icon');
            if (iconNode) {
                const sprite = iconNode.getComponent(Sprite);
                if (sprite) {
                    sprite.spriteFrame = imageManager.getUIImage(btnConfig.icon);
                }
            }

            // 绑定点击事件
            btnNode.off(Node.EventType.TOUCH_END, null, this);
            btnNode.on(Node.EventType.TOUCH_END, () => {
                btnConfig.onClick();
            }, this);
        });
    }
}