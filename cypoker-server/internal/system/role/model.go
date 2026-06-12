package role

import "server/internal/helper"

// AdminRole 管理员角色（角色表）
type AdminRole struct {
	helper.Model
	Name        string   `json:"name" gorm:"column:name;type:varchar(50);not null;uniqueIndex:idx_name;comment:角色名称"`
	Description string   `json:"description" gorm:"column:description;type:varchar(255);comment:角色描述"`
	Permissions []string `json:"permissions" gorm:"column:permissions;type:text;serializer:json;comment:权限"`
	Status      int      `json:"status" gorm:"column:status;type:int;not null;default:1;index:idx_status;comment:状态:0-禁用,1-正常"`
	CreatorID   *int64   `json:"creator_id,omitempty" gorm:"column:creator_id;index:idx_creator_id;comment:创建者ID"`
	CreatorName string   `json:"creator_name" gorm:"column:creator_name;type:varchar(50);index:idx_creator_name;comment:创建者名称"`
}

func (ar *AdminRole) TableName() string {
	return "sys_roles"
}

func init() {
	helper.RegisterModel(&AdminRole{})
}
