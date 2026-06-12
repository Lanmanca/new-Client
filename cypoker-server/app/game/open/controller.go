package open

import "star"

type Controller struct {
	service *Service
}

func NewController() *Controller {
	return &Controller{service: NewService()}
}

// GetAppVersion 获取应用版本（最新版本）
func (c *Controller) GetAppVersion(ctx *star.Context) *star.Response {
	return c.service.GetAppVersion(ctx)
}
