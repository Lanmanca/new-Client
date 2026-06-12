package user

import (
	"server/internal/helper"
	"time"
)

// 用户信息
type User struct {
	helper.Model
	UserId              string     `gorm:"column:user_id;type:varchar(50);not null;uniqueIndex:idx_user_id;comment:用户ID" json:"user_id"`             // 用户ID
	DeviceId            string     `gorm:"column:device_id;type:varchar(50);not null;uniqueIndex:idx_device_id;comment:设备ID" json:"device_id"`       // 设备ID
	Nickname            string     `gorm:"column:nickname;type:varchar(50);comment:昵称" json:"nickname"`                                              // 昵称
	AvatarUrl           string     `gorm:"column:avatar_url;type:varchar(255);comment:头像URL" json:"avatar_url"`                                      // 头像URL
	Level               int        `gorm:"column:level;type:int;not null;default:0;comment:等级" json:"level"`                                         // 等级
	Experience          int        `gorm:"column:experience;type:int;not null;default:0;comment:经验" json:"experience"`                               // 经验
	NextLevelExperience int        `gorm:"column:next_level_experience;type:int;not null;default:1000;comment:下一级所需经验" json:"next_level_experience"` // 下一级所需经验
	Wallet              float64    `gorm:"column:wallet;type:float;not null;default:0.0;comment:钱包" json:"wallet"`                                   // 钱包
	Status              int        `gorm:"column:status;type:int;not null;default:1;comment:状态:0-禁用,1-正常" json:"status"`                             // 状态
	LastLoginAt         *time.Time `gorm:"column:last_login_at;type:datetime;comment:最后登录时间" json:"last_login_at"`                                   // 最后登录时间
	LastLoginIP         string     `gorm:"column:last_login_ip;type:varchar(100);comment:最后登录IP" json:"last_login_ip"`                               // 最后登录IP
	LoginCount          int        `gorm:"column:login_count;type:int;not null;default:0;comment:登录次数" json:"login_count"`                           // 登录次数
	IsVip               int        `gorm:"column:is_vip;type:int;not null;default:0;comment:是否特权用户:0-否,1-是" json:"is_vip"`                           // 是否特权用户
}

func (u *User) TableName() string {
	return "game_users"
}

func init() {
	helper.RegisterModel(&User{})
}
