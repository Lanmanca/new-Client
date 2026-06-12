package game

import (
	"server/internal/helper"
	"star"
)

func Router() star.Route {
	c := NewController()

	return star.Route{
		Path: "/game",
		Children: []star.Route{
			{Path: "/ws", Method: star.GET, IsWebSocket: true, Meta: map[string]any{"encrypt": false, "requireAuth": false}, Handler: c.WS},
			{Path: "/create_room", Method: star.POST, Body: &CreateRoomReq{}, Handler: c.CreateRoom},
			{Path: "/join_room", Method: star.POST, Body: &JoinRoomReq{}, Handler: c.JoinRoom},
			{Path: "/get_room_state", Method: star.POST, Body: &GetRoomStateReq{}, Handler: c.GetRoomState},
			{Path: "/get_room_owner", Method: star.POST, Body: &GetRoomStateReq{}, Handler: c.GetRoomOwner},
			{Path: "/get_room_players", Method: star.POST, Body: &GetRoomStateReq{}, Handler: c.GetRoomPlayers},
			{Path: "/get_room_list", Method: star.POST, Body: &helper.PageParam{}, Handler: c.GetRoomList},
			{Path: "/get_my_room_list", Method: star.POST, Body: &GetMyRoomsReq{}, Handler: c.GetMyRoomList},
			{Path: "/get_game_history", Method: star.POST, Body: &GetGameHistoryReq{}, Handler: c.GetGameHistory},
			{Path: "/dissolve_room", Method: star.POST, Body: &GetRoomStateReq{}, Handler: c.DissolveRoom},
		},
	}
}
