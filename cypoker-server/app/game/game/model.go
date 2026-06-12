package game

import "time"

// RoomStatus 房间状态
type RoomStatus string

const (
	RoomStatusNotActivated RoomStatus = "not_activated"
	RoomStatusOpen         RoomStatus = "open"
	RoomStatusClose        RoomStatus = "close"
	RoomStatusPlaying      RoomStatus = "playing"
	RoomStatusEnded        RoomStatus = "ended"
)

// PlayerStatus 玩家状态
type PlayerStatus string

const (
	PlayerStatusLeave    PlayerStatus = "leave"
	PlayerStatusBusy     PlayerStatus = "busy"
	PlayerStatusSitDown  PlayerStatus = "sit_down"
	PlayerStatusReady    PlayerStatus = "ready"
	PlayerStatusSpeaking PlayerStatus = "speaking"
	PlayerStatusWaiting  PlayerStatus = "waiting"
)

// PlayerSeat 房间座位上的玩家快照
type PlayerSeat struct {
	UserID    string       `json:"user_id"`
	Nickname  string       `json:"nickname"`
	AvatarURL string       `json:"avatar_url"`
	SeatIndex int          `json:"seat_index"`
	IsOwner   bool         `json:"is_owner"`
	Status    PlayerStatus `json:"status"`
	Cards     []int        `json:"cards"`
	// Wallet 桌上筹码（现金桌 stack）；账外余额见 AccountBalance（来自 game_users.wallet）。
	Wallet              float64 `json:"wallet"`
	AccountBalance      float64 `json:"account_balance"`
	CurrentBet          float64 `json:"current_bet"`
	ContributedThisHand float64 `json:"contributed_this_hand"`
	// AllInHand 本手已无剩余可下注筹码（与 wallet==0 对齐；新开街后仍应跳过行动轮）
	AllInHand    bool         `json:"all_in_hand"`
	Folded       bool         `json:"folded"`
	Offline      bool         `json:"offline"`
	OfflineAt    int64        `json:"offline_at"`
	ResumeStatus PlayerStatus `json:"-"`
	JoinAt       int64        `json:"join_at"`
	LastUpdateAt int64        `json:"last_update_at"`
}

// PotState 奖池状态（Total 为桌中筹码合计；MainPot/SidePot 为按贡献拆分的主池与边池展示）
type PotState struct {
	MainPot float64 `json:"main_pot"`
	SidePot float64 `json:"side_pot"`
	Total   float64 `json:"total"`
}

// ActionState 当前行动状态
type ActionState struct {
	CurrentTurnUserID string  `json:"current_turn_user_id"`
	DeadlineAt        int64   `json:"deadline_at"`
	LastAction        string  `json:"last_action"`
	LastActionUserID  string  `json:"last_action_user_id"`
	LastActionAmount  float64 `json:"last_action_amount"`
}

// LastHandPayout 上一手结算派奖一行（供客户端弹窗展示）
type LastHandPayout struct {
	UserID    string  `json:"user_id"`
	Nickname  string  `json:"nickname"`
	Amount    float64 `json:"amount"`
	HoleCards []int   `json:"hole_cards,omitempty"` // 摊牌/弃牌赢时该玩家底牌编码 suit*100+rank，仅结算展示
}

// LastHandLayer 上一手按主池/边池分层的派奖明细（税后实际入账桌上筹码）
type LastHandLayer struct {
	Tier    int              `json:"tier"` // 0 主池，1 起依次为边池
	Amount  float64          `json:"amount"`
	Payouts []LastHandPayout `json:"payouts,omitempty"`
}

// ShowdownBestHand 摊牌时该座位在 7 张中选出的最优 5 张组合及牌型（便于全员对照）
type ShowdownBestHand struct {
	UserID       string `json:"user_id"`
	Nickname     string `json:"nickname"`
	SeatIndex    int    `json:"seat_index"`
	BestFive     []int  `json:"best_five"`
	HandCategory string `json:"hand_category"`
}

// PlayerHandAction 本手玩家操作流水（仅服务端用于历史明细，不直接下发房态）。
type PlayerHandAction struct {
	UserID       string  `json:"user_id"`
	Stage        string  `json:"stage"`
	Action       string  `json:"action"`
	Amount       float64 `json:"amount"`
	ActionAtUnix int64   `json:"action_at_unix"`
}

// RoundState 本局状态
type RoundState struct {
	HandNo           int         `json:"hand_no"`
	HandStartedAt    int64       `json:"hand_started_at"`
	Stage            string      `json:"stage"`
	DealerSeatIndex  int         `json:"dealer_seat_index"`
	SmallBlindAmount float64     `json:"small_blind_amount"`
	BigBlindAmount   float64     `json:"big_blind_amount"`
	CommunityCards   []int       `json:"community_cards"` // 已翻开给客户端的公共牌，未翻开为 0
	communityDeck    []int       `json:"-"`               // 本手五张公共牌真值，仅服务端比牌/发牌用，永不下发
	Pot              PotState    `json:"pot"`
	Action           ActionState `json:"action"`
	// LastRaiseSize 当前街最小再加注的参照增量（首街初始为大盲实扣额；短码全下未抬高时可不变）。
	LastRaiseSize float64 `json:"last_raise_size"`
	// ShowdownRevealUserIDs 摊牌阶段对全员公开底牌的玩家（下一手开局清空）。
	ShowdownRevealUserIDs []string `json:"showdown_reveal_user_ids"`
	// ShowdownBestHands 摊牌结算时各未弃牌座位的最佳 5 张与牌型（下一手 startGameLocked 清空）
	ShowdownBestHands []ShowdownBestHand `json:"showdown_best_hands,omitempty"`
	// HandActionLog 本手每位玩家操作记录（仅历史持久化使用）。
	HandActionLog []PlayerHandAction `json:"-"`
	// 上一手结算摘要（下一手 startGameLocked 清空）
	LastHandKind     string           `json:"last_hand_kind,omitempty"`
	LastHandPotTotal float64          `json:"last_hand_pot_total"`
	LastHandRake     float64          `json:"last_hand_rake"`
	LastHandPayouts  []LastHandPayout `json:"last_hand_payouts,omitempty"`
	LastHandLayers   []LastHandLayer  `json:"last_hand_layers,omitempty"`
}

// Room 房间聚合根（后端真源）
type Room struct {
	RoomNumber        string       `json:"room_number"`
	OwnerUserID       string       `json:"owner_user_id"`
	RoomType          string       `json:"room_type"`
	Status            RoomStatus   `json:"status"`
	MaxPlayers        int          `json:"max_players"`
	MaxWatchers       int          `json:"max_watchers"`
	LeaveTimeout      int          `json:"leave_timeout"`
	ActionTimeout     int          `json:"action_timeout"`
	OwnerCommission   float64      `json:"owner_commission"`
	SmallBlind        float64      `json:"small_blind"`
	Ante              float64      `json:"ante"`
	MaxBuyIn          float64      `json:"max_buy_in"`
	MinBuyIn          float64      `json:"min_buy_in"`
	AllowWatch        bool         `json:"allow_watch"`
	MaxRounds         int          `json:"max_rounds"`
	CreatedAt         int64        `json:"created_at"`
	UpdatedAt         int64        `json:"updated_at"`
	Players           []PlayerSeat `json:"players"`
	Watchers          []string     `json:"watchers"`
	Round             RoundState   `json:"round"`
	CountdownReadyKey string       `json:"-"`
	// 本手牌下注引擎（内存态，不序列化到房态 JSON）
	BettingMaxStreet float64      `json:"-"`
	BettingActed     map[int]bool `json:"-"` // seatIndex -> 本轮是否已作出闭式行动（跟/弃/过牌/加注）
}

func nowUnix() int64 {
	return time.Now().Unix()
}

func nowUnixMilli() int64 {
	return time.Now().UnixMilli()
}
