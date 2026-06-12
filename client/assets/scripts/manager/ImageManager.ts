import { IState } from '@/types/state';
import { AssetManager, assetManager, isValid, SpriteAtlas, SpriteFrame } from 'cc';

export class ImageManager {
    private static _instance: ImageManager;
    public static get instance(): ImageManager {
        if (!this._instance) {
            this._instance = new ImageManager();
        }
        return this._instance;
    }

    private navbar: Map<string, SpriteFrame> = new Map();
    private ui: Map<string, SpriteFrame> = new Map();
    private table: Map<string, SpriteFrame> = new Map();
    private atlas: Map<string, SpriteAtlas> = new Map();
    private icon: Map<string, SpriteFrame> = new Map();

    /**
     * 初始化
     */
    public init() {
        return new Promise<IState>(resolve => {
            assetManager.loadBundle('images', async (err, bundle) => {
                if (err) {
                    resolve({ status: false, message: err.message });
                    return;
                }

                try {
                    await this.loadSpriteFrame(bundle, 'navbar', this.navbar);
                    await this.loadSpriteFrame(bundle, 'ui/uiImg', this.ui);
                    await this.loadSpriteFrame(bundle, 'table/tableImg', this.table);
                    await this.loadSpriteAtlas(bundle, 'poker/poker', this.atlas);
                    await this.loadSpriteFrame(bundle, 'icon', this.icon);

                    resolve({ status: true });
                } catch (error) {
                    console.error('[ImageManager] image bundle load failed', error);
                    resolve({ status: false, message: error.message });
                }
            });
        });
    }

    /**
     * 加载图片资源
     */
    private loadSpriteFrame(
        bundle: AssetManager.Bundle,
        dir: string,
        cache: Map<string, SpriteFrame>
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            bundle.loadDir(dir, SpriteFrame, (err, spriteFrames) => {
                if (err) {
                    console.error(`[ImageManager] loadDir failed: ${dir}`, err);
                    reject(err);
                    return;
                }

                spriteFrames.forEach(prefab => {
                    prefab.addRef();
                    cache.set(prefab.name, prefab);
                });
                resolve();
            });
        });
    }

    /**
     * 加载图集资源
     */
    private loadSpriteAtlas(
        bundle: AssetManager.Bundle,
        path: string,
        cache: Map<string, SpriteAtlas>
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            bundle.load(path, SpriteAtlas, (err, spriteAtlas) => {
                if (err) {
                    console.error(`[ImageManager] load atlas failed: ${path}`, err);
                    reject(err);
                    return;
                }
                spriteAtlas.addRef();
                cache.set(spriteAtlas.name, spriteAtlas);
                resolve();
            });
        });
    }

    /**
     * 获取导航图标
     */
    public getNavbarIcon(name: string) {
        if (!name.trim() || !this.navbar.has(name)) {
            return null;
        }
        const frame = this.navbar.get(name);
        if (!frame || !isValid(frame, true)) {
            this.navbar.delete(name);
            return null;
        }
        return frame;
    }

    /**
     * 获取UI图片
     */
    public getUIImage(name: string) {
        if (!name.trim() || !this.ui.has(name)) {
            return null;
        }
        const frame = this.ui.get(name);
        if (!frame || !isValid(frame, true)) {
            this.ui.delete(name);
            return null;
        }
        return frame;
    }

    /**
     * 获取图标
     */
    public getIcon(name: string) {
        if (!name.trim() || !this.icon.has(name)) {
            return null;
        }
        const frame = this.icon.get(name);
        if (!frame || !isValid(frame, true)) {
            this.icon.delete(name);
            return null;
        }
        return frame;
    }

    /**
     * 获取牌桌背景
     */
    public getTableBackground(name: string) {
        if (!name.trim() || !this.table.has(name)) {
            return null;
        }
        const frame = this.table.get(name);
        if (!frame || !isValid(frame, true)) {
            this.table.delete(name);
            return null;
        }
        return frame;
    }

    /**
     * 获取所有牌桌背景
     */
    public getAllTableBackgrounds() {
        return Array.from(this.table.entries()).map(([name, spriteFrame]) => ({
            name,
            spriteFrame,
        }));
    }

    /**
     * 获取扑克图集
     */
    public getPokerAtlas() {
        const atlas = this.atlas.get('poker');
        if (!atlas || !isValid(atlas, true)) {
            this.atlas.delete('poker');
            return null;
        }
        return atlas;
    }
}

/**
 * 图片管理器
 */
export const imageManager = ImageManager.instance;