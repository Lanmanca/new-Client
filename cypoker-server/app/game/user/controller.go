package user

import "star"

type Controller struct {
	service *Service
}

func NewController() *Controller {
	return &Controller{service: NewService()}
}

// Register 注册用户
func (c *Controller) Register(ctx *star.Context) *star.Response {
	return c.service.Register(ctx)
}

// Login 登录
func (c *Controller) Login(ctx *star.Context) *star.Response {
	return c.service.Login(ctx)
}

// LoginTelegram Telegram WebApp 登录
func (c *Controller) LoginTelegram(ctx *star.Context) *star.Response {
	return c.service.LoginTelegram(ctx)
}

// GetUserInfo 获取用户信息
func (c *Controller) GetUserInfo(ctx *star.Context) *star.Response {
	return c.service.GetUserInfo(ctx)
}

// UpdateUserStatus 更新用户状态
func (c *Controller) UpdateUserStatus(ctx *star.Context) *star.Response {
	return c.service.UpdateUserStatus(ctx)
}

// UpdateUserIsVip 更新用户特权
func (c *Controller) UpdateUserIsVip(ctx *star.Context) *star.Response {
	return c.service.UpdateUserIsVip(ctx)
}

// GetUserList 用户列表
func (c *Controller) GetUserList(ctx *star.Context) *star.Response {
	return c.service.GetUserList(ctx)
}

// UpdateUserLevel 更新用户等级
func (c *Controller) UpdateUserLevel(ctx *star.Context) *star.Response {
	return c.service.UpdateUserLevel(ctx)
}

// UpdateUserWallet 更新用户钱包
func (c *Controller) UpdateUserWallet(ctx *star.Context) *star.Response {
	return c.service.UpdateUserWallet(ctx)
}
