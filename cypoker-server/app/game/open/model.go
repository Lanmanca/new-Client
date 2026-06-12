package open

import "server/internal/helper"

// 游戏应用信息
type AppInfo struct {
	helper.Model
	Name    string `gorm:"column:name;type:varchar(255);not null;comment:应用名称" json:"name"`
	Version string `gorm:"column:version;type:varchar(255);not null;comment:应用版本" json:"version"`
	Url     string `gorm:"column:url;type:varchar(255);not null;comment:应用下载地址" json:"url"`
	Status  int    `gorm:"column:status;type:int;not null;default:1;comment:状态:0-禁用,1-正常" json:"status"`
}

func (a *AppInfo) TableName() string {
	return "game_app_infos"
}

func init() {
	helper.RegisterModel(&AppInfo{})
}
