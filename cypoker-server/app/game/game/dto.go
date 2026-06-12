package game

import (
	"errors"
	"net/http"
	"star"
	"strings"
)

type CreateRoomReq struct {
	RoomType        string  `json:"room_type"`
	MaxPlayers      int     `json:"max_players"`
	MaxWatchers     int     `json:"max_watchers"`
	LeaveTimeout    int     `json:"leave_timeout"`
	ActionTimeout   int     `json:"action_timeout"`
	OwnerCommission float64 `json:"owner_commission"`
	SmallBlind      float64 `json:"small_blind"`
	Ante            float64 `json:"ante"`
	MaxBuyIn        float64 `json:"max_buy_in"`
	MinBuyIn        float64 `json:"min_buy_in"`
	AllowWatch      bool    `json:"allow_watch"`
	MaxRounds       int     `json:"max_rounds"`
}

func (d *CreateRoomReq) Validate(ctx *star.Context) error {
	if d.MaxPlayers < 2 || d.MaxPlayers > 10 {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	if d.MaxWatchers < 0 {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	if d.LeaveTimeout <= 0 || d.ActionTimeout <= 0 {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	if d.SmallBlind < 0 || d.Ante < 0 || d.MinBuyIn < 0 || d.MaxBuyIn < 0 {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	if d.MaxBuyIn > 0 && d.MinBuyIn > d.MaxBuyIn {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	if d.MaxRounds <= 0 {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	if strings.TrimSpace(d.RoomType) == "" {
		d.RoomType = "private"
	}
	return nil
}

type CreateRoomResp struct {
	Room      RoomStateResp `json:"room"`
	CreatedBy string        `json:"created_by"`
}

type JoinRoomReq struct {
	RoomNumber string `json:"room_number"`
}

func (d *JoinRoomReq) Validate(ctx *star.Context) error {
	if strings.TrimSpace(d.RoomNumber) == "" {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	return nil
}

type JoinRoomResp struct {
	Room   RoomStateResp `json:"room"`
	Joined bool          `json:"joined"`
}

type GetRoomStateReq struct {
	RoomNumber string `json:"room_number"`
}

func (d *GetRoomStateReq) Validate(ctx *star.Context) error {
	if strings.TrimSpace(d.RoomNumber) == "" {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	return nil
}

type GetMyRoomsReq struct {
	PageNo   int `json:"page_no"`
	PageSize int `json:"page_size"`
}

func (d *GetMyRoomsReq) Validate(ctx *star.Context) error {
	if d.PageNo < 1 {
		d.PageNo = 1
	}
	if d.PageSize < 1 {
		d.PageSize = 20
	}
	return nil
}

type GetGameHistoryReq struct {
	PageNo   int `json:"page_no"`
	PageSize int `json:"page_size"`
}

func (d *GetGameHistoryReq) Validate(ctx *star.Context) error {
	if d.PageNo < 1 {
		d.PageNo = 1
	}
	if d.PageSize < 1 {
		d.PageSize = 20
	}
	return nil
}

type GameHistoryResp struct {
	RoomNumber     string                  `json:"room_number"`
	HandNo         int                     `json:"hand_no"`
	Kind           string                  `json:"kind"`
	CommunityCards []int                   `json:"community_cards,omitempty"`
	StartedAtUnix  int64                   `json:"started_at_unix"`
	EndedAtUnix    int64                   `json:"ended_at_unix"`
	DurationSec    int64                   `json:"duration_sec"`
	PotTotal       float64                 `json:"pot_total"`
	Rake           float64                 `json:"rake"`
	SmallBlind     float64                 `json:"small_blind"`
	Owner          GameHistoryOwnerResp    `json:"owner"`
	Payouts        []LastHandPayout        `json:"payouts,omitempty"`
	Pot            PotState                `json:"pot"`
	Layers         []LastHandLayer         `json:"layers,omitempty"`
	Players        []GameHistoryPlayerResp `json:"players,omitempty"`
	SettledAtUnix  int64                   `json:"settled_at_unix"`
}

type GameHistoryOwnerResp struct {
	UserID    string `json:"user_id"`
	Nickname  string `json:"nickname"`
	AvatarURL string `json:"avatar_url"`
}

type GameHistoryPlayerResp struct {
	UserID              string                  `json:"user_id"`
	Nickname            string                  `json:"nickname"`
	AvatarURL           string                  `json:"avatar_url"`
	SeatIndex           int                     `json:"seat_index"`
	SeatRole            string                  `json:"seat_role"`
	ContributedThisHand float64                 `json:"contributed_this_hand"`
	CurrentBet          float64                 `json:"current_bet"`
	WonAmount           float64                 `json:"won_amount"`
	ProfitLoss          float64                 `json:"profit_loss"`
	IsWinner            bool                    `json:"is_winner"`
	Actions             []GameHistoryActionResp `json:"actions,omitempty"`
	BestFive            []int                   `json:"best_five,omitempty"`
	HoleCards           []int                   `json:"hole_cards,omitempty"`
}

type GameHistoryActionResp struct {
	Stage        string  `json:"stage"`
	Action       string  `json:"action"`
	Amount       float64 `json:"amount"`
	ActionAtUnix int64   `json:"action_at_unix"`
}

type ActionReq struct {
	RoomNumber string  `json:"room_number"`
	Action     string  `json:"action"`
	Amount     float64 `json:"amount"`
}

func (d *ActionReq) Validate(ctx *star.Context) error {
	if strings.TrimSpace(d.RoomNumber) == "" || strings.TrimSpace(d.Action) == "" {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	if d.Amount < 0 {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	return nil
}

type ActionResp struct {
	Accepted bool   `json:"accepted"`
	Message  string `json:"message"`
}

type RoomOwnerResp struct {
	UserID    string       `json:"user_id"`
	Nickname  string       `json:"nickname"`
	AvatarURL string       `json:"avatar_url"`
	Status    PlayerStatus `json:"status"`
}

type RoomPlayerResp struct {
	UserID         string       `json:"user_id"`
	Nickname       string       `json:"nickname"`
	AvatarURL      string       `json:"avatar_url"`
	SeatIndex      int          `json:"seat_index"`
	IsOwner        bool         `json:"is_owner"`
	Status         PlayerStatus `json:"status"`
	Wallet         float64      `json:"wallet"`
	AccountBalance float64      `json:"account_balance"`
}

type SeatRoleResp struct {
	SeatIndex int    `json:"seat_index"`
	Role      string `json:"role"`
}

type PrepareEventData struct {
	DealerSeatIndex int            `json:"dealer_seat_index"`
	SeatRoles       []SeatRoleResp `json:"seat_roles"`
}

type RoomEvent struct {
	Type  string `json:"type"`
	Event string `json:"event"`
	Data  any    `json:"data"`
}

type LeaveEventData struct {
	SeatIndex int    `json:"seat_index,omitempty"`
	Role      string `json:"role"`
	UserID    string `json:"user_id"`
}

// RecoverEventData 玩家在游戏进行中重连时，服务端通过 WS 向该玩家推送的恢复事件。
// 包含其原始座位、手牌、筹码等信息，以及当前遮罩后的房间快照，前端据此还原 UI。
type RecoverEventData struct {
	SeatIndex    int     `json:"seat_index"`
	Cards        []int   `json:"cards"`
	Wallet       float64 `json:"wallet"`
	CurrentBet   float64 `json:"current_bet"`
	Folded       bool    `json:"folded"`
	AllInHand    bool    `json:"all_in_hand"`
	RoomState    RoomStateResp `json:"room_state"`
}

type GameOverWinnerResp struct {
	UserID       string  `json:"user_id"`
	Nickname     string  `json:"nickname"`
	SeatIndex    int     `json:"seat_index"`
	Amount       float64 `json:"amount"`
	HoleCards    []int   `json:"hole_cards,omitempty"`
	BestFive     []int   `json:"best_five,omitempty"`
	HandCategory string  `json:"hand_category,omitempty"`
}

type GameOverEventData struct {
	Kind              string               `json:"kind"`
	PotTotal          float64              `json:"pot_total"`
	Rake              float64              `json:"rake"`
	Payouts           []LastHandPayout     `json:"payouts,omitempty"`
	Layers            []LastHandLayer      `json:"layers,omitempty"`
	Winners           []GameOverWinnerResp `json:"winners"`
	ShowdownBestHands []ShowdownBestHand   `json:"showdown_best_hands,omitempty"`
}

type RoomStateResp struct {
	RoomNumber      string       `json:"room_number"`
	Owner           string       `json:"owner"`
	OwnerUserID     string       `json:"owner_user_id"`
	ServerNow       int64        `json:"server_now"`
	RoomType        string       `json:"room_type"`
	Status          RoomStatus   `json:"status"`
	MaxPlayers      int          `json:"max_players"`
	MaxWatchers     int          `json:"max_watchers"`
	LeaveTimeout    int          `json:"leave_timeout"`
	ActionTimeout   int          `json:"action_timeout"`
	OwnerCommission float64      `json:"owner_commission"`
	SmallBlind      float64      `json:"small_blind"`
	Ante            float64      `json:"ante"`
	MaxBuyIn        float64      `json:"max_buy_in"`
	MinBuyIn        float64      `json:"min_buy_in"`
	AllowWatch      bool         `json:"allow_watch"`
	MaxRounds       int          `json:"max_rounds"`
	CreatedAt       int64        `json:"created_at"`
	Players         []PlayerSeat `json:"players"`
	Watchers        []string     `json:"watchers"`
	Round           RoundState   `json:"round"`
	Events          []RoomEvent  `json:"-"`
}

var ErrRoomNotFound = errors.New("ROOM_NOT_FOUND")
var ErrRoomAlreadyJoined = errors.New("ROOM_ALREADY_JOINED")
var ErrRoomFull = errors.New("ROOM_IS_FULL")
var ErrNotRoomOwner = errors.New("NOT_ROOM_OWNER")
