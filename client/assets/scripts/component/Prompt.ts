import { i18n } from '@/manager';
import { _decorator, Component, Label } from 'cc';
const { ccclass, property } = _decorator;

interface childNodes {
    sbNote: Label;
    bbNote: Label;
    psbNote: Label;
    pbbNote: Label;
    anteNote: Label;
    ckNote: Label;
    callNote: Label;
    raiseNote: Label;
    allInNote: Label;
    foldNote: Label;
}

@ccclass('Prompt')
export class Prompt extends Component {

    private _childNodes: childNodes = null!;

    start() {
        this._childNodes = this.childNodes();
        this.init();
    }

    private childNodes(): childNodes {
        return {
            sbNote: this.node.getChildByPath('SB/note').getComponent(Label),
            bbNote: this.node.getChildByPath('BB/note').getComponent(Label),
            psbNote: this.node.getChildByPath('PSB/note').getComponent(Label),
            pbbNote: this.node.getChildByPath('PBB/note').getComponent(Label),
            anteNote: this.node.getChildByPath('ANT/note').getComponent(Label),
            ckNote: this.node.getChildByPath('CK/note').getComponent(Label),
            callNote: this.node.getChildByPath('C/note').getComponent(Label),
            raiseNote: this.node.getChildByPath('R/note').getComponent(Label),
            allInNote: this.node.getChildByPath('A/note').getComponent(Label),
            foldNote: this.node.getChildByPath('F/note').getComponent(Label),
        }
    }

    init() {
        this._childNodes.sbNote.string = i18n.t('prompt.sb');
        this._childNodes.bbNote.string = i18n.t('prompt.bb');
        this._childNodes.psbNote.string = i18n.t('prompt.postSb');
        this._childNodes.pbbNote.string = i18n.t('prompt.postBb');
        this._childNodes.anteNote.string = i18n.t('prompt.ante');
        this._childNodes.ckNote.string = i18n.t('prompt.check');
        this._childNodes.callNote.string = i18n.t('prompt.call');
        this._childNodes.raiseNote.string = i18n.t('prompt.raise');
        this._childNodes.allInNote.string = i18n.t('prompt.allIn');
        this._childNodes.foldNote.string = i18n.t('prompt.fold');
    }
}