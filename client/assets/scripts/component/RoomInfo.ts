import config from '@/config';
import { i18n } from '@/manager';
import { isNullOrEmpty } from '@/utils';
import { _decorator, Node } from 'cc';
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
    }
}
