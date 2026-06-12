import { IInput, InputType } from '@/types/form';
import { debounce } from '@/utils';
import { _decorator, Component, EditBox, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Input')
export class Input extends Component implements IInput {
    @property({ type: EditBox, tooltip: '输入框' })
    editBox: EditBox;

    @property({ type: Number, tooltip: '防抖阈值' })
    debounceThreshold: number = 300;

    /**
     * 输入框类型
     */
    type: InputType = InputType.Text;
    /**
     * 最大长度
     */
    maxLength: number = -1;
    /**
     * 是否只允许整数
     */
    isInteger: boolean = false;

    readonly?: boolean = false;
    value: string = '';
    placeholder: string = '';
    onInput?: (value: string) => void;

    start() {
        this.editBox.string = this.value;
        this.editBox.placeholder = this.placeholder;

        switch (this.type) {
            case InputType.Number:
                if (this.isInteger) {
                    this.editBox.inputMode = EditBox.InputMode.NUMERIC;
                } else {
                    this.editBox.inputMode = EditBox.InputMode.DECIMAL;
                }
                break;
            case InputType.Password:
                this.editBox.inputFlag = EditBox.InputFlag.PASSWORD;
                break;
        }

        // 设置最大长度
        if (this.maxLength > 0) {
            this.editBox.maxLength = this.maxLength;
        }

        if (!this.readonly) {
            this.node.on(Node.EventType.TOUCH_END, this._onClick, this);
            this.editBox.node.on(EditBox.EventType.TEXT_CHANGED, this._onInput, this);
        } else {
            this.editBox.enabled = false;
        }
    }

    onDestroy() {
        if (this.node.isValid && !this.readonly) {
            this.node.off(Node.EventType.TOUCH_END, this._onClick, this);
            if (this.editBox.node && this.editBox.node.isValid) {
                this.editBox.node.off(EditBox.EventType.TEXT_CHANGED, this._onInput, this);
            }
        }
    }

    private _onInput(editBox: EditBox) {
        debounce(() => {
            this.value = editBox.string;
            if (this.onInput) {
                this.onInput(this.value);
            }
        }, this.debounceThreshold)();
    }

    private _onClick() {
        this.editBox.focus();
    }
}
