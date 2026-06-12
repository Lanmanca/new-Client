import { i18n, uiManager } from '@/manager';
import { ButtonType } from '@/types/button';
import { FormItemType, IFormItem, InputType, LabelPosition } from '@/types/form';
import { isNullOrEmpty } from '@/utils';
import {
    _decorator,
    Component,
    instantiate,
    Label,
    Layout,
    Node,
    Prefab,
    UITransform,
    Widget,
} from 'cc';
import { Button, Help, Input, RadioGroup, Toggle } from './index';

const { ccclass, property } = _decorator;

@ccclass('FormItem')
export class FormItem extends Component {
    @property({ type: Label, tooltip: '标签节点' })
    labelNode: Label = null;

    @property({ type: Node, tooltip: '帮助信息节点' })
    helpNode: Node = null;

    @property({ type: Node, tooltip: '标签容器' })
    labelContainerNode: Node = null;

    @property({ type: Node, tooltip: '表单项容器节点' })
    containerNode: Node = null;

    @property({ type: Prefab, tooltip: '单选框预制件' })
    radio: Prefab = null;

    @property({ type: Prefab, tooltip: '输入框预制件' })
    input: Prefab = null;

    @property({ type: Prefab, tooltip: '复选框预制件' })
    checkbox: Prefab = null;

    props: IFormItem;

    // 表单节点
    private _form: RadioGroup | Input | Toggle = null;

    /**
     * 获取表单项的值
     */
    public get value() {
        const isNumber =
            this.props.type === FormItemType.Input && this.props.inputType === InputType.Number;

        let val = this._form.value;
        try {
            if (isNumber) {
                val = Number(val);
            }
        } catch (e) {
            val = undefined;
        }

        return { [this.props.key]: val };
    }

    /**
     * 验证表单项
     */
    public async validate() {
        const { required, key, label } = this.props;
        const value = this._form.value;
        const isEmpty = isNullOrEmpty(value);

        // 必填校验
        if (required && isEmpty) {
            uiManager.toast(i18n.t('form.required', { field: label }));
            return false;
        }

        // 如果有值
        if (!isEmpty) {
            // 验证输入框
            if (this.props.type === FormItemType.Input) {
                // 数值类
                if (
                    this.props.type === FormItemType.Input &&
                    this.props.inputType === InputType.Number
                ) {
                    if (this.props.isInteger && !/^-?\d+$/.test(value as string)) {
                        uiManager.toast(i18n.t('form.integer_invalid', { field: label }));
                        return false;
                    }

                    if (!/^-?\d+(\.\d+)?$/.test(value as string)) {
                        uiManager.toast(i18n.t('form.number_invalid', { field: label }));
                        return false;
                    }

                    const num = Number(value);

                    // 检验范围（允许 min===max，如买入额仅有一种合法值）
                    const { maxValue, minValue } = this.props;
                    const hasMin = !isNullOrEmpty(minValue);
                    const hasMax = !isNullOrEmpty(maxValue);
                    if (hasMin && hasMax && (num < minValue || num > maxValue)) {
                        const content = i18n.t('form.range_invalid', {
                            field: label,
                            min: minValue,
                            max: maxValue,
                        });
                        uiManager.toast(content);
                        return false;
                    }
                    if (!hasMin && hasMax && num > maxValue) {
                        uiManager.toast(
                            i18n.t('form.only_max_range', { field: label, max: maxValue })
                        );
                        return false;
                    }
                    if (hasMin && !hasMax && num < minValue) {
                        uiManager.toast(
                            i18n.t('form.only_min_range', { field: label, min: minValue })
                        );
                        return false;
                    }
                } else {
                    // 校验长度
                    const { minLength, maxLength } = this.props;
                    if (!isNullOrEmpty(minLength) || !isNullOrEmpty(maxLength)) {
                        if (
                            // @ts-ignore
                            (value.length < minLength || value.length > maxLength) &&
                            minLength < maxLength
                        ) {
                            let content = '';
                            if (!isNullOrEmpty(maxLength) && !isNullOrEmpty(minLength)) {
                                content = i18n.t('form.length_invalid', {
                                    field: label,
                                    min: minLength,
                                    max: maxLength,
                                });
                            } else if (!isNullOrEmpty(maxLength)) {
                                content = i18n.t('form.only_max_length', {
                                    field: label,
                                    max: maxLength,
                                });
                            } else if (!isNullOrEmpty(minLength)) {
                                content = i18n.t('form.only_min_length', {
                                    field: label,
                                    min: minLength,
                                });
                            }

                            uiManager.toast(content);
                            return false;
                        }
                    }

                    // 正则校验
                    const { regex } = this.props;
                    if (!isNullOrEmpty(regex) && !new RegExp(regex).test(value as string)) {
                        uiManager.toast(i18n.t('form.format_invalid', { field: label }));
                        return false;
                    }
                }
            }
        }

        return true;
    }

    start() {
        const {
            label,
            help,
            type,
            defaultValue,
            labelPosition = LabelPosition.Top,
            hiddenLabel = false,
        } = this.props;

        // 如果是在左边，则调整布局
        if (labelPosition === LabelPosition.Left) {
            // 获取直接子节点的最大高度并给节点设置
            const maxHeight = this.node.children.reduce((max, child) => {
                const height = child.getComponent(UITransform).height;
                return height > max ? height : max;
            }, 0);
            this.node.getComponent(UITransform).height = maxHeight;

            const layout = this.node.getComponent(Layout);
            // 改成水平布局
            layout.type = Layout.Type.HORIZONTAL;
            layout.alignHorizontal = true;
            layout.resizeMode = Layout.ResizeMode.NONE;
            layout.spacingX = 30;
            layout.updateLayout();

            // 标签容器布局
            const labelWidget = this.labelContainerNode.getComponent(Widget);
            labelWidget.isAlignLeft = false;
            labelWidget.isAlignRight = false;
            const labelLayout = this.labelContainerNode.addComponent(Layout);
            labelLayout.type = Layout.Type.VERTICAL;
            labelLayout.alignVertical = true;
            labelLayout.resizeMode = Layout.ResizeMode.CONTAINER;
            labelLayout.updateLayout();

            // 表单项容器布局
            const containerWidget = this.containerNode.getComponent(Widget);
            containerWidget.isAlignLeft = false;
            containerWidget.isAlignRight = false;
            const containerLayout = this.containerNode.getComponent(Layout);
            containerLayout.alignVertical = true;
            containerLayout.type = Layout.Type.VERTICAL;
            containerLayout.resizeMode = Layout.ResizeMode.CONTAINER;
            containerLayout.updateLayout();
        }

        // 隐藏标签
        if (hiddenLabel) {
            this.labelContainerNode.active = false;
        }

        this.labelNode.string = label;
        if (help) {
            this.helpNode.active = true;
            this.helpNode.getComponent(Button).type = ButtonType.INFO;
            this.helpNode.getComponent(Help).content = help;
        } else {
            this.helpNode.destroy();
        }

        // 根据类型创建表单项
        switch (type) {
            case 'radio': {
                const { items, readonly } = this.props;
                const radioNode = instantiate(this.radio);
                this._form = radioNode.getComponent(RadioGroup);
                this._form.items = items;
                this._form.value = defaultValue ?? '';
                this._form.readonly = readonly;
                const layout = radioNode.getComponent(Layout);
                layout.alignHorizontal = false;
                layout.alignVertical = false;
                const widget = radioNode.addComponent(Widget);
                widget.isAlignLeft = true;
                widget.left = 0;
                this.containerNode.addChild(radioNode);
                break;
            }
            case 'input': {
                const { placeholder, inputType, readonly } = this.props;
                const inputNode = instantiate(this.input);
                this._form = inputNode.getComponent(Input);
                this._form.value = !isNullOrEmpty(defaultValue) ? String(defaultValue) : '';
                this._form.placeholder = placeholder;
                this._form.type = inputType;
                this._form.readonly = readonly;
                if (inputType === InputType.Number) {
                    this._form.isInteger = this.props.isInteger;
                } else {
                    this._form.maxLength = this.props.maxLength;
                }
                // 自适应容器
                const widget = inputNode.addComponent(Widget);
                widget.isAlignLeft = true;
                widget.isAlignRight = true;
                widget.isAlignTop = true;
                widget.isAlignBottom = true;
                widget.left = 0;
                widget.right = 0;
                widget.top = 0;
                widget.bottom = 0;

                this.containerNode.addChild(inputNode);
                break;
            }
            case 'checkbox': {
                const { readonly, text } = this.props;
                const checkboxNode = instantiate(this.checkbox);
                this._form = checkboxNode.getComponent(Toggle);
                this._form.value = defaultValue ?? false;
                this._form.checked = (defaultValue as boolean) ?? false;
                this._form.text = text;
                this._form.readonly = readonly;
                const widget = checkboxNode.addComponent(Widget);
                widget.isAlignLeft = true;
                widget.left = 0;
                this.containerNode.addChild(checkboxNode);
                break;
            }
        }
    }
}
