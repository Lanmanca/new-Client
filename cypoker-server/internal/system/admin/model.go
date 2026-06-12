package admin

import (
	"server/internal/helper"
	"server/internal/system/role"
	"time"
)

// Admin 管理员
type Admin struct {
	helper.Model
	// 基本信息
	Username string `json:"username" gorm:"column:username;type:varchar(50);not null;uniqueIndex:idx_username;comment:用户名"`
	Password string `json:"password" gorm:"column:password;type:varchar(255);not null;comment:密码"`
	Salt     string `json:"salt" gorm:"column:salt;type:varchar(64);comment:盐值"`

	// 个人资料
	Nickname string `json:"nickname" gorm:"column:nickname;type:varchar(50);comment:昵称"`
	Avatar   string `json:"avatar" gorm:"column:avatar;type:varchar(255);comment:头像"`
	Email    string `json:"email" gorm:"column:email;type:varchar(100);uniqueIndex:idx_email;comment:邮箱"`
	Phone    string `json:"phone" gorm:"column:phone;type:varchar(20);uniqueIndex:idx_phone;comment:手机号"`

	// 权限和状态
	Status  int             `json:"status" gorm:"column:status;type:int;not null;default:1;index:idx_status;comment:状态:0-禁用,1-正常"`
	RoleID  int64           `json:"role_id" gorm:"column:role_id;not null;index:idx_role_id;comment:角色ID"`
	Role    *role.AdminRole `json:"role,omitempty" gorm:"foreignKey:RoleID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT"`
	IsSuper int             `json:"is_super" gorm:"column:is_super;type:int;not null;default:0;index:idx_is_super;comment:是否超级管理员:0-否,1-是"`

	// 登录统计
	LastLoginAt *time.Time `json:"last_login_at" gorm:"column:last_login_at;type:datetime;comment:最后登录时间"`
	LastLoginIP string     `json:"last_login_ip" gorm:"column:last_login_ip;type:varchar(100);comment:最后登录IP"`
	LoginCount  int        `json:"login_count" gorm:"column:login_count;type:int;not null;default:0;comment:登录次数"`

	// 创建者
	CreatorID *int64 `json:"creator_id,omitempty" gorm:"column:creator_id;index:idx_creator_id;comment:创建者ID"`
	Creator   *Admin `json:"creator,omitempty" gorm:"foreignKey:CreatorID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL"`
}

func (a *Admin) TableName() string {
	return "sys_admins"
}

func init() {
	helper.RegisterModel(&Admin{})
}
