export interface IBaseItem {
    /**
     * 是否禁用
     */
    disabled?: boolean;
    /**
     * 是否只读
     */
    readonly?: boolean;
}

export interface IToggle extends IBaseItem {
    /**
     * 值
     */
    value?: boolean | string | number;
    /**
     * 标签
     */
    text?: string;
    /**
     * 更改回调
     */
    onChange?: (value: boolean | string | number, isChecked: boolean) => void;
}

export interface IRadioGroup extends IBaseItem {
    /**
     * 单选项
     */
    items: IToggle[];
    /**
     * 值
     */
    value?: string | number | boolean;
    /**
     * 更改回调
     */
    onChange?: (value: string | number | boolean) => void;
}

export enum InputType {
    /**
     * 文本
     */
    Text = 'text',
    /**
     * 数字
     */
    Number = 'number',
    /**
     * 密码
     */
    Password = 'password',
}

export interface IInput extends IBaseItem {
    /**
     * 值
     */
    value?: string | number;
    /**
     * 占位符
     */
    placeholder?: string;
    /**
     * 输入类型
     */
    inputType?: InputType;
    /**
     * 输入回调
     */
    onInput?: (value: string) => void;
}

export interface IStringInput extends IInput {
    inputType?: InputType.Text | InputType.Password;
    value?: string;
    /**
     * 最大长度
     */
    maxLength?: number;
    /**
     * 最小长度
     */
    minLength?: number;
    /**
     * 正则表达式
     * 将会对输入的值进行正则匹配，如果匹配失败则输入将被拒绝
     */
    regex?: RegExp;
}

export interface INumberInput extends IInput {
    inputType?: InputType.Number;
    value?: number;
    /**
     * 最大值
     */
    maxValue?: number;
    /**
     * 最小值
     */
    minValue?: number;
    /**
     * 是否只允许整数
     */
    isInteger?: boolean;
}

export enum FormItemType {
    /**
     * 输入框
     */
    Input = 'input',
    /**
     * 单选框
     */
    Radio = 'radio',
    /**
     * 复选框
     */
    Checkbox = 'checkbox',
}

export enum LabelPosition {
    Top = 'top',
    Left = 'left',
}

export interface IBaseFormItem {
    /**
     * 类型
     */
    type: FormItemType;
    /**
     * 字段名
     */
    key: string;
    /**
     * 标签
     */
    label?: string;
    /**
     * 标签位置
     */
    labelPosition?: LabelPosition;
    /**
     * 隐藏标签
     */
    hiddenLabel?: boolean;
    /**
     * 是否必填
     */
    required?: boolean;
    /**
     * 提示
     */
    help?: string;
    /**
     * 默认值
     */
    defaultValue?: string | number | boolean;
}

export type IInputForm = (IStringInput | INumberInput) &
    IBaseFormItem & {
        type: FormItemType.Input;
    };

export type IRadioForm = IRadioGroup &
    IBaseFormItem & {
        type: FormItemType.Radio;
    };

export type ICheckboxForm = IToggle &
    IBaseFormItem & {
        type: FormItemType.Checkbox;
    };

export type IFormItem = IInputForm | IRadioForm | ICheckboxForm;

export interface IForm {
    /**
     * 表单项
     */
    items: IFormItem[];
    /**
     * 表单值
     */
    value: Record<string, string | number | boolean>;
}
