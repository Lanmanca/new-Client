import { assetManager, AssetManager, error, Prefab } from 'cc';

export class ResManager {
    /**
     * 加载 Bundle
     * 注意：这里的类型是 AssetManager.Bundle
     */
    public static loadBundle(bundleName: string): Promise<AssetManager.Bundle> {
        return new Promise((resolve, reject) => {
            // 尝试获取已经加载过的 Bundle
            const bundle = assetManager.getBundle(bundleName);
            if (bundle) return resolve(bundle);
            assetManager.loadBundle(bundleName, (err, bundle) => {
                if (err) {
                    error(`ResManager 加载 Bundle 失败: ${bundleName}`, err);
                    reject(err);
                } else {
                    resolve(bundle);
                }
            });
        });
    }

    /**
     * 加载 Prefab
     */
    public static async loadPrefab(bundleName: string, path: string): Promise<Prefab> {
        try {
            const bundle = await this.loadBundle(bundleName);

            return new Promise((resolve, reject) => {
                // 1. 先看 Bundle 缓存里有没有
                const asset = bundle.get(path, Prefab);
                if (asset) return resolve(asset);

                // 2. 缓存没有再进行加载
                bundle.load(path, Prefab, (err, prefab) => {
                    if (err) {
                        error(`ResManager 加载 Prefab 失败: ${path}`, err);
                        reject(err);
                    } else {
                        resolve(prefab);
                    }
                });
            });
        } catch (e) {
            console.log('加载失败', e);
            throw e;
        }
    }
}