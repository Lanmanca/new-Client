import { PokerCard } from '@/component/PokerCard';
import { imageManager } from '@/manager';
import { instantiate, Prefab, SpriteFrame } from 'cc';

/**
 * 扑克牌工厂类
 */
export class PokerFactory {
    /**
     * @param _pokerPrefab 扑克牌预制体
     */
    constructor(private _pokerPrefab: Prefab) { }

    /**
     * 创建扑克牌背面
     * @returns 扑克牌背面节点
     */
    createPokerBack() {
        const pokerBack = instantiate(this._pokerPrefab);
        const pokerCard = pokerBack.getComponent(PokerCard);
        pokerCard.poker = 0;

        return pokerBack;
    }

    /**
     * 创建扑克牌
     * @param poker 扑克牌点数
     * @returns 扑克牌节点
     */
    createPoker(poker: number) {
        if (!PokerFactory.verifyPoker(poker)) return null;

        const pokerNode = instantiate(this._pokerPrefab);
        const pokerCard = pokerNode.getComponent(PokerCard);
        pokerCard.poker = poker;

        return pokerNode;
    }

    /**
     * 获取扑克牌背面
     */
    static get pokerBack() {
        const pokerAtlas = imageManager.getPokerAtlas();
        if (!pokerAtlas) return null;

        return pokerAtlas.getSpriteFrame('bg');
    }

    /**
     * 获取扑克牌
     * 获取规则：直接按牌编码读取整张牌图，例如 101 表示黑桃 2。
     */
    static getPoker(num: number): SpriteFrame | null {
        if (typeof num !== 'number' || num <= 0) return null;
        const pokerAtlas = imageManager.getPokerAtlas();
        if (!pokerAtlas) return null;

        return pokerAtlas.getSpriteFrame(`${num}`);
    }

    /**
     * 验证扑克牌
     * @param num 扑克牌点数
     * @returns 验证结果
     */
    static verifyPoker(num: number): boolean {
        return !!PokerFactory.getPoker(num);
    }
}
