import { Button } from '@/component';
import { IListItem_user, ListItem_user } from '@/component/ListItem_user';
import { Sidebar } from '@/component/Sidebar';
import { ResManager, uiManager, userManager } from '@/manager';
import { SlideDirection } from '@/types/sidebar';
import { isNullOrEmpty } from '@/utils';
import { loadRemoteSpriteFrame } from '@/utils/loadRemoteSpriteFrame';
import {
    _decorator,
    Button as CCButton,
    Component,
    instantiate,
    Label,
    Node,
    Prefab,
    Sprite,
    UITransform
} from 'cc';
const { ccclass, property } = _decorator;

interface UserChild {
    avatar: Sprite,
    name: Label,
    id: Label,
    copy: Node,
    level: Label,
    wallet: Label,      // 用户余额
    tradeRecord: Node,  // 交易记录节点
    withDrawalBtn: CCButton, // 提现按钮
    depositBtn: CCButton, // 充值按钮
    listContainer: Node, // 列表容器节点
}

@ccclass('UserController')
export class UserController extends Component {

    @property({ type: Node, tooltip: '容器节点' })
    contentNode: Node = null!;

    @property({ type: Prefab, tooltip: '列表项预制体' })
    listPrefab: Prefab = null!;

    @property({ type: String, tooltip: '语言预制体路径' })
    languagePath: string = 'components/ListItem_language';

    @property({ type: String, tooltip: '游戏设置预制体路径' })
    gameSettingPath: string = 'components/GameSetting';

    private childNodes: UserChild = null!;
    private _languagePrefab: Prefab = null!;
    private _gameSettingPrefab: Prefab = null!;

    async start() {
        await this.initPrefab();
        this.childNodes = this.getChildNode();
        this.setUserInfo();
        this.setupEventListeners();
        this.childNodes.tradeRecord.on(Node.EventType.TOUCH_END, () => {
            uiManager.navigateTo({ page: 'TradeRecord', contentPrefab: 'TradeRecord' });
        }, this);
    }

    async initPrefab() {
        try {
            this._languagePrefab = await ResManager.loadPrefab('prefabs', 'components/ListItem_language');
            this._gameSettingPrefab = await ResManager.loadPrefab('prefabs', this.gameSettingPath);
        } catch (err) {
            console.error('初始化预制体失败', err);
        }
    }

    private setupEventListeners() {
        this.clickWithDrawalBtn();
        this.clickDepositBtn();
        this.createList();
    }

    private getChildNode(): UserChild {
        const container = this.contentNode;
        const userInformationNode = container.getChildByPath('Node/UserInformation');
        return {
            avatar: userInformationNode.getChildByPath('Avatar/Mask/avatar').getComponent(Sprite),
            name: userInformationNode.getChildByPath('Container/Name').getComponent(Label),
            id: userInformationNode.getChildByPath('Container/ID/Id').getComponent(Label),
            copy: userInformationNode.getChildByPath('Container/ID/copy'),
            level: userInformationNode.getChildByPath('Container/LevelNode/level').getComponent(Label),
            wallet: container.getChildByPath('Important/Amount/wallet').getComponent(Label),
            tradeRecord: container.getChildByPath('Important/Amount/TradeRecord'),
            withDrawalBtn: container.getChildByPath('Important/BtnList/withDrawalBtn').getComponent(CCButton),
            depositBtn: container.getChildByPath('Important/BtnList/depositBtn').getComponent(CCButton),
            listContainer: container.getChildByName('ListContainer'),
        }
    }

    setUserInfo() {
        const userInfo = userManager.getUserInfo();
        if (!isNullOrEmpty(userInfo)) {
            console.log("userInfo", userInfo);
            if (userInfo.avatarUrl) this.setAvatar(userInfo.avatarUrl);
            this.childNodes.name.string = userInfo.nickname;
            this.childNodes.level.string = userInfo.level.toString();
            this.childNodes.wallet.string = userInfo.wallet.toString();
        }
    }

    /**
     * 设置用户头像
     * @param avatarUrl 头像URL
     */
    public async setAvatar(avatarUrl: string) {
        try {
            const spriteFrame = await loadRemoteSpriteFrame(avatarUrl);
            this.childNodes.avatar.spriteFrame = spriteFrame;
            console.log("user中的头像", spriteFrame);
            const uiTransform = this.childNodes.avatar.getComponent(UITransform);
            uiTransform?.setContentSize(150, 150);
        } catch (error) {
            console.error('图片加载失败', error);
        }
    }

    private async clickWithDrawalBtn() {
        const withDrawalBtn = this.childNodes.withDrawalBtn.getComponent(Button);
        withDrawalBtn.onClick = async () => {
            await uiManager.navigateTo({
                page: '暂无提现'
            });
        }
    }

    private clickDepositBtn() {
        const depositBtn = this.childNodes.depositBtn.getComponent(Button);
        depositBtn.onClick = async () => {
            await uiManager.navigateTo({ page: '暂无充值' });
        }
    }

    createList() {
        const dataList: IListItem_user[] = [
            {
                icon: 'poker',
                label: '牌局历史',
                isShowLineNode: true,
                onClick: () => {
                    uiManager.navigateTo({ page: 'Career', contentPrefab: 'Career' });
                }
            },
            {
                icon: 'bell',
                label: '消息',
                isShowLineNode: true,
                onClick: () => {
                    uiManager.navigateTo({
                        page: 'Message', contentPrefab: 'Message', btnList: [{
                            icon: 'delete-bin-fill', onClick: () => {
                                console.log('删除消息');
                            }
                        }]
                    });
                }
            },
            {
                icon: 'customer_service',
                label: '客服',
                isShowLineNode: true,
                onClick: () => {
                    uiManager.navigateTo({ page: 'CustomerService', contentPrefab: 'CustomerService' });
                }
            },
            {
                icon: 'HTSCIT_earth',
                label: '语言',
                isShowLineNode: true,
                onClick: () => {
                    uiManager.createSidebar('Sidebar', Sidebar, SlideDirection.TOP, this._languagePrefab);
                }
            },
            {
                icon: 'set-user',
                label: '设置',
                isShowLineNode: false,
                onClick: () => {
                    uiManager.createSidebar('Sidebar', Sidebar, SlideDirection.TOP, this._gameSettingPrefab);
                }
            },
        ];

        dataList.forEach(data => {
            const listItem = instantiate(this.listPrefab);
            const item = listItem.getComponent(ListItem_user);

            item.setData(data);

            this.childNodes.listContainer.addChild(listItem);
        });
    }
}