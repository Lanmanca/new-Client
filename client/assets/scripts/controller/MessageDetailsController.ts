import { stateManager } from '@/manager';
import { _decorator, Component, Label, Node } from 'cc';
const { ccclass, property } = _decorator;

interface IMessageDetails {
    title: string;
    message: string;
    time: string;
}

@ccclass('MessageDetailsController')
export class MessageDetailsController extends Component {

    @property({ type: Node, tooltip: '内容节点' })
    contentNode: Node = null!;

    private getChildNode() {
        const contentTitle = this.contentNode.getChildByPath('Title/title').getComponent(Label);
        const content = this.contentNode.getChildByPath('Title/content').getComponent(Label);
        const time = this.contentNode.getChildByName('time').getComponent(Label);

        return {
            contentTitle,
            content,
            time,
        }
    }

    start() {
        const message = stateManager.getItem('message') as IMessageDetails;
        if (message) {
            this.setData(message);
        }
    }

    setData(data: IMessageDetails) {
        const { contentTitle, content, time } = this.getChildNode();
        contentTitle.string = data.title;
        content.string = data.message;
        time.string = data.time;
    }
}


