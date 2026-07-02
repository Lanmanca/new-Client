import config from '@/config';
import { i18n } from '@/manager';
import { isNullOrEmpty } from '@/utils';
import { loadRemoteSpriteFrame } from '@/utils/loadRemoteSpriteFrame';
import {
    _decorator,
    Color,
    Graphics,
    Mask,
    Node,
    Sprite,
    UITransform,
    Widget
} from 'cc';
import { Form } from './Form';
import { FormItem } from './FormItem';
import { Modal } from './Modal';

const { ccclass, property } = _decorator;

const AVATAR_SIZE = 80;
const AVATAR_COLS = 5;
const AVATAR_OVERLAP_RATIO = 0.2; // 后一个头像覆盖前一个右边 20%
const AVATAR_STEP = AVATAR_SIZE * (1 - AVATAR_OVERLAP_RATIO); // 头像之间的 X 步进
const ROW_SPACING = 5; // 行间距

@ccclass('RoomInfo')
export class RoomInfo extends Modal {
    @property({ type: Node, tooltip: '表单容器' })
    form: Node = null;

    /**
     * 房间信息
     */
    roomInfo: Record<string, any> = {};

    onBeforeShow() {
        this.title = i18n.t('game.room_info.title');
        this.showClose = true;
        this.showCancel = false;
        this.showConfirm = false;
        this.init();

        const form = this.form.getComponent(Form);
        const items = config.ROOM_INFO;

        // 设置默认值（players 字段不再使用，但保留让 Form 渲染出 FormItem 壳）
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.key === 'playerList') continue;
            if (!isNullOrEmpty(this.roomInfo[item.key])) {
                item.defaultValue = this.roomInfo[item.key];
            }
        }

        // 确保 players 字段渲染（用于壳的 label + containerNode）
        const playersItem = items.find(i => i.key === 'players');
        if (playersItem) {
            playersItem.defaultValue = '';
        }

        form.items = items;

        // Form.start() 在下一帧才执行 _addItem，所以 scheduleOnce 延迟替换
        this.scheduleOnce(() => {
            this._replacePlayersWithAvatars();
        });
    }

    /**
     * 找到 players 的 FormItem 节点，清掉 Input 内容，替换为头像 Sprite
     */
    private _replacePlayersWithAvatars() {
        const playerList: Array<{ avatarUrl: string; nickname: string; isOwner: boolean }> =
            this.roomInfo['playerList'] || [];
        if (!playerList.length) return;

        // Form 的子节点就是按顺序添加的 FormItem 节点
        const formItemNodes = this.form.children;
        for (const itemNode of formItemNodes) {
            const formItem = itemNode.getComponent(FormItem);
            if (!formItem || formItem.props.key !== 'players') continue;

            const containerNode = formItem.containerNode;
            if (!containerNode) break;

            // 清空 Input 子节点
            containerNode.removeAllChildren();

            // 创建父节点：收纳多行头像（手动定位，不用 Layout）
            const wrapper = new Node('AvatarWrapper');
            const wrapperUi = wrapper.addComponent(UITransform);
            // 一行宽度（按最大列数预留）
            const rowFullWidth = AVATAR_SIZE + (AVATAR_COLS - 1) * AVATAR_STEP;
            const total = playerList.length;
            const rows = Math.ceil(total / AVATAR_COLS);
            const totalHeight = rows * AVATAR_SIZE + (rows - 1) * ROW_SPACING;
            wrapperUi.setContentSize(rowFullWidth, totalHeight);
            // 锚点设为左上角：wrapper.position 就是左上角，子节点 (0,0) 也是左上角
            wrapperUi.setAnchorPoint(0, 1);
            wrapper.layer = this.node.layer;
            containerNode.addChild(wrapper);

            // 用 Widget 让 wrapper 顶部+左边贴齐 containerNode（和原 Input 同样的上沿位置）
            const wrapperWidget = wrapper.addComponent(Widget);
            wrapperWidget.isAlignLeft = true;
            wrapperWidget.isAlignTop = true;
            wrapperWidget.left = 0;
            wrapperWidget.top = 0;
            wrapperWidget.updateAlignment();

            let playerIndex = 0;
            for (let row = 0; row < rows; row++) {
                // 这一行放的头像数量
                const countInRow = Math.min(AVATAR_COLS, total - playerIndex);

                // 每行容器（不使用 Layout，手动 setPosition 实现叠加）
                const rowNode = new Node(`AvatarRow_${row}`);
                const rowUi = rowNode.addComponent(UITransform);
                rowUi.setContentSize(rowFullWidth, AVATAR_SIZE);
                // 锚点 (0, 1)：左上角作为基准
                rowUi.setAnchorPoint(0, 1);
                rowNode.layer = this.node.layer;
                wrapper.addChild(rowNode);
                // 在 wrapper 左上坐标系中定位：x=0（左边），y = -row * (AVATAR_SIZE + ROW_SPACING)
                rowNode.setPosition(0, -row * (AVATAR_SIZE + ROW_SPACING), 0);

                for (let col = 0; col < countInRow; col++) {
                    const player = playerList[playerIndex];
                    const isOwner = !!player.isOwner;

                    // 父节点：仅作为定位容器
                    const avatarNode = new Node(`avatar_${playerIndex}`);
                    avatarNode.layer = this.node.layer;

                    const avatarUi = avatarNode.addComponent(UITransform);
                    avatarUi.setContentSize(AVATAR_SIZE, AVATAR_SIZE);
                    avatarUi.setAnchorPoint(0, 1);

                    rowNode.addChild(avatarNode);
                    // 在 rowNode 左上坐标系中：x=col*STEP（左对齐），y=0（顶对齐）
                    avatarNode.setPosition(col * AVATAR_STEP, 0, 0);

                    // 房主：绿色背景圆（Graphics 直接画圆，不靠 Mask 裁）
                    if (isOwner) {
                        const ownerBg = new Node('ownerBg');
                        ownerBg.layer = this.node.layer;

                        const bgUi = ownerBg.addComponent(UITransform);
                        bgUi.setContentSize(AVATAR_SIZE, AVATAR_SIZE);
                        bgUi.setAnchorPoint(0.5, 0.5);

                        const g = ownerBg.addComponent(Graphics);
                        g.fillColor = new Color().fromHEX('#4ade80');
                        // 以节点中心 (0,0) 为圆心，半径 = AVATAR_SIZE/2
                        g.circle(0, 0, AVATAR_SIZE / 2);
                        g.fill();

                        avatarNode.addChild(ownerBg);

                        const bgWidget = ownerBg.addComponent(Widget);
                        bgWidget.isAlignLeft = true;
                        bgWidget.isAlignRight = true;
                        bgWidget.isAlignTop = true;
                        bgWidget.isAlignBottom = true;
                        bgWidget.left = 0;
                        bgWidget.right = 0;
                        bgWidget.top = 0;
                        bgWidget.bottom = 0;
                    }

                    // photoMask：承载圆形头像（房主时缩 2px，非房主铺满）
                    const photoMask = new Node('photoMask');
                    photoMask.layer = this.node.layer;

                    const maskUi = photoMask.addComponent(UITransform);
                    maskUi.setContentSize(AVATAR_SIZE, AVATAR_SIZE);

                    const mask = photoMask.addComponent(Mask);
                    mask.type = Mask.Type.GRAPHICS_ELLIPSE;

                    avatarNode.addChild(photoMask);

                    const maskWidget = photoMask.addComponent(Widget);
                    maskWidget.isAlignLeft = true;
                    maskWidget.isAlignRight = true;
                    maskWidget.isAlignTop = true;
                    maskWidget.isAlignBottom = true;
                    maskWidget.left = isOwner ? 2 : 0;
                    maskWidget.right = isOwner ? 2 : 0;
                    maskWidget.top = isOwner ? 2 : 0;
                    maskWidget.bottom = isOwner ? 2 : 0;

                    // inner：Sprite，铺满 photoMask，被裁成圆
                    const innerNode = new Node('inner');
                    innerNode.layer = this.node.layer;

                    const innerUi = innerNode.addComponent(UITransform);
                    innerUi.setContentSize(AVATAR_SIZE, AVATAR_SIZE);

                    const sprite = innerNode.addComponent(Sprite);
                    sprite.type = Sprite.Type.SIMPLE;
                    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

                    photoMask.addChild(innerNode);

                    const innerWidget = innerNode.addComponent(Widget);
                    innerWidget.isAlignLeft = true;
                    innerWidget.isAlignRight = true;
                    innerWidget.isAlignTop = true;
                    innerWidget.isAlignBottom = true;
                    innerWidget.left = 0;
                    innerWidget.right = 0;
                    innerWidget.top = 0;
                    innerWidget.bottom = 0;

                    // 异步加载头像
                    const avatarUrl = player.avatarUrl;
                    if (avatarUrl) {
                        loadRemoteSpriteFrame(avatarUrl).then(sf => {
                            if (!innerNode.isValid) return;
                            sprite.spriteFrame = sf;
                        }).catch(() => {
                            console.warn('RoomInfo: 头像加载失败', avatarUrl);
                        });
                    }
                    playerIndex++;
                }
            }

            break;
        }
    }
}
