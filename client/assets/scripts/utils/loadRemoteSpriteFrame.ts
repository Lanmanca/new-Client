import Config from '@/config';
import { assetManager, ImageAsset, SpriteFrame, Texture2D } from 'cc';

function addUrlprefix(url: string) {
    return Config.SERVER_URL + '/telegram-image?url=' + url;
}

// 加载远程图片为SpriteFrame
export function loadRemoteSpriteFrame(url: string): Promise<SpriteFrame> {
    if (!url || typeof url !== 'string') {
        return Promise.reject(new Error('无效图片地址'));
    }

    const normalizedUrl = addUrlprefix(url);
    return new Promise((resolve, reject) => {
        assetManager.loadRemote<ImageAsset>(normalizedUrl, { ext: '.jpg' }, (err, imageAsset) => {
            if (err || !imageAsset) {
                reject(new Error(`远程图片加载失败: ${normalizedUrl}`));
                return;
            }

            try {
                const texture = new Texture2D();
                texture.image = imageAsset;

                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;

                resolve(spriteFrame);
            } catch (error) {
                reject(error);
            }
        });
    });
}