import { _decorator, Component, instantiate, Node, Prefab, ScrollView } from 'cc';
import { QuickItem } from './QuickItem';
const { ccclass, property } = _decorator;

@ccclass('PopLayer')
export class PopLayer extends Component {

    @property({ type: ScrollView, tooltip: '滚动视图' })
    scrollView: ScrollView;

    @property({ type: Node, tooltip: '内容节点' })
    contentNode: Node;

    @property({ type: Prefab, tooltip: '快捷语预制件' })
    QuickPrefab: Prefab;

    public onSelect: ((text: string) => void) | null = null;

    private quickItems: string[] = [
        '就这？也敢跟我打',
        '你这手，胆子挺大啊',
        '感觉你在硬撑',
        '这一把你要扛不住了吧',
        '别犹豫了，要么跟要么弃',
        '看你这操作，像在送分',
        '再跟下去就不好收场了',
        '我已经看透你了',
        '这局我吃定了',
        '你是不是在赌运气？',
        'All in 了，你敢不敢？',
        '不跟就认输吧',
        '这一手你翻不了盘',
        '别装了，你牌不行',
        '你这节奏已经乱了',
        '我等你犯错很久了',
        '你现在每一步都在亏',
        '再想想，你真的要跟吗？',
        '这局你已经被我带节奏了',
        '我就喜欢你这种不服的',
        '来，再加点筹码试试',
        '你这是在试探我吗？',
        '这把我陪你玩到底',
        '再来一手大的？',
        '你不会又要弃吧',
    ];

    start() {
        this.initQuickItems();
    }

    private initQuickItems() {
        for (const item of this.quickItems) {
            const quickItemNode = instantiate(this.QuickPrefab);
            quickItemNode.parent = this.contentNode;
            const quickItem = quickItemNode.getComponent(QuickItem);
            quickItem.setData(item);

            quickItem.onSelect = (text: string) => {
                // 转发给外部（Chat）
                this.onSelect?.(text);

                this.node.destroy();
            };
        }
    }
}


