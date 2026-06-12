package game

import (
	"fmt"
	"server/internal/helper"
	"star"
	"strings"
)

type Service struct {
	repo *Repository
	ws   *WSManager
}

func NewService() *Service {
	repo := NewRepository()
	return &Service{repo: repo, ws: NewWSManager(repo)}
}

func requireTelegramUserID(raw string) (string, bool) {
	uid := strings.TrimSpace(raw)
	if uid == "" {
		return "", false
	}
	return uid, true
}

// CreateRoom 创建房间
func (s *Service) CreateRoom(ctx *star.Context) *star.Response {
	in := ctx.GetBodyModel().(*CreateRoomReq)
	userID, ok := requireTelegramUserID(ctx.GetRequestHeader("X-User-ID"))
	if !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	resp, err := s.repo.CreateRoom(userID, in)
	if err != nil {
		return helper.FailWithShow("GAME_CREATE_ROOM_FAILED")
	}
	maskRoomStateHoleCards(&resp.Room, userID)
	return helper.Success("GAME_CREATE_ROOM_SUCCESS", resp.Room)
}

// JoinRoom 加入房间
func (s *Service) JoinRoom(ctx *star.Context) *star.Response {
	in := ctx.GetBodyModel().(*JoinRoomReq)
	userID, ok := requireTelegramUserID(ctx.GetRequestHeader("X-User-ID"))
	if !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	resp, err := s.repo.JoinRoom(userID, in.RoomNumber)
	if err != nil {
		return helper.FailWithShow(err.Error())
	}
	// 重连/加入后立即广播完整房态（WS 内按连接再遮罩）；HTTP 仅返回当前用户视角。
	s.ws.hub.broadcastRoomState(in.RoomNumber, &resp.Room)

	// 游戏进行中重连：向该玩家定向推送 recover 事件，携带其真实手牌及遮罩后的房态
	if resp.Room.Status == RoomStatusPlaying {
		for _, p := range resp.Room.Players {
			if sameUserID(p.UserID, userID) && p.SeatIndex > 0 && len(p.Cards) >= 2 {
				masked := s.ws.hub.maskRoomStateForUser(&resp.Room, userID)
				s.ws.hub.sendEventToUser(in.RoomNumber, userID, RoomEvent{
					Type:  "event",
					Event: "recover",
					Data: RecoverEventData{
						SeatIndex:  p.SeatIndex,
						Cards:      p.Cards,
						Wallet:     p.Wallet,
						CurrentBet: p.CurrentBet,
						Folded:     p.Folded,
						AllInHand:  p.AllInHand,
						RoomState:  *masked,
					},
				})
				break
			}
		}
	}

	maskRoomStateHoleCards(&resp.Room, userID)
	return helper.Success("GAME_JOIN_ROOM_SUCCESS", resp.Room)
}

// GetRoomState 获取房态
func (s *Service) GetRoomState(ctx *star.Context) *star.Response {
	in := ctx.GetBodyModel().(*GetRoomStateReq)
	viewer, ok := requireTelegramUserID(ctx.GetRequestHeader("X-User-ID"))
	if !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	room, err := s.repo.GetRoomState(in.RoomNumber)
	if err != nil {
		return helper.FailWithShow(err.Error())
	}
	maskRoomStateHoleCards(room, viewer)
	return helper.Success("GAME_GET_ROOM_STATE_SUCCESS", room)
}

// GetRoomOwner 获取房主信息
func (s *Service) GetRoomOwner(ctx *star.Context) *star.Response {
	in := ctx.GetBodyModel().(*GetRoomStateReq)
	if _, ok := requireTelegramUserID(ctx.GetRequestHeader("X-User-ID")); !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	owner, err := s.repo.GetRoomOwner(in.RoomNumber)
	if err != nil {
		return helper.FailWithShow(err.Error())
	}
	return helper.Success("GAME_GET_ROOM_OWNER_SUCCESS", owner)
}

// GetRoomPlayers 获取房间玩家
func (s *Service) GetRoomPlayers(ctx *star.Context) *star.Response {
	in := ctx.GetBodyModel().(*GetRoomStateReq)
	if _, ok := requireTelegramUserID(ctx.GetRequestHeader("X-User-ID")); !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	players, err := s.repo.GetRoomPlayers(in.RoomNumber)
	if err != nil {
		return helper.FailWithShow(err.Error())
	}
	return helper.Success("GAME_GET_ROOM_PLAYERS_SUCCESS", players)
}

// DissolveRoom 房主解散房间（仅移除内存房间并断开该房 WS，具体 UI 由客户端处理）。
func (s *Service) DissolveRoom(ctx *star.Context) *star.Response {
	in := ctx.GetBodyModel().(*GetRoomStateReq)
	userID, ok := requireTelegramUserID(ctx.GetRequestHeader("X-User-ID"))
	if !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	if err := s.repo.DissolveRoom(in.RoomNumber, userID); err != nil {
		return helper.FailWithShow(err.Error())
	}
	s.ws.CloseRoom(in.RoomNumber)
	return helper.Success("GAME_DISSOLVE_ROOM_SUCCESS", map[string]any{"room_number": in.RoomNumber})
}

// GetRoomList 获取公开房间列表
func (s *Service) GetRoomList(ctx *star.Context) *star.Response {
	if _, ok := requireTelegramUserID(ctx.GetRequestHeader("X-User-ID")); !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	param := ctx.GetBodyModel().(*helper.PageParam)
	rooms, total := s.repo.GetPublicRoomList(param.PageNo, param.PageSize)
	pages := 0
	if param.PageSize > 0 {
		pages = (total + param.PageSize - 1) / param.PageSize
	}
	data := helper.PageResponse{
		PageNo:   param.PageNo,
		PageSize: param.PageSize,
		Count:    total,
		Pages:    pages,
		List:     rooms,
	}
	return helper.Success("GAME_GET_ROOM_LIST_SUCCESS", data)
}

// GetMyRoomList 获取当前用户已加入房间列表
func (s *Service) GetMyRoomList(ctx *star.Context) *star.Response {
	param := ctx.GetBodyModel().(*GetMyRoomsReq)
	userID, ok := requireTelegramUserID(ctx.GetRequestHeader("X-User-ID"))
	if !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	rooms, total := s.repo.GetJoinedRoomList(userID, param.PageNo, param.PageSize)
	pages := 0
	if param.PageSize > 0 {
		pages = (total + param.PageSize - 1) / param.PageSize
	}
	data := helper.PageResponse{
		PageNo:   param.PageNo,
		PageSize: param.PageSize,
		Count:    total,
		Pages:    pages,
		List:     rooms,
	}
	return helper.Success("GAME_GET_MY_ROOM_LIST_SUCCESS", data)
}

// GetGameHistory 获取当前用户参与过的对局历史
func (s *Service) GetGameHistory(ctx *star.Context) *star.Response {
	param := ctx.GetBodyModel().(*GetGameHistoryReq)
	userID, ok := requireTelegramUserID(ctx.GetRequestHeader("X-User-ID"))
	if !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	records, total := s.repo.GetGameHistory(userID, param.PageNo, param.PageSize)
	pages := 0
	if param.PageSize > 0 {
		pages = (total + param.PageSize - 1) / param.PageSize
	}
	data := helper.PageResponse{
		PageNo:   param.PageNo,
		PageSize: param.PageSize,
		Count:    total,
		Pages:    pages,
		List:     records,
	}
	return helper.Success("GAME_GET_GAME_HISTORY_SUCCESS", data)
}

// WS WebSocket 入口
func (s *Service) WS(ctx *star.Context) *star.Response {
	userID := ctx.GetQuery("user_id")
	if _, ok := requireTelegramUserID(fmt.Sprintf("%v", userID)); !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	return s.ws.Handle(ctx)
}
