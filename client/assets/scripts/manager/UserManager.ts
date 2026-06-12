import { IState } from '@/types/state';
import { IUser } from '@/types/user';
import { generateUUID } from '@/utils';
import { APIManager } from './APIManager';
import { stateManager } from './StateManager';

class UserManager {
    public static _instance: UserManager;
    public static get instance(): UserManager {
        if (!this._instance) {
            this._instance = new UserManager();
        }
        return this._instance;
    }

    /**
     * 当前用户
     */
    public user: IUser;

    public getUserInfo(): IUser {
        return this.user;
    }

    private getTelegramInitData(): string {
        const tg = (globalThis as any)?.Telegram?.WebApp;
        const initData = tg?.initData;
        if (typeof initData === 'string') {
            const v = initData.trim();
            if (v) return v;
        }
        // 兜底：部分 WebView/预览链路下可从 URL 参数拿到 tgWebAppData。
        try {
            const href = globalThis.location?.href || '';
            if (href) {
                const qIdx = href.indexOf('?');
                const hIdx = href.indexOf('#');
                const queryLike = qIdx >= 0 ? href.slice(qIdx + 1) : hIdx >= 0 ? href.slice(hIdx + 1) : '';
                const params = new URLSearchParams(queryLike);
                const raw = params.get('tgWebAppData') || params.get('tg_web_app_data') || '';
                if (raw) {
                    const decoded = decodeURIComponent(raw).trim();
                    if (decoded) return decoded;
                }
            }
        } catch (e) {
            console.warn('[UserManager] parse tgWebAppData failed', e);
        }
        return '';
    }

    // 
    public async init(): Promise<IState> {
        this.user = stateManager.getItem('user');
        if (this.user) return { status: true };
        // const res = await APIManager.login();
        // if (res.status) {
        //     this.user = res.data;
        // } else {
        //     const uuid = generateUUID();
        // }
        const uuid = generateUUID();
        const res2 = await APIManager.register(uuid);
        if (res2.status) {
            this.user = res2.data;
        } else {
            return { status: false, message: res2.message };
        }

        stateManager.setItem('user', this.user);

        return { status: true };
    }

    /**
     * 初始化
     */
    public async init2(): Promise<IState> {
        this.user = stateManager.getItem('user');
        const tgInitData = this.getTelegramInitData();
        console.log('[UserManager] telegram initData len =', tgInitData ? tgInitData.length : 0);
        if (!tgInitData) {
            return { status: false, message: 'USER_TELEGRAM_ONLY' };
        }
        const tgLogin = await APIManager.loginTelegram(tgInitData);
        if (!tgLogin.status) {
            return { status: false, message: tgLogin.message };
        }
        this.user = tgLogin.data;

        stateManager.setItem('user', this.user);

        return { status: true };
    }
}

/**
 * 用户管理器
 */
export const userManager = UserManager.instance;
