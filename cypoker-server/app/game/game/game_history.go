package game

import (
	"encoding/json"
	"sort"
	"strconv"
	"strings"
	"sync"

	"server/internal/helper"
)

type handHistoryRecord struct {
	ID           int64   `gorm:"column:id;primaryKey;autoIncrement"`
	RoomNumber   string  `gorm:"column:room_number;type:varchar(32);index:idx_room_hand,priority:1;not null"`
	HandNo       int     `gorm:"column:hand_no;index:idx_room_hand,priority:2;not null"`
	Kind         string  `gorm:"column:kind;type:varchar(32);not null"`
	PotTotal     float64 `gorm:"column:pot_total;type:decimal(18,2);not null;default:0"`
	Rake         float64 `gorm:"column:rake;type:decimal(18,2);not null;default:0"`
	PayoutsJSON  string  `gorm:"column:payouts_json;type:longtext"`
	DetailJSON   string  `gorm:"column:detail_json;type:longtext"`
	Participants string  `gorm:"column:participants;type:text"`
	SettledAt    int64   `gorm:"column:settled_at;index:idx_settled_at;not null"`
}

func (handHistoryRecord) TableName() string {
	return "game_hand_histories"
}

type handHistoryParticipant struct {
	ID            int64  `gorm:"column:id;primaryKey;autoIncrement"`
	HandHistoryID int64  `gorm:"column:hand_history_id;index:idx_history_user,priority:1;not null"`
	UserID        string `gorm:"column:user_id;type:varchar(64);index:idx_history_user,priority:2;not null"`
}

func (handHistoryParticipant) TableName() string {
	return "game_hand_history_participants"
}

func init() {
	// 显式注册模型：与其它模块一致，在系统启动时统一 AutoMigrate。
	helper.RegisterModel(&handHistoryRecord{})
	helper.RegisterModel(&handHistoryParticipant{})
}

var gameHistoryMigrateOnce sync.Once
var gameHistoryMemMu sync.RWMutex
var gameHistoryMem []GameHistoryResp

func normalizeTsMilli(ts int64) int64 {
	if ts <= 0 {
		return ts
	}
	if ts < 1_000_000_000_000 {
		return ts * 1000
	}
	return ts
}

type historyPlayerPersist struct {
	UserID              string                  `json:"user_id"`
	Nickname            string                  `json:"nickname"`
	AvatarURL           string                  `json:"avatar_url"`
	SeatIndex           int                     `json:"seat_index"`
	SeatRole            string                  `json:"seat_role"`
	IsOwner             bool                    `json:"is_owner"`
	ContributedThisHand float64                 `json:"contributed_this_hand"`
	CurrentBet          float64                 `json:"current_bet"`
	WonAmount           float64                 `json:"won_amount"`
	ProfitLoss          float64                 `json:"profit_loss"`
	IsWinner            bool                    `json:"is_winner"`
	Actions             []GameHistoryActionResp `json:"actions,omitempty"`
	BestFive            []int                   `json:"best_five,omitempty"`
	HoleCards           []int                   `json:"hole_cards,omitempty"`
}

type historyDetailPersist struct {
	Pot             PotState               `json:"pot"`
	Layers          []LastHandLayer        `json:"layers,omitempty"`
	Players         []historyPlayerPersist `json:"players,omitempty"`
	CommunityCards  []int                  `json:"community_cards,omitempty"`
	StartedAt       int64                  `json:"started_at_unix"`
	EndedAt         int64                  `json:"ended_at_unix"`
	DurationSec     int64                  `json:"duration_sec"`
	SmallBlind      float64                `json:"small_blind"`
	Owner           GameHistoryOwnerResp   `json:"owner"`
	RevealedUserIDs []string               `json:"revealed_user_ids,omitempty"`
}

func ensureGameHistoryTable() {
	gameHistoryMigrateOnce.Do(func() {
		db := helper.GetDB()
		if db == nil {
			return
		}
		_ = db.AutoMigrate(&handHistoryRecord{})
		_ = db.AutoMigrate(&handHistoryParticipant{})
	})
}

func uniqueParticipants(room *Room) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(room.Players))
	for i := range room.Players {
		uid := strings.TrimSpace(room.Players[i].UserID)
		if uid == "" {
			continue
		}
		if _, ok := seen[uid]; ok {
			continue
		}
		seen[uid] = struct{}{}
		out = append(out, uid)
	}
	return out
}

func participantsToken(participants []string) string {
	if len(participants) == 0 {
		return ""
	}
	return "," + strings.Join(participants, ",") + ","
}

func buildHistoryPlayers(room *Room) []historyPlayerPersist {
	actionMap := map[string][]GameHistoryActionResp{}
	for _, a := range room.Round.HandActionLog {
		if strings.TrimSpace(a.UserID) == "" {
			continue
		}
		actionMap[a.UserID] = append(actionMap[a.UserID], GameHistoryActionResp{
			Stage:        a.Stage,
			Action:       a.Action,
			Amount:       a.Amount,
			ActionAtUnix: normalizeTsMilli(a.ActionAtUnix),
		})
	}
	bestFiveMap := map[string][]int{}
	for _, b := range room.Round.ShowdownBestHands {
		if strings.TrimSpace(b.UserID) == "" {
			continue
		}
		bestFiveMap[b.UserID] = append([]int(nil), b.BestFive...)
	}
	roleBySeat := buildSeatRoleBySeat(room)
	wonMap := map[string]float64{}
	for _, p := range room.Round.LastHandPayouts {
		if strings.TrimSpace(p.UserID) == "" {
			continue
		}
		wonMap[p.UserID] += p.Amount
	}
	out := make([]historyPlayerPersist, 0, len(room.Players))
	for i := range room.Players {
		p := room.Players[i]
		if strings.TrimSpace(p.UserID) == "" {
			continue
		}
		participated := (len(p.Cards) >= 2 && (p.Cards[0] > 0 || p.Cards[1] > 0)) || p.ContributedThisHand > 0.005 || p.Folded
		if !participated {
			continue
		}
		hole := make([]int, 0, 2)
		for _, c := range p.Cards {
			if c > 0 {
				hole = append(hole, c)
			}
		}
		won := wonMap[p.UserID]
		out = append(out, historyPlayerPersist{
			UserID:              p.UserID,
			Nickname:            p.Nickname,
			AvatarURL:           p.AvatarURL,
			SeatIndex:           p.SeatIndex,
			SeatRole:            roleBySeat[p.SeatIndex],
			IsOwner:             p.IsOwner,
			ContributedThisHand: p.ContributedThisHand,
			CurrentBet:          p.CurrentBet,
			WonAmount:           won,
			ProfitLoss:          won - p.ContributedThisHand,
			IsWinner:            won > 0.005,
			Actions:             actionMap[p.UserID],
			BestFive:            bestFiveMap[p.UserID],
			HoleCards:           hole,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].SeatIndex != out[j].SeatIndex {
			return out[i].SeatIndex < out[j].SeatIndex
		}
		return out[i].UserID < out[j].UserID
	})
	return out
}

func buildSeatRoleBySeat(room *Room) map[int]string {
	out := map[int]string{}
	if room == nil {
		return out
	}
	dealer := room.Round.DealerSeatIndex
	seats := make([]int, 0, len(room.Players))
	for i := range room.Players {
		p := room.Players[i]
		participated := (len(p.Cards) >= 2 && (p.Cards[0] > 0 || p.Cards[1] > 0)) || p.ContributedThisHand > 0.005 || p.Folded
		if p.SeatIndex > 0 && participated {
			seats = append(seats, p.SeatIndex)
		}
	}
	sort.Ints(seats)
	if len(seats) < 2 {
		return out
	}
	for _, seatRole := range buildSeatRoles(seats, dealer) {
		out[seatRole.SeatIndex] = seatRole.Role
	}
	return out
}

func maskHistoryHoleCardsForViewer(players []historyPlayerPersist, viewer string, revealed []string) []GameHistoryPlayerResp {
	winners := map[string]struct{}{}
	revealedSet := map[string]struct{}{}
	for _, uid := range revealed {
		if strings.TrimSpace(uid) == "" {
			continue
		}
		revealedSet[uid] = struct{}{}
	}
	for i := range players {
		if players[i].WonAmount > 0.005 {
			winners[players[i].UserID] = struct{}{}
		}
	}
	out := make([]GameHistoryPlayerResp, 0, len(players))
	for i := range players {
		p := players[i]
		item := GameHistoryPlayerResp{
			UserID:              p.UserID,
			Nickname:            p.Nickname,
			AvatarURL:           p.AvatarURL,
			SeatIndex:           p.SeatIndex,
			SeatRole:            p.SeatRole,
			ContributedThisHand: p.ContributedThisHand,
			CurrentBet:          p.CurrentBet,
			WonAmount:           p.WonAmount,
			ProfitLoss:          p.ProfitLoss,
			IsWinner:            p.IsWinner,
			Actions:             append([]GameHistoryActionResp(nil), p.Actions...),
			BestFive:            append([]int(nil), p.BestFive...),
		}
		_, isWinner := winners[p.UserID]
		_, isRevealed := revealedSet[p.UserID]
		if sameUserID(p.UserID, viewer) || isWinner || isRevealed {
			item.HoleCards = append([]int(nil), p.HoleCards...)
		}
		out = append(out, item)
	}
	return out
}

func buildHistoryCommunityCards(room *Room) []int {
	out := make([]int, 0, 5)
	for _, c := range room.Round.CommunityCards {
		if c > 0 {
			out = append(out, c)
		}
	}
	if len(out) > 0 {
		return out
	}
	// 兼容某些结算时机：若已摊牌但公共牌未同步到 CommunityCards，回退 deck 真值。
	if room.Round.Stage == "showdown" {
		for _, c := range room.Round.communityDeck {
			if c > 0 {
				out = append(out, c)
			}
		}
	}
	return out
}

func historyOwnerFromRoom(room *Room) GameHistoryOwnerResp {
	out := GameHistoryOwnerResp{UserID: room.OwnerUserID}
	for i := range room.Players {
		if !sameUserID(room.Players[i].UserID, room.OwnerUserID) {
			continue
		}
		out.Nickname = room.Players[i].Nickname
		out.AvatarURL = room.Players[i].AvatarURL
		break
	}
	if strings.TrimSpace(out.Nickname) == "" {
		nick, avatar, _ := getUserProfile(room.OwnerUserID)
		out.Nickname = nick
		if out.AvatarURL == "" {
			out.AvatarURL = avatar
		}
	}
	if strings.TrimSpace(out.Nickname) == "" {
		out.Nickname = room.OwnerUserID
	}
	return out
}

func recordHandHistory(room *Room) {
	if room == nil || room.Round.HandNo <= 0 || room.RoomNumber == "" {
		return
	}
	payoutsJSONBytes, _ := json.Marshal(room.Round.LastHandPayouts)
	participants := uniqueParticipants(room)
	endedAt := nowUnixMilli()
	startedAt := room.Round.HandStartedAt
	if startedAt <= 0 || startedAt > endedAt {
		startedAt = endedAt - 1
	}
	if startedAt == endedAt {
		startedAt = endedAt - 1
	}
	players := buildHistoryPlayers(room)
	detail := historyDetailPersist{
		Pot: PotState{
			MainPot: room.Round.Pot.MainPot,
			SidePot: room.Round.Pot.SidePot,
			Total:   room.Round.Pot.Total,
		},
		Layers:          append([]LastHandLayer(nil), room.Round.LastHandLayers...),
		Players:         players,
		CommunityCards:  buildHistoryCommunityCards(room),
		StartedAt:       startedAt,
		EndedAt:         endedAt,
		DurationSec:     (endedAt - startedAt) / 1000,
		SmallBlind:      room.SmallBlind,
		Owner:           historyOwnerFromRoom(room),
		RevealedUserIDs: append([]string(nil), room.Round.ShowdownRevealUserIDs...),
	}
	detailJSONBytes, _ := json.Marshal(detail)
	memRec := GameHistoryResp{
		RoomNumber:     room.RoomNumber,
		HandNo:         room.Round.HandNo,
		Kind:           room.Round.LastHandKind,
		CommunityCards: append([]int(nil), detail.CommunityCards...),
		StartedAtUnix:  detail.StartedAt,
		EndedAtUnix:    detail.EndedAt,
		DurationSec:    detail.DurationSec,
		PotTotal:       room.Round.LastHandPotTotal,
		Rake:           room.Round.LastHandRake,
		SmallBlind:     detail.SmallBlind,
		Owner:          detail.Owner,
		Payouts:        append([]LastHandPayout(nil), room.Round.LastHandPayouts...),
		Pot:            detail.Pot,
		Layers:         detail.Layers,
		Players:        maskHistoryHoleCardsForViewer(detail.Players, "", detail.RevealedUserIDs),
		SettledAtUnix:  endedAt,
	}
	// 内存兜底：即使 DB 不可用，也能给当前进程返回对局历史。
	gameHistoryMemMu.Lock()
	gameHistoryMem = append(gameHistoryMem, memRec)
	gameHistoryMemMu.Unlock()

	ensureGameHistoryTable()
	db := helper.GetDB()
	if db == nil {
		return
	}
	rec := handHistoryRecord{
		RoomNumber:   room.RoomNumber,
		HandNo:       room.Round.HandNo,
		Kind:         room.Round.LastHandKind,
		PotTotal:     room.Round.LastHandPotTotal,
		Rake:         room.Round.LastHandRake,
		PayoutsJSON:  string(payoutsJSONBytes),
		DetailJSON:   string(detailJSONBytes),
		Participants: participantsToken(participants),
		SettledAt:    memRec.SettledAtUnix,
	}
	if err := db.Table(rec.TableName()).Create(&rec).Error; err != nil {
		return
	}
	if len(participants) == 0 {
		return
	}
	links := make([]handHistoryParticipant, 0, len(participants))
	for _, uid := range participants {
		links = append(links, handHistoryParticipant{
			HandHistoryID: rec.ID,
			UserID:        uid,
		})
	}
	_ = db.Table("game_hand_history_participants").Create(&links).Error
}

func (r *Repository) GetGameHistory(userID string, pageNo, pageSize int) ([]GameHistoryResp, int) {
	if pageNo <= 0 {
		pageNo = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	merged := make([]GameHistoryResp, 0, 32)
	seen := map[string]struct{}{}

	// 先取 DB（持久化）
	ensureGameHistoryTable()
	db := helper.GetDB()
	if db != nil {
		var rows []handHistoryRecord
		if err := db.Table("game_hand_histories h").
			Select("h.*").
			Joins("join game_hand_history_participants p on p.hand_history_id = h.id").
			Where("p.user_id = ?", userID).
			Group("h.id").
			Order("settled_at desc").
			Find(&rows).Error; err == nil {
			for i := range rows {
				var payouts []LastHandPayout
				_ = json.Unmarshal([]byte(rows[i].PayoutsJSON), &payouts)
				var detail historyDetailPersist
				_ = json.Unmarshal([]byte(rows[i].DetailJSON), &detail)
				if detail.Pot.Total <= 0 && rows[i].PotTotal > 0 {
					detail.Pot.Total = rows[i].PotTotal
				}
				if detail.Layers == nil {
					detail.Layers = []LastHandLayer{}
				}
				if detail.EndedAt <= 0 {
					detail.EndedAt = rows[i].SettledAt
				}
				detail.EndedAt = normalizeTsMilli(detail.EndedAt)
				detail.StartedAt = normalizeTsMilli(detail.StartedAt)
				if detail.StartedAt <= 0 || detail.StartedAt > detail.EndedAt {
					detail.StartedAt = detail.EndedAt - 1
				}
				if detail.StartedAt == detail.EndedAt {
					detail.StartedAt = detail.EndedAt - 1
				}
				if detail.DurationSec < 0 {
					detail.DurationSec = 0
				}
				if detail.DurationSec == 0 && detail.EndedAt > detail.StartedAt {
					detail.DurationSec = (detail.EndedAt - detail.StartedAt) / 1000
				}
				item := GameHistoryResp{
					RoomNumber:     rows[i].RoomNumber,
					HandNo:         rows[i].HandNo,
					Kind:           rows[i].Kind,
					CommunityCards: append([]int(nil), detail.CommunityCards...),
					StartedAtUnix:  detail.StartedAt,
					EndedAtUnix:    detail.EndedAt,
					DurationSec:    detail.DurationSec,
					PotTotal:       rows[i].PotTotal,
					Rake:           rows[i].Rake,
					SmallBlind:     detail.SmallBlind,
					Owner:          detail.Owner,
					Payouts:        payouts,
					Pot:            detail.Pot,
					Layers:         detail.Layers,
					Players:        maskHistoryHoleCardsForViewer(detail.Players, userID, detail.RevealedUserIDs),
					SettledAtUnix:  normalizeTsMilli(rows[i].SettledAt),
				}
				key := item.RoomNumber + "#" + strconv.Itoa(item.HandNo)
				seen[key] = struct{}{}
				merged = append(merged, item)
			}
		}
	}

	// 再补内存（兜底）
	gameHistoryMemMu.RLock()
	for i := range gameHistoryMem {
		h := gameHistoryMem[i]
		h.CommunityCards = append([]int(nil), h.CommunityCards...)
		h.StartedAtUnix = normalizeTsMilli(h.StartedAtUnix)
		h.EndedAtUnix = normalizeTsMilli(h.EndedAtUnix)
		h.SettledAtUnix = normalizeTsMilli(h.SettledAtUnix)
		if h.StartedAtUnix <= 0 || h.StartedAtUnix > h.EndedAtUnix {
			h.StartedAtUnix = h.EndedAtUnix - 1
		}
		if h.DurationSec < 0 {
			h.DurationSec = 0
		}
		if h.DurationSec == 0 && h.EndedAtUnix > h.StartedAtUnix {
			h.DurationSec = (h.EndedAtUnix - h.StartedAtUnix) / 1000
		}
		include := false
		for _, p := range h.Players {
			if sameUserID(p.UserID, userID) {
				include = true
				break
			}
		}
		if !include {
			continue
		}
		key := h.RoomNumber + "#" + strconv.Itoa(h.HandNo)
		if _, ok := seen[key]; ok {
			continue
		}
		h.Players = maskHistoryHoleCardsForViewer(func() []historyPlayerPersist {
			out := make([]historyPlayerPersist, 0, len(h.Players))
			for _, p := range h.Players {
				out = append(out, historyPlayerPersist{
					UserID:              p.UserID,
					Nickname:            p.Nickname,
					AvatarURL:           p.AvatarURL,
					SeatIndex:           p.SeatIndex,
					SeatRole:            p.SeatRole,
					IsOwner:             false,
					ContributedThisHand: p.ContributedThisHand,
					CurrentBet:          p.CurrentBet,
					WonAmount:           p.WonAmount,
					ProfitLoss:          p.ProfitLoss,
					IsWinner:            p.IsWinner,
					Actions:             append([]GameHistoryActionResp(nil), p.Actions...),
					BestFive:            append([]int(nil), p.BestFive...),
					HoleCards:           append([]int(nil), p.HoleCards...),
				})
			}
			return out
		}(), userID, nil)
		merged = append(merged, h)
	}
	gameHistoryMemMu.RUnlock()

	sort.Slice(merged, func(i, j int) bool {
		return merged[i].SettledAtUnix > merged[j].SettledAtUnix
	})
	total := len(merged)
	start := (pageNo - 1) * pageSize
	if start >= total {
		return []GameHistoryResp{}, total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return merged[start:end], total
}
