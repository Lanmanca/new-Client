import { Button, KeyInput, RoomSettings } from '@/component';
import { APIManager, i18n, roomManager, uiManager } from '@/manager';
import { IRoomSettings } from '@/types/room';
import { _decorator, Button as CButton, Component, Label, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    @property({ type: Label, tooltip: '房间号输入提示' })
    roomInputTip: Label;

    @property({ type: Label, tooltip: '或' })
    orLabel: Label;

    @property({ type: Node, tooltip: '房间号输入框' })
    roomInput: Node;

    @property({ type: CButton, tooltip: '创建房间按钮' })
    createRoomButton: CButton;

    start() {
        this.roomInputTip.string = i18n.t('pages.game.room_input_tip');
        this.orLabel.string = i18n.t('pages.game.or');

        const button = this.createRoomButton.getComponent(Button);
        button.label = i18n.t('pages.game.create_button');
        button.onClick = this.createRoom.bind(this);

        const roomInput = this.roomInput.getComponent(KeyInput);
        roomInput.onDone = this.joinRoom.bind(this);
    }

    /**
     * 创建房间
     */
    async createRoom() {
        let roomSettings: IRoomSettings;
        await uiManager.createModal('RoomSettings', RoomSettings, {
            onConfirm: _roomSettings => {
                roomSettings = _roomSettings;
                return true;
            },
        });
        if (roomSettings) {
            const result = await APIManager.createRoom(roomSettings);
            if (!result.status) return false;

            return await roomManager.joinRoom(result.data);
        }
    }

    /**
     * 加入房间
     */
    async joinRoom(roomId: string) {
        if (!roomId || roomId.length !== 6) return false;

        const result = await APIManager.joinRoom(roomId);
        if (!result.status) return false;

        return await roomManager.joinRoom(result.data);
    }
}
