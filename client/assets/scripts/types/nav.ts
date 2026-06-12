/**
 * 导航项
 */
export interface INavItem {
    /**
     * 图标
     * 将图标放入images/navbar目录下，这里传入图标名称即可
     */
    icon: string;
    /**
     * 名称
     */
    name: string;
    /**
     * 路径
     * 以prefabs/pages为根目录
     */
    path: string;
    /**
     * 是否显示标签
     */
    showLabel?: boolean;
}
