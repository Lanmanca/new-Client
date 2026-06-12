package admin

import (
	"errors"
	"star"
	"strings"
)

// LoginDTO 登录DTO
type LoginDTO struct {
	Username string `json:"username"` // 用户名
	Password string `json:"password"` // 密码
}

func (d *LoginDTO) Validate(ctx *star.Context) error {
	if strings.TrimSpace(d.Username) == "" || strings.TrimSpace(d.Password) == "" {
		return errors.New("USERNAME_OR_PASSWORD_EMPTY")
	}
	if len(d.Username) < 3 || len(d.Username) > 10 {
		return errors.New("USERNAME_LENGTH_ERROR")
	}
	return nil
}

// 用户信息
type UserInfo struct {
	ID       int64  `json:"id"`       // 用户ID
	Username string `json:"username"` // 用户名
	Nickname string `json:"nickname"` // 昵称
	Avatar   string `json:"avatar"`   // 头像
	Email    string `json:"email"`    // 邮箱
	Phone    string `json:"phone"`    // 手机号
}

// 创建管理员DTO
type CreateAdminDTO struct {
	Username string `json:"username"` // 用户名
	Password string `json:"password"` // 密码
	Nickname string `json:"nickname"` // 昵称
	Avatar   string `json:"avatar"`   // 头像
	Email    string `json:"email"`    // 邮箱
	Phone    string `json:"phone"`    // 手机号
	RoleID   int64  `json:"role_id"`  // 角色ID
	Status   int    `json:"status"`   // 状态
}

func (d *CreateAdminDTO) Validate(ctx *star.Context) error {
	if strings.TrimSpace(d.Username) == "" {
		return errors.New("USERNAME_EMPTY")
	}
	if len(d.Username) < 3 || len(d.Username) > 10 {
		return errors.New("USERNAME_LENGTH_ERROR")
	}
	if strings.TrimSpace(d.Password) == "" {
		return errors.New("PASSWORD_EMPTY")
	}
	return nil
}
