package game

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"server/internal/helper"
	"sort"
	"sync"
)

type Repository struct{}

var (
	roomStoreMu sync.RWMutex
	roomStore   = map[string]*Room{}
)

var ErrPlayerNotInRoom = errors.New("PLAYER_NOT_IN_ROOM")
var ErrSeatOccupied = errors.New("SEAT_OCCUPIED")
var ErrNeedStandUpFirst = errors.New("NEED_STAND_UP_FIRST")
var ErrNeedSitDownFirst = errors.New("NEED_SIT_DOWN_FIRST")
var ErrSeatIndexInvalid = errors.New("SEAT_INDEX_INVALID")
var ErrGameActionLocked = errors.New("GAME_ACTION_LOCKED")
var ErrNotEnoughReadyPlayers = errors.New("NOT_ENOUGH_READY_PLAYERS")
var ErrBuyInRequired = errors.New("BUY_IN_REQUIRED")
var ErrBuyInOutOfRange = errors.New("BUY_IN_OUT_OF_RANGE")
var ErrInsufficientStackToReady = errors.New("INSUFFICIENT_STACK_TO_READY")
var ErrRoomEnded = errors.New("ROOM_ENDED")

const StartCountdownSeconds int64 = 30

func NewRepository() *Repository {
	return &Repository{}
}

func randomRoomNumber() string {
	n := rand.IntN(900000) + 100000
	return fmt.Sprintf("%06d", n)
}

func buildDefaultRound(in *CreateRoomReq) RoundState {
	return RoundState{
		HandNo:           0,
		Stage:            "waiting",
		DealerSeatIndex:  -1,
		SmallBlindAmount: in.SmallBlind,
		BigBlindAmount:   in.SmallBlind * 2,
		CommunityCards:   []int{},
		Pot: PotState{
			MainPot: 0,
			SidePot: 0,
			Total:   0,
		},
		Action: ActionState{
			CurrentTurnUserID: "",
			DeadlineAt:        0,
			LastAction:        "",
			LastActionUserID:  "",
			LastActionAmount:  0,
		},
		LastRaiseSize: 0,
	}
}

func toRoomStateResp(room *Room) RoomStateResp {
	syncAccountBalancesFromDB(room)
	return RoomStateResp{
		RoomNumber:      room.RoomNumber,
		Owner:           room.OwnerUserID,
		OwnerUserID:     room.OwnerUserID,
		ServerNow:       nowUnix(),
		RoomType:        room.RoomType,
		Status:          room.Status,
		MaxPlayers:      room.MaxPlayers,
		MaxWatchers:     room.MaxWatchers,
		LeaveTimeout:    room.LeaveTimeout,
		ActionTimeout:   room.ActionTimeout,
		OwnerCommission: room.OwnerCommission,
		SmallBlind:      room.SmallBlind,
		Ante:            room.Ante,
		MaxBuyIn:        room.MaxBuyIn,
		MinBuyIn:        room.MinBuyIn,
		AllowWatch:      room.AllowWatch,
		MaxRounds:       room.MaxRounds,
		CreatedAt:       room.CreatedAt,
		Players:         room.Players,
		Watchers:        room.Watchers,
		Round:           room.Round,
	}
}

type userProfile struct {
	Nickname  string  `gorm:"column:nickname"`
	AvatarURL string  `gorm:"column:avatar_url"`
	Wallet    float64 `gorm:"column:wallet"`
}

func getUserProfile(userID string) (nickname, avatarURL string, wallet float64) {
	if userID == "" {
		return "", "", 0
	}
	db := helper.GetDB()
	if db == nil {
		return userID, "", 0
	}
	var profile userProfile
	if err := db.Table("game_users").Select("nickname, avatar_url, wallet").Where("user_id = ?", userID).Take(&profile).Error; err != nil {
		return userID, "", 0
	}
	if profile.Nickname == "" {
		profile.Nickname = userID
	}
	return profile.Nickname, profile.AvatarURL, profile.Wallet
}

func (r *Repository) CreateRoom(ownerUserID string, in *CreateRoomReq) (*CreateRoomResp, error) {
	roomStoreMu.Lock()
	defer roomStoreMu.Unlock()

	roomNumber := randomRoomNumber()
	for {
		if _, ok := roomStore[roomNumber]; !ok {
			break
		}
		roomNumber = randomRoomNumber()
	}

	now := nowUnix()
	ownerNickname, ownerAvatar, ownerOffTable := getUserProfile(ownerUserID)
	ownerSeat := PlayerSeat{
		UserID:         ownerUserID,
		Nickname:       ownerNickname,
		AvatarURL:      ownerAvatar,
		SeatIndex:      -1,
		IsOwner:        true,
		Status:         PlayerStatusWaiting,
		Cards:          []int{0, 0},
		Wallet:         0,
		AccountBalance: ownerOffTable,
		CurrentBet:     0,
		Offline:        false,
		OfflineAt:      0,
		JoinAt:         now,
		LastUpdateAt:   now,
	}
	room := &Room{
		RoomNumber:      roomNumber,
		OwnerUserID:     ownerUserID,
		RoomType:        in.RoomType,
		Status:          RoomStatusOpen,
		MaxPlayers:      in.MaxPlayers,
		MaxWatchers:     in.MaxWatchers,
		LeaveTimeout:    in.LeaveTimeout,
		ActionTimeout:   in.ActionTimeout,
		OwnerCommission: in.OwnerCommission,
		SmallBlind:      in.SmallBlind,
		Ante:            in.Ante,
		MaxBuyIn:        in.MaxBuyIn,
		MinBuyIn:        in.MinBuyIn,
		AllowWatch:      in.AllowWatch,
		MaxRounds:       in.MaxRounds,
		CreatedAt:       now,
		UpdatedAt:       now,
		Players:         []PlayerSeat{ownerSeat},
		Watchers:        []string{},
		Round:           buildDefaultRound(in),
	}
	roomStore[roomNumber] = room

	return &CreateRoomResp{
		Room:      toRoomStateResp(room),
		CreatedBy: ownerUserID,
	}, nil
}

func (r *Repository) JoinRoom(userID, roomNumber string) (*JoinRoomResp, error) {
	roomStoreMu.Lock()
	defer roomStoreMu.Unlock()

	room, ok := roomStore[roomNumber]
	if !ok {
		return nil, ErrRoomNotFound
	}
	now := nowUnix()
	pruneRoomPlayers(room, now)

	for i := range room.Players {
		if !sameUserID(room.Players[i].UserID, userID) {
			continue
		}
		p := &room.Players[i]
		if p.Offline || p.Status == PlayerStatusLeave || p.Status == PlayerStatusBusy {
			// 可重连：恢复在线并尽量恢复离线前状态
			p.Offline = false
			p.OfflineAt = 0
			if p.ResumeStatus != "" {
				p.Status = p.ResumeStatus
				p.ResumeStatus = ""
			} else if p.SeatIndex > 0 {
				p.Status = PlayerStatusSitDown
			} else {
				p.Status = PlayerStatusWaiting
			}
		} else {
			// 同账号再次 join_room（异常断线后仅 HTTP 重进等）：幂等成功，勿返回 ROOM_ALREADY_JOINED
			p.Offline = false
			p.OfflineAt = 0
		}
		p.LastUpdateAt = now
		room.UpdatedAt = now
		return &JoinRoomResp{
			Room:   toRoomStateResp(room),
			Joined: true,
		}, nil
	}
	if len(room.Players) >= room.MaxPlayers {
		return nil, ErrRoomFull
	}

	nickname, avatar, offTable := getUserProfile(userID)
	room.Players = append(room.Players, PlayerSeat{
		UserID:         userID,
		Nickname:       nickname,
		AvatarURL:      avatar,
		SeatIndex:      -1,
		IsOwner:        false,
		Status:         PlayerStatusWaiting,
		Cards:          []int{0, 0},
		Wallet:         0,
		AccountBalance: offTable,
		CurrentBet:     0,
		Offline:        false,
		OfflineAt:      0,
		JoinAt:         now,
		LastUpdateAt:   now,
	})
	room.UpdatedAt = now

	return &JoinRoomResp{
		Room:   toRoomStateResp(room),
		Joined: true,
	}, nil
}

func (r *Repository) GetRoomState(roomNumber string) (*RoomStateResp, error) {
	roomStoreMu.Lock()
	defer roomStoreMu.Unlock()

	room, ok := roomStore[roomNumber]
	if !ok {
		return nil, ErrRoomNotFound
	}
	pruneRoomPlayers(room, nowUnix())

	resp := toRoomStateResp(room)
	return &resp, nil
}

func (r *Repository) GetRoomOwner(roomNumber string) (*RoomOwnerResp, error) {
	roomStoreMu.Lock()
	defer roomStoreMu.Unlock()

	room, ok := roomStore[roomNumber]
	if !ok {
		return nil, ErrRoomNotFound
	}
	pruneRoomPlayers(room, nowUnix())
	nickname, avatar, _ := getUserProfile(room.OwnerUserID)
	status := PlayerStatusLeave
	for _, p := range room.Players {
		if p.UserID == room.OwnerUserID {
			status = p.Status
			break
		}
	}
	return &RoomOwnerResp{
		UserID:    room.OwnerUserID,
		Nickname:  nickname,
		AvatarURL: avatar,
		Status:    status,
	}, nil
}

func (r *Repository) GetRoomPlayers(roomNumber string) ([]RoomPlayerResp, error) {
	roomStoreMu.Lock()
	defer roomStoreMu.Unlock()

	room, ok := roomStore[roomNumber]
	if !ok {
		return nil, ErrRoomNotFound
	}
	pruneRoomPlayers(room, nowUnix())
	syncAccountBalancesFromDB(room)
	out := make([]RoomPlayerResp, 0, len(room.Players))
	for _, p := range room.Players {
		out = append(out, RoomPlayerResp{
			UserID:         p.UserID,
			Nickname:       p.Nickname,
			AvatarURL:      p.AvatarURL,
			SeatIndex:      p.SeatIndex,
			IsOwner:        p.IsOwner,
			Status:         p.Status,
			Wallet:         p.Wallet,
			AccountBalance: p.AccountBalance,
		})
	}
	return out, nil
}

// DissolveRoom 房主手动解散房间，从内存中移除；不会在人走空时自动调用。
func (r *Repository) DissolveRoom(roomNumber, userID string) error {
	roomStoreMu.Lock()
	defer roomStoreMu.Unlock()
	room, ok := roomStore[roomNumber]
	if !ok {
		return ErrRoomNotFound
	}
	if room.OwnerUserID != userID {
		return ErrNotRoomOwner
	}
	for i := range room.Players {
		_ = refundSeatStackToDB(&room.Players[i])
	}
	delete(roomStore, roomNumber)
	return nil
}

func paginateRooms(all []RoomStateResp, pageNo, pageSize int) ([]RoomStateResp, int) {
	total := len(all)
	sort.Slice(all, func(i, j int) bool {
		return all[i].CreatedAt > all[j].CreatedAt
	})
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageNo <= 0 {
		pageNo = 1
	}
	start := (pageNo - 1) * pageSize
	if start >= len(all) {
		return []RoomStateResp{}, total
	}
	end := start + pageSize
	if end > len(all) {
		end = len(all)
	}
	return all[start:end], total
}

func (r *Repository) GetPublicRoomList(pageNo, pageSize int) ([]RoomStateResp, int) {
	roomStoreMu.Lock()
	defer roomStoreMu.Unlock()

	all := make([]RoomStateResp, 0, len(roomStore))
	now := nowUnix()
	for _, room := range roomStore {
		if room.RoomType != "public" {
			continue
		}
		pruneRoomPlayers(room, now)
		updateStartCountdownLocked(room, now)
		rs := toRoomStateResp(room)
		maskRoomStateHoleCards(&rs, "")
		all = append(all, rs)
	}
	return paginateRooms(all, pageNo, pageSize)
}

func (r *Repository) GetJoinedRoomList(userID string, pageNo, pageSize int) ([]RoomStateResp, int) {
	roomStoreMu.Lock()
	defer roomStoreMu.Unlock()

	all := make([]RoomStateResp, 0, len(roomStore))
	now := nowUnix()
	for _, room := range roomStore {
		pruneRoomPlayers(room, now)
		found := false
		for i := range room.Players {
			if sameUserID(room.Players[i].UserID, userID) {
				found = true
				break
			}
		}
		if !found {
			continue
		}
		updateStartCountdownLocked(room, now)
		rs := toRoomStateResp(room)
		maskRoomStateHoleCards(&rs, userID)
		all = append(all, rs)
	}
	return paginateRooms(all, pageNo, pageSize)
}
