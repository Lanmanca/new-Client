import config from '@/config';
import { i18n } from '@/manager';
import { isNullOrEmpty } from '@/utils';
import { loadRemoteSpriteFrame } from '@/utils/loadRemoteSpriteFrame';
import { _decorator, Label, Layout, Node, Sprite, UITransform } from 'cc';
import { Form } from './Form';
import { Modal } from './Modal';

const { ccclass, property } = _decorator;

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

        // 设置默认值
        for (let i = 0; i < items.length; i++) {
            if (!isNullOrEmpty(this.roomInfo[items[i].key])) {
                items[i].defaultValue = this.roomInfo[items[i].key];
            }
        }

        form.items = items;

        // 等 Form.start() 执行完毕后再渲染头像区域
        this.scheduleOnce(() => {
            this.renderPlayerAvatars();
        }, 0);
    }

    /**
     * 在表单下方渲染玩家头像列表（40×40，水平排列，最多 9 个）
     */
    private async renderPlayerAvatars() {
        const players: any[] = this.roomInfo.players;
        if (!Array.isArray(players) || players.length === 0) return;

        // ── "玩家" 标题 ──
        const labelNode = new Node('PlayersLabel');
        labelNode.setParent(this.form.node);
        const labelUT = labelNode.addComponent(UITransform);
        labelUT.setContentSize(500, 28);
        const label = labelNode.addComponent(Label);
        label.string = i18n.t('game.room_info.players.title');
        label.fontSize = 14;
        label.lineHeight = 16;
        label.color.set(200, 200, 200, 255);
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;

        // ── 头像容器（水平排列）──
        const container = new Node('AvatarContainer');
        container.setParent(this.form.node);
        const containerUT = container.addComponent(UITransform);
        containerUT.setContentSize(500, 40);
        containerUT.setAnchorPoint(0, 0.5);
        const layout = container.addComponent(Layout);
        layout.type = Layout.Type.HORIZONTAL;
        layout.spacingX = 10;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;

        // ── 逐个创建头像节点（占位先行，图片异步加载）──
        for (const player of players) {
            const avatarUrl = player.avatarUrl || player.user?.avatarUrl;
            if (!avatarUrl) continue;

            const avatarNode = new Node('Avatar');
            avatarNode.setParent(container);
            const ut = avatarNode.addComponent(UITransform);
            ut.setContentSize(40, 40);
            ut.setAnchorPoint(0.5, 0.5);

            const sprite = avatarNode.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;

            // 异步加载远程头像
            this.loadAvatar(avatarUrl, sprite, avatarNode);
        }
    }

    /**
     * 异步加载远程头像图片，参照 PokerPile.setAvatar 实现
     */
    private async loadAvatar(url: string, sprite: Sprite, node: Node) {
        try {
            const spriteFrame = await loadRemoteSpriteFrame(url);
            if (node.isValid && sprite.isValid) {
                sprite.spriteFrame = spriteFrame;
            }
        } catch (error) {
            console.error('[RoomInfo] 头像加载失败', url, error);
        }
    }
}
