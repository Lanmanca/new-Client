package game

import "star"

type Controller struct {
	service *Service
}

func NewController() *Controller {
	return &Controller{service: NewService()}
}

func (c *Controller) CreateRoom(ctx *star.Context) *star.Response {
	return c.service.CreateRoom(ctx)
}

func (c *Controller) JoinRoom(ctx *star.Context) *star.Response {
	return c.service.JoinRoom(ctx)
}

// GetRoomState 获取房态
func (c *Controller) GetRoomState(ctx *star.Context) *star.Response {
	return c.service.GetRoomState(ctx)
}

// GetRoomOwner 获取房主
func (c *Controller) GetRoomOwner(ctx *star.Context) *star.Response {
	return c.service.GetRoomOwner(ctx)
}

// GetRoomPlayers 获取房间玩家
func (c *Controller) GetRoomPlayers(ctx *star.Context) *star.Response {
	return c.service.GetRoomPlayers(ctx)
}

// GetRoomList 获取房间列表
func (c *Controller) GetRoomList(ctx *star.Context) *star.Response {
	return c.service.GetRoomList(ctx)
}

// GetMyRoomList 获取我当前加入的房间列表
func (c *Controller) GetMyRoomList(ctx *star.Context) *star.Response {
	return c.service.GetMyRoomList(ctx)
}

// GetGameHistory 获取我参与过的对局历史
func (c *Controller) GetGameHistory(ctx *star.Context) *star.Response {
	return c.service.GetGameHistory(ctx)
}

// DissolveRoom 房主解散房间
func (c *Controller) DissolveRoom(ctx *star.Context) *star.Response {
	return c.service.DissolveRoom(ctx)
}

// WS WebSocket 入口
func (c *Controller) WS(ctx *star.Context) *star.Response {
	return c.service.WS(ctx)
}
