import { uiManager } from '@/manager';
import { _decorator, Button as CCButton, Component, EditBox, instantiate, Layout, Node, Prefab, ScrollView, UITransform, Vec3, Widget } from 'cc';
import { BaseMessage, ChatMessage, ChatMessageType, MessageType } from '../types/chat';
import { formatDate } from '../utils/index';
import { Button } from './Button';
import { ChatItem } from './ChatItem';
import { PopLayer } from './PopLayer';
const { ccclass, property } = _decorator;

@ccclass('Chat')
export class Chat extends Component {
    @property({ type: Node, tooltip: '聊天消息容器' })
    ChatMsgContainer: Node = null;

    @property({ type: EditBox, tooltip: '聊天输入框' })
    ChatInput: EditBox = null;

    @property({ type: Prefab, tooltip: '聊天消息预制体' })
    ChatMsgPrefab: Prefab = null;

    @property({ type: ScrollView, tooltip: '聊天滚动区域' })
    ChatScrollView: ScrollView = null;

    @property({ type: CCButton, tooltip: '快捷语言按钮' })
    ChatQuickBtn: CCButton = null;

    @property({ type: CCButton, tooltip: '发送按钮' })
    ChatSendBtn: CCButton = null;

    private quickPopNode: Node | null = null;

    messages: (BaseMessage & ChatMessage)[] = [
        {
            id: "msg_1001",
            type: MessageType.Chat,
            message_type: ChatMessageType.Notice,
            content: "欢迎进入聊天室，请文明发言，遵守社区规则。如果遇到问题可以联系管理员，我们会尽快为大家解决。",
            user_id: "system",
            device_id: "server",
            timestamp: 1710000000000
        },
        {
            id: "msg_1002",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "大家好 👋，我是刚进来的新人，第一次使用这个聊天室，看起来界面还挺不错的。我是刚进来的新人，第一次使用这个聊天室，看起来界面还挺不错的。我是刚进来的新人，第一次使用这个聊天室，看起来界面还挺不错的。我是刚进来的新人，第一次使用这个聊天室，看起来界面还挺不错的。",
            user_id: "user_001",
            device_id: "device_a1",
            timestamp: 1710000002000
        },
        {
            id: "msg_1003",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "你好！欢迎加入我们，这个聊天室平时还是挺热闹的，大家经常一起聊天和打游戏。你好！欢迎加入我们，这个聊天室平时还是挺热闹的，大家经常一起聊天和打游戏。你好！欢迎加入我们，这个聊天室平时还是挺热闹的，大家经常一起聊天和打游戏。你好！欢迎加入我们，这个聊天室平时还是挺热闹的，大家经常一起聊天和打游戏。你好！欢迎加入我们，这个聊天室平时还是挺热闹的，大家经常一起聊天和打游戏。你好！欢迎加入我们，这个聊天室平时还是挺热闹的，大家经常一起聊天和打游戏。你好！欢迎加入我们，这个聊天室平时还是挺热闹的，大家经常一起聊天和打游戏。",
            user_id: "user_002",
            device_id: "device_b2",
            timestamp: 1710000005000
        },
        {
            id: "msg_1004",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "@user_002 你今天在忙什么？我刚下班，现在正准备放松一下，打算看看有没有人一起玩游戏。",
            user_id: "user_001",
            device_id: "device_a1",
            timestamp: 1710000010000,
            at: ["user_002"]
        },
        {
            id: "msg_1005",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "我也是刚下班不久，准备打两把游戏放松一下，顺便在这里看看大家在聊什么。",
            user_id: "user_003",
            device_id: "device_c3",
            timestamp: 1710000014000
        },
        {
            id: "msg_1006",
            type: MessageType.Chat,
            message_type: ChatMessageType.Notice,
            content: "系统公告：今晚22:00服务器将进行例行维护，预计持续30分钟，请大家提前做好准备。",
            user_id: "system",
            device_id: "server",
            timestamp: 1710000020000
        },
        {
            id: "msg_1007",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "有人一起开黑吗？我刚上线，现在正好有时间，可以打几把排位或者娱乐模式。",
            user_id: "user_002",
            device_id: "device_b2",
            timestamp: 1710000023000
        },
        {
            id: "msg_1008",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "我可以，不过可能要等我十分钟，我先去倒杯水顺便整理一下桌面，很快就回来。",
            user_id: "user_001",
            device_id: "device_a1",
            timestamp: 1710000027000
        },
        {
            id: "msg_1009",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "我刚上线，还没开游戏呢，如果你们要开黑的话可以带我一个，我最近在练新英雄。",
            user_id: "user_003",
            device_id: "device_c3",
            timestamp: 1710000030000
        },
        {
            id: "msg_1010",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "那等下我们三个人一起排吧，人多一点配合也好打一点，不然单排太看队友了。",
            user_id: "user_002",
            device_id: "device_b2",
            timestamp: 1710000033000
        },
        {
            id: "msg_1011",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "@user_001 你平时玩什么位置？我们可以先商量一下分路，这样打起来比较有默契。",
            user_id: "user_003",
            device_id: "device_c3",
            timestamp: 1710000037000,
            at: ["user_001"]
        },
        {
            id: "msg_1012",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "我一般打辅助或者中路比较多，不过如果需要的话其他位置也可以试试。",
            user_id: "user_001",
            device_id: "device_a1",
            timestamp: 1710000040000
        },
        {
            id: "msg_1013",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "那我打野吧，我对地图节奏比较熟，带节奏应该没什么问题。",
            user_id: "user_002",
            device_id: "device_b2",
            timestamp: 1710000043000
        },
        {
            id: "msg_1014",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "行，那我走上路，我最近在练几个新英雄，正好可以试试看效果。",
            user_id: "user_003",
            device_id: "device_c3",
            timestamp: 1710000047000
        },
        {
            id: "msg_1015",
            type: MessageType.Chat,
            message_type: ChatMessageType.Notice,
            content: "系统提示：用户 user_003 已成功加入房间，现在房间人数为3人。",
            user_id: "system",
            device_id: "server",
            timestamp: 1710000050000
        },
        {
            id: "msg_1016",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "我准备好了，可以开始排队了，大家都确认一下自己的网络和设备状态。",
            user_id: "user_002",
            device_id: "device_b2",
            timestamp: 1710000054000
        },
        {
            id: "msg_1017",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "我这边也OK，网络很稳定，随时可以开始游戏。",
            user_id: "user_001",
            device_id: "device_a1",
            timestamp: 1710000057000
        },
        {
            id: "msg_1018",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "那我开房间了，你们稍等一下，我创建好之后把房间号发在这里。",
            user_id: "user_003",
            device_id: "device_c3",
            timestamp: 1710000060000
        },
        {
            id: "msg_1019",
            type: MessageType.Chat,
            message_type: ChatMessageType.Notice,
            content: "系统提示：游戏房间创建成功，房间号为 842173，请需要加入的玩家尽快进入。",
            user_id: "system",
            device_id: "server",
            timestamp: 1710000064000
        },
        {
            id: "msg_1020",
            type: MessageType.Chat,
            message_type: ChatMessageType.User,
            content: "冲冲冲！🚀 让我们看看今天的战绩怎么样，希望能连胜几把。",
            user_id: "user_001",
            device_id: "device_a1",
            timestamp: 1710000067000
        }
    ];

    start() {
        // 初始化聊天消息容器
        this.render(this.messages);
        this.setChatQuickBtn();

        this.scheduleOnce(() => {
            const layout = this.ChatMsgContainer.getComponent(Layout);
            if (layout) {
                layout.updateLayout();
            }

            this.ChatScrollView.scrollToBottom(0.3);
        }, 0);
    }

    public render(dataList?: (BaseMessage & ChatMessage)[]) {
        // 渲染聊天消息
        dataList.forEach(msg => {

            const msgNode = instantiate(this.ChatMsgPrefab);

            const item = msgNode.getComponent(ChatItem);

            if (msg.user_id === "user_001") {

                item.setMine(
                    '',
                    formatDate(msg.timestamp),
                    msg.content
                );

            } else if (msg.user_id === "system") {

                item.setSystem(msg.content);

            } else {

                item.setOther(
                    '',
                    formatDate(msg.timestamp),
                    msg.content
                );
            }

            this.ChatMsgContainer.addChild(msgNode);

        });
    }

    setChatQuickBtn() {
        const quickBtnTransform = this.ChatQuickBtn.getComponent(UITransform);
        quickBtnTransform.setContentSize(50, 50);

        const btn = this.ChatQuickBtn.getComponent(Button);
        btn.color = '#FFFFFF';

        btn.onClick = () => {
            // 如果已经打开了，再次点击则关闭
            if (this.quickPopNode && this.quickPopNode.isValid) {
                uiManager.destroyPopLayer(this.quickPopNode);
                this.quickPopNode = null;
                return;
            }

            // 先把弹窗创建出来（初始位置传 Vec3.ZERO 即可，稍后我们精准设置）
            // 注意：uiManager.createPopLayer 必须是一个同步方法，或者你在这里需要 await
            this.quickPopNode = uiManager.createPopLayer('PopLayer', Vec3.ZERO);

            if (!this.quickPopNode || !this.quickPopNode.parent) {
                console.warn("PopLayer 创建失败或未被添加到节点树中");
                return;
            }

            // 刷新按钮世界矩阵，确保它在滚动或布局后的位置是最新的
            btn.node.updateWorldTransform();

            // 获取按钮的绝对世界坐标
            const btnWorldPos = btn.node.getWorldPosition();

            // 将坐标转换为【弹窗真实的父节点】的局部坐标空间
            const parentTransform = this.quickPopNode.parent.getComponent(UITransform);
            const targetLocalPos = parentTransform.convertToNodeSpaceAR(btnWorldPos);

            // 获取按钮和弹窗的尺寸与锚点信息，进行精准定位
            const popTransform = this.quickPopNode.getComponent(UITransform);

            // 计算按钮中心点到按钮顶部的距离 = 高度 * (1 - Y轴锚点)
            const btnTopOffset = quickBtnTransform.height * (1 - quickBtnTransform.anchorY);

            // 计算弹窗中心点到底部的距离 = 高度 * Y轴锚点
            const popBottomOffset = popTransform.height * popTransform.anchorY;

            // 目标 Y 坐标 = 按钮坐标Y + 按钮上半部分高度 + 弹窗下半部分高度 + 间距(20)
            targetLocalPos.y += btnTopOffset + popBottomOffset + 20;
            targetLocalPos.x -= 100;  // 向左偏移一段像素

            // 关键拦截：如果弹窗 Prefab 上挂载了 Widget，必须禁用它，否则上面算好的坐标会被重写
            const widget = this.quickPopNode.getComponent(Widget);
            if (widget) {
                widget.enabled = false;
            }

            // 赋予最终的精准位置
            this.quickPopNode.setPosition(targetLocalPos);

            // 绑定回调事件
            const ui = this.quickPopNode.getComponent(PopLayer);
            if (ui) {
                ui.onSelect = (text: string) => {
                    this.ChatInput.string = text;
                    // 赋值文字后销毁弹窗
                    uiManager.destroyPopLayer(this.quickPopNode);
                    this.quickPopNode = null;
                };
            }
        };
    }

    // 销毁时调用的方法
    onDestroy() {
        if (this.quickPopNode && this.quickPopNode.isValid) {
            uiManager.destroyPopLayer(this.quickPopNode);
            this.quickPopNode = null;
        }
    }
}