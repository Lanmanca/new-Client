import { _decorator, Component, EditBox, EventHandler, instantiate, Node, Prefab } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('KeyInput')
export class KeyInput extends Component {
    @property({ type: Prefab, tooltip: '输入框预制体' })
    inputPrefab: Prefab = null;

    @property({ type: Number, tooltip: '输入框数量' })
    inputCount: number = 6;

    /**
     * 输入完成回调
     */
    public onDone: (value: string) => void = null;

    private _inputNodes: Node[] = [];
    private _editBoxComponents: EditBox[] = [];
    private _currentInputIndex: number = 0;
    private _hasListener: boolean = false;

    private _boundHandleDelete: (event: KeyboardEvent) => void = null!;

    start() {
        this._boundHandleDelete = this.handleDelete.bind(this);
        this.createInput();

        this.node.on(Node.EventType.TOUCH_END, this.inputFocus, this);
        this.addListener();
    }

    onDestroy() {
        this._inputNodes.forEach(input => {
            if (input && input.isValid) {
                input.off(Node.EventType.TOUCH_END, this.singleInputFocus, this);
                input.destroy();
            }
        });
        this._inputNodes = [];
        this._editBoxComponents = [];
        this._currentInputIndex = 0;
        if (this.node && this.node.isValid) {
            this.node.off(Node.EventType.TOUCH_END, this.inputFocus, this);
            this.removeListener();
        }
    }

    private addListener() {
        if (this._hasListener) return;
        this._hasListener = true;
        window.addEventListener('keydown', this._boundHandleDelete, false);
    }

    private removeListener() {
        if (!this._hasListener) return;
        this._hasListener = false;
        window.removeEventListener('keydown', this._boundHandleDelete, false);
    }

    // 创建输入框
    private createInput() {
        for (let i = 0; i < this.inputCount; i++) {
            const input = instantiate(this.inputPrefab);
            const editBox = input.getComponent(EditBox);
            editBox.maxLength = 1;
            editBox.textChanged = this.createEventHandler(i);
            this._inputNodes.push(input);
            this._editBoxComponents.push(editBox);
            input.on(Node.EventType.TOUCH_END, this.singleInputFocus.bind(this, i), this);

            this.node.addChild(input);
        }
    }

    // 创建事件处理程序
    private createEventHandler(index: number): EventHandler[] {
        const eventHandler = new EventHandler();
        eventHandler.target = this.node;
        eventHandler.component = 'KeyInput';
        eventHandler.handler = 'onEditBoxTextChanged';
        eventHandler.customEventData = index.toString();

        return [eventHandler];
    }

    // 输入框获得焦点
    private singleInputFocus(index: number) {
        if (this._currentInputIndex === index) return;

        this._currentInputIndex = index;
        this._editBoxComponents[index].focus();

        this.addListener();
    }

    // 输入框获得焦点
    private inputFocus() {
        for (let i = 0; i < this._inputNodes.length; i++) {
            const editBox = this._editBoxComponents[i];
            // 如果已经获取焦点，则跳过
            if (editBox.isFocused) {
                break;
            }

            // 找到没有值的输入框，使其获取焦点
            if (editBox.string.trim() == '') {
                editBox.focus();
                break;
            }
        }
    }

    // 监听输入框输入
    public onEditBoxTextChanged(text: string, editbox: EditBox, customEventData: string) {
        const index = parseInt(customEventData);

        // 校验是否为大写字母和数字
        const validPattern = /^[A-Z0-9]$/;
        if (!validPattern.test(text)) {
            editbox.string = '';
            // 刷新输入框显示
            editbox.blur();
            editbox.focus();
            this._currentInputIndex = index;
            return;
        }

        if (text.length === 1) {
            // 输入完成
            if (this.value.length === this.inputCount) {
                // 使输入框失焦
                editbox.blur();
                if (index < this.inputCount - 1) {
                    this._editBoxComponents[index + 1].blur();
                }

                if (this.onDone) {
                    this.onDone(this.value);
                }

                this.removeListener();
            } else {
                if (index < this.inputCount - 1) {
                    this._editBoxComponents[index + 1].focus();
                    this._currentInputIndex = index + 1;
                }
            }
        }
    }

    // 处理删除键
    private handleDelete(event: KeyboardEvent) {
        if (event.key !== 'Backspace') return;
        if (this._currentInputIndex < 0 || this._currentInputIndex >= this._inputNodes.length) {
            return;
        }

        const currentEditBox = this._editBoxComponents[this._currentInputIndex];

        if (currentEditBox.string.trim() !== '') {
            currentEditBox.string = '';
            currentEditBox.blur();
            currentEditBox.focus();
        } else if (this._currentInputIndex > 0) {
            this._currentInputIndex--;
            this._editBoxComponents[this._currentInputIndex].focus();
        }
    }

    // 获取输入的值
    public get value() {
        return this._editBoxComponents.map(editBox => editBox.string).join('');
    }

    // 清空输入
    public clear() {
        this._editBoxComponents.forEach(editBox => {
            editBox.string = '';
            editBox.blur();
            editBox.focus();
            editBox.blur();
        });
    }
}
