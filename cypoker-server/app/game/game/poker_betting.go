package game

import (
	"errors"
	"fmt"
	"math"
	"sort"
)

var (
	ErrNotYourTurn   = errors.New("NOT_YOUR_TURN")
	ErrInvalidAction = errors.New("INVALID_ACTION")
	ErrCannotCheck   = errors.New("CANNOT_CHECK")
	ErrCannotRaise   = errors.New("CANNOT_RAISE")
)

const chipEps = 1e-6

// walletDustEps 低于此视为无剩余栈：归零（配合 markAllInIfCommittedFullStack 标 AllInHand）
const walletDustEps = 1e-3

// markAllInIfCommittedFullStack 本行动是否用尽了行动前桌上全部可下注筹码（与浮点残片无关）。
// 一旦为真，本手不再进入行动轮（德扑：全下后只摊牌，不再决策）。
func markAllInIfCommittedFullStack(p *PlayerSeat, preWallet, paid float64) {
	if preWallet <= chipEps || paid <= chipEps {
		return
	}
	if paid+chipEps < preWallet-chipEps {
		return
	}
	p.AllInHand = true
	p.Wallet = 0
}

func beginPokerHand(room *Room, now int64) error {
	room.Round.Pot.MainPot = 0
	room.Round.Pot.SidePot = 0
	room.Round.Pot.Total = 0
	room.BettingActed = make(map[int]bool)
	room.BettingMaxStreet = 0
	room.Round.Action.LastAction = ""
	room.Round.Action.LastActionUserID = ""
	room.Round.Action.LastActionAmount = 0
	room.Round.HandActionLog = nil

	for i := range room.Players {
		room.Players[i].Folded = false
		room.Players[i].CurrentBet = 0
		room.Players[i].ContributedThisHand = 0
		room.Players[i].AllInHand = false
	}

	if room.Ante > chipEps {
		for i := range room.Players {
			if playerInHand(&room.Players[i]) {
				preW := room.Players[i].Wallet
				postAnte(room, i, room.Ante)
				take := preW - room.Players[i].Wallet
				if take > chipEps {
					markAllInIfCommittedFullStack(&room.Players[i], preW, take)
					appendHandAction(room, room.Players[i].UserID, "ante", take)
				}
			}
		}
	}

	seats := readySeatsWithCards(room)
	if len(seats) < 2 {
		return ErrNotEnoughReadyPlayers
	}
	order := seatOrderClockwise(seats, room.Round.DealerSeatIndex)
	sbSeat, bbSeat := sbBbSeatsFromOrder(order)
	sbIdx := indexBySeat(room, sbSeat)
	bbIdx := indexBySeat(room, bbSeat)
	if sbIdx < 0 || bbIdx < 0 {
		return ErrInvalidAction
	}

	sbAmt := math.Min(room.Round.SmallBlindAmount, room.Players[sbIdx].Wallet)
	bbAmt := math.Min(room.Round.BigBlindAmount, room.Players[bbIdx].Wallet)
	sbPre := room.Players[sbIdx].Wallet
	postChip(room, sbIdx, sbAmt)
	markAllInIfCommittedFullStack(&room.Players[sbIdx], sbPre, sbAmt)
	appendHandAction(room, room.Players[sbIdx].UserID, "post_sb", sbAmt)
	bbPre := room.Players[bbIdx].Wallet
	postChip(room, bbIdx, bbAmt)
	markAllInIfCommittedFullStack(&room.Players[bbIdx], bbPre, bbAmt)
	appendHandAction(room, room.Players[bbIdx].UserID, "post_bb", bbAmt)

	room.BettingMaxStreet = math.Max(room.Players[sbIdx].CurrentBet, room.Players[bbIdx].CurrentBet)
	room.Round.LastRaiseSize = bbAmt
	if room.Round.LastRaiseSize < chipEps {
		room.Round.LastRaiseSize = room.Round.BigBlindAmount
		if room.Round.LastRaiseSize < chipEps {
			room.Round.LastRaiseSize = room.SmallBlind * 2
		}
	}

	first := findFirstActorSeatPreflop(room, order)
	if first <= 0 {
		return ErrInvalidAction
	}
	setActionTurn(room, first, now)
	return nil
}

func readySeatsWithCards(room *Room) []int {
	out := make([]int, 0, len(room.Players))
	for _, p := range room.Players {
		if p.SeatIndex <= 0 {
			continue
		}
		if p.Status != PlayerStatusReady {
			continue
		}
		if len(p.Cards) < 2 || (p.Cards[0] == 0 && p.Cards[1] == 0) {
			continue
		}
		out = append(out, p.SeatIndex)
	}
	sort.Ints(out)
	return out
}

func seatOrderClockwise(seats []int, dealerSeat int) []int {
	if len(seats) == 0 {
		return seats
	}
	sort.Ints(seats)
	start := 0
	found := false
	for i, s := range seats {
		if s == dealerSeat {
			start = i
			found = true
			break
		}
	}
	if !found {
		for i, s := range seats {
			if s > dealerSeat {
				start = i
				break
			}
		}
	}
	out := make([]int, len(seats))
	for i := range seats {
		out[i] = seats[(start+i)%len(seats)]
	}
	return out
}

func sbBbSeatsFromOrder(order []int) (sb, bb int) {
	n := len(order)
	if n == 2 {
		return order[0], order[1]
	}
	if n >= 3 {
		return order[1], order[2]
	}
	return order[0], order[0]
}

func indexBySeat(room *Room, seat int) int {
	for i := range room.Players {
		if room.Players[i].SeatIndex == seat {
			return i
		}
	}
	return -1
}

func postChip(room *Room, pi int, amt float64) {
	if amt <= chipEps {
		return
	}
	p := &room.Players[pi]
	take := math.Min(amt, p.Wallet)
	if take <= chipEps {
		return
	}
	p.Wallet -= take
	if p.Wallet <= walletDustEps {
		p.Wallet = 0
		p.AllInHand = true
	}
	p.CurrentBet += take
	p.ContributedThisHand += take
	room.Round.Pot.Total += take
	recalcPotMainSide(room)
}

// postAnte 前注：进底池与 ContributedThisHand，但不进 CurrentBet（避免干扰盲注与前注圈行动逻辑）。
func postAnte(room *Room, pi int, amt float64) {
	if amt <= chipEps {
		return
	}
	p := &room.Players[pi]
	take := math.Min(amt, p.Wallet)
	if take <= chipEps {
		return
	}
	p.Wallet -= take
	if p.Wallet <= walletDustEps {
		p.Wallet = 0
		p.AllInHand = true
	}
	p.ContributedThisHand += take
	room.Round.Pot.Total += take
	recalcPotMainSide(room)
}

// findFirstActorSeatPreflop 翻牌前：从大盲下家（UTG）起顺时针找第一个需行动座位（标准德扑）。
// clockwiseOrder 与 sbBbSeatsFromOrder 一致：order[0]=庄；2 人时 order[1]=BB；3+ 人时 order[2]=BB。
func findFirstActorSeatPreflop(room *Room, clockwiseOrder []int) int {
	n := len(clockwiseOrder)
	if n == 0 {
		return -1
	}
	bbIdx := 1
	if n >= 3 {
		bbIdx = 2
	}
	start := (bbIdx + 1) % n
	for k := 0; k < n; k++ {
		seat := clockwiseOrder[(start+k)%n]
		if needsToActSeat(room, seat) {
			return seat
		}
	}
	return -1
}

func needsToActSeat(room *Room, seat int) bool {
	idx := indexBySeat(room, seat)
	if idx < 0 {
		return false
	}
	p := &room.Players[idx]
	if p.Folded || !playerInHand(p) {
		return false
	}
	if p.AllInHand {
		return false
	}
	// 与 postChip 归一一致：极小额视为已全下，不再参与下注轮
	noStack := p.Wallet <= walletDustEps
	if noStack && p.CurrentBet+chipEps < room.BettingMaxStreet {
		return false
	}
	if p.CurrentBet+chipEps >= room.BettingMaxStreet {
		if noStack {
			return false
		}
		return !room.BettingActed[seat]
	}
	if noStack {
		return false
	}
	return true
}

func playerInHand(p *PlayerSeat) bool {
	return p.SeatIndex > 0 && len(p.Cards) >= 2 && (p.Cards[0] > 0 || p.Cards[1] > 0)
}

func setActionTurn(room *Room, seat int, now int64) {
	idx := indexBySeat(room, seat)
	if idx < 0 {
		room.Round.Action.CurrentTurnUserID = ""
		room.Round.Action.DeadlineAt = 0
		return
	}
	room.Round.Action.CurrentTurnUserID = room.Players[idx].UserID
	// 离线玩家：5 秒后触发自动操作（优先过牌，不能过牌则弃牌）
	if room.Players[idx].Offline {
		room.Round.Action.DeadlineAt = now + 5
		fmt.Printf("[setActionTurn] OFFLINE player user=%s seat=%d deadline=now+5\n",
			room.Players[idx].UserID, seat)
		return
	}
	fmt.Printf("[setActionTurn] ONLINE player user=%s seat=%d timeout=%ds\n",
		room.Players[idx].UserID, seat, room.ActionTimeout)
	if room.ActionTimeout > 0 {
		room.Round.Action.DeadlineAt = now + int64(room.ActionTimeout)
	} else {
		room.Round.Action.DeadlineAt = 0
	}
}

// applyPokerAction 执行下注动作。有效筹码与加注规则以服务端重算为准（买入见 room_lifecycle sit_down）；
// 客户端 amount 仅作建议，raise 目标会按规则与钱包夹紧。
func applyPokerAction(room *Room, userID, kind string, amount float64, now int64) error {
	if !sameUserID(room.Round.Action.CurrentTurnUserID, userID) {
		return ErrNotYourTurn
	}
	pi := -1
	for i := range room.Players {
		if sameUserID(room.Players[i].UserID, userID) {
			pi = i
			break
		}
	}
	if pi < 0 {
		return ErrPlayerNotInRoom
	}
	seat := room.Players[pi].SeatIndex
	switch kind {
	case "fold":
		room.Players[pi].Folded = true
		room.BettingActed[seat] = true
		recordLastAction(room, userID, "fold", 0)
		advanceBettingTurn(room, now, seat)
	case "check":
		if room.Players[pi].CurrentBet+chipEps < room.BettingMaxStreet {
			return ErrCannotCheck
		}
		room.BettingActed[seat] = true
		recordLastAction(room, userID, "check", 0)
		advanceBettingTurn(room, now, seat)
	case "call":
		toCall := room.BettingMaxStreet - room.Players[pi].CurrentBet
		if toCall < chipEps {
			room.BettingActed[seat] = true
			recordLastAction(room, userID, "call", 0)
			advanceBettingTurn(room, now, seat)
			break
		}
		if room.Players[pi].Wallet <= walletDustEps {
			return ErrInvalidAction
		}
		preW := room.Players[pi].Wallet
		pay := math.Min(toCall, preW)
		postChip(room, pi, pay)
		markAllInIfCommittedFullStack(&room.Players[pi], preW, pay)
		room.BettingActed[seat] = true
		act := "call"
		if pay+chipEps >= preW-chipEps {
			act = "all_in"
		}
		recordLastAction(room, userID, act, pay)
		advanceBettingTurn(room, now, seat)
	case "raise":
		if math.IsNaN(amount) || math.IsInf(amount, 0) {
			return ErrInvalidAction
		}
		minInc := room.Round.LastRaiseSize
		if minInc < chipEps {
			minInc = room.Round.BigBlindAmount
			if minInc < chipEps {
				minInc = room.SmallBlind * 2
			}
		}
		prevMax := room.BettingMaxStreet
		target := room.BettingMaxStreet + minInc
		if amount > chipEps {
			target = math.Max(target, amount)
		}
		// 本街该玩家总下注上界：当前已下 + 剩余钱包（与 postChip(Min(add,Wallet)) 一致，显式夹紧防异常 payload）
		maxTarget := room.Players[pi].CurrentBet + room.Players[pi].Wallet
		target = math.Min(target, maxTarget)
		add := target - room.Players[pi].CurrentBet
		if add <= chipEps {
			return ErrCannotRaise
		}
		if add > room.Players[pi].Wallet+chipEps {
			return ErrCannotRaise
		}
		preW := room.Players[pi].Wallet
		take := math.Min(add, preW)
		postChip(room, pi, take)
		markAllInIfCommittedFullStack(&room.Players[pi], preW, take)
		room.BettingMaxStreet = math.Max(room.BettingMaxStreet, room.Players[pi].CurrentBet)
		actualInc := room.Players[pi].CurrentBet - prevMax
		if actualInc+chipEps >= minInc-chipEps {
			room.Round.LastRaiseSize = actualInc
		}
		room.BettingActed = make(map[int]bool)
		room.BettingActed[seat] = true
		recordLastAction(room, userID, "raise", add)
		advanceBettingTurn(room, now, seat)
	case "all_in":
		w := room.Players[pi].Wallet
		if w <= chipEps {
			return ErrInvalidAction
		}
		// 客户端显式「全下」：本手不再参与行动轮；且必须推满当前剩余栈（不能只做 min(跟注额, 栈) 的「跟注」否则大栈全下后仍有余码）
		room.Players[pi].AllInHand = true
		toCall := room.BettingMaxStreet - room.Players[pi].CurrentBet
		if toCall < chipEps {
			prevMax := room.BettingMaxStreet
			postChip(room, pi, w)
			markAllInIfCommittedFullStack(&room.Players[pi], w, w)
			room.BettingMaxStreet = math.Max(room.BettingMaxStreet, room.Players[pi].CurrentBet)
			actualInc := room.Players[pi].CurrentBet - prevMax
			minInc := room.Round.LastRaiseSize
			if minInc < chipEps {
				minInc = room.Round.BigBlindAmount
				if minInc < chipEps {
					minInc = room.SmallBlind * 2
				}
			}
			if actualInc+chipEps >= minInc-chipEps {
				room.Round.LastRaiseSize = actualInc
			}
			room.BettingActed = make(map[int]bool)
			room.BettingActed[seat] = true
			recordLastAction(room, userID, "all_in", w)
			advanceBettingTurn(room, now, seat)
			break
		}
		// 面对下注：全下 = 把 Wallet 全部推进底池（短码不足当前最高注则形成边池；大栈则构成加注/全下）
		prevMax := room.BettingMaxStreet
		preW := room.Players[pi].Wallet
		postChip(room, pi, preW)
		markAllInIfCommittedFullStack(&room.Players[pi], preW, preW)
		newBet := room.Players[pi].CurrentBet
		room.BettingMaxStreet = math.Max(room.BettingMaxStreet, newBet)
		actualInc := newBet - prevMax
		minInc := room.Round.LastRaiseSize
		if minInc < chipEps {
			minInc = room.Round.BigBlindAmount
			if minInc < chipEps {
				minInc = room.SmallBlind * 2
			}
		}
		if newBet > prevMax+chipEps {
			if actualInc+chipEps >= minInc-chipEps {
				room.Round.LastRaiseSize = actualInc
			}
			room.BettingActed = make(map[int]bool)
			room.BettingActed[seat] = true
		} else {
			room.BettingActed[seat] = true
		}
		recordLastAction(room, userID, "all_in", preW)
		advanceBettingTurn(room, now, seat)
	default:
		return ErrInvalidAction
	}
	return nil
}

func recordLastAction(room *Room, userID, act string, amt float64) {
	room.Round.Action.LastAction = act
	room.Round.Action.LastActionUserID = userID
	room.Round.Action.LastActionAmount = amt
	appendHandAction(room, userID, act, amt)
}

func appendHandAction(room *Room, userID, act string, amt float64) {
	if room == nil || userID == "" || act == "" {
		return
	}
	room.Round.HandActionLog = append(room.Round.HandActionLog, PlayerHandAction{
		UserID:       userID,
		Stage:        room.Round.Stage,
		Action:       act,
		Amount:       amt,
		ActionAtUnix: nowUnixMilli(),
	})
}

func advanceBettingTurn(room *Room, now int64, afterSeat int) {
	if countActiveNotFolded(room) <= 1 {
		settleFoldWin(room, now)
		return
	}
	if bettingStreetComplete(room) {
		advanceStreetOrFinish(room, now)
		return
	}
	next := findNextActorSeat(room, afterSeat)
	// 防御：若状态异常把无需行动位当作下家，跳过直到真需行动或无人可动
	for guard := 0; next > 0 && !needsToActSeat(room, next) && guard < len(room.Players)+3; guard++ {
		next = findNextActorSeat(room, next)
	}
	if next <= 0 {
		if bettingStreetComplete(room) {
			advanceStreetOrFinish(room, now)
			return
		}
		room.Round.Action.CurrentTurnUserID = ""
		room.Round.Action.DeadlineAt = 0
		return
	}
	setActionTurn(room, next, now)
}

func countActiveNotFolded(room *Room) int {
	n := 0
	for i := range room.Players {
		if playerInHand(&room.Players[i]) && !room.Players[i].Folded {
			n++
		}
	}
	return n
}

func bettingStreetComplete(room *Room) bool {
	for i := range room.Players {
		p := &room.Players[i]
		if !playerInHand(p) || p.Folded {
			continue
		}
		// 离线玩家的行动由 applyActionTimeout 单独处理（轮到其时 5 秒超时自动过牌/弃牌），
		// 此处跳过，防止离线玩家携带上一街的 CurrentBet 和重置后的 BettingActed
		// 阻塞本街完成判定，导致回合在在线与离线玩家之间无限震荡。
		if p.Offline {
			continue
		}
		matched := p.CurrentBet+chipEps >= room.BettingMaxStreet
		if !matched {
			if p.Wallet >= walletDustEps {
				return false
			}
			continue
		}
		if p.Wallet < walletDustEps {
			continue
		}
		if !room.BettingActed[p.SeatIndex] {
			return false
		}
	}
	return true
}

func findNextActorSeat(room *Room, afterSeat int) int {
	seats := make([]int, 0, len(room.Players))
	for i := range room.Players {
		if playerInHand(&room.Players[i]) && !room.Players[i].Folded {
			seats = append(seats, room.Players[i].SeatIndex)
		}
	}
	sort.Ints(seats)
	if len(seats) == 0 {
		return -1
	}
	order := seatOrderClockwise(seats, room.Round.DealerSeatIndex)
	start := 0
	for i, s := range order {
		if s == afterSeat {
			start = i + 1
			break
		}
	}
	for k := 0; k < len(order); k++ {
		seat := order[(start+k)%len(order)]
		if seat == afterSeat {
			continue
		}
		if needsToActSeat(room, seat) {
			return seat
		}
	}
	return -1
}

func advanceStreetOrFinish(room *Room, now int64) {
	st := room.Round.Stage
	switch st {
	case "preflop":
		room.Round.Stage = "flop"
	case "flop":
		room.Round.Stage = "turn"
	case "turn":
		room.Round.Stage = "river"
	case "river":
		settleShowdownMVP(room, now)
		return
	default:
		settleShowdownMVP(room, now)
		return
	}
	revealCommunityForStage(room)
	for i := range room.Players {
		room.Players[i].CurrentBet = 0
	}
	room.BettingMaxStreet = 0
	room.Round.LastRaiseSize = room.Round.BigBlindAmount
	if room.Round.LastRaiseSize < chipEps {
		room.Round.LastRaiseSize = room.SmallBlind * 2
	}
	room.BettingActed = make(map[int]bool)
	first := firstPostFlopActor(room)
	if first <= 0 {
		settleShowdownMVP(room, now)
		return
	}
	setActionTurn(room, first, now)
}

func firstPostFlopActor(room *Room) int {
	seats := make([]int, 0, len(room.Players))
	for i := range room.Players {
		if playerInHand(&room.Players[i]) && !room.Players[i].Folded {
			seats = append(seats, room.Players[i].SeatIndex)
		}
	}
	sort.Ints(seats)
	if len(seats) == 0 {
		return -1
	}
	order := seatOrderClockwise(seats, room.Round.DealerSeatIndex)
	// 3+ 人：庄下家起第一个仍在池内且需行动者（通常为小盲 order[1]）
	if len(order) >= 3 {
		sb := order[1]
		if needsToActSeat(room, sb) {
			return sb
		}
		return findNextActorSeat(room, order[0])
	}
	// 单挑：翻牌后由大盲（非庄）先行动，庄后行动
	if len(order) == 2 {
		bb := order[1]
		if needsToActSeat(room, bb) {
			return bb
		}
		return findNextActorSeat(room, bb)
	}
	return order[0]
}

func copyHoleCardsForPayout(p *PlayerSeat) []int {
	var out []int
	for _, c := range p.Cards {
		if c > 0 {
			out = append(out, c)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func settleFoldWin(room *Room, now int64) {
	potTotal := room.Round.Pot.Total
	var winnerIdx = -1
	for i := range room.Players {
		if playerInHand(&room.Players[i]) && !room.Players[i].Folded {
			winnerIdx = i
			break
		}
	}
	award, rake := potAfterRakeAmount(potTotal, room.OwnerCommission)
	room.Round.LastHandKind = "fold_win"
	room.Round.LastHandPotTotal = potTotal
	room.Round.LastHandRake = rake
	room.Round.LastHandPayouts = nil
	room.Round.LastHandLayers = nil
	if winnerIdx >= 0 {
		w := &room.Players[winnerIdx]
		hc := copyHoleCardsForPayout(w)
		w.Wallet += award
		p := []LastHandPayout{{UserID: w.UserID, Nickname: w.Nickname, Amount: award, HoleCards: hc}}
		room.Round.LastHandPayouts = p
		room.Round.LastHandLayers = []LastHandLayer{{Tier: 0, Amount: award, Payouts: p}}
	}
	CreditOwnerRakeOffTable(room.OwnerUserID, rake)
	recordHandHistory(room)
	endHandResetRoom(room, now, "waiting", true)
}

// showdownAllSurvivorsAllIn 摊牌时若所有未弃牌玩家桌上剩余筹码均为 0，视为一路全下发完，可公开全部底牌。
func showdownAllSurvivorsAllIn(room *Room) bool {
	var any bool
	for i := range room.Players {
		if !playerInHand(&room.Players[i]) || room.Players[i].Folded {
			continue
		}
		any = true
		if room.Players[i].Wallet >= walletDustEps {
			return false
		}
	}
	return any
}

func splitPotToWinners(room *Room, winners []int, amount float64) {
	if len(winners) == 0 || amount <= chipEps {
		return
	}
	w := append([]int(nil), winners...)
	sortWinnerIndicesLeftOfDealer(room, w)
	n := len(w)
	share := math.Floor((amount/float64(n))*100) / 100
	paid := 0.0
	for _, wi := range w {
		if wi < 0 || wi >= len(room.Players) {
			continue
		}
		room.Players[wi].Wallet += share
		paid += share
	}
	rem := amount - paid
	if rem > chipEps {
		room.Players[w[0]].Wallet += rem
	}
}

func settleShowdownMVP(room *Room, now int64) {
	layers := buildPotLayers(room)
	if len(layers) == 0 {
		endHandResetRoom(room, now, "waiting", true)
		return
	}
	var reveal []string
	var bestHands []ShowdownBestHand
	for i := range room.Players {
		if !playerInHand(&room.Players[i]) || room.Players[i].Folded {
			continue
		}
		uid := room.Players[i].UserID
		if uid == "" {
			continue
		}
		reveal = append(reveal, uid)
		five, sc := holdemBestFiveCards(room, i)
		bestHands = append(bestHands, ShowdownBestHand{
			UserID:       uid,
			Nickname:     room.Players[i].Nickname,
			SeatIndex:    room.Players[i].SeatIndex,
			BestFive:     five,
			HandCategory: handCategoryFromScore(sc),
		})
	}
	sort.Strings(reveal)
	room.Round.ShowdownRevealUserIDs = reveal
	sort.Slice(bestHands, func(i, j int) bool {
		if bestHands[i].SeatIndex != bestHands[j].SeatIndex {
			return bestHands[i].SeatIndex < bestHands[j].SeatIndex
		}
		return bestHands[i].UserID < bestHands[j].UserID
	})
	room.Round.ShowdownBestHands = bestHands

	potTotal := room.Round.Pot.Total
	_, rake := potRakeScale(potTotal, room.OwnerCommission)
	beforeW := make([]float64, len(room.Players))
	for i := range room.Players {
		beforeW[i] = room.Players[i].Wallet
	}
	scale, _ := potRakeScale(potTotal, room.OwnerCommission)
	var lastLayers []LastHandLayer
	for tier, layer := range layers {
		elig := layer.Eligible
		if len(elig) == 0 {
			elig = nonFoldedInHandIndices(room)
		}
		winners := bestShowdownWinners(room, elig)
		if len(winners) == 0 {
			if w := pickMVPWinnerAmong(room, elig); w >= 0 {
				winners = []int{w}
			}
		}
		wSnap := make([]float64, len(room.Players))
		for i := range room.Players {
			wSnap[i] = room.Players[i].Wallet
		}
		splitPotToWinners(room, winners, layer.Amount*scale)
		var layerPayouts []LastHandPayout
		layerAmt := 0.0
		for i := range room.Players {
			d := room.Players[i].Wallet - wSnap[i]
			if d <= chipEps {
				continue
			}
			layerAmt += d
			layerPayouts = append(layerPayouts, LastHandPayout{
				UserID:    room.Players[i].UserID,
				Nickname:  room.Players[i].Nickname,
				Amount:    d,
				HoleCards: copyHoleCardsForPayout(&room.Players[i]),
			})
		}
		sort.Slice(layerPayouts, func(i, j int) bool {
			if layerPayouts[i].Nickname == layerPayouts[j].Nickname {
				return layerPayouts[i].UserID < layerPayouts[j].UserID
			}
			return layerPayouts[i].Nickname < layerPayouts[j].Nickname
		})
		lastLayers = append(lastLayers, LastHandLayer{Tier: tier, Amount: layerAmt, Payouts: layerPayouts})
	}
	room.Round.LastHandLayers = lastLayers
	type agg struct {
		uid, nick string
		amt       float64
	}
	byUID := map[string]*agg{}
	for i := range room.Players {
		d := room.Players[i].Wallet - beforeW[i]
		if d <= chipEps {
			continue
		}
		uid := room.Players[i].UserID
		if uid == "" {
			continue
		}
		if byUID[uid] == nil {
			byUID[uid] = &agg{uid: uid, nick: room.Players[i].Nickname}
		}
		byUID[uid].amt += d
	}
	payouts := make([]LastHandPayout, 0, len(byUID))
	for _, a := range byUID {
		if a.amt > chipEps {
			var hc []int
			for i := range room.Players {
				if sameUserID(room.Players[i].UserID, a.uid) {
					hc = copyHoleCardsForPayout(&room.Players[i])
					break
				}
			}
			payouts = append(payouts, LastHandPayout{UserID: a.uid, Nickname: a.nick, Amount: a.amt, HoleCards: hc})
		}
	}
	sort.Slice(payouts, func(i, j int) bool {
		if payouts[i].Nickname == payouts[j].Nickname {
			return payouts[i].UserID < payouts[j].UserID
		}
		return payouts[i].Nickname < payouts[j].Nickname
	})
	room.Round.LastHandKind = "showdown"
	room.Round.LastHandPotTotal = potTotal
	room.Round.LastHandRake = rake
	room.Round.LastHandPayouts = payouts
	CreditOwnerRakeOffTable(room.OwnerUserID, rake)
	recordHandHistory(room)
	endHandResetRoom(room, now, "showdown", false)
}

func endHandResetRoom(room *Room, now int64, finalStage string, clearCommunity bool) {
	room.Status = RoomStatusOpen
	if finalStage != "" {
		room.Round.Stage = finalStage
	} else {
		room.Round.Stage = "waiting"
	}
	if room.Round.Stage == "showdown" {
		revealCommunityForStage(room)
	} else {
		room.Round.ShowdownRevealUserIDs = nil
		room.Round.ShowdownBestHands = nil
	}
	if clearCommunity {
		room.Round.CommunityCards = []int{}
		room.Round.communityDeck = nil
	}
	room.Round.Pot.MainPot = 0
	room.Round.Pot.SidePot = 0
	room.Round.Pot.Total = 0
	room.Round.Action.CurrentTurnUserID = ""
	room.Round.Action.DeadlineAt = 0
	room.BettingActed = nil
	room.BettingMaxStreet = 0
	for i := range room.Players {
		if clearCommunity {
			room.Players[i].Cards = []int{0, 0}
		}
		room.Players[i].CurrentBet = 0
		room.Players[i].ContributedThisHand = 0
		room.Players[i].Folded = false
		if room.Players[i].SeatIndex > 0 {
			switch room.Players[i].Status {
			case PlayerStatusReady:
				if room.Players[i].Wallet <= chipEps {
					room.Players[i].Status = PlayerStatusSitDown
				}
			case PlayerStatusBusy:
				room.Players[i].Status = PlayerStatusSitDown
			}
		}
	}
	if room.MaxRounds > 0 && room.Round.HandNo >= room.MaxRounds {
		room.Status = RoomStatusEnded
		room.Round.Stage = "ended"
		room.Round.Action.DeadlineAt = 0
		room.CountdownReadyKey = ""
		for i := range room.Players {
			_ = refundSeatStackToDB(&room.Players[i])
		}
	}
	room.UpdatedAt = now
}

func applyActionTimeout(room *Room, now int64) bool {
	if room.Status != RoomStatusPlaying {
		return false
	}
	if room.Round.Action.DeadlineAt <= 0 || now < room.Round.Action.DeadlineAt {
		return false
	}
	uid := room.Round.Action.CurrentTurnUserID
	if uid == "" {
		return false
	}
	pi := -1
	for i := range room.Players {
		if sameUserID(room.Players[i].UserID, uid) {
			pi = i
			break
		}
	}
	if pi < 0 {
		return false
	}
	// 如果当前行动玩家已经弃牌（如离开时被立即弃牌），跳过该玩家
	if room.Players[pi].Folded {
		seat := room.Players[pi].SeatIndex
		fmt.Printf("[timeout] player already folded, skip user=%s seat=%d\n", uid, seat)
		room.Round.Action.CurrentTurnUserID = ""
		room.Round.Action.DeadlineAt = 0
		advanceBettingTurn(room, now, seat)
		return true
	}
	seat := room.Players[pi].SeatIndex
	isOffline := room.Players[pi].Offline
	fmt.Printf("[timeout] fired user=%s seat=%d offline=%v currentBet=%.2f maxStreet=%.2f wallet=%.2f\n",
		uid, seat, isOffline, room.Players[pi].CurrentBet, room.BettingMaxStreet, room.Players[pi].Wallet)

	// 能过牌就过牌（在线/离线玩家通用）
	if room.Players[pi].CurrentBet+chipEps >= room.BettingMaxStreet {
		fmt.Printf("[timeout] auto-CHECK user=%s seat=%d offline=%v\n", uid, seat, isOffline)
		room.BettingActed[seat] = true
		recordLastAction(room, uid, "check", 0)
		advanceBettingTurn(room, now, seat)
	} else if isOffline {
		// 离线玩家：不能过牌时直接弃牌（不自动跟注，避免离线玩家被动消耗筹码）
		fmt.Printf("[timeout] auto-FOLD offline user=%s seat=%d (cannot check, no auto-call)\n", uid, seat)
		room.Players[pi].Folded = true
		room.BettingActed[seat] = true
		recordLastAction(room, uid, "fold", 0)
		advanceBettingTurn(room, now, seat)
	} else {
		// 在线玩家超时：正常跟注/全下/弃牌
		preW := room.Players[pi].Wallet
		toCall := room.BettingMaxStreet - room.Players[pi].CurrentBet
		if preW > chipEps && toCall > chipEps {
			pay := math.Min(toCall, preW)
			postChip(room, pi, pay)
			markAllInIfCommittedFullStack(&room.Players[pi], preW, pay)
			room.BettingActed[seat] = true
			act := "call"
			if pay+chipEps >= preW-chipEps {
				act = "all_in"
			}
			fmt.Printf("[timeout] auto-%s online user=%s seat=%d pay=%.2f\n", act, uid, seat, pay)
			recordLastAction(room, uid, act, pay)
			advanceBettingTurn(room, now, seat)
		} else {
			fmt.Printf("[timeout] auto-FOLD online user=%s seat=%d (no chips to call)\n", uid, seat)
			room.Players[pi].Folded = true
			room.BettingActed[seat] = true
			recordLastAction(room, uid, "fold", 0)
			advanceBettingTurn(room, now, seat)
		}
	}
	return true
}

// potRakeScale 返回 (1,0) 表示不抽水；否则 scale 为各层可分配比例（OwnerCommission 为百分比，如 5 表示 5%）。
func potRakeScale(totalPot, commissionPct float64) (scale float64, rake float64) {
	if totalPot <= chipEps || commissionPct <= chipEps {
		return 1, 0
	}
	rake = totalPot * commissionPct / 100.0
	if rake <= chipEps {
		return 1, 0
	}
	if rake >= totalPot-chipEps {
		return 1, 0
	}
	return (totalPot - rake) / totalPot, rake
}

func potAfterRakeAmount(totalPot, commissionPct float64) (award float64, rake float64) {
	scale, rake := potRakeScale(totalPot, commissionPct)
	return totalPot * scale, rake
}

// sortWinnerIndicesLeftOfDealer 平分余数给从庄家顺时针最接近庄家左侧（先行动侧）的赢家座位。
func sortWinnerIndicesLeftOfDealer(room *Room, winners []int) {
	if len(winners) <= 1 {
		return
	}
	dealer := room.Round.DealerSeatIndex
	seats := make([]int, 0, len(room.Players))
	for i := range room.Players {
		if room.Players[i].SeatIndex > 0 {
			seats = append(seats, room.Players[i].SeatIndex)
		}
	}
	if len(seats) == 0 {
		sort.Ints(winners)
		return
	}
	order := seatOrderClockwise(seats, dealer)
	rank := make(map[int]int, len(order))
	for i, s := range order {
		rank[s] = i
	}
	sort.Slice(winners, func(a, b int) bool {
		sa := room.Players[winners[a]].SeatIndex
		sb := room.Players[winners[b]].SeatIndex
		ra, oka := rank[sa]
		rb, okb := rank[sb]
		if !oka {
			return okb
		}
		if !okb {
			return true
		}
		return ra < rb
	})
}
