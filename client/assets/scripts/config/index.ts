import { APPManager, i18n } from '@/manager';
import { FormItemType, IFormItem, InputType } from '@/types/form';
import { INavItem } from '@/types/nav';
import { getDeviceType } from '@/utils';

/**
 * APP配置
 */
export default class Config {
    /**
     * 主题色
     */
    public static readonly THEME_COLOR = {
        primary: '#6bcb9d',
        secondary: '#647582',
        success: '#00cf55',
        error: '#dd7373',
        warning: '#d8b26a',
        info: '#22292f',
        light: '#ffffff',
        dark: '#181818',
    };

    /**
     * 应用名称
     */
    public static readonly APP_NAME = 'CYPoker';

    /**
     * API地址
     */
    // public static readonly SERVER_URL = 'https://zxc.esoyapk.cc';
    public static readonly SERVER_URL = 'http://192.168.1.64:8000';

    /**
     * WS地址
     */
    // public static readonly WS_URL = 'wss://zxc.esoyapk.cc';
    public static readonly WS_URL = 'ws://192.168.1.64:8000';

    /**
     * APP版本
     */
    public static async APP_VERSION() {
        return await APPManager.getAppVersion();
    }

    /**
     * 设备ID
     */
    public static async DEVICE_ID() {
        return await APPManager.getDeviceId();
    }

    /**
     * 设备类型
     */
    public static get DEVICE_TYPE() {
        return getDeviceType();
    }

    /**
     * 语言
     */
    public static get LANGUAGE() {
        return i18n.language;
    }

    /**
     * 导航栏
     */
    public static get NAVBAR(): INavItem[] {
        return [
            {
                path: 'Game',
                icon: 'game',
                name: i18n.t('navbar.game'),
            },
            {
                path: 'Home',
                icon: 'home',
                name: i18n.t('navbar.home'),
            },
            {
                path: 'User',
                icon: 'user',
                name: i18n.t('navbar.user'),
            },
        ];
    }

    /**
     * 房间设置国际化键
     */
    public static readonly ROOM_SETTINGS_KEY = 'pages.game.room_settings';

    /** 上桌买入弹窗文案键 */
    public static readonly BUY_IN_MODAL_KEY = 'pages.game.buy_in_modal';

    /**
     * 房间设置项
     */
    public static get ROOM_SETTINGS(): IFormItem[] {
        return [
            {
                label: i18n.t(`${this.ROOM_SETTINGS_KEY}.room_type.title`),
                key: 'roomType',
                type: FormItemType.Radio,
                help: i18n.t(`${this.ROOM_SETTINGS_KEY}.room_type.help`),
                defaultValue: 'private',
                items: [
                    {
                        text: i18n.t(`${this.ROOM_SETTINGS_KEY}.room_type.private`),
                        value: 'private',
                    },
                    {
                        text: i18n.t(`${this.ROOM_SETTINGS_KEY}.room_type.public`),
                        value: 'public',
                    },
                ],
                required: true,
            },
            {
                label: i18n.t(`${this.ROOM_SETTINGS_KEY}.max_players.title`),
                key: 'maxPlayers',
                type: FormItemType.Input,
                inputType: InputType.Number,
                isInteger: true,
                defaultValue: 6,
                maxValue: 9,
                minValue: 2,
                required: true,
            },
            {
                label: i18n.t(`${this.ROOM_SETTINGS_KEY}.leave_timeout.title`),
                key: 'leaveTimeout',
                type: FormItemType.Input,
                inputType: InputType.Number,
                isInteger: true,
                defaultValue: 60,
                minValue: 10,
                required: true,
            },
            {
                label: i18n.t(`${this.ROOM_SETTINGS_KEY}.action_timeout.title`),
                key: 'actionTimeout',
                type: FormItemType.Input,
                inputType: InputType.Number,
                isInteger: true,
                defaultValue: 30,
                minValue: 5,
                required: true,
            },
            {
                label: i18n.t(`${this.ROOM_SETTINGS_KEY}.owner_commission.title`),
                key: 'ownerCommission',
                type: FormItemType.Input,
                inputType: InputType.Number,
                isInteger: true,
                defaultValue: 5,
                minValue: 0,
                maxValue: 100,
                help: i18n.t(`${this.ROOM_SETTINGS_KEY}.owner_commission.help`),
                required: true,
            },
            {
                label: i18n.t(`${this.ROOM_SETTINGS_KEY}.small_blind.title`),
                key: 'smallBlind',
                type: FormItemType.Input,
                inputType: InputType.Number,
                isInteger: true,
                defaultValue: 100,
                minValue: 1,
                required: true,
            },
            {
                label: i18n.t(`${this.ROOM_SETTINGS_KEY}.ante.title`),
                key: 'ante',
                type: FormItemType.Input,
                inputType: InputType.Number,
                defaultValue: 0,
                minValue: 0,
            },
            {
                label: i18n.t(`${this.ROOM_SETTINGS_KEY}.max_buy_in.title`),
                key: 'maxBuyIn',
                type: FormItemType.Input,
                inputType: InputType.Number,
                isInteger: true,
                defaultValue: 100000,
                minValue: 1,
                required: true,
            },
            {
                label: i18n.t(`${this.ROOM_SETTINGS_KEY}.min_buy_in.title`),
                key: 'minBuyIn',
                type: FormItemType.Input,
                inputType: InputType.Number,
                isInteger: true,
                defaultValue: 10000,
                minValue: 1,
                required: true,
            },
            {
                hiddenLabel: true,
                key: 'allowWatch',
                type: FormItemType.Checkbox,
                defaultValue: false,
                text: i18n.t(`${this.ROOM_SETTINGS_KEY}.allow_watch.title`),
            },
            {
                label: i18n.t(`${this.ROOM_SETTINGS_KEY}.max_watchers.title`),
                key: 'maxWatchers',
                type: FormItemType.Input,
                inputType: InputType.Number,
                isInteger: true,
                defaultValue: 10,
                help: i18n.t(`${this.ROOM_SETTINGS_KEY}.max_watchers.help`),
                maxValue: 20,
                minValue: 0,
            },
            {
                label: i18n.t(`${this.ROOM_SETTINGS_KEY}.max_rounds.title`),
                key: 'maxRounds',
                type: FormItemType.Input,
                inputType: InputType.Number,
                isInteger: true,
                defaultValue: 10,
                minValue: 1,
                maxValue: 16,
                required: true,
            },
        ];
    }

    /**
     * 上桌买入表单（限额来自当前房间的 min/max 与玩家账外余额；最终以服务端校验为准）
     */
    public static buildBuyInFormItems(opts: {
        minBuy: number;
        maxAfford: number;
        suggested: number;
        account: number;
    }): IFormItem[] {
        const minInput = Math.max(1, Math.floor(opts.minBuy));
        const maxInput = Math.max(minInput, Math.floor(Math.min(opts.maxAfford, opts.account)));
        const def = Math.min(maxInput, Math.max(minInput, Math.floor(opts.suggested)));
        return [
            {
                label: i18n.t(`${this.BUY_IN_MODAL_KEY}.amount_label`),
                key: 'buyIn',
                type: FormItemType.Input,
                inputType: InputType.Number,
                isInteger: true,
                defaultValue: def,
                minValue: minInput,
                maxValue: maxInput,
                required: true,
                help: i18n.t(`${this.BUY_IN_MODAL_KEY}.help`, {
                    min: minInput,
                    max: maxInput,
                    account: Math.floor(opts.account),
                }),
            },
        ];
    }

    /**
     * 房间信息表单
     */
    public static get ROOM_INFO(): IFormItem[] {
        return [
            {
                label: i18n.t('game.room_info.room_type.title'),
                key: 'roomType',
                type: FormItemType.Radio,
                items: [
                    {
                        text: i18n.t('game.room_info.room_type.private'),
                        value: 'private',
                    },
                    {
                        text: i18n.t('game.room_info.room_type.public'),
                        value: 'public',
                    },
                ],
                readonly: true,
            },
            {
                label: i18n.t('game.room_info.room_number.title'),
                key: 'roomNumber',
                type: FormItemType.Input,
                readonly: true,
            },
            {
                label: i18n.t('game.room_info.owner.title'),
                key: 'owner',
                type: FormItemType.Input,
                readonly: true,
            },
        ];
    }
}
