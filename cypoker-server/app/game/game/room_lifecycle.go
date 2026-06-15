package game

import (
	"fmt"
	"math"
	"math/rand/v2"
	"server/internal/helper"
	"sort"
	"strconv"
	"strings"
)

func shuffledDeck() []int {
	deck := make([]int, 0, 52)
	for suit := 1; suit <= 4; suit++ {
		for rank := 1; rank <= 13; rank++ {
			deck = append(deck, suit*100+rank)
		}
	}
	for i := len(deck) - 1; i > 0; i-- {
		j := rand.IntN(i + 1)
		deck[i], deck[j] = deck[j], deck[i]
	}
	return deck
}

// nextDealerAmongReady 在已准备座位间顺时针轮换庄家；首局或找不到上一庄时取最小座位号。
func nextDealerAmongReady(readySeats []int, prevDealer int) int {
	sort.Ints(readySeats)
	if len(readySeats) == 0 {
		return -1
	}
	if len(readySeats) == 1 {
		return readySeats[0]
	}
	if prevDealer <= 0 {
		return readySeats[0]
	}
	for i, s := range readySeats {
		if s == prevDealer {
			return readySeats[(i+1)%len(readySeats)]
		}
	}
	return readySeats[0]
}

func containsSeat(seats []int, seat int) bool {
	for _, s := range seats {
		if s == seat {
			return true
		}
	}
	return false
}

func playableSeatIndexes(room *Room) []int {
	if room == nil {
		return nil
	}
	seats := make([]int, 0, len(room.Players))
	for _, p := range room.Players {
		if p.SeatIndex > 0 && p.Status == PlayerStatusReady && p.Wallet > chipEps {
			seats = append(seats, p.SeatIndex)
		}
	}
	sort.Ints(seats)
	return seats
}

func nonBlindPositionLabels(count int) []string {
	switch count {
	case 0:
		return nil
	case 1:
		return []string{"UTG"}
	case 2:
		return []string{"UTG", "CO"}
	case 3:
		return []string{"UTG", "UTG+1", "CO"}
	case 4:
		return []string{"UTG", "UTG+1", "HJ", "CO"}
	case 5:
		return []string{"UTG", "UTG+1", "LJ", "HJ", "CO"}
	case 6:
		return []string{"UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"}
	default:
		labels := []string{"UTG", "UTG+1", "UTG+2"}
		for i := 0; i < count-6; i++ {
			labels = append(labels, "MP")
		}
		labels = append(labels, "LJ", "HJ", "CO")
		return labels
	}
}

func buildSeatRoles(seats []int, dealerSeat int) []SeatRoleResp {
	if len(seats) == 0 {
		return nil
	}
	order := seatOrderClockwise(append([]int(nil), seats...), dealerSeat)
	if len(order) == 0 {
		return nil
	}
	if len(order) == 1 {
		return []SeatRoleResp{{SeatIndex: order[0], Role: "BTN"}}
	}
	if len(order) == 2 {
		return []SeatRoleResp{
			{SeatIndex: order[0], Role: "BTN/SB"},
			{SeatIndex: order[1], Role: "BB"},
		}
	}
	roles := make([]SeatRoleResp, 0, len(order))
	roles = append(roles,
		SeatRoleResp{SeatIndex: order[0], Role: "BTN"},
		SeatRoleResp{SeatIndex: order[1], Role: "SB"},
		SeatRoleResp{SeatIndex: order[2], Role: "BB"},
	)
	labels := nonBlindPositionLabels(len(order) - 3)
	for i, label := range labels {
		roles = append(roles, SeatRoleResp{SeatIndex: order[i+3], Role: label})
	}
	return roles
}

func roomReadyKey(seats []int) string {
	key := ""
	for i, seat := range seats {
		if i > 0 {
			key += ","
		}
		key += strconv.Itoa(seat)
	}
	return key
}

func prepareRoomIfReadyLocked(room *Room, now int64) []RoomEvent {
	if room == nil {
		return nil
	}
	if room.Status == RoomStatusEnded {
		room.Round.Action.DeadlineAt = 0
		room.CountdownReadyKey = ""
		return nil
	}
	if room.Status == RoomStatusPlaying {
		room.CountdownReadyKey = ""
		return nil
	}
	seats := playableSeatIndexes(room)
	if room.MaxPlayers < 2 || len(seats) < room.MaxPlayers {
		room.Round.Action.DeadlineAt = 0
		room.CountdownReadyKey = ""
		return nil
	}
	key := roomReadyKey(seats)
	needsPrepare := key != room.CountdownReadyKey || !containsSeat(seats, room.Round.DealerSeatIndex)
	if needsPrepare {
		if room.Round.HandNo <= 0 {
			room.Round.DealerSeatIndex = seats[rand.IntN(len(seats))]
		} else {
			room.Round.DealerSeatIndex = nextDealerAmongReady(seats, room.Round.DealerSeatIndex)
		}
		room.CountdownReadyKey = key
		room.Round.Action.DeadlineAt = 0
		return []RoomEvent{{
			Type:  "event",
			Event: "prepare",
			Data: PrepareEventData{
				DealerSeatIndex: room.Round.DealerSeatIndex,
				SeatRoles:       buildSeatRoles(seats, room.Round.DealerSeatIndex),
			},
		}}
	}
	room.Round.Action.DeadlineAt = 0
	return nil
}

func buildGameOverEvent(room *Room) RoomEvent {
	data := GameOverEventData{
		Winners: []GameOverWinnerResp{},
	}
	if room != nil {
		data.Kind = room.Round.LastHandKind
		data.PotTotal = room.Round.LastHandPotTotal
		data.Rake = room.Round.LastHandRake
		data.Payouts = append([]LastHandPayout(nil), room.Round.LastHandPayouts...)
		data.Layers = append([]LastHandLayer(nil), room.Round.LastHandLayers...)
		data.ShowdownBestHands = append([]ShowdownBestHand(nil), room.Round.ShowdownBestHands...)

		bestByUser := make(map[string]ShowdownBestHand, len(room.Round.ShowdownBestHands))
		for _, best := range room.Round.ShowdownBestHands {
			bestByUser[best.UserID] = best
		}
		seatByUser := make(map[string]int, len(room.Players))
		for _, p := range room.Players {
			seatByUser[p.UserID] = p.SeatIndex
		}
		for _, payout := range room.Round.LastHandPayouts {
			if payout.Amount <= chipEps {
				continue
			}
			w := GameOverWinnerResp{
				UserID:    payout.UserID,
				Nickname:  payout.Nickname,
				SeatIndex: seatByUser[payout.UserID],
				Amount:    payout.Amount,
				HoleCards: append([]int(nil), payout.HoleCards...),
			}
			if best, ok := bestByUser[payout.UserID]; ok {
				if w.Nickname == "" {
					w.Nickname = best.Nickname
				}
				if w.SeatIndex <= 0 {
					w.SeatIndex = best.SeatIndex
				}
				w.BestFive = append([]int(nil), best.BestFive...)
				w.HandCategory = best.HandCategory
			}
			data.Winners = append(data.Winners, w)
		}
	}
	return RoomEvent{
		Type:  "event",
		Event: "gameover",
		Data:  data,
	}
}

func buildHandEndEvents(room *Room, now int64) []RoomEvent {
	if room == nil || room.Round.LastHandKind == "" {
		return nil
	}
	events := []RoomEvent{buildGameOverEvent(room)}
	// 一手结束后，清除已离线玩家的座位信息：
	// 他们没有在本手结束前重连，座位恢复为"空"状态
	clearOfflinePlayersSeats(room)
	room.CountdownReadyKey = ""
	events = append(events, prepareRoomIfReadyLocked(room, now)...)
	return events
}

// clearOfflinePlayersSeats 一手结束后移除所有仍离线的玩家，
// 将其座位恢复为空，以便下一手开始前座位状态干净。
func clearOfflinePlayersSeats(room *Room) {
	if room == nil {
		return
	}
	removed := false
	newPlayers := make([]PlayerSeat, 0, len(room.Players))
	for i := range room.Players {
		p := room.Players[i]
		if p.Offline {
			_ = refundSeatStackToDB(&room.Players[i])
			removed = true
			continue
		}
		newPlayers = append(newPlayers, p)
	}
	if removed {
		room.Players = newPlayers
		// 座位被清除后重置准备计数键，下次座位坐满时 prepareRoomIfReadyLocked
		// 会检测到 key 变化并重新触发 prepare 事件（分配 BTN/SB/BB 等座位角色）
		room.CountdownReadyKey = ""
	}
}

func buildLeaveEvent(p PlayerSeat) RoomEvent {
	data := LeaveEventData{
		Role:   "watcher",
		UserID: p.UserID,
	}
	if p.SeatIndex > 0 {
		data.SeatIndex = p.SeatIndex
		data.Role = "player"
	}
	return RoomEvent{
		Type:  "event",
		Event: "leave",
		Data:  data,
	}
}

func startGameLocked(room *Room) error {
	if room.Status == RoomStatusEnded {
		return ErrRoomEnded
	}
	for i := range room.Players {
		if room.Players[i].SeatIndex > 0 && room.Players[i].Status == PlayerStatusReady && room.Players[i].Wallet <= chipEps {
			room.Players[i].Status = PlayerStatusSitDown
		}
	}
	readySeats := make([]int, 0, len(room.Players))
	for _, p := range room.Players {
		if p.SeatIndex > 0 && p.Status == PlayerStatusReady {
			readySeats = append(readySeats, p.SeatIndex)
		}
	}
	if len(readySeats) < 2 {
		return ErrNotEnoughReadyPlayers
	}
	if room.MaxPlayers >= 2 && len(readySeats) < room.MaxPlayers {
		return ErrNotEnoughReadyPlayers
	}
	firstHand := room.Round.HandNo == 0
	room.Status = RoomStatusPlaying
	room.Round.HandNo++
	room.Round.ShowdownRevealUserIDs = nil
	room.Round.ShowdownBestHands = nil
	room.Round.HandActionLog = nil
	room.Round.LastHandKind = ""
	room.Round.LastHandPotTotal = 0
	room.Round.LastHandRake = 0
	room.Round.LastHandPayouts = nil
	room.Round.LastHandLayers = nil
	room.Round.Stage = "preflop"
	room.Round.HandStartedAt = nowUnixMilli()
	room.Round.CommunityCards = []int{0, 0, 0, 0, 0}
	room.Round.communityDeck = nil
	if !firstHand || !containsSeat(readySeats, room.Round.DealerSeatIndex) {
		room.Round.DealerSeatIndex = nextDealerAmongReady(readySeats, room.Round.DealerSeatIndex)
	}
	room.Round.Action.DeadlineAt = 0
	room.CountdownReadyKey = ""

	deck := shuffledDeck()
	di := 0
	for i := range room.Players {
		room.Players[i].Cards = []int{0, 0}
		if room.Players[i].SeatIndex > 0 && room.Players[i].Status == PlayerStatusReady {
			if di+1 < len(deck) {
				room.Players[i].Cards = []int{deck[di], deck[di+1]}
				di += 2
			}
		}
	}
	if di+4 < len(deck) {
		room.Round.communityDeck = []int{
			deck[di],
			deck[di+1],
			deck[di+2],
			deck[di+3],
			deck[di+4],
		}
	} else {
		room.Round.communityDeck = []int{0, 0, 0, 0, 0}
	}
	// 翻牌前客户端与对手均不应收到公共牌真值
	room.Round.CommunityCards = []int{0, 0, 0, 0, 0}
	now := nowUnix()
	if err := beginPokerHand(room, now); err != nil {
		return err
	}
	return nil
}

func updateStartCountdownLocked(room *Room, now int64) {
	_ = prepareRoomIfReadyLocked(room, now)
}

func pruneRoomPlayers(room *Room, now int64) bool {
	if room == nil {
		return false
	}
	changed := false
	newPlayers := make([]PlayerSeat, 0, len(room.Players))
	for i := range room.Players {
		p := room.Players[i]
		if p.IsOwner {
			newPlayers = append(newPlayers, p)
			continue
		}
		if p.Offline && p.OfflineAt > 0 {
			if room.Status == RoomStatusPlaying {
				// 对局中：超时不清座位、不改状态，由客户端在读秒结束后显示「离开」
				newPlayers = append(newPlayers, p)
				continue
			}
			// 非对局：离开即移出房间（非房主），桌上筹码退回账外
			_ = refundSeatStackToDB(&room.Players[i])
			changed = true
			continue
		}
		newPlayers = append(newPlayers, p)
	}
	if len(newPlayers) != len(room.Players) {
		changed = true
	}
	room.Players = newPlayers
	return changed
}

// syncAccountBalancesFromDB 仅同步账外余额到 AccountBalance，不修改桌上 Wallet（stack）。
func syncAccountBalancesFromDB(room *Room) bool {
	if room == nil || len(room.Players) == 0 {
		return false
	}
	userIDs := make([]string, 0, len(room.Players))
	for _, p := range room.Players {
		if p.UserID != "" {
			userIDs = append(userIDs, p.UserID)
		}
	}
	if len(userIDs) == 0 {
		return false
	}
	db := helper.GetDB()
	if db == nil {
		return false
	}
	type walletRow struct {
		UserID string  `gorm:"column:user_id"`
		Wallet float64 `gorm:"column:wallet"`
	}
	var rows []walletRow
	if err := db.Table("game_users").Select("user_id, wallet").Where("user_id IN ?", userIDs).Find(&rows).Error; err != nil {
		return false
	}
	walletMap := make(map[string]float64, len(rows))
	for _, row := range rows {
		walletMap[normUserID(row.UserID)] = row.Wallet
	}
	changed := false
	for i := range room.Players {
		if w, ok := walletMap[normUserID(room.Players[i].UserID)]; ok {
			if math.Abs(room.Players[i].AccountBalance-w) > 0.005 {
				room.Players[i].AccountBalance = w
				changed = true
			}
		}
	}
	return changed
}

func parseBuyInAmount(data map[string]any) float64 {
	if data == nil {
		return 0
	}
	for _, key := range []string{"buy_in", "buyIn", "amount"} {
		if raw, ok := data[key]; ok {
			switch v := raw.(type) {
			case float64:
				return v
			case int:
				return float64(v)
			case int64:
				return float64(v)
			case string:
				if parsed, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil {
					return parsed
				}
			}
		}
	}
	return 0
}

// ApplyPlayerEvent 统一房间内玩家事件状态机（坐下/站起/准备/离开）
func (r *Repository) ApplyPlayerEvent(roomNumber, userID, event string, data map[string]any) (*RoomStateResp, error) {
	roomStoreMu.Lock()
	defer roomStoreMu.Unlock()

	room, ok := roomStore[roomNumber]
	if !ok {
		return nil, ErrRoomNotFound
	}

	playerIdx := -1
	for i := range room.Players {
		if sameUserID(room.Players[i].UserID, userID) {
			playerIdx = i
			break
		}
	}
	if playerIdx < 0 {
		return nil, ErrPlayerNotInRoom
	}

	now := nowUnix()
	pruneRoomPlayers(room, now)
	events := []RoomEvent(nil)
	handEnded := false
	switch event {
	case "sit_down":
		syncAccountBalancesFromDB(room)
		if room.Status == RoomStatusEnded {
			return nil, ErrRoomEnded
		}
		if room.Status == RoomStatusPlaying {
			return nil, ErrGameActionLocked
		}
		targetSeat := -1
		if data != nil {
			if raw, ok := data["index"]; ok {
				switch v := raw.(type) {
				case float64:
					targetSeat = int(v)
				case int:
					targetSeat = v
				case int64:
					targetSeat = int(v)
				}
			}
			if raw, ok := data["seat_index"]; ok {
				switch v := raw.(type) {
				case float64:
					targetSeat = int(v)
				case int:
					targetSeat = v
				case int64:
					targetSeat = int(v)
				}
			}
		}
		if targetSeat < 1 || targetSeat > room.MaxPlayers {
			return nil, ErrSeatIndexInvalid
		}
		for i := range room.Players {
			// 站起（SeatIndex <=0）不占座
			if i != playerIdx && room.Players[i].SeatIndex == targetSeat {
				return nil, ErrSeatOccupied
			}
		}
		buyIn := parseBuyInAmount(data)
		alreadySeated := room.Players[playerIdx].SeatIndex > 0
		if !alreadySeated && buyIn <= chipEps {
			return nil, ErrBuyInRequired
		}
		if buyIn > chipEps {
			offTable, err := dbOffTableBalance(userID)
			if err != nil {
				return nil, err
			}
			// 账外（game_users.wallet）无可用余额则不可买入上桌（与桌上筹码无关）
			if offTable <= chipEps {
				return nil, ErrInsufficientOffTableBalance
			}
			if buyIn > offTable+chipEps {
				return nil, ErrInsufficientOffTableBalance
			}
			maxCap := room.MaxBuyIn
			if maxCap <= chipEps {
				maxCap = offTable
			} else {
				maxCap = math.Min(maxCap, offTable)
			}
			if buyIn > maxCap+chipEps {
				return nil, ErrBuyInOutOfRange
			}
			if room.MinBuyIn > chipEps && !alreadySeated {
				if offTable+chipEps < room.MinBuyIn {
					if math.Abs(buyIn-offTable) > chipEps {
						return nil, ErrBuyInOutOfRange
					}
				} else if buyIn+chipEps < room.MinBuyIn {
					return nil, ErrBuyInOutOfRange
				}
			}
			if err := dbSubtractOffTable(userID, buyIn); err != nil {
				return nil, err
			}
			room.Players[playerIdx].Wallet += buyIn
			room.Players[playerIdx].AccountBalance = offTable - buyIn
		}
		room.Players[playerIdx].SeatIndex = targetSeat
		room.Players[playerIdx].Status = PlayerStatusReady
		room.Players[playerIdx].Offline = false
		room.Players[playerIdx].OfflineAt = 0
		room.Players[playerIdx].ResumeStatus = ""
	case "stand_up":
		if room.Status == RoomStatusEnded {
			return nil, ErrRoomEnded
		}
		if room.Status == RoomStatusPlaying {
			return nil, ErrGameActionLocked
		}
		if room.Players[playerIdx].SeatIndex <= 0 {
			return nil, ErrNeedSitDownFirst
		}
		if err := refundSeatStackToDB(&room.Players[playerIdx]); err != nil {
			return nil, err
		}
		room.Players[playerIdx].Status = PlayerStatusWaiting
		room.Players[playerIdx].SeatIndex = -1
		if bal, err := dbOffTableBalance(userID); err == nil {
			room.Players[playerIdx].AccountBalance = bal
		}
	case "ready":
		if room.Status == RoomStatusEnded {
			return nil, ErrRoomEnded
		}
		if room.Status == RoomStatusPlaying {
			return nil, ErrGameActionLocked
		}
		if room.Players[playerIdx].SeatIndex <= 0 {
			return nil, ErrNeedSitDownFirst
		}
		// 已入座玩家准备：只需桌上仍有筹码；最小买入仅约束 sit_down 买入，不强制短码站起
		if room.Players[playerIdx].Wallet <= chipEps {
			return nil, ErrInsufficientStackToReady
		}
		room.Players[playerIdx].Status = PlayerStatusReady
	case "cancel_ready":
		if room.Status == RoomStatusEnded {
			return nil, ErrRoomEnded
		}
		if room.Status == RoomStatusPlaying {
			return nil, ErrGameActionLocked
		}
		if room.Players[playerIdx].SeatIndex <= 0 {
			return nil, ErrNeedSitDownFirst
		}
		room.Players[playerIdx].Status = PlayerStatusReady
	case "start_game":
		if room.Status == RoomStatusEnded {
			return nil, ErrRoomEnded
		}
		if room.Status == RoomStatusPlaying {
			resp := toRoomStateResp(room)
			return &resp, nil
		}
		if err := startGameLocked(room); err != nil {
			return nil, err
		}
	case "action":
		if room.Status == RoomStatusEnded {
			return nil, ErrRoomEnded
		}
		if room.Status != RoomStatusPlaying {
			return nil, ErrGameActionLocked
		}
		kind := ""
		var amount float64
		if data != nil {
			if raw, ok := data["kind"]; ok {
				if s, ok2 := raw.(string); ok2 {
					kind = s
				}
			}
			if raw, ok := data["amount"]; ok {
				switch v := raw.(type) {
				case float64:
					amount = v
				case int:
					amount = float64(v)
				}
			}
		}
		wasPlaying := room.Status == RoomStatusPlaying
		if err := applyPokerAction(room, userID, kind, amount, now); err != nil {
			return nil, err
		}
		if wasPlaying && room.Status != RoomStatusPlaying && room.Round.LastHandKind != "" {
			events = append(events, buildHandEndEvents(room, now)...)
			handEnded = true
		}
	case "leave":
		events = append(events, buildLeaveEvent(room.Players[playerIdx]))
		if room.Status != RoomStatusPlaying {
			if err := refundSeatStackToDB(&room.Players[playerIdx]); err != nil {
				return nil, err
			}
			room.Players = append(room.Players[:playerIdx], room.Players[playerIdx+1:]...)
			break
		}
		// 游戏进行中离开：保留座位和手牌用于重连恢复，但立即标记为弃牌。
		// 其他玩家继续游戏；若该玩家重连则通过 recover 事件恢复座位视图。
		prevStatus := room.Players[playerIdx].Status
		resumeStatus := prevStatus
		if room.Players[playerIdx].IsOwner {
			room.Players[playerIdx].Offline = true
			room.Players[playerIdx].OfflineAt = now
			room.Players[playerIdx].ResumeStatus = resumeStatus
			if room.Players[playerIdx].SeatIndex > 0 ||
				room.Players[playerIdx].Status == PlayerStatusReady ||
				room.Players[playerIdx].Status == PlayerStatusSitDown {
				room.Players[playerIdx].Status = PlayerStatusBusy
			} else {
				room.Players[playerIdx].Status = PlayerStatusLeave
			}
		} else if room.Players[playerIdx].SeatIndex > 0 ||
			room.Players[playerIdx].Status == PlayerStatusReady ||
			room.Players[playerIdx].Status == PlayerStatusSitDown {
			room.Players[playerIdx].Offline = true
			room.Players[playerIdx].OfflineAt = now
			room.Players[playerIdx].ResumeStatus = resumeStatus
			room.Players[playerIdx].Status = PlayerStatusBusy
		} else {
			room.Players = append(room.Players[:playerIdx], room.Players[playerIdx+1:]...)
		}
		// 游戏进行中离开：区分当前回合玩家与非当前回合玩家
		if room.Status == RoomStatusPlaying && playerIdx >= 0 &&
			playerIdx < len(room.Players) && room.Players[playerIdx].SeatIndex > 0 {
			seatBefore := room.Players[playerIdx].SeatIndex
			isCurrentTurn := sameUserID(room.Round.Action.CurrentTurnUserID, userID)

			if isCurrentTurn {
				// 当前回合玩家离开：
				// - 剩余读秒 > 5s → 缩短到 5s，等待超时后由 applyActionTimeout 自动处理
				// - 剩余读秒 ≤ 5s → 立即弃牌，推进到下一位
				remaining := room.Round.Action.DeadlineAt - now
				if remaining > 5 {
					room.Round.Action.DeadlineAt = now + 5
					fmt.Printf("[game.leave] current-turn user=%s seat=%d deadline shortened to 5s (was %ds)\n",
						userID, seatBefore, remaining)
				} else {
					room.Players[playerIdx].Folded = true
					room.BettingActed[seatBefore] = true
					recordLastAction(room, userID, "fold", 0)

					fmt.Printf("[game.leave] current-turn auto-fold user=%s seat=%d (remaining=%ds)\n",
						userID, seatBefore, remaining)

					advanceBettingTurn(room, now, seatBefore)

					// 弃牌可能导致整手结束（如 2 人局当前玩家离开弃牌 → fold_win）
					if room.Status != RoomStatusPlaying && room.Round.LastHandKind != "" {
						fmt.Printf("[game.leave] hand ended via auto-fold, kind=%s\n", room.Round.LastHandKind)
						events = append(events, buildHandEndEvents(room, now)...)
						handEnded = true
					}
				}
			} else {
				// 非当前回合玩家离开：仅标记离线，不弃牌。
				// 轮到该玩家时，由 setActionTurn 设定 5 秒超时，
				// applyActionTimeout 自动处理（优先过牌 > 弃牌），
				// 确保离开玩家以最小损失参与完本手牌。
				fmt.Printf("[game.leave] non-current-turn user=%s seat=%d marked offline, deferred auto-action\n",
					userID, seatBefore)
			}
		}
	default:
		// 未支持事件保持幂等
	}

	for i := range room.Players {
		room.Players[i].LastUpdateAt = now
	}
	if !handEnded {
		events = append(events, prepareRoomIfReadyLocked(room, now)...)
	}
	room.UpdatedAt = now

	resp := toRoomStateResp(room)
	resp.Events = events
	return &resp, nil
}

func (r *Repository) ProcessRoomTimers() map[string]*RoomStateResp {
	roomStoreMu.Lock()
	defer roomStoreMu.Unlock()
	now := nowUnix()
	changed := map[string]*RoomStateResp{}
	for roomNumber, room := range roomStore {
		pruned := pruneRoomPlayers(room, now)
		walletChanged := syncAccountBalancesFromDB(room)
		events := []RoomEvent(nil)

		wasPlaying := room.Status == RoomStatusPlaying
		if applyActionTimeout(room, now) {
			if wasPlaying && room.Status != RoomStatusPlaying && room.Round.LastHandKind != "" {
				events = append(events, buildHandEndEvents(room, now)...)
			}
			for i := range room.Players {
				room.Players[i].LastUpdateAt = now
			}
			room.UpdatedAt = now
			resp := toRoomStateResp(room)
			resp.Events = events
			changed[roomNumber] = &resp
			continue
		}

		// 清理离线玩家后，必须重算开局准备事件（准备人数变化），否则其他客户端房态不同步。
		events = append(events, prepareRoomIfReadyLocked(room, now)...)
		if pruned || walletChanged || len(events) > 0 {
			room.UpdatedAt = now
			resp := toRoomStateResp(room)
			resp.Events = events
			changed[roomNumber] = &resp
		}
	}
	return changed
}
