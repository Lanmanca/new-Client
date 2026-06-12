package game

// revealCommunityForStage 按当前 stage 将 communityDeck 同步到 CommunityCards（下发给客户端）。
func revealCommunityForStage(room *Room) {
	deck := room.Round.communityDeck
	if len(deck) < 5 {
		room.Round.CommunityCards = []int{0, 0, 0, 0, 0}
		return
	}
	vis := make([]int, 5)
	switch room.Round.Stage {
	case "preflop":
		// 全 0
	case "flop":
		copy(vis[0:3], deck[0:3])
	case "turn":
		copy(vis[0:4], deck[0:4])
	case "river", "showdown":
		copy(vis, deck)
	default:
	}
	room.Round.CommunityCards = vis
}

// communityBoardForEval 比牌用完整五张公共牌（来自内存 deck）。
func communityBoardForEval(room *Room) []int {
	if len(room.Round.communityDeck) >= 5 {
		return room.Round.communityDeck
	}
	out := make([]int, 0, 5)
	for _, c := range room.Round.CommunityCards {
		if c > 0 {
			out = append(out, c)
		}
	}
	return out
}
