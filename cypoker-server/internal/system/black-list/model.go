package black_list

import "server/internal/helper"

// BlackList 黑名单
type BlackList struct {
	helper.Model
	IP          string `json:"ip" gorm:"type:varchar(100);not null;uniqueIndex:idx_ip;comment:IP地址"`
	Reason      string `json:"reason" gorm:"type:varchar(255);not null;comment:封禁原因"`
	Duration    string `json:"duration" gorm:"type:varchar(10);not null;comment:封禁时长:m 分钟,h 小时,d 天"`
	CreatorID   *int64 `json:"creator_id,omitempty" gorm:"column:creator_id;index:idx_creator_id;comment:创建者ID"`
	CreatorName string `json:"creator_name" gorm:"column:creator_name;type:varchar(50);index:idx_creator_name;comment:创建者名称"`
}

func (bl *BlackList) TableName() string {
	return "sys_black_list"
}

func init() {
	helper.RegisterModel(&BlackList{})
}
