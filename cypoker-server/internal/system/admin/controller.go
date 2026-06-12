package admin

import (
	"star"
)

type Controller struct {
	Service *Service
}

func NewController() *Controller {
	return &Controller{Service: NewService()}
}

// Login 登录
func (c *Controller) Login(ctx *star.Context) *star.Response {
	return c.Service.Login(ctx)
}

// Logout 登出
func (c *Controller) Logout(ctx *star.Context) *star.Response {
	return nil
}

// ChangePassword 修改密码
func (c *Controller) ChangePassword(ctx *star.Context) *star.Response {
	return nil
}

// UpdateProfile 更新个人信息
func (c *Controller) UpdateProfile(ctx *star.Context) *star.Response {
	return nil
}

// Ping 心跳检测
func (c *Controller) Ping(ctx *star.Context) *star.Response {
	return nil
}

// GetAdminList 获取管理员列表
func (c *Controller) GetAdminList(ctx *star.Context) *star.Response {
	return nil
}

// CreateAdmin 创建管理员
func (c *Controller) CreateAdmin(ctx *star.Context) *star.Response {
	return c.Service.CreateAdmin(ctx)
}

// UpdateAdmin 更新管理员
func (c *Controller) UpdateAdmin(ctx *star.Context) *star.Response {
	return nil
}

// DeleteAdmin 删除管理员
func (c *Controller) DeleteAdmin(ctx *star.Context) *star.Response {
	return nil
}
