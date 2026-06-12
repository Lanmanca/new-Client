package game

// maskRoomStateHoleCards 保留 viewer 自己的手牌；摊牌阶段在 showdown_reveal 名单内的玩家对全员公开。
// viewerUserID 为空时（如房间列表）仅公开名单内玩家手牌，其余 [0,0]。
func maskRoomStateHoleCards(resp *RoomStateResp, viewerUserID string) {
	if resp == nil {
		return
	}
	reveal := map[string]struct{}{}
	if resp.Round.Stage == "showdown" {
		for _, uid := range resp.Round.ShowdownRevealUserIDs {
			reveal[uid] = struct{}{}
		}
	}
	for i := range resp.Players {
		uid := resp.Players[i].UserID
		if viewerUserID != "" && sameUserID(uid, viewerUserID) {
			continue
		}
		if _, ok := reveal[uid]; ok {
			continue
		}
		resp.Players[i].Cards = []int{0, 0}
		resp.Players[i].AccountBalance = 0
	}
}
