package menu

import (
	"server/internal/helper"

	"gorm.io/datatypes"
)

type Menu struct {
	helper.Model

	Name        string         `json:"name" gorm:"column:name;type:varchar(50);not null;uniqueIndex:idx_name;comment:菜单名称"`
	Path        string         `json:"path" gorm:"column:path;type:varchar(255);not null;comment:菜单路径"`
	Config      datatypes.JSON `json:"config" gorm:"column:config;type:json;comment:菜单配置"`
	ParentID    *int64         `json:"parent_id,omitempty" gorm:"column:parent_id;index:idx_parent_id;comment:父级ID"`
	Status      int            `json:"status" gorm:"column:status;type:int;not null;default:1;comment:状态:0-禁用,1-正常"`
	CreatorID   *int64         `json:"creator_id,omitempty" gorm:"column:creator_id;index:idx_creator_id;comment:创建者ID"`
	CreatorName string         `json:"creator_name" gorm:"column:creator_name;type:varchar(50);index:idx_creator_name;comment:创建者名称"`
}

func (m *Menu) TableName() string {
	return "sys_menus"
}

func init() {
	helper.RegisterModel(&Menu{})
}
